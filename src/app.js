// Goaly MVP - Main Application Logic

class GoalyApp {
    constructor() {
        this.goals = [];
        this.settings = {
            maxActiveGoals: 3,
            checkInInterval: 1 // minutes for dev testing
        };
        this.checkIns = [];
        this.init();
    }

    init() {
        this.loadSettings();
        this.loadGoals();
        this.setupEventListeners();
        this.renderDashboard();
        this.startCheckInTimer();
    }

    // Settings Management
    loadSettings() {
        const saved = localStorage.getItem('goaly_settings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
        document.getElementById('maxActiveGoals').value = this.settings.maxActiveGoals;
        document.getElementById('checkInInterval').value = this.settings.checkInInterval;
        document.getElementById('maxActiveGoalsDisplay').textContent = this.settings.maxActiveGoals;
    }

    saveSettings() {
        localStorage.setItem('goaly_settings', JSON.stringify(this.settings));
        document.getElementById('maxActiveGoalsDisplay').textContent = this.settings.maxActiveGoals;
    }

    // Goal Management
    loadGoals() {
        const saved = localStorage.getItem('goaly_goals');
        if (saved) {
            this.goals = JSON.parse(saved).map(goal => ({
                ...goal,
                createdAt: goal.createdAt ? new Date(goal.createdAt) : new Date(),
                lastUpdated: goal.lastUpdated ? new Date(goal.lastUpdated) : new Date(),
                deadline: goal.deadline ? new Date(goal.deadline) : null
            }));
        }
    }

    saveGoals() {
        localStorage.setItem('goaly_goals', JSON.stringify(this.goals));
    }

    createGoal(goalData) {
        const goal = {
            id: Date.now().toString(),
            title: goalData.title,
            description: goalData.description || '',
            motivation: parseInt(goalData.motivation),
            urgency: parseInt(goalData.urgency),
            deadline: goalData.deadline ? new Date(goalData.deadline) : null,
            status: goalData.status || 'active',
            createdAt: new Date(),
            lastUpdated: new Date(),
            checkInDates: []
        };

        // Check if we can activate this goal
        if (goal.status === 'active') {
            const activeCount = this.goals.filter(g => g.status === 'active').length;
            if (activeCount >= this.settings.maxActiveGoals) {
                throw new Error(`Maximale Anzahl aktiver Ziele erreicht (${this.settings.maxActiveGoals}). Bitte ein anderes Ziel pausieren oder das Limit erhöhen.`);
            }
        }

        this.goals.push(goal);
        this.saveGoals();
        return goal;
    }

    updateGoal(id, goalData) {
        const goal = this.goals.find(g => g.id === id);
        if (!goal) return null;

        const wasActive = goal.status === 'active';
        const willBeActive = goalData.status === 'active';

        // Check if activation would exceed limit
        if (!wasActive && willBeActive) {
            const activeCount = this.goals.filter(g => g.status === 'active' && g.id !== id).length;
            if (activeCount >= this.settings.maxActiveGoals) {
                throw new Error(`Maximale Anzahl aktiver Ziele erreicht (${this.settings.maxActiveGoals}). Bitte ein anderes Ziel pausieren oder das Limit erhöhen.`);
            }
        }

        Object.assign(goal, {
            ...goalData,
            motivation: parseInt(goalData.motivation),
            urgency: parseInt(goalData.urgency),
            deadline: goalData.deadline ? new Date(goalData.deadline) : null,
            lastUpdated: new Date()
        });

        this.saveGoals();
        return goal;
    }

    deleteGoal(id) {
        this.goals = this.goals.filter(g => g.id !== id);
        this.saveGoals();
    }

    // Priority Calculation
    calculatePriority(goal) {
        // Base priority: Motivation + Urgency (max 10)
        let priority = goal.motivation + goal.urgency;

        // Deadline bonus: closer deadlines get higher priority
        if (goal.deadline) {
            const now = new Date();
            const daysUntilDeadline = Math.ceil((goal.deadline - now) / (1000 * 60 * 60 * 24));
            if (daysUntilDeadline > 0 && daysUntilDeadline <= 30) {
                priority += (30 - daysUntilDeadline) / 10; // Bonus up to 3 points
            } else if (daysUntilDeadline <= 0) {
                priority += 5; // Overdue gets big bonus
            }
        }

        return priority;
    }

    getActiveGoals() {
        return this.goals
            .filter(g => g.status === 'active')
            .sort((a, b) => this.calculatePriority(b) - this.calculatePriority(a));
    }

    // Check-in System
    shouldCheckIn(goal) {
        if (goal.status !== 'active') return false;

        const now = new Date();
        const created = new Date(goal.createdAt);
        const daysSinceCreation = Math.ceil((now - created) / (1000 * 60 * 60 * 24));

        // Check-in intervals: 3, 7, 14, 30 days
        const intervals = [3, 7, 14, 30];
        const lastCheckIn = goal.checkInDates && goal.checkInDates.length > 0
            ? new Date(Math.max(...goal.checkInDates.map(d => new Date(d))))
            : created;

        const daysSinceLastCheckIn = Math.ceil((now - lastCheckIn) / (1000 * 60 * 60 * 24));

        // For dev testing, use minutes instead of days
        const checkInMinutes = this.settings.checkInInterval;
        const minutesSinceCreation = Math.ceil((now - created) / (1000 * 60));
        const minutesSinceLastCheckIn = Math.ceil((now - lastCheckIn) / (1000 * 60));

        // Check if we've passed any check-in interval
        for (const interval of intervals) {
            const intervalMinutes = interval * checkInMinutes;
            if (minutesSinceLastCheckIn >= intervalMinutes && 
                !goal.checkInDates.some(d => {
                    const checkInDate = new Date(d);
                    const minutesSinceCheckIn = Math.ceil((now - checkInDate) / (1000 * 60));
                    return minutesSinceCheckIn < intervalMinutes && minutesSinceCheckIn >= intervalMinutes - checkInMinutes;
                })) {
                return true;
            }
        }

        return false;
    }

    getCheckIns() {
        return this.goals
            .filter(g => this.shouldCheckIn(g))
            .map(goal => ({
                goal,
                message: `Zeit für ein Check-in: "${goal.title}". Bitte überprüfe Motivation und Dringlichkeit.`
            }));
    }

    performCheckIn(goalId) {
        const goal = this.goals.find(g => g.id === goalId);
        if (goal) {
            if (!goal.checkInDates) goal.checkInDates = [];
            goal.checkInDates.push(new Date().toISOString());
            goal.lastUpdated = new Date();
            this.saveGoals();
        }
    }

    startCheckInTimer() {
        // Check every minute for check-ins (for dev testing)
        setInterval(() => {
            this.checkIns = this.getCheckIns();
            if (this.checkIns.length > 0) {
                this.showCheckIns();
            }
        }, 60000); // Check every minute
    }

    // Export/Import
    exportData() {
        const data = {
            goals: this.goals.map(goal => ({
                ...goal,
                createdAt: goal.createdAt.toISOString(),
                lastUpdated: goal.lastUpdated.toISOString(),
                deadline: goal.deadline ? goal.deadline.toISOString() : null
            })),
            settings: this.settings,
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `goaly-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (data.goals) {
                    this.goals = data.goals.map(goal => ({
                        ...goal,
                        createdAt: new Date(goal.createdAt),
                        lastUpdated: new Date(goal.lastUpdated),
                        deadline: goal.deadline ? new Date(goal.deadline) : null
                    }));
                    this.saveGoals();
                }

                if (data.settings) {
                    this.settings = { ...this.settings, ...data.settings };
                    this.saveSettings();
                    document.getElementById('maxActiveGoals').value = this.settings.maxActiveGoals;
                    document.getElementById('checkInInterval').value = this.settings.checkInInterval;
                }

                this.renderDashboard();
                alert('Daten erfolgreich importiert!');
            } catch (error) {
                alert('Fehler beim Importieren: ' + error.message);
            }
        };
        reader.readAsText(file);
    }

    // UI Rendering
    renderDashboard() {
        const activeGoals = this.getActiveGoals();
        const allGoals = this.goals.filter(g => g.status !== 'active');
        
        document.getElementById('activeGoalsCount').textContent = activeGoals.length;

        const activeList = document.getElementById('goalsList');
        activeList.innerHTML = '';

        if (activeGoals.length === 0) {
            activeList.innerHTML = '<p style="text-align: center; color: #888; padding: 40px;">Keine aktiven Ziele. Erstelle dein erstes Ziel!</p>';
        } else {
            activeGoals.forEach(goal => {
                activeList.appendChild(this.createGoalCard(goal));
            });
        }

        const allGoalsSection = document.getElementById('allGoalsSection');
        const allGoalsList = document.getElementById('allGoalsList');
        
        if (allGoals.length > 0) {
            allGoalsSection.style.display = 'block';
            allGoalsList.innerHTML = '';
            allGoals.forEach(goal => {
                allGoalsList.appendChild(this.createGoalCard(goal));
            });
        } else {
            allGoalsSection.style.display = 'none';
        }
    }

    createGoalCard(goal) {
        const card = document.createElement('div');
        card.className = `goal-card ${goal.status}`;
        
        const priority = this.calculatePriority(goal);
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

        // Add event listeners
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

    // Goal Form Management
    openGoalForm(goalId = null) {
        const modal = document.getElementById('goalModal');
        const form = document.getElementById('goalForm');
        const deleteBtn = document.getElementById('deleteBtn');
        const modalTitle = document.getElementById('modalTitle');

        if (goalId) {
            const goal = this.goals.find(g => g.id === goalId);
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
            this.updateGoal(id, { status: 'paused' });
            this.renderDashboard();
        } catch (error) {
            alert(error.message);
        }
    }

    activateGoal(id) {
        try {
            this.updateGoal(id, { status: 'active' });
            this.renderDashboard();
        } catch (error) {
            alert(error.message);
        }
    }

    showCheckIns() {
        const panel = document.getElementById('checkInsPanel');
        const list = document.getElementById('checkInsList');
        
        list.innerHTML = '';
        
        this.checkIns.forEach(checkIn => {
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
                this.performCheckIn(checkIn.goal.id);
                this.checkIns = this.getCheckIns();
                this.showCheckIns();
                if (this.checkIns.length === 0) {
                    panel.style.display = 'none';
                }
            });
            
            item.querySelector('.edit-check-in-goal').addEventListener('click', () => {
                this.closeCheckIns();
                this.openGoalForm(checkIn.goal.id);
            });
            
            list.appendChild(item);
        });
        
        panel.style.display = 'block';
    }

    closeCheckIns() {
        document.getElementById('checkInsPanel').style.display = 'none';
    }

    // Event Listeners Setup
    setupEventListeners() {
        // Add Goal Button
        document.getElementById('addGoalBtn').addEventListener('click', () => this.openGoalForm());

        // Goal Form
        document.getElementById('goalForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleGoalSubmit();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => this.closeGoalForm());
        document.getElementById('deleteBtn').addEventListener('click', () => {
            if (confirm('Möchtest du dieses Ziel wirklich löschen?')) {
                const id = document.getElementById('goalId').value;
                this.deleteGoal(id);
                this.closeGoalForm();
                this.renderDashboard();
            }
        });

        // Modal Close
        document.querySelector('.close').addEventListener('click', () => this.closeGoalForm());
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('goalModal');
            if (e.target === modal) {
                this.closeGoalForm();
            }
        });

        // Export/Import
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('importFile').click();
        });
        document.getElementById('importFile').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.importData(e.target.files[0]);
                e.target.value = ''; // Reset input
            }
        });

        // Settings
        document.getElementById('settingsBtn').addEventListener('click', () => {
            const panel = document.getElementById('settingsPanel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });

        document.getElementById('saveSettingsBtn').addEventListener('click', () => {
            this.settings.maxActiveGoals = parseInt(document.getElementById('maxActiveGoals').value);
            this.settings.checkInInterval = parseInt(document.getElementById('checkInInterval').value);
            this.saveSettings();
            document.getElementById('settingsPanel').style.display = 'none';
            this.renderDashboard();
        });

        // Check-ins
        document.getElementById('closeCheckInsBtn').addEventListener('click', () => this.closeCheckIns());
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
                this.updateGoal(id, goalData);
            } else {
                this.createGoal(goalData);
            }
            this.closeGoalForm();
            this.renderDashboard();
        } catch (error) {
            alert(error.message);
        }
    }
}

// Initialize App
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new GoalyApp();
});

