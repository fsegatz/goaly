// src/domain/migration-manager.js

import { migratePayloadToCurrent } from './migration-service.js';
import { isSameVersion } from '../utils/versioning.js';

/**
 * Manages data migration when importing older versions
 */
class MigrationManager {
    constructor(app) {
        this.app = app;
        this.pendingMigration = null;
    }

    /**
     * Begin migration process for an older data version
     */
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

        this.app.uiController.openMigrationPrompt({
            fromVersion: sourceVersion,
            toVersion: this.app.currentDataVersion,
            fileName: fileName ?? null
        });
    }

    /**
     * Handle request to review migration diff
     */
    handleMigrationReviewRequest() {
        if (!this.pendingMigration) {
            return;
        }
        this.app.uiController.openMigrationDiff({
            fromVersion: this.pendingMigration.sourceVersion,
            toVersion: this.app.currentDataVersion,
            originalString: this.pendingMigration.originalString,
            migratedString: this.pendingMigration.migratedString,
            fileName: this.pendingMigration.fileName ?? null
        });
    }

    /**
     * Cancel migration
     */
    cancelMigration() {
        this.pendingMigration = null;
        if (this.app.uiController && typeof this.app.uiController.closeMigrationModals === 'function') {
            this.app.uiController.closeMigrationModals();
        }
        this.alertError('import.migrationCancelled');
    }

    /**
     * Complete migration and apply migrated payload
     */
    completeMigration() {
        if (!this.pendingMigration) {
            this.alertError('import.incompatible');
            return;
        }

        try {
            const payload = this.pendingMigration.migratedPayload;
            if (!payload || !isSameVersion(payload.version, this.app.currentDataVersion)) {
                throw new Error('Migrated payload is incompatible with this version.');
            }
            this.app.applyImportedPayload(payload);
            this.pendingMigration = null;
            this.app.uiController.closeMigrationModals();
            this.alertSuccess();
        } catch (error) {
            this.alertError('import.error', { message: error.message });
        }
    }

    /**
     * Show success alert
     */
    alertSuccess() {
        alert(this.app.languageService.translate('import.success'));
    }

    /**
     * Show error alert
     */
    alertError(messageKey, replacements) {
        alert(this.app.languageService.translate(messageKey, replacements));
    }

    /**
     * Get pending migration
     */
    getPendingMigration() {
        return this.pendingMigration;
    }
}

export default MigrationManager;

