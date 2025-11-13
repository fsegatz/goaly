// Goaly MVP - Main Application Logic

import GoalService from './domain/goal-service.js';
import SettingsService from './domain/settings-service.js';
import ReviewService from './domain/review-service.js';
import UIController from './ui/ui-controller.js';
import Goal from './domain/goal.js';
import LanguageService from './domain/language-service.js';
import { prepareExportPayload, migratePayloadToCurrent } from './domain/migration-service.js';
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
        this.currentDataVersion = GOAL_FILE_VERSION;
        this.pendingMigration = null;
        
        this.checkIns = [];
        this.reviewService = null;
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
        this.reviewService = new ReviewService(this.goalService, this.settingsService);
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

            if (!fileVersion || Array.isArray(data)) {
                this.beginMigration({
                    originalPayload: data,
                    sourceVersion: fileVersion,
                    fileName: file?.name ?? null
                });
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
        const data = Array.isArray(payload) ? { goals: payload } : payload;

        if (!Array.isArray(data.goals)) {
            throw new Error('Missing goals array in payload.');
        }

        // Load settings first when available
        if (data.settings) {
            this.settingsService.updateSettings(data.settings);
            if (this.settingsService.getSettings().language) {
                this.languageService.setLanguage(this.settingsService.getSettings().language, { notify: false });
            }
            this.startCheckInTimer();
        }

        this.goalService.goals = data.goals.map(goal => new Goal(goal));
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
}

// Initialize App
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new GoalyApp();
});

export default GoalyApp;