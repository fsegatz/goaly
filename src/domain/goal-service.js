// src/domain/goal-service.js

const Goal = require('./goal');

class GoalService {
    constructor(goals = []) {
        this.goals = goals.map(g => new Goal(g));
    }

    loadGoals() {
        const saved = localStorage.getItem('goaly_goals');
        if (saved) {
            this.goals = JSON.parse(saved).map(goal => new Goal(goal));
        }
    }

    saveGoals() {
        localStorage.setItem('goaly_goals', JSON.stringify(this.goals));
    }

    createGoal(goalData, maxActiveGoals) {
        const goal = new Goal(goalData);

        if (goal.status === 'active') {
            const activeCount = this.goals.filter(g => g.status === 'active').length;
            if (activeCount >= maxActiveGoals) {
                throw new Error(`Maximale Anzahl aktiver Ziele erreicht (${maxActiveGoals}). Bitte ein anderes Ziel pausieren oder das Limit erhöhen.`);
            }
        }

        this.goals.push(goal);
        this.saveGoals();
        return goal;
    }

    updateGoal(id, goalData, maxActiveGoals) {
        const goal = this.goals.find(g => g.id === id);
        if (!goal) return null;

        const wasActive = goal.status === 'active';
        const willBeActive = goalData.status === 'active';

        if (!wasActive && willBeActive) {
            const activeCount = this.goals.filter(g => g.status === 'active' && g.id !== id).length;
            if (activeCount >= maxActiveGoals) {
                throw new Error(`Maximale Anzahl aktiver Ziele erreicht (${maxActiveGoals}). Bitte ein anderes Ziel pausieren oder das Limit erhöhen.`);
            }
        }

        const updates = {
            lastUpdated: new Date()
        };

        if (goalData.title !== undefined) updates.title = goalData.title;
        if (goalData.description !== undefined) updates.description = goalData.description;
        if (goalData.motivation !== undefined) updates.motivation = parseInt(goalData.motivation);
        if (goalData.urgency !== undefined) updates.urgency = parseInt(goalData.urgency);
        if (goalData.deadline !== undefined) {
            updates.deadline = goalData.deadline ? new Date(goalData.deadline) : null;
        }
        if (goalData.status !== undefined) updates.status = goalData.status;

        Object.assign(goal, updates);
        this.saveGoals();
        return goal;
    }

    deleteGoal(id) {
        this.goals = this.goals.filter(g => g.id !== id);
        this.saveGoals();
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
}

module.exports = GoalService;
