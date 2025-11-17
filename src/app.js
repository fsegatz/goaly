// Goaly MVP - Main Application Logic

import GoalService from './domain/services/goal-service.js';
import SettingsService from './domain/services/settings-service.js';
import ReviewService from './domain/services/review-service.js';
import UIController from './ui/ui-controller.js';
import Goal from './domain/models/goal.js';
import LanguageService from './domain/services/language-service.js';
import DeveloperModeService from './domain/services/developer-mode-service.js';
import SyncManager from './domain/sync/sync-manager.js';
import ImportExportService from './domain/utils/import-export-service.js';
import MigrationManager from './domain/migration/migration-manager.js';
import TimerService from './domain/services/timer-service.js';
import { GOAL_FILE_VERSION } from './domain/utils/versioning.js';
import { DEVELOPER_MODE_PRESS_DURATION_MS, DEVELOPER_MODE_VISUAL_FEEDBACK_MS } from './domain/utils/constants.js';

class GoalyApp {
    constructor() {
        this.settingsService = new SettingsService();
        this.languageService = new LanguageService();
        this.goalService = new GoalService();
        this.developerModeService = new DeveloperModeService();
        this.currentDataVersion = GOAL_FILE_VERSION;
        
        this.checkIns = [];
        this.reviewService = null;
        
        // Initialize service managers
        this.syncManager = new SyncManager(this);
        this.importExportService = new ImportExportService(this);
        this.migrationManager = new MigrationManager(this);
        this.timerService = new TimerService(this);
        
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
        this.reviewService = new ReviewService(this.goalService, this.settingsService);
        this.syncManager.hookGoalSavesForBackgroundSync();
        
        // Initialize Google Drive sync service if credentials are available
        this.syncManager.initGoogleDriveSync();
        
        this.uiController = new UIController(this);
        this.uiController.renderViews();
        this.refreshCheckIns();
        this.timerService.startCheckInTimer();
        this.setupDeveloperMode();
    }

    setupDeveloperMode() {
        const logo = document.getElementById('goalyLogo');
        if (!logo) {
            return;
        }

        let pressTimer = null;

        const startPress = (e) => {
            e.preventDefault();
            pressTimer = setTimeout(() => {
                // Press duration has passed
                this.developerModeService.enable();
                this.uiController.settingsView.updateDeveloperModeVisibility();
                // Visual feedback
                logo.style.transform = 'scale(1.1)';
                logo.style.transition = 'transform 0.2s';
                const visualFeedbackTimer = setTimeout(() => {
                    logo.style.transform = 'scale(1)';
                }, DEVELOPER_MODE_VISUAL_FEEDBACK_MS);
                // Use unref() to prevent timer from keeping Node.js process alive (for testing)
                if (typeof visualFeedbackTimer?.unref === 'function') {
                    visualFeedbackTimer.unref();
                }
                // Show non-blocking notification
                const statusView = this.uiController.settingsView;
                if (statusView) {
                    statusView.showGoogleDriveStatus('Developer mode enabled!', false);
                }
                pressTimer = null;
            }, DEVELOPER_MODE_PRESS_DURATION_MS);
            
            // Use unref() to prevent timer from keeping Node.js process alive (for testing)
            if (typeof pressTimer?.unref === 'function') {
                pressTimer.unref();
            }
        };

        const cancelPress = () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };

        // Mouse events (for desktop)
        logo.addEventListener('mousedown', startPress);
        logo.addEventListener('mouseup', cancelPress);
        logo.addEventListener('mouseleave', cancelPress);

        // Touch events (for mobile)
        logo.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startPress(e);
        });
        logo.addEventListener('touchend', cancelPress);
        logo.addEventListener('touchcancel', cancelPress);
        logo.addEventListener('touchmove', cancelPress);

        // Update visibility on load
        this.uiController.settingsView.updateDeveloperModeVisibility();
    }

    startCheckInTimer() {
        this.timerService.startCheckInTimer();
    }
    
    stopCheckInTimer() {
        this.timerService.stopCheckInTimer();
    }

    refreshCheckIns({ render = true } = {}) {
        this.checkIns = this.reviewService.getCheckIns();
        if (render && this.uiController && typeof this.uiController.renderCheckInView === 'function') {
            this.uiController.renderCheckInView();
        }
    }

    exportData() {
        this.importExportService.exportData();
    }

    importData(file) {
        this.importExportService.importData(file);
    }

    applyImportedPayload(payload) {
        if (!Array.isArray(payload.goals)) {
            throw new Error('Missing goals array in payload.');
        }

        // Load settings first when available
        if (payload.settings) {
            this.settingsService.updateSettings(payload.settings);
            if (this.settingsService.getSettings().language) {
                this.languageService.setLanguage(this.settingsService.getSettings().language, { notify: false });
            }
            this.startCheckInTimer();
        }

        this.goalService.goals = payload.goals.map(goal => new Goal(goal));
        this.reviewService = new ReviewService(this.goalService, this.settingsService);
        this.goalService.migrateGoalsToAutoActivation(this.settingsService.getSettings().maxActiveGoals);

        this.uiController.renderViews();
        this.refreshCheckIns();
        this.languageService.applyTranslations(document);
    }

    beginMigration({ originalPayload, sourceVersion, fileName }) {
        this.migrationManager.beginMigration({ originalPayload, sourceVersion, fileName });
    }

    handleMigrationReviewRequest() {
        this.migrationManager.handleMigrationReviewRequest();
    }

    cancelMigration() {
        this.migrationManager.cancelMigration();
    }

    completeMigration() {
        this.migrationManager.completeMigration();
    }

    async authenticateGoogleDrive() {
        await this.syncManager.authenticateGoogleDrive();
    }

    signOutGoogleDrive() {
        this.syncManager.signOutGoogleDrive();
    }

    async syncWithGoogleDrive({ background = false } = {}) {
        await this.syncManager.syncWithGoogleDrive({ background });
    }

    async downloadFromGoogleDrive() {
        await this.syncManager.downloadFromGoogleDrive();
    }
}

// Initialize App
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new GoalyApp();
});

export default GoalyApp;