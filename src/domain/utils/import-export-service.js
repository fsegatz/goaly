// src/domain/import-export-service.js

import { prepareExportPayload } from '../migration/migration-service.js';
import { isValidVersion, isSameVersion, isOlderVersion, isNewerVersion } from './versioning.js';

/**
 * Handles import and export of goal data
 */
class ImportExportService {
    constructor(app) {
        this.app = app;
    }

    /**
     * Export data to JSON file
     */
    exportData() {
        const data = prepareExportPayload(
            this.app.goalService.goals,
            this.app.settingsService.getSettings()
        );

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

    /**
     * Import data from JSON file
     */
    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const rawContent = e.target.result;
            let data;
            try {
                data = JSON.parse(rawContent);
            } catch (error) {
                this.alertError('import.invalidJson');
                return;
            }

            if (!data || (typeof data !== 'object' && !Array.isArray(data))) {
                this.alertError('import.invalidStructure');
                return;
            }

            const fileVersion = Array.isArray(data) ? null : data.version ?? null;

            if (fileVersion && !isValidVersion(fileVersion)) {
                this.alertError('import.invalidVersionFormat', { version: fileVersion });
                return;
            }

            if (isSameVersion(fileVersion, this.app.currentDataVersion)) {
                try {
                    this.app.applyImportedPayload(data);
                    this.alertSuccess();
                } catch (error) {
                    this.alertError('import.error', { message: error.message });
                }
                return;
            }

            if (isOlderVersion(fileVersion, this.app.currentDataVersion)) {
                this.app.beginMigration({
                    originalPayload: data,
                    sourceVersion: fileVersion,
                    fileName: file?.name ?? null
                });
                return;
            }

            if (isNewerVersion(fileVersion, this.app.currentDataVersion)) {
                this.alertError('import.versionTooNew', {
                    fileVersion,
                    currentVersion: this.app.currentDataVersion
                });
                return;
            }

            this.alertError('import.incompatible');
        };
        reader.readAsText(file);
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
}

export default ImportExportService;

