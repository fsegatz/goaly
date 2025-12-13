// src/domain/goal.js

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
        // Pause metadata: pauseUntil (date) or pauseUntilGoalId (goal ID that must be completed)
        this.pauseUntil = goalData.pauseUntil ? new Date(goalData.pauseUntil) : null;
        this.pauseUntilGoalId = goalData.pauseUntilGoalId || null;
        // Track if goal was force-activated by user (not priority-based)
        this.forceActivated = Boolean(goalData.forceActivated);
    }
}

export default Goal;
