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
import ErrorHandler from './domain/services/error-handler.js';
import { GOAL_FILE_VERSION } from './domain/utils/versioning.js';
import { DEVELOPER_MODE_PRESS_DURATION_MS, DEVELOPER_MODE_VISUAL_FEEDBACK_MS, GOAL_SAVE_INTERVAL_MS } from './domain/utils/constants.js';
import { getOptionalElement } from './ui/utils/dom-utils.js';

class GoalyApp {
    constructor() {
        this.settingsService = new SettingsService();
        this.languageService = new LanguageService();
        this.errorHandler = new ErrorHandler(this.languageService);
        this.goalService = new GoalService([], this.errorHandler);
        this.developerModeService = new DeveloperModeService();
        this.currentDataVersion = GOAL_FILE_VERSION;
        
        this.reviews = [];
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
        this.syncManager.hookSettingsUpdatesForBackgroundSync();
        
        // Initialize Google Drive sync service if credentials are available
        this.syncManager.initGoogleDriveSync();
        
        this.uiController = new UIController(this);
        // Set UI controller in error handler after it's created
        this.errorHandler.setUIController(this.uiController);
        this.uiController.renderViews();
        this.refreshReviews();
        this.timerService.startReviewTimer();
        this.setupDeveloperMode();
    }

    setupDeveloperMode() {
        const logo = getOptionalElement('goalyLogo');
        if (!logo) {
            return;
        }

        let pressTimer = null;

        const startPress = (e) => {
            if (e) {
                e.preventDefault();
            }
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
        let touchStartTime = null;
        let touchMoved = false;
        logo.addEventListener('touchstart', (e) => {
            touchStartTime = Date.now();
            touchMoved = false;
            // Don't preventDefault immediately - allow click for quick taps
            // Quick tap navigation is handled by the 'click' event in ui-controller.js
            startPress(null); // Pass null so preventDefault isn't called
        }, { passive: true });
        logo.addEventListener('touchmove', () => {
            touchMoved = true;
            cancelPress();
        }, { passive: true });
        logo.addEventListener('touchend', (e) => {
            cancelPress();
            touchStartTime = null;
            touchMoved = false;
        }, { passive: true });
        logo.addEventListener('touchcancel', () => {
            cancelPress();
            touchStartTime = null;
            touchMoved = false;
        }, { passive: true });

        // Update visibility on load
        this.uiController.settingsView.updateDeveloperModeVisibility();
    }

    startReviewTimer() {
        this.timerService.startReviewTimer();
    }
    
    stopReviewTimer() {
        this.timerService.stopReviewTimer();
    }

    refreshReviews({ render = true } = {}) {
        // getReviews() calls ensureGoalSchedule() which may update goals' review schedules in memory
        // Save goals to persist any schedule updates
        const reviewsBefore = this.reviews?.length ?? 0;
        this.reviews = this.reviewService.getReviews();
        
        // Save goals if schedules were updated (ensureGoalSchedule modifies goals in-place)
        // We save whenever reviews change or periodically to persist schedule updates
        if (this.goalService) {
            const reviewsChanged = this.reviews.length !== reviewsBefore;
            // Save if reviews changed (schedule updates may have occurred) or periodically
            // This ensures nextReviewAt values calculated by ensureGoalSchedule are persisted
            if (reviewsChanged || !this._lastReviewSave || (Date.now() - this._lastReviewSave) > GOAL_SAVE_INTERVAL_MS) {
                this.goalService.saveGoals();
                this._lastReviewSave = Date.now();
            }
        }
        
        if (render && this.uiController) {
            this.uiController.renderViews();
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
            this.startReviewTimer();
        }

        this.goalService.goals = payload.goals.map(goal => new Goal(goal));
        this.reviewService = new ReviewService(this.goalService, this.settingsService);
        this.goalService.migrateGoalsToAutoActivation(this.settingsService.getSettings().maxActiveGoals);

        this.uiController.renderViews();
        this.refreshReviews();
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