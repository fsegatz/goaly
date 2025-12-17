// src/domain/goal-service.js

/**
 * @module GoalService
 * @description Core service for managing goals including CRUD operations,
 * status transitions, priority calculations, and auto-activation logic.
 */

import createGoal from '../models/goal.js';
import { prepareGoalsStoragePayload } from '../migration/migration-service.js';
import { STORAGE_KEY_GOALS, DEADLINE_BONUS_DAYS } from '../utils/constants.js';
import { PriorityCacheManager } from '../priority-cache-manager.js';
import { setToMidnight, normalizeDate } from '../utils/date-utils.js';

/** @typedef {Object} ErrorHandler */

/**
 * Parse a date string in local timezone to avoid off-by-one-day errors.
 * @param {string|Date|null} value - The date value to parse
 * @returns {Date|null}
 * @private
 */
function parseLocalDate(value) {
    if (!value) {
        return null;
    }
    if (typeof value === 'string' && !value.includes('T')) {
        return new Date(value + 'T00:00:00');
    }
    return new Date(value);
}

/**
 * Service for managing goals and their lifecycle.
 * Handles persistence, priority-based activation, and pause functionality.
 * @class
 */
class GoalService {
    /**
     * Create a new GoalService instance.
     * @param {Array} [goals=[]] - Initial goals array
     * @param {ErrorHandler} [errorHandler=null] - Error handler for logging
     */
    constructor(goals = [], errorHandler = null) {
        this.goals = goals.map(g => createGoal(g));
        this._listeners = { afterSave: [] };
        this.errorHandler = errorHandler;
        this.priorityCache = new PriorityCacheManager(this);
    }

    onAfterSave(listener) {
        if (typeof listener === 'function') {
            this._listeners.afterSave.push(listener);
        }
    }

    _notifyAfterSave() {
        const listeners = this._listeners?.afterSave || [];
        for (const fn of listeners) {
            try {
                fn();
            } catch (error) {
                // Log and continue so one faulty listener does not break others
                if (this.errorHandler) {
                    this.errorHandler.warning('errors.generic', { message: 'GoalService afterSave listener error' }, error, { context: 'afterSaveListener' });
                } else {
                    console.error('GoalService afterSave listener error', error);
                }
            }
        }
    }

    loadGoals() {
        const saved = localStorage.getItem(STORAGE_KEY_GOALS);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    this.goals = parsed.map(goal => createGoal(goal));
                    this.priorityCache.invalidate();
                    this.saveGoals();
                    return;
                }
                if (parsed && Array.isArray(parsed.goals)) {
                    this.goals = parsed.goals.map(goal => createGoal(goal));
                    this.priorityCache.invalidate();
                    if (!parsed.version) {
                        this.saveGoals();
                    }
                }
            } catch (error) {
                if (this.errorHandler) {
                    this.errorHandler.error('errors.generic', { message: 'Failed to load goals from storage' }, error, { context: 'loadGoals' });
                } else {
                    console.error('Failed to load goals from storage', error);
                }
            }
        }
    }

    /**
     * Migrates existing goals by automatically activating the top N goals by priority.
     * Call this during app start to migrate previously manually activated goals.
     * @param {number} maxActiveGoals - Maximum number of active goals
     */
    migrateGoalsToAutoActivation(maxActiveGoals) {
        if (this.goals.length === 0) return;

        // Automatically activate the top N goals by priority
        this.autoActivateGoalsByPriority(maxActiveGoals);
    }

    saveGoals() {
        const payload = prepareGoalsStoragePayload(this.goals);
        localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(payload));
        this._notifyAfterSave();
    }


    handleStatusTransition(goal, newStatus) {
        if (goal.status === newStatus) {
            return;
        }
        goal.status = newStatus;
        // Clear pause metadata when transitioning to active status
        if (newStatus === 'active') {
            goal.pauseUntil = null;
            goal.pauseUntilGoalId = null;
        }
        goal.lastUpdated = new Date();
    }

    setGoalStatus(id, newStatus, maxActiveGoals) {
        const goal = this.goals.find(g => g.id === id);
        if (!goal) {
            return null;
        }

        const previousStatus = goal.status;
        this.handleStatusTransition(goal, newStatus);

        if (goal.status === previousStatus) {
            return goal;
        }

        const effectiveLimit = Number.isFinite(maxActiveGoals) && maxActiveGoals > 0
            ? maxActiveGoals
            : this.goals.length;

        if (previousStatus === 'active' || newStatus === 'active') {
            this.autoActivateGoalsByPriority(effectiveLimit);
        } else {
            this.saveGoals();
        }

        // Status changes may affect priority (e.g., deadline calculations)
        this.priorityCache.invalidate();

        return goal;
    }

    createGoal(goalData, maxActiveGoals) {
        // Status is determined automatically rather than set manually
        const goal = createGoal({ ...goalData, status: 'inactive' }); // Temporarily set to inactive
        this.goals.push(goal);
        this.priorityCache.invalidate();

        // Automatically activate the top N goals by priority
        this.autoActivateGoalsByPriority(maxActiveGoals);

        return goal;
    }

    /**
     * Update title field if changed
     * @private
     */
    _updateTitle(goal, goalData, updates) {
        if (goalData.title !== undefined && goalData.title !== goal.title) {
            updates.title = goalData.title;
        }
    }

    /**
     * Update motivation field if changed
     * @private
     */
    _updateMotivation(goal, goalData, updates) {
        if (goalData.motivation !== undefined) {
            const parsedMotivation = Number.parseInt(goalData.motivation, 10);
            if (parsedMotivation !== goal.motivation) {
                updates.motivation = parsedMotivation;
                return true; // Priority changed
            }
        }
        return false;
    }

    /**
     * Update urgency field if changed
     * @private
     */
    _updateUrgency(goal, goalData, updates) {
        if (goalData.urgency !== undefined) {
            const parsedUrgency = Number.parseInt(goalData.urgency, 10);
            if (parsedUrgency !== goal.urgency) {
                updates.urgency = parsedUrgency;
                return true; // Priority changed
            }
        }
        return false;
    }

    /**
     * Update deadline field if changed
     * @private
     */
    _updateDeadline(goal, goalData, updates) {
        if (goalData.deadline !== undefined) {
            const newDeadline = parseLocalDate(goalData.deadline);
            const currentTime = goal.deadline instanceof Date ? goal.deadline.getTime() : null;
            const newTime = newDeadline instanceof Date ? newDeadline.getTime() : null;
            if (currentTime !== newTime) {
                updates.deadline = newDeadline;
                return true; // Priority changed
            }
        }
        return false;
    }

    /**
     * Update recurring goal fields
     * @private
     */
    _updateRecurringFields(goalData, updates) {
        if (goalData.isRecurring !== undefined) {
            updates.isRecurring = Boolean(goalData.isRecurring);
        }
        if (goalData.recurPeriod !== undefined) {
            updates.recurPeriod = Number.isInteger(goalData.recurPeriod) && goalData.recurPeriod > 0
                ? goalData.recurPeriod
                : 7;
        }
        if (goalData.recurPeriodUnit !== undefined) {
            updates.recurPeriodUnit = ['days', 'weeks', 'months'].includes(goalData.recurPeriodUnit)
                ? goalData.recurPeriodUnit
                : 'days';
        }
    }

    updateGoal(id, goalData, maxActiveGoals) {
        const goal = this.goals.find(g => g.id === id);
        if (!goal) return null;

        const updates = {};
        let priorityChanged = false;

        // Update basic fields
        this._updateTitle(goal, goalData, updates);
        priorityChanged = this._updateMotivation(goal, goalData, updates) || priorityChanged;
        priorityChanged = this._updateUrgency(goal, goalData, updates) || priorityChanged;
        priorityChanged = this._updateDeadline(goal, goalData, updates) || priorityChanged;

        // Update steps and resources
        if (goalData.steps !== undefined) {
            updates.steps = Array.isArray(goalData.steps) ? goalData.steps : [];
        }
        if (goalData.resources !== undefined) {
            updates.resources = Array.isArray(goalData.resources) ? goalData.resources : [];
        }

        // Update recurring goal fields
        this._updateRecurringFields(goalData, updates);

        if (Object.keys(updates).length === 0) {
            return goal;
        }

        updates.lastUpdated = new Date();
        Object.assign(goal, updates);

        // Invalidate cache when goal is updated (priority may have changed)
        this.priorityCache.invalidate();

        // Automatically re-activate goals if the priority changed
        if (priorityChanged) {
            this.autoActivateGoalsByPriority(maxActiveGoals);
        } else {
            this.saveGoals();
        }

        return goal;
    }


    deleteGoal(id, maxActiveGoals) {
        const wasActive = this.goals.find(g => g.id === id)?.status === 'active';
        this.goals = this.goals.filter(g => g.id !== id);
        this.priorityCache.invalidate();

        // Automatically re-activate goals if an active goal was deleted
        if (wasActive) {
            this.autoActivateGoalsByPriority(maxActiveGoals);
        } else {
            this.saveGoals();
        }
    }

    calculatePriority(goal) {
        let priority = goal.motivation + (goal.urgency * 10);

        if (goal.deadline) {
            const now = new Date();
            const deadlineDate = normalizeDate(goal.deadline);
            if (deadlineDate) {
                const daysUntilDeadline = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                if (daysUntilDeadline > DEADLINE_BONUS_DAYS) {
                    priority += 0;
                } else {
                    const bonus = Math.max(0, DEADLINE_BONUS_DAYS - daysUntilDeadline);
                    priority += bonus;
                }
            }
        }

        return priority;
    }

    getActiveGoals() {
        return this.goals
            .filter(g => g.status === 'active' && !this.isGoalPaused(g))
            .sort((a, b) => this.calculatePriority(b) - this.calculatePriority(a));
    }

    /**
     * Check if a goal is currently paused (either by date or goal dependency)
     * This method does NOT modify the goal - use checkAndClearPauseConditions to clear expired pauses
     * @param {Goal} goal - The goal to check
     * @returns {boolean} - True if the goal is paused
     */
    isGoalPaused(goal) {
        if (!goal) {
            return false;
        }

        // Check date-based pause
        if (goal.pauseUntil) {
            const now = setToMidnight(new Date());
            const pauseUntil = setToMidnight(goal.pauseUntil);
            if (pauseUntil > now) {
                return true;
            }
        }

        // Check goal dependency pause
        if (goal.pauseUntilGoalId) {
            const dependencyGoal = this.goals.find(g => g.id === goal.pauseUntilGoalId);
            if (dependencyGoal && dependencyGoal.status !== 'completed') {
                return true;
            }
        }

        return false;
    }

    /**
     * Pause a goal until a specific date or until another goal is completed
     * @param {string} goalId - The ID of the goal to pause
     * @param {Object} pauseData - Object with pauseUntil (Date) or pauseUntilGoalId (string)
     * @param {number} maxActiveGoals - Maximum number of active goals
     * @returns {Goal|null} - The paused goal or null if not found
     */
    pauseGoal(goalId, pauseData, maxActiveGoals) {
        const goal = this.goals.find(g => g.id === goalId);
        if (!goal) {
            return null;
        }

        // Set pause metadata
        goal.pauseUntil = pauseData.pauseUntil || null;
        goal.pauseUntilGoalId = pauseData.pauseUntilGoalId || null;
        goal.lastUpdated = new Date();

        // If goal is active and should be paused, change status to paused
        if (goal.status === 'active' && this.isGoalPaused(goal)) {
            this.handleStatusTransition(goal, 'paused');
        }

        this.priorityCache.invalidate();

        // Re-activate goals to fill the slot if needed
        this.autoActivateGoalsByPriority(maxActiveGoals);

        return goal;
    }

    /**
     * Unpause a goal (clear pause metadata)
     * @param {string} goalId - The ID of the goal to unpause
     * @param {number} maxActiveGoals - Maximum number of active goals
     * @returns {Goal|null} - The unpaused goal or null if not found
     */
    unpauseGoal(goalId, maxActiveGoals) {
        const goal = this.goals.find(g => g.id === goalId);
        if (!goal) {
            return null;
        }

        // Clear pause metadata
        goal.pauseUntil = null;
        goal.pauseUntilGoalId = null;
        goal.lastUpdated = new Date();

        this.priorityCache.invalidate();

        // Re-activate goals based on priority
        this.autoActivateGoalsByPriority(maxActiveGoals);

        return goal;
    }

    /**
     * Check and clear expired pause conditions
     * @private
     */
    _checkExpiredPauses() {
        this.checkAndClearPauseConditions();
    }

    /**
     * Get goals eligible for activation (excluding completed, notCompleted, and manually paused goals)
     * @param {Set<string>} ineligibleStatuses - Set of statuses that are not eligible
     * @returns {Goal[]} - Array of eligible goals sorted by priority
     * @private
     */
    _getEligibleGoalsForActivation(ineligibleStatuses) {
        return this.goals
            .filter(g => {
                if (ineligibleStatuses.has(g.status)) {
                    return false;
                }
                // Exclude goals that are manually paused (they should have status 'paused')
                if (this.isGoalPaused(g)) {
                    return false;
                }
                // If goal has old 'paused' status but is not manually paused, migrate it to 'inactive'
                if (g.status === 'paused') {
                    this.handleStatusTransition(g, 'inactive');
                }
                return true;
            })
            .sort((a, b) => {
                // Force-activated goals should be sorted first (to preserve them)
                if (a.forceActivated && !b.forceActivated) return -1;
                if (!a.forceActivated && b.forceActivated) return 1;

                const priorityA = this.calculatePriority(a);
                const priorityB = this.calculatePriority(b);
                // Prefer older goals when priorities tie to keep sorting stable
                if (priorityA === priorityB) {
                    return a.createdAt - b.createdAt;
                }
                return priorityB - priorityA;
            });
    }

    /**
     * Activate the top N goals by priority
     * @param {Goal[]} eligibleGoals - Goals eligible for activation, sorted by priority
     * @param {number} maxActiveGoals - Maximum number of active goals
     * @private
     */
    _activateTopPriorityGoals(eligibleGoals, maxActiveGoals) {
        // Separate force-activated goals from others
        const forceActivatedGoals = this.goals.filter(g => g.status === 'active' && g.forceActivated);
        const forceActivatedCount = forceActivatedGoals.length;

        // Calculate how many slots are available for priority-based activation
        const availableSlots = Math.max(0, maxActiveGoals - forceActivatedCount);

        // Get goals to activate by priority (excluding force-activated ones)
        const goalsToActivate = eligibleGoals
            .filter(g => !g.forceActivated)
            .slice(0, availableSlots);
        const goalsToInactivate = eligibleGoals
            .filter(g => !g.forceActivated)
            .slice(availableSlots);

        // Update status
        goalsToActivate.forEach(goal => {
            if (goal.status !== 'active') {
                this.handleStatusTransition(goal, 'active');
            }
        });

        // Set goals to inactive (not active due to priority limits)
        goalsToInactivate.forEach(goal => {
            // Only set to inactive if not manually paused
            if (!this.isGoalPaused(goal) && goal.status !== 'inactive') {
                this.handleStatusTransition(goal, 'inactive');
            }
        });
    }

    /**
     * Validate that manually paused goals have the correct 'paused' status
     * @param {Set<string>} ineligibleStatuses - Set of statuses that are not eligible
     * @private
     */
    _validatePausedGoals(ineligibleStatuses) {
        this.goals.forEach(goal => {
            if (!ineligibleStatuses.has(goal.status) && this.isGoalPaused(goal) && goal.status !== 'paused') {
                this.handleStatusTransition(goal, 'paused');
            }
        });
    }

    /**
     * Automatically activates the top N goals with the highest priority.
     * All other non-completed goals are paused.
     * Excludes goals that are manually paused (by date or goal dependency).
     * @param {number} maxActiveGoals - Maximum number of active goals
     */
    autoActivateGoalsByPriority(maxActiveGoals) {
        // Check and clear expired pause conditions
        this._checkExpiredPauses();

        // Sort all non-completed goals by priority, excluding manually paused goals
        const ineligibleStatuses = new Set(['completed', 'notCompleted']);
        const eligibleGoals = this._getEligibleGoalsForActivation(ineligibleStatuses);

        // Activate the top N goals by priority
        this._activateTopPriorityGoals(eligibleGoals, maxActiveGoals);

        // Ensure manually paused goals have status 'paused'
        this._validatePausedGoals(ineligibleStatuses);

        this.priorityCache.invalidate();
        this.saveGoals();
    }

    /**
     * Check and clear expired pause conditions
     */
    checkAndClearPauseConditions() {
        const now = setToMidnight(new Date());
        let anyChanged = false;

        this.goals.forEach(goal => {
            let changed = false;

            // Clear expired date-based pauses
            if (goal.pauseUntil) {
                const pauseUntil = setToMidnight(goal.pauseUntil);
                if (pauseUntil <= now) {
                    goal.pauseUntil = null;
                    changed = true;
                    anyChanged = true;
                }
            }

            // Clear goal dependency pauses if dependency is completed
            if (goal.pauseUntilGoalId) {
                const dependencyGoal = this.goals.find(g => g.id === goal.pauseUntilGoalId);
                if (!dependencyGoal || dependencyGoal.status === 'completed') {
                    goal.pauseUntilGoalId = null;
                    changed = true;
                    anyChanged = true;
                }
            }

            if (changed) {
                goal.lastUpdated = new Date();
            }
        });

        // Invalidate cache if any pause conditions were cleared (may affect priority)
        if (anyChanged) {
            this.priorityCache.invalidate();
        }
    }

    /**
     * Force-activate a goal regardless of priority
     * Deactivates the lowest-priority active goal if needed to maintain maxActiveGoals limit
     * @param {string} goalId - The ID of the goal to force-activate
     * @param {number} maxActiveGoals - Maximum number of active goals
     * @returns {Goal|null} - The force-activated goal or null if not found
     */
    forceActivateGoal(goalId, maxActiveGoals) {
        const goal = this.goals.find(g => g.id === goalId);
        if (!goal) {
            return null;
        }

        // Cannot force-activate completed or notCompleted goals
        if (goal.status === 'completed' || goal.status === 'notCompleted') {
            return null;
        }

        // Clear pause metadata if goal is paused
        if (goal.pauseUntil || goal.pauseUntilGoalId) {
            goal.pauseUntil = null;
            goal.pauseUntilGoalId = null;
        }

        // Mark as force-activated and activate
        goal.forceActivated = true;
        this.handleStatusTransition(goal, 'active');
        goal.lastUpdated = new Date();

        // Get current active goals (excluding the one we just force-activated)
        const activeGoals = this.goals
            .filter(g => g.status === 'active' && g.id !== goalId && !this.isGoalPaused(g))
            .map(g => ({
                goal: g,
                priority: this.calculatePriority(g)
            }))
            .sort((a, b) => {
                // Sort by priority, then by creation date for stability
                if (a.priority !== b.priority) {
                    return a.priority - b.priority; // Lower priority first (to deactivate)
                }
                return b.goal.createdAt - a.goal.createdAt; // Newer first (to deactivate)
            });

        // If we exceed maxActiveGoals, deactivate the lowest-priority active goal
        if (activeGoals.length >= maxActiveGoals) {
            const goalToDeactivate = activeGoals[0].goal;
            goalToDeactivate.forceActivated = false; // Clear force flag if it was set
            this.handleStatusTransition(goalToDeactivate, 'inactive');
            goalToDeactivate.lastUpdated = new Date();
        }

        this.priorityCache.invalidate();
        this.saveGoals();

        return goal;
    }
}

export default GoalService;
