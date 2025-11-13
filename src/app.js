// Goaly MVP - Main Application Logic

import GoalService from './domain/goal-service.js';
import SettingsService from './domain/settings-service.js';
import CheckInService from './domain/check-in-service.js';
import UIController from './ui/ui-controller.js';
import Goal from './domain/goal.js';
import LanguageService from './domain/language-service.js';

class GoalyApp {
    constructor() {
        this.settingsService = new SettingsService();
        this.languageService = new LanguageService();
        this.goalService = new GoalService();
        
        this.checkIns = [];
        this.checkInTimer = null;
        this.init();
    }

    init() {
        this.settingsService.loadSettings();
        const resolvedLanguage = this.languageService.init(this.settingsService.getSettings().language);
        if (resolvedLanguage !== this.settingsService.getSettings().language) {
            this.settingsService.updateSettings({ language: resolvedLanguage });
        }
        this.languageService.applyTranslations(document);

        this.goalService.loadGoals();
        // Migrate existing goals to automatic activation
        this.goalService.migrateGoalsToAutoActivation(this.settingsService.getSettings().maxActiveGoals);
        this.checkInService = new CheckInService(this.goalService, this.settingsService);
        this.uiController = new UIController(this);
        this.uiController.renderViews();
        this.refreshCheckIns();
        this.startCheckInTimer();
    }

    startCheckInTimer() {
        if (this.checkInTimer) {
            clearInterval(this.checkInTimer);
        }

        this.refreshCheckIns();
        this.checkInTimer = setInterval(() => {
            this.refreshCheckIns();
        }, 60000);
    }

    refreshCheckIns({ render = true } = {}) {
        this.checkIns = this.checkInService.getCheckIns();
        if (render && this.uiController && typeof this.uiController.renderCheckInView === 'function') {
            this.uiController.renderCheckInView();
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
                
                // Load settings first when available
                if (data.settings) {
                    this.settingsService.updateSettings(data.settings);
                    if (this.settingsService.getSettings().language) {
                        this.languageService.setLanguage(this.settingsService.getSettings().language, { notify: false });
                    }
                    this.startCheckInTimer();
                }
                
                // Then load goals and migrate them with the current maxActiveGoals value
                if (data.goals) {
                    this.goalService.goals = data.goals.map(goal => new Goal(goal));
                    this.checkInService = new CheckInService(this.goalService, this.settingsService);
                    // Activate the top N goals by priority right after import
                    this.goalService.migrateGoalsToAutoActivation(this.settingsService.getSettings().maxActiveGoals);
                }

                this.uiController.renderViews();
                this.refreshCheckIns();
                this.languageService.applyTranslations(document);
                alert(this.languageService.translate('import.success'));
            } catch (error) {
                alert(this.languageService.translate('import.error', { message: error.message }));
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

export default GoalyApp;