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
                field: change?.field,
                from: Object.prototype.hasOwnProperty.call(change || {}, 'from') ? change.from : null,
                to: Object.prototype.hasOwnProperty.call(change || {}, 'to') ? change.to : null
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
        this.description = goalData.description || '';
        this.motivation = parseInt(goalData.motivation);
        this.urgency = parseInt(goalData.urgency);
        this.deadline = goalData.deadline ? new Date(goalData.deadline) : null;
        this.status = goalData.status || 'active';
        this.createdAt = goalData.createdAt ? new Date(goalData.createdAt) : new Date();
        this.lastUpdated = goalData.lastUpdated ? new Date(goalData.lastUpdated) : new Date();
        this.checkInDates = goalData.checkInDates || [];
        const history = Array.isArray(goalData.history) ? goalData.history.map(normalizeHistoryEntry).filter(Boolean) : [];
        this.history = history;
    }
}

export default Goal;
