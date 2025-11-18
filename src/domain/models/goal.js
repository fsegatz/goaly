// src/domain/goal.js

const DEFAULT_HISTORY_EVENT = 'update';

function normalizeHistoryEntry(entry) {
    if (!entry) {
        return null;
    }

    const timestamp = entry.timestamp ? new Date(entry.timestamp) : new Date();
    return {
        id: entry.id || `${timestamp.getTime()}-${Math.random().toString(16).slice(2, 10)}`,
        event: entry.event || DEFAULT_HISTORY_EVENT,
        timestamp,
        changes: Array.isArray(entry.changes)
            ? entry.changes.map(change => ({
                field: change?.field ?? null,
                from: change?.from ?? null,
                to: change?.to ?? null
            }))
            : [],
        before: entry.before ? { ...entry.before } : null,
        after: entry.after ? { ...entry.after } : null,
        meta: entry.meta ? { ...entry.meta } : undefined
    };
}

class Goal {
    constructor(goalData) {
        this.id = goalData.id || (Date.now().toString() + Math.random().toString());
        this.title = goalData.title;
        this.motivation = parseInt(goalData.motivation);
        this.urgency = parseInt(goalData.urgency);
        this.deadline = goalData.deadline ? new Date(goalData.deadline) : null;
        this.status = goalData.status || 'active';
        this.createdAt = goalData.createdAt ? new Date(goalData.createdAt) : new Date();
        this.lastUpdated = goalData.lastUpdated ? new Date(goalData.lastUpdated) : new Date();
        // Support both old checkIn* and new review* field names for migration compatibility
        this.reviewDates = Array.isArray(goalData.reviewDates) ? [...goalData.reviewDates] 
            : (Array.isArray(goalData.checkInDates) ? [...goalData.checkInDates] : []);
        this.lastReviewAt = goalData.lastReviewAt ? new Date(goalData.lastReviewAt) 
            : (goalData.lastCheckInAt ? new Date(goalData.lastCheckInAt) : null);
        this.nextReviewAt = goalData.nextReviewAt ? new Date(goalData.nextReviewAt) 
            : (goalData.nextCheckInAt ? new Date(goalData.nextCheckInAt) : null);
        this.reviewIntervalIndex = Number.isInteger(goalData.reviewIntervalIndex)
            ? goalData.reviewIntervalIndex
            : null;
        const history = Array.isArray(goalData.history) ? goalData.history.map(normalizeHistoryEntry).filter(Boolean) : [];
        this.history = history;
        this.steps = Array.isArray(goalData.steps) ? goalData.steps.map((step, index) => ({
            id: step.id || `${Date.now()}-${index}-${Math.random().toString(16).slice(2, 10)}`,
            text: step.text || '',
            completed: Boolean(step.completed),
            order: Number.isInteger(step.order) ? step.order : index
        })) : [];
        this.resources = Array.isArray(goalData.resources) ? goalData.resources.map((resource, index) => ({
            id: resource.id || `${Date.now()}-${index}-${Math.random().toString(16).slice(2, 10)}`,
            text: resource.text || '',
            type: resource.type || 'general'
        })) : [];
    }
}

export default Goal;
