// src/domain/goal-service.js

import Goal from './goal.js';
import { prepareGoalsStoragePayload } from './migration-service.js';

const HISTORY_LIMIT = 50;
const HISTORY_EVENTS = {
    CREATED: 'created',
    UPDATED: 'updated',
    STATUS_CHANGE: 'status-change',
    ROLLBACK: 'rollback'
};

const TRACKED_HISTORY_FIELDS = ['title', 'description', 'motivation', 'urgency', 'deadline', 'status', 'priority'];

function valuesEqual(a, b) {
    if (a === b) {
        return true;
    }
    if (Number.isNaN(a) && Number.isNaN(b)) {
        return true;
    }
    if ((a === undefined || a === null) && (b === undefined || b === null)) {
        return true;
    }
    return false;
}

class GoalService {
    constructor(goals = []) {
        this.goals = goals.map(g => new Goal(g));
    }

    loadGoals() {
        const saved = localStorage.getItem('goaly_goals');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    this.goals = parsed.map(goal => new Goal(goal));
                    this.saveGoals();
                    return;
                }
                if (parsed && Array.isArray(parsed.goals)) {
                    this.goals = parsed.goals.map(goal => new Goal(goal));
                    if (!parsed.version) {
                        this.saveGoals();
                    }
                }
            } catch (error) {
                console.error('Failed to load goals from storage', error);
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
        localStorage.setItem('goaly_goals', JSON.stringify(payload));
    }

    generateHistoryId() {
        return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
    }

    createSnapshot(goal) {
        return {
            title: goal.title ?? '',
            description: goal.description ?? '',
            motivation: Number.isNaN(goal.motivation) ? null : goal.motivation,
            urgency: Number.isNaN(goal.urgency) ? null : goal.urgency,
            deadline: goal.deadline
                ? goal.deadline.toISOString()
                : null,
            status: goal.status ?? 'active',
            priority: this.calculatePriority(goal)
        };
    }

    diffSnapshots(before = {}, after = {}) {
        return TRACKED_HISTORY_FIELDS.reduce((changes, field) => {
            const previous = before ? before[field] : undefined;
            const next = after ? after[field] : undefined;
            if (!valuesEqual(previous, next)) {
                changes.push({
                    field,
                    from: previous ?? null,
                    to: next ?? null
                });
            }
            return changes;
        }, []);
    }

    appendHistoryEntry(goal, entry) {
        if (!goal.history) {
            goal.history = [];
        }
        goal.history.push(entry);
        if (goal.history.length > HISTORY_LIMIT) {
            goal.history = goal.history.slice(goal.history.length - HISTORY_LIMIT);
        }
    }

    recordHistory(goal, { event, timestamp, before, after, changes, meta }) {
        if (!changes || changes.length === 0) {
            return;
        }
        this.appendHistoryEntry(goal, {
            id: this.generateHistoryId(),
            event,
            timestamp,
            changes,
            before,
            after,
            meta
        });
    }

    applySnapshotToGoal(goal, snapshot) {
        if (!snapshot) {
            return;
        }
        const updatedFields = {};

        if (snapshot.title !== undefined) {
            updatedFields.title = snapshot.title;
        }
        if (snapshot.description !== undefined) {
            updatedFields.description = snapshot.description;
        }
        if (snapshot.motivation !== undefined) {
            updatedFields.motivation = snapshot.motivation === null ? NaN : Number(snapshot.motivation);
        }
        if (snapshot.urgency !== undefined) {
            updatedFields.urgency = snapshot.urgency === null ? NaN : Number(snapshot.urgency);
        }
        if (snapshot.deadline !== undefined) {
            updatedFields.deadline = snapshot.deadline ? new Date(snapshot.deadline) : null;
        }
        if (snapshot.status !== undefined) {
            updatedFields.status = snapshot.status;
        }

        Object.assign(goal, updatedFields);
    }

    handleStatusTransition(goal, newStatus) {
        if (goal.status === newStatus) {
            return;
        }
        const beforeSnapshot = this.createSnapshot(goal);
        goal.status = newStatus;
        goal.lastUpdated = new Date();
        const afterSnapshot = this.createSnapshot(goal);
        const changes = this.diffSnapshots(beforeSnapshot, afterSnapshot).filter(change => change.field === 'status' || change.field === 'priority');
        this.recordHistory(goal, {
            event: HISTORY_EVENTS.STATUS_CHANGE,
            timestamp: goal.lastUpdated,
            before: beforeSnapshot,
            after: afterSnapshot,
            changes
        });
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

        return goal;
    }

    createGoal(goalData, maxActiveGoals) {
        // Status is determined automatically rather than set manually
        const goal = new Goal({ ...goalData, status: 'paused' }); // Temporarily set to paused
        const creationSnapshot = this.createSnapshot(goal);
        const creationChanges = this.diffSnapshots({}, creationSnapshot);
        this.recordHistory(goal, {
            event: HISTORY_EVENTS.CREATED,
            timestamp: goal.createdAt || new Date(),
            before: null,
            after: creationSnapshot,
            changes: creationChanges
        });
        this.goals.push(goal);
        
        // Automatically activate the top N goals by priority
        this.autoActivateGoalsByPriority(maxActiveGoals);
        
        return goal;
    }

    updateGoal(id, goalData, maxActiveGoals) {
        const goal = this.goals.find(g => g.id === id);
        if (!goal) return null;

        const beforeSnapshot = this.createSnapshot(goal);

        let priorityChanged = false;
        const updates = {};

        if (goalData.title !== undefined && goalData.title !== goal.title) {
            updates.title = goalData.title;
        }
        if (goalData.description !== undefined && goalData.description !== goal.description) {
            updates.description = goalData.description;
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

        if (Object.keys(updates).length === 0) {
            return goal;
        }

        updates.lastUpdated = new Date();

        // Status is determined automatically; ignore goalData.status input

        Object.assign(goal, updates);

        const afterSnapshot = this.createSnapshot(goal);
        const changes = this.diffSnapshots(beforeSnapshot, afterSnapshot);
        this.recordHistory(goal, {
            event: HISTORY_EVENTS.UPDATED,
            timestamp: goal.lastUpdated,
            before: beforeSnapshot,
            after: afterSnapshot,
            changes
        });
        
        // Automatically re-activate goals if the priority changed
        if (priorityChanged) {
            this.autoActivateGoalsByPriority(maxActiveGoals);
        } else {
            this.saveGoals();
        }
        
        return goal;
    }

    revertGoalToHistoryEntry(id, historyEntryId, maxActiveGoals) {
        const goal = this.goals.find(g => g.id === id);
        if (!goal || !Array.isArray(goal.history)) {
            return null;
        }

        const targetEntry = goal.history.find(entry => entry.id === historyEntryId);
        if (!targetEntry || !targetEntry.before) {
            return null;
        }

        const beforeSnapshot = this.createSnapshot(goal);
        this.applySnapshotToGoal(goal, targetEntry.before);
        goal.lastUpdated = new Date();
        const afterSnapshot = this.createSnapshot(goal);
        const changes = this.diffSnapshots(beforeSnapshot, afterSnapshot);

        if (changes.length === 0) {
            this.saveGoals();
            return goal;
        }

        this.recordHistory(goal, {
            event: HISTORY_EVENTS.ROLLBACK,
            timestamp: goal.lastUpdated,
            before: beforeSnapshot,
            after: afterSnapshot,
            changes,
            meta: { revertedEntryId: historyEntryId }
        });

        this.autoActivateGoalsByPriority(maxActiveGoals);
        return goal;
    }

    deleteGoal(id, maxActiveGoals) {
        const wasActive = this.goals.find(g => g.id === id)?.status === 'active';
        this.goals = this.goals.filter(g => g.id !== id);
        
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
            const daysUntilDeadline = Math.ceil((goal.deadline - now) / (1000 * 60 * 60 * 24));
            
            if (daysUntilDeadline > 30) {
                priority += 0;
            } else {
                const bonus = Math.max(0, 30 - daysUntilDeadline);
                priority += bonus;
            }
        }

        return priority;
    }

    getActiveGoals() {
        return this.goals
            .filter(g => g.status === 'active')
            .sort((a, b) => this.calculatePriority(b) - this.calculatePriority(a));
    }

    /**
     * Automatically activates the top N goals with the highest priority.
     * All other non-completed goals are paused.
     * @param {number} maxActiveGoals - Maximum number of active goals
     */
    autoActivateGoalsByPriority(maxActiveGoals) {
        // Sort all non-completed goals by priority
        const ineligibleStatuses = new Set(['completed', 'abandoned']);
        const eligibleGoals = this.goals
            .filter(g => !ineligibleStatuses.has(g.status))
            .sort((a, b) => {
                const priorityA = this.calculatePriority(a);
                const priorityB = this.calculatePriority(b);
                // Prefer older goals when priorities tie to keep sorting stable
                if (priorityA === priorityB) {
                    return a.createdAt - b.createdAt;
                }
                return priorityB - priorityA;
            });

        // Activate the top N goals by priority
        const goalsToActivate = eligibleGoals.slice(0, maxActiveGoals);
        const goalsToPause = eligibleGoals.slice(maxActiveGoals);

        // Update status
        goalsToActivate.forEach(goal => {
            this.handleStatusTransition(goal, 'active');
        });

        goalsToPause.forEach(goal => {
            this.handleStatusTransition(goal, 'paused');
        });

        this.saveGoals();
    }
}

export default GoalService;
