// src/ui/ui-controller.js

class UIController {
    constructor(app) {
        this.app = app;
        this.setupEventListeners();
    }

    renderViews() {
        const activeGoals = this.app.goalService.getActiveGoals();
        const totalActiveCount = activeGoals.length;
        
        const dashboardGoals = activeGoals.slice(0, this.app.settingsService.getSettings().maxActiveGoals);
        
        const remainingActiveGoals = activeGoals.slice(this.app.settingsService.getSettings().maxActiveGoals);
        const allOtherGoals = this.app.goalService.goals
            .filter(g => g.status !== 'active')
            .sort((a, b) => this.app.goalService.calculatePriority(b) - this.app.goalService.calculatePriority(a));
        
        const allGoals = [...remainingActiveGoals, ...allOtherGoals];

        const dashboardList = document.getElementById('goalsList');
        dashboardList.innerHTML = '';

        if (dashboardGoals.length === 0) {
            dashboardList.innerHTML = '<p style="text-align: center; color: #888; padding: 40px;">Keine aktiven Ziele. Erstelle dein erstes Ziel!</p>';
        } else {
            dashboardGoals.forEach(goal => {
                dashboardList.appendChild(this.createGoalCard(goal));
            });
        }

        const allGoalsList = document.getElementById('allGoalsList');
        allGoalsList.innerHTML = '';

        if (allGoals.length === 0) {
            allGoalsList.innerHTML = '<p style="text-align: center; color: #888; padding: 40px;">Keine weiteren Ziele im Backlog.</p>';
        } else {
            allGoals.forEach(goal => {
                allGoalsList.appendChild(this.createGoalCard(goal));
            });
        }
    }

    createGoalCard(goal) {
        const card = document.createElement('div');
        card.className = `goal-card ${goal.status}`;
        
        const priority = this.app.goalService.calculatePriority(goal);
        const deadlineText = goal.deadline 
            ? this.formatDeadline(goal.deadline)
            : 'Keine Deadline';

        card.innerHTML = `
            <div class="goal-header">
                <div>
                    <div class="goal-title">${this.escapeHtml(goal.title)}</div>
                    <span class="goal-status-badge status-${goal.status}">${this.getStatusText(goal.status)}</span>
                </div>
            </div>
            ${goal.description ? `<div class="goal-description">${this.escapeHtml(goal.description)}</div>` : ''}
            <div class="goal-metrics">
                <div class="metric">
                    <span class="metric-label">Motivation</span>
                    <span class="metric-value motivation">${goal.motivation}/5</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Dringlichkeit</span>
                    <span class="metric-value urgency">${goal.urgency}/5</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Priorität</span>
                    <span class="metric-value priority">${priority.toFixed(1)}</span>
                </div>
            </div>
            <div class="goal-deadline ${this.isDeadlineUrgent(goal.deadline) ? 'urgent' : ''}">
                📅 ${deadlineText}
            </div>
            <div class="goal-actions">
                <button class="btn btn-primary edit-goal" data-id="${goal.id}">Bearbeiten</button>
                ${goal.status === 'active' 
                    ? `<button class="btn btn-secondary pause-goal" data-id="${goal.id}">Pausieren</button>`
                    : goal.status === 'paused'
                    ? `<button class="btn btn-primary activate-goal" data-id="${goal.id}">Aktivieren</button>`
                    : ''}
            </div>
        `;

        card.querySelector('.edit-goal')?.addEventListener('click', () => this.openGoalForm(goal.id));
        card.querySelector('.pause-goal')?.addEventListener('click', () => this.pauseGoal(goal.id));
        card.querySelector('.activate-goal')?.addEventListener('click', () => this.activateGoal(goal.id));

        return card;
    }

    formatDeadline(deadline) {
        const now = new Date();
        const days = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
        
        if (days < 0) {
            return `Überfällig (${Math.abs(days)} Tage)`;
        } else if (days === 0) {
            return 'Heute';
        } else if (days === 1) {
            return 'Morgen';
        } else if (days <= 7) {
            return `In ${days} Tagen`;
        } else {
            return deadline.toLocaleDateString('de-DE');
        }
    }

    isDeadlineUrgent(deadline) {
        if (!deadline) return false;
        const now = new Date();
        const days = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
        return days <= 7 && days >= 0;
    }

