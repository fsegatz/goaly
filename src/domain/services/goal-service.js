// src/domain/goal-service.js

import Goal from '../models/goal.js';
import { prepareGoalsStoragePayload } from '../migration/migration-service.js';
import { STORAGE_KEY_GOALS, DEADLINE_BONUS_DAYS } from '../utils/constants.js';
import { PriorityCacheManager } from '../priority-cache-manager.js';
import { setToMidnight, normalizeDate } from '../utils/date-utils.js';

class GoalService {
    constructor(goals = [], errorHandler = null) {
		this.goals = goals.map(g => new Goal(g));
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
                    this.goals = parsed.map(goal => new Goal(goal));
                    this.priorityCache.invalidate();
                    this.saveGoals();
                    return;
                }
                if (parsed && Array.isArray(parsed.goals)) {
                    this.goals = parsed.goals.map(goal => new Goal(goal));
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
        const goal = new Goal({ ...goalData, status: 'inactive' }); // Temporarily set to inactive
        this.goals.push(goal);
        this.priorityCache.invalidate();
        
        // Automatically activate the top N goals by priority
        this.autoActivateGoalsByPriority(maxActiveGoals);
        
        return goal;
    }

    updateGoal(id, goalData, maxActiveGoals) {
        const goal = this.goals.find(g => g.id === id);
        if (!goal) return null;

        let priorityChanged = false;
        const updates = {};

        if (goalData.title !== undefined && goalData.title !== goal.title) {
            updates.title = goalData.title;
        }
        if (goalData.motivation !== undefined) {
            const parsedMotivation = parseInt(goalData.motivation, 10);
            if (parsedMotivation !== goal.motivation) {
                updates.motivation = parsedMotivation;
                priorityChanged = true;
            }
        }
        if (goalData.urgency !== undefined) {
            const parsedUrgency = parseInt(goalData.urgency, 10);
            if (parsedUrgency !== goal.urgency) {
                updates.urgency = parsedUrgency;
                priorityChanged = true;
            }
        }
        if (goalData.deadline !== undefined) {
            const newDeadline = goalData.deadline ? new Date(goalData.deadline) : null;
            const currentTime = goal.deadline instanceof Date ? goal.deadline.getTime() : null;
            const newTime = newDeadline instanceof Date ? newDeadline.getTime() : null;
            if (currentTime !== newTime) {
                updates.deadline = newDeadline;
                priorityChanged = true;
            }
        }
        if (goalData.steps !== undefined) {
            updates.steps = Array.isArray(goalData.steps) ? goalData.steps : [];
        }
        if (goalData.resources !== undefined) {
            updates.resources = Array.isArray(goalData.resources) ? goalData.resources : [];
        }

        if (Object.keys(updates).length === 0) {
            return goal;
        }

        updates.lastUpdated = new Date();

        // Status is determined automatically; ignore goalData.status input

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
     * Get goals eligible for activation (excluding completed, abandoned, and manually paused goals)
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
        const goalsToActivate = eligibleGoals.slice(0, maxActiveGoals);
        const goalsToInactivate = eligibleGoals.slice(maxActiveGoals);

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
        const ineligibleStatuses = new Set(['completed', 'abandoned']);
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
}

export default GoalService;
