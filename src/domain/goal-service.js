// src/domain/goal-service.js

import Goal from './goal.js';

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

    /**
     * Migriert bestehende Ziele: Aktiviert automatisch die N Ziele mit höchster Priorität.
     * Sollte beim App-Start aufgerufen werden, um bestehende manuell aktivierte Ziele zu migrieren.
     * @param {number} maxActiveGoals - Maximale Anzahl aktiver Ziele
     */
    migrateGoalsToAutoActivation(maxActiveGoals) {
        if (this.goals.length === 0) return;
        
        // Automatisch die N Ziele mit höchster Priorität aktivieren
        this.autoActivateGoalsByPriority(maxActiveGoals);
    }

    saveGoals() {
        localStorage.setItem('goaly_goals', JSON.stringify(this.goals));
    }

    createGoal(goalData, maxActiveGoals) {
        // Status wird nicht mehr manuell gesetzt, sondern automatisch bestimmt
        const goal = new Goal({ ...goalData, status: 'paused' }); // Temporär auf paused setzen
        this.goals.push(goal);
        
        // Automatisch die N Ziele mit höchster Priorität aktivieren
        this.autoActivateGoalsByPriority(maxActiveGoals);
        
        return goal;
    }

    updateGoal(id, goalData, maxActiveGoals) {
        const goal = this.goals.find(g => g.id === id);
        if (!goal) return null;

        // Prüfen, ob sich prioritätsrelevante Felder geändert haben
        const priorityChanged = 
            (goalData.motivation !== undefined && goalData.motivation !== goal.motivation) ||
            (goalData.urgency !== undefined && goalData.urgency !== goal.urgency) ||
            (goalData.deadline !== undefined && (
                (goalData.deadline === null && goal.deadline !== null) ||
                (goalData.deadline !== null && goal.deadline === null) ||
                (goalData.deadline && goal.deadline && 
                 new Date(goalData.deadline).getTime() !== goal.deadline.getTime())
            ));

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
        // Status wird nicht mehr manuell gesetzt, sondern automatisch bestimmt
        // goalData.status wird ignoriert

        Object.assign(goal, updates);
        
        // Wenn sich die Priorität geändert hat, automatisch neu aktivieren
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
        
        // Wenn ein aktives Ziel gelöscht wurde, automatisch neu aktivieren
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
     * Automatisch die N Ziele mit der höchsten Priorität aktivieren.
     * Alle anderen nicht-abgeschlossenen Ziele werden pausiert.
     * @param {number} maxActiveGoals - Maximale Anzahl aktiver Ziele
     */
    autoActivateGoalsByPriority(maxActiveGoals) {
        // Alle nicht-abgeschlossenen Ziele nach Priorität sortieren
        const eligibleGoals = this.goals
            .filter(g => g.status !== 'completed')
            .sort((a, b) => {
                const priorityA = this.calculatePriority(a);
                const priorityB = this.calculatePriority(b);
                // Bei gleicher Priorität: ältere Ziele bevorzugen (stabilere Sortierung)
                if (priorityA === priorityB) {
                    return a.createdAt - b.createdAt;
                }
                return priorityB - priorityA;
            });

        // Die N Ziele mit höchster Priorität aktivieren
        const goalsToActivate = eligibleGoals.slice(0, maxActiveGoals);
        const goalsToPause = eligibleGoals.slice(maxActiveGoals);

        // Status aktualisieren
        goalsToActivate.forEach(goal => {
            if (goal.status !== 'active') {
                goal.status = 'active';
            }
        });

        goalsToPause.forEach(goal => {
            if (goal.status !== 'paused') {
                goal.status = 'paused';
            }
        });

        this.saveGoals();
    }
}

export default GoalService;