    getStatusText(status) {
        const statusMap = {
            active: 'Aktiv',
            paused: 'Pausiert',
            completed: 'Abgeschlossen'
        };
        return statusMap[status] || status;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    openGoalForm(goalId = null) {
        const modal = document.getElementById('goalModal');
        const form = document.getElementById('goalForm');
        const deleteBtn = document.getElementById('deleteBtn');
        const modalTitle = document.getElementById('modalTitle');

        if (goalId) {
            const goal = this.app.goalService.goals.find(g => g.id === goalId);
            if (goal) {
                modalTitle.textContent = 'Ziel bearbeiten';
                document.getElementById('goalId').value = goal.id;
                document.getElementById('goalTitle').value = goal.title;
                document.getElementById('goalDescription').value = goal.description || '';
                document.getElementById('goalMotivation').value = goal.motivation;
                document.getElementById('goalUrgency').value = goal.urgency;
                document.getElementById('goalDeadline').value = goal.deadline 
                    ? goal.deadline.toISOString().split('T')[0]
                    : '';
                document.getElementById('goalStatus').value = goal.status;
                deleteBtn.style.display = 'inline-block';
            }
        } else {
            modalTitle.textContent = 'Neues Ziel';
            form.reset();
            document.getElementById('goalId').value = '';
            document.getElementById('goalStatus').value = 'active';
            deleteBtn.style.display = 'none';
        }

        modal.style.display = 'block';
    }

    closeGoalForm() {
        document.getElementById('goalModal').style.display = 'none';
        document.getElementById('goalForm').reset();
    }

    pauseGoal(id) {
        try {
            const goal = this.app.goalService.goals.find(g => g.id === id);
            if (!goal) return;

            this.app.goalService.updateGoal(id, { ...goal, status: 'paused' }, this.app.settingsService.getSettings().maxActiveGoals);
            this.renderViews();
        } catch (error) {
            alert(error.message);
        }
    }

    activateGoal(id) {
        try {
            const goal = this.app.goalService.goals.find(g => g.id === id);
            if (!goal) return;

            this.app.goalService.updateGoal(id, { ...goal, status: 'active' }, this.app.settingsService.getSettings().maxActiveGoals);
            this.renderViews();
        } catch (error) {
            alert(error.message);
        }
    }

    showCheckIns() {
        const panel = document.getElementById('checkInsPanel');
        const list = document.getElementById('checkInsList');
        
        list.innerHTML = '';
        
        this.app.checkIns.forEach(checkIn => {
            const item = document.createElement('div');
            item.className = 'check-in-item';
            item.innerHTML = `
                <h3>${this.escapeHtml(checkIn.goal.title)}</h3>
                <p>${checkIn.message}</p>
                <div class="check-in-actions">
                    <button class="btn btn-primary check-in-done" data-id="${checkIn.goal.id}">Check-in durchgeführt</button>
                    <button class="btn btn-secondary edit-check-in-goal" data-id="${checkIn.goal.id}">Ziel bearbeiten</button>
                </div>
            `;
            
            item.querySelector('.check-in-done').addEventListener('click', () => {
                this.app.checkInService.performCheckIn(checkIn.goal.id);
                this.app.checkIns = this.app.checkInService.getCheckIns();
                this.showCheckIns();
                if (this.app.checkIns.length === 0) {
                    panel.style.display = 'none';
                }
            });
            
            item.querySelector('.edit-check-in-goal').addEventListener('click', () => {
                this.openGoalForm(checkIn.goal.id);
            });
            
            list.appendChild(item);
        });
        
        panel.style.display = 'block';
    }

    setupEventListeners() {
        document.getElementById('addGoalBtn').addEventListener('click', () => this.openGoalForm());

        document.getElementById('goalForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleGoalSubmit();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => this.closeGoalForm());
        document.getElementById('deleteBtn').addEventListener('click', () => {
            if (confirm('Möchtest du dieses Ziel wirklich löschen?')) {
                const id = document.getElementById('goalId').value;
                this.app.goalService.deleteGoal(id);
                this.closeGoalForm();
                this.renderViews();
            }
        });

        document.querySelector('.close').addEventListener('click', () => this.closeGoalForm());
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('goalModal');
            if (e.target === modal) {
                this.closeGoalForm();
            }
        });

        document.getElementById('exportBtn').addEventListener('click', () => this.app.exportData());
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('importFile').click();
        });
        document.getElementById('importFile').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.app.importData(e.target.files[0]);
                e.target.value = '';
            }
        });

        document.getElementById('saveSettingsBtn').addEventListener('click', () => {
            const newSettings = {
                maxActiveGoals: parseInt(document.getElementById('maxActiveGoals').value),
                checkInInterval: parseInt(document.getElementById('checkInInterval').value),
                checkInsEnabled: document.getElementById('checkInsEnabled').checked
            };
            this.app.settingsService.updateSettings(newSettings);
            this.app.startCheckInTimer();
            this.renderViews();
        });

        document.querySelectorAll('.menu-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const viewName = btn.dataset.view;
                
                document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                document.querySelectorAll('.view').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`${viewName}View`).classList.add('active');
            });
        });
    }

    handleGoalSubmit() {
        const id = document.getElementById('goalId').value;
        const goalData = {
            title: document.getElementById('goalTitle').value,
            description: document.getElementById('goalDescription').value,
            motivation: document.getElementById('goalMotivation').value,
            urgency: document.getElementById('goalUrgency').value,
            deadline: document.getElementById('goalDeadline').value || null,
            status: document.getElementById('goalStatus').value
        };

        try {
            if (id) {
                this.app.goalService.updateGoal(id, goalData, this.app.settingsService.getSettings().maxActiveGoals);
            } else {
                this.app.goalService.createGoal(goalData, this.app.settingsService.getSettings().maxActiveGoals);
            }
            this.closeGoalForm();
            this.renderViews();
        } catch (error) {
            alert(error.message);
        }
    }
}

module.exports = UIController;
