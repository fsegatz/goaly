// Goaly MVP - Main Application Logic

const GoalService = require('./domain/goal-service');
const SettingsService = require('./domain/settings-service');
const CheckInService = require('./domain/check-in-service');
const UIController = require('./ui/ui-controller');

class GoalyApp {
    constructor() {
        this.settingsService = new SettingsService();
        this.goalService = new GoalService();
        this.checkInService = new CheckInService(this.goalService.goals, this.settingsService.getSettings());
        this.uiController = new UIController(this);
        
        this.checkIns = [];
        this.checkInTimer = null;
        this.init();
    }

    init() {
        this.settingsService.loadSettings();
        this.goalService.loadGoals();
        this.uiController.renderViews();
        this.startCheckInTimer();
    }

    startCheckInTimer() {
        if (this.checkInTimer) {
            clearInterval(this.checkInTimer);
        }

        if (this.settingsService.getSettings().checkInsEnabled) {
            this.checkInTimer = setInterval(() => {
                this.checkIns = this.checkInService.getCheckIns();
                if (this.checkIns.length > 0) {
                    this.uiController.showCheckIns();
                }
            }, 60000);
        }
    }

    exportData() {
        const data = {
            goals: this.goalService.goals.map(goal => ({
                ...goal,
                createdAt: goal.createdAt.toISOString(),
                lastUpdated: goal.lastUpdated.toISOString(),
                deadline: goal.deadline ? goal.deadline.toISOString() : null
            })),
            settings: this.settingsService.getSettings(),
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
                    this.goalService.goals = data.goals.map(goal => ({
                        ...goal,
                        createdAt: new Date(goal.createdAt),
                        lastUpdated: new Date(goal.lastUpdated),
                        deadline: goal.deadline ? new Date(goal.deadline) : null
                    }));
                    this.goalService.saveGoals();
                }

                if (data.settings) {
                    this.settingsService.updateSettings(data.settings);
                    document.getElementById('maxActiveGoals').value = this.settingsService.getSettings().maxActiveGoals;
                    document.getElementById('checkInInterval').value = this.settingsService.getSettings().checkInInterval;
                    document.getElementById('checkInsEnabled').checked = this.settingsService.getSettings().checkInsEnabled !== false;
                    this.startCheckInTimer();
                }

                this.uiController.renderViews();
                alert('Daten erfolgreich importiert!');
            } catch (error) {
                alert('Fehler beim Importieren: ' + error.message);
            }
        };
        reader.readAsText(file);
    }
}

// Initialize App
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new GoalyApp();
});

module.exports = GoalyApp;