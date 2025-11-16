// Goaly MVP - Main Application Logic

import GoalService from './domain/goal-service.js';
import SettingsService from './domain/settings-service.js';
import ReviewService from './domain/review-service.js';
import UIController from './ui/ui-controller.js';
import Goal from './domain/goal.js';
import LanguageService from './domain/language-service.js';
import GoogleDriveSyncService from './domain/google-drive-sync-service.js';
import DeveloperModeService from './domain/developer-mode-service.js';
import { prepareExportPayload, migratePayloadToCurrent } from './domain/migration-service.js';
import { mergePayloads } from './domain/sync-merge-service.js';
import {
    GOAL_FILE_VERSION,
    isValidVersion,
    isSameVersion,
    isOlderVersion,
    isNewerVersion
} from './domain/versioning.js';

class GoalyApp {
    constructor() {
        this.settingsService = new SettingsService();
        this.languageService = new LanguageService();
        this.goalService = new GoalService();
        this.developerModeService = new DeveloperModeService();
        this.currentDataVersion = GOAL_FILE_VERSION;
        this.pendingMigration = null;
        
        this.checkIns = [];
        this.reviewService = null;
        this.checkInTimer = null;
        this.googleDriveSyncTimer = null;
        this.googleDriveSyncDebounce = null;
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
        this.hookGoalSavesForBackgroundSync();
        
        // Initialize Google Drive sync service if credentials are available
        this.googleDriveSyncService = null;
        this.initGoogleDriveSync();
        
        this.uiController = new UIController(this);
        this.uiController.renderViews();
        this.refreshCheckIns();
        this.startCheckInTimer();
        this.setupDeveloperMode();
    }

    setupDeveloperMode() {
        const logo = document.getElementById('goalyLogo');
        if (!logo) {
            return;
        }

        let pressTimer = null;
        let pressStartTime = null;
        const PRESS_DURATION = 5000; // 5 seconds

        const startPress = (e) => {
            e.preventDefault();
            pressStartTime = Date.now();
            pressTimer = setTimeout(() => {
                // 5 seconds have passed
                this.developerModeService.enable();
                this.uiController.settingsView.updateDeveloperModeVisibility();
                // Visual feedback
                logo.style.transform = 'scale(1.1)';
                logo.style.transition = 'transform 0.2s';
                const visualFeedbackTimer = setTimeout(() => {
                    logo.style.transform = 'scale(1)';
                }, 200);
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
            }, PRESS_DURATION);
            
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
            pressStartTime = null;
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

    hookGoalSavesForBackgroundSync() {
        const originalSave = this.goalService.saveGoals.bind(this.goalService);
        this.goalService.saveGoals = () => {
            originalSave();
            this.scheduleBackgroundSyncSoon();
        };
    }

    initGoogleDriveSync() {
        // Get credentials from environment or window config
        const apiKey = window.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY;
        const clientId = window.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;

        if (apiKey && clientId) {
            this.googleDriveSyncService = new GoogleDriveSyncService();
            this.googleDriveSyncService.initialize(apiKey, clientId).catch(error => {
                console.error('Failed to initialize Google Drive sync:', error);
                this.googleDriveSyncService = null;
            });
        }
    }

    startGoogleDriveBackgroundSync() {
        if (this.googleDriveSyncTimer) {
            clearInterval(this.googleDriveSyncTimer);
            this.googleDriveSyncTimer = null;
        }
        if (!this.googleDriveSyncService || !this.googleDriveSyncService.isAuthenticated()) {
            return;
        }
        // Periodic background sync every 2 minutes
        this.googleDriveSyncTimer = setInterval(() => {
            this.syncWithGoogleDrive({ background: true }).catch(() => {});
        }, 120000);
        if (typeof this.googleDriveSyncTimer?.unref === 'function') {
            this.googleDriveSyncTimer.unref();
        }
        // Also sync when window regains focus
        window.addEventListener('focus', () => this.syncWithGoogleDrive({ background: true }).catch(() => {}));
    }

    scheduleBackgroundSyncSoon() {
        if (!this.googleDriveSyncService || !this.googleDriveSyncService.isAuthenticated()) {
            return;
        }
        if (this.googleDriveSyncDebounce) {
            clearTimeout(this.googleDriveSyncDebounce);
        }
        this.googleDriveSyncDebounce = setTimeout(() => {
            this.syncWithGoogleDrive({ background: true }).catch(() => {});
            this.googleDriveSyncDebounce = null;
        }, 5000);
        if (typeof this.googleDriveSyncDebounce?.unref === 'function') {
            this.googleDriveSyncDebounce.unref();
        }
    }

    startCheckInTimer() {
        if (this.checkInTimer) {
            clearInterval(this.checkInTimer);
            this.checkInTimer = null;
        }

        this.refreshCheckIns();
        this.checkInTimer = setInterval(() => {
            this.refreshCheckIns();
        }, 60000);
        
        // Use unref() to prevent timer from keeping Node.js process alive (for testing)
        if (typeof this.checkInTimer.unref === 'function') {
            this.checkInTimer.unref();
        }
    }
    
    stopCheckInTimer() {
        if (this.checkInTimer) {
            clearInterval(this.checkInTimer);
            this.checkInTimer = null;
        }
    }

    refreshCheckIns({ render = true } = {}) {
        this.checkIns = this.reviewService.getCheckIns();
        if (render && this.uiController && typeof this.uiController.renderCheckInView === 'function') {
            this.uiController.renderCheckInView();
        }
    }

    exportData() {
        const data = prepareExportPayload(this.goalService.goals, this.settingsService.getSettings());

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
            const rawContent = e.target.result;
            let data;
            try {
                data = JSON.parse(rawContent);
            } catch (error) {
                this.alertImportError('import.invalidJson');
                return;
            }

            if (!data || (typeof data !== 'object' && !Array.isArray(data))) {
                this.alertImportError('import.invalidStructure');
                return;
            }

            const fileVersion = Array.isArray(data) ? null : data.version ?? null;

            if (fileVersion && !isValidVersion(fileVersion)) {
                this.alertImportError('import.invalidVersionFormat', { version: fileVersion });
                return;
            }

            if (isSameVersion(fileVersion, this.currentDataVersion)) {
                try {
                    this.applyImportedPayload(data);
                    this.alertImportSuccess();
                } catch (error) {
                    this.alertImportError('import.error', { message: error.message });
                }
                return;
            }

            if (isOlderVersion(fileVersion, this.currentDataVersion)) {
                this.beginMigration({
                    originalPayload: data,
                    sourceVersion: fileVersion,
                    fileName: file?.name ?? null
                });
                return;
            }

            if (isNewerVersion(fileVersion, this.currentDataVersion)) {
                this.alertImportError('import.versionTooNew', {
                    fileVersion,
                    currentVersion: this.currentDataVersion
                });
                return;
            }

            this.alertImportError('import.incompatible');
        };
        reader.readAsText(file);
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
        const migrated = migratePayloadToCurrent(originalPayload);
        const originalString = JSON.stringify(originalPayload, null, 2);
        const migratedString = JSON.stringify(migrated, null, 2);

        this.pendingMigration = {
            originalPayload: originalPayload,
            migratedPayload: migrated,
            sourceVersion: sourceVersion,
            fileName: fileName ?? null,
            originalString,
            migratedString
        };

        this.uiController.openMigrationPrompt({
            fromVersion: sourceVersion,
            toVersion: this.currentDataVersion,
            fileName: fileName ?? null
        });
    }

    handleMigrationReviewRequest() {
        if (!this.pendingMigration) {
            return;
        }
        this.uiController.openMigrationDiff({
            fromVersion: this.pendingMigration.sourceVersion,
            toVersion: this.currentDataVersion,
            originalString: this.pendingMigration.originalString,
            migratedString: this.pendingMigration.migratedString,
            fileName: this.pendingMigration.fileName ?? null
        });
    }

    cancelMigration() {
        this.pendingMigration = null;
        if (this.uiController && typeof this.uiController.closeMigrationModals === 'function') {
            this.uiController.closeMigrationModals();
        }
        this.alertImportError('import.migrationCancelled');
    }

    completeMigration() {
        if (!this.pendingMigration) {
            this.alertImportError('import.incompatible');
            return;
        }

        try {
            const payload = this.pendingMigration.migratedPayload;
            if (!payload || !isSameVersion(payload.version, this.currentDataVersion)) {
                throw new Error('Migrated payload is incompatible with this version.');
            }
            this.applyImportedPayload(payload);
            this.pendingMigration = null;
            this.uiController.closeMigrationModals();
            this.alertImportSuccess();
        } catch (error) {
            this.alertImportError('import.error', { message: error.message });
        }
    }

    alertImportSuccess() {
        alert(this.languageService.translate('import.success'));
    }

    alertImportError(messageKey, replacements) {
        alert(this.languageService.translate(messageKey, replacements));
    }

    async authenticateGoogleDrive() {
        if (!this.googleDriveSyncService) {
            this.showGoogleDriveError('googleDrive.notConfigured');
            return;
        }

        try {
            await this.googleDriveSyncService.authenticate();
            this.uiController.settingsView.updateGoogleDriveUI();
            this.startGoogleDriveBackgroundSync();
            this.uiController.settingsView.showGoogleDriveStatus(
                this.languageService.translate('googleDrive.authenticated'),
                false
            );
        } catch (error) {
            console.error('Google Drive authentication error:', error);
            // Show the actual error message from the service
            const errorMessage = error.message || 'Unknown error occurred';
            this.showGoogleDriveError('googleDrive.authError', { message: errorMessage });
        }
    }

    signOutGoogleDrive() {
        if (!this.googleDriveSyncService) {
            return;
        }

        this.googleDriveSyncService.signOut();
        this.uiController.settingsView.updateGoogleDriveUI();
    }

    async syncWithGoogleDrive({ background = false } = {}) {
        if (!this.googleDriveSyncService) {
            this.showGoogleDriveError('googleDrive.notConfigured');
            return;
        }

        if (!this.googleDriveSyncService.isAuthenticated()) {
            this.showGoogleDriveError('googleDrive.authError', { message: 'Not authenticated' });
            return;
        }

        const statusView = this.uiController.settingsView;
        if (!background) {
            statusView.showGoogleDriveStatus(
                this.languageService.translate('googleDrive.syncing'),
                false
            );
        }

        try {
            // Build local payload
            const localPayload = prepareExportPayload(
                this.goalService.goals || [],
                this.settingsService.getSettings()
            );

            // Download remote if exists
            let remotePayload = null;
            try {
                const downloaded = await this.googleDriveSyncService.downloadData();
                remotePayload = downloaded?.data ?? null;
            } catch (e) {
                // If no file found, proceed with local as source
                if (!String(e?.message || '').includes('No data file found')) {
                    throw e;
                }
            }

            // Load base from last successful sync
            let basePayload = null;
            try {
                const baseStr = localStorage.getItem('goaly_gdrive_last_sync');
                if (baseStr) basePayload = JSON.parse(baseStr);
            } catch {}

            // Merge (three-way if possible)
            const merged = mergePayloads({
                base: basePayload,
                local: localPayload,
                remote: remotePayload ?? localPayload
            });

            // Apply merged locally
            this.applyImportedPayload(merged);

            // Upload merged to remote to converge
            await this.googleDriveSyncService.uploadData(
                this.goalService.goals,
                this.settingsService.getSettings()
            );

            // Persist last sync base for future merges
            localStorage.setItem('goaly_gdrive_last_sync', JSON.stringify(prepareExportPayload(
                this.goalService.goals,
                this.settingsService.getSettings()
            )));

            if (!background) {
                statusView.showGoogleDriveStatus(
                    this.languageService.translate('googleDrive.uploadSuccess'),
                    false
                );
            }

            statusView.updateGoogleDriveUI();
            this.startGoogleDriveBackgroundSync();
        } catch (error) {
            this.showGoogleDriveError('googleDrive.syncError', { message: error.message });
        }
    }

    // Legacy method - kept for backward compatibility but no longer used
    // Sync now always happens automatically toward older state
    async handleSyncConflict(conflictCheck, localPayload) {
        // This method is deprecated - sync is now automatic
        // Keeping for backward compatibility
        const statusView = this.uiController.settingsView;
        
        if (conflictCheck.shouldUpload) {
            await this.googleDriveSyncService.uploadData(
                this.goalService.goals,
                this.settingsService.getSettings()
            );
            statusView.showGoogleDriveStatus(
                this.languageService.translate('googleDrive.uploadSuccess'),
                false
            );
        } else {
            await this.downloadFromGoogleDrive();
            statusView.showGoogleDriveStatus(
                this.languageService.translate('googleDrive.downloadSuccess'),
                false
            );
        }

        statusView.updateGoogleDriveUI();
    }

    async downloadFromGoogleDrive() {
        if (!this.googleDriveSyncService || !this.googleDriveSyncService.isAuthenticated()) {
            return;
        }

        const statusView = this.uiController.settingsView;

        try {
            const result = await this.googleDriveSyncService.downloadData();
            const data = result.data;

            // Validate and import the data
            const fileVersion = Array.isArray(data) ? null : data.version ?? null;

            if (fileVersion && !isValidVersion(fileVersion)) {
                this.showGoogleDriveError('import.invalidVersionFormat', { version: fileVersion });
                return;
            }

            if (isSameVersion(fileVersion, this.currentDataVersion)) {
                this.applyImportedPayload(data);
                statusView.showGoogleDriveStatus(
                    this.languageService.translate('googleDrive.downloadSuccess'),
                    false
                );
            } else if (isOlderVersion(fileVersion, this.currentDataVersion)) {
                this.beginMigration({
                    originalPayload: data,
                    sourceVersion: fileVersion,
                    fileName: 'Google Drive'
                });
            } else if (isNewerVersion(fileVersion, this.currentDataVersion)) {
                this.showGoogleDriveError('import.versionTooNew', {
                    fileVersion,
                    currentVersion: this.currentDataVersion
                });
            } else {
                this.showGoogleDriveError('import.incompatible');
            }
        } catch (error) {
            this.showGoogleDriveError('googleDrive.downloadError', { message: error.message });
        }
    }

    showGoogleDriveError(messageKey, replacements = {}) {
        const message = this.languageService.translate(messageKey, replacements);
        if (this.uiController && this.uiController.settingsView) {
            this.uiController.settingsView.showGoogleDriveStatus(message, true);
        } else {
            alert(message);
        }
    }
}

// Initialize App
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new GoalyApp();
});

export default GoalyApp;