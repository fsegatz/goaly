// src/domain/goal.js

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
    }
}

module.exports = Goal;
