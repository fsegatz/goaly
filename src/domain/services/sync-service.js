// src/domain/services/sync-service.js

/**
 * @module SyncService
 * @description High-level synchronization orchestration service.
 * Coordinates between the app and Google Drive, handling auto-sync,
 * background sync, and three-way merge operations.
 */

import GoogleAuthService from './google-auth-service.js';
import GoogleDriveService, { GoogleDriveFileNotFoundError } from './google-drive-service.js';
import { prepareExportPayload, migratePayloadToCurrent } from '../migration/migration-service.js';
import { mergePayloads } from './sync-merge-service.js';
import { isValidVersion, isSameVersion, isOlderVersion, isNewerVersion } from '../utils/versioning.js';
import { GOOGLE_DRIVE_SYNC_DEBOUNCE_MS, STORAGE_KEY_GDRIVE_FILE_ID } from '../utils/constants.js';

/**
 * Manages Google Drive synchronization for the app.
 * @class
 */
class SyncService {
    /**
     * Create a SyncService.
     * @param {Object} app - The main application instance
     */
    constructor(app) {
        this.app = app;
        this.authService = null;
        this.driveService = null;
        this.syncDebounce = null;
        this._isSyncing = false;
        this._suppressAutoSync = false;
    }

    /**
     * Initialize Google Drive sync service if credentials are available.
     * @async
     * @returns {Promise<void>}
     */
    async initGoogleDriveSync() {
        const apiKey = globalThis.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY;
        const clientId = globalThis.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;

        if (apiKey && clientId) {
            this.authService = new GoogleAuthService();
            try {
                await this.authService.initialize(apiKey, clientId);
                this.driveService = new GoogleDriveService(this.authService);

                if (this.authService.isAuthenticated()) {
                    this.syncWithGoogleDrive({ background: true }).catch(error => {
                        this.app.errorHandler.warning('googleDrive.syncError', { message: error?.message || 'Background sync failed' }, error, { context: 'initialization' });
                    });
                }
            } catch (error) {
                this.app.errorHandler.error('googleDrive.syncError', { message: error?.message || 'Failed to initialize Google Drive sync' }, error, { context: 'initialization' });
                this.authService = null;
                this.driveService = null;
            }
        }
    }

    /**
     * Hook into goal saves to trigger background sync.
     */
    hookGoalSavesForBackgroundSync() {
        if (!this.app.goalService || typeof this.app.goalService.onAfterSave !== 'function') {
            return;
        }
        this.app.goalService.onAfterSave(() => {
            if (!this._suppressAutoSync) {
                this.scheduleBackgroundSyncSoon();
            }
        });
    }

    /**
     * Hook into settings updates to trigger background sync.
     */
    hookSettingsUpdatesForBackgroundSync() {
        if (!this.app.settingsService || typeof this.app.settingsService.onAfterSave !== 'function') {
            return;
        }
        this.app.settingsService.onAfterSave(() => {
            if (!this._suppressAutoSync) {
                this.scheduleBackgroundSyncSoon();
            }
        });
    }

    /**
     * Schedule a background sync after a debounce period.
     */
    scheduleBackgroundSyncSoon() {
        if (!this.authService?.isAuthenticated()) {
            return;
        }
        if (this._isSyncing || this._suppressAutoSync) {
            return;
        }
        if (this.syncDebounce) {
            clearTimeout(this.syncDebounce);
        }
        this.syncDebounce = setTimeout(() => {
            this.syncWithGoogleDrive({ background: true }).catch(error => {
                this.app.errorHandler.warning('googleDrive.syncError', { message: error?.message || 'Background sync failed' }, error, { context: 'debounced' });
            });
            this.syncDebounce = null;
        }, GOOGLE_DRIVE_SYNC_DEBOUNCE_MS);
        if (typeof this.syncDebounce?.unref === 'function') {
            this.syncDebounce.unref();
        }
    }

    /**
     * Get the localStorage key for last sync data.
     * @returns {string}
     */
    getLastSyncStorageKey() {
        const fileId = this.driveService?.fileId ||
            localStorage.getItem(STORAGE_KEY_GDRIVE_FILE_ID) ||
            'unknown';
        return `goaly_gdrive_last_sync_${fileId}`;
    }

    /**
     * Authenticate with Google Drive.
     */
    async authenticateGoogleDrive() {
        if (!this.authService) {
            this.app.errorHandler.error('googleDrive.notConfigured', {});
            return;
        }

        try {
            await this.authService.authenticate();
            this.app.uiController.settingsView.updateGoogleDriveUI();
            this.syncWithGoogleDrive({ background: true }).catch(() => { });
            this.app.uiController.settingsView.showGoogleDriveStatus(
                this.app.languageService.translate('googleDrive.authenticated'),
                false
            );
        } catch (error) {
            this.app.errorHandler.error('googleDrive.authError', { message: error?.message || 'Unknown error occurred' }, error);
        }
    }

    /**
     * Sign out from Google Drive.
     */
    signOutGoogleDrive() {
        if (!this.authService) {
            return;
        }

        this.authService.signOut();
        this.driveService?.clearCache();

        if (this.syncDebounce) {
            clearTimeout(this.syncDebounce);
            this.syncDebounce = null;
        }
        this.app.uiController.settingsView.updateGoogleDriveUI();
    }

    /**
     * Download remote data from Google Drive.
     * @private
     */
    async _downloadRemoteData(statusView, background) {
        try {
            if (!background) {
                statusView.showGoogleDriveStatus(
                    this.app.languageService.translate('googleDrive.status.checkingRemote') || 'Checking remote data…',
                    false
                );
            }
            const downloaded = await this.driveService.downloadData();
            const remotePayload = downloaded?.data ?? null;
            if (!background) {
                statusView.showGoogleDriveStatus(
                    this.app.languageService.translate('googleDrive.status.remoteFound') || 'Remote data found. Downloaded successfully.',
                    false
                );
            }
            return remotePayload;
        } catch (e) {
            if (!(e instanceof GoogleDriveFileNotFoundError)) {
                throw e;
            }
            if (!background) {
                statusView.showGoogleDriveStatus(
                    this.app.languageService.translate('googleDrive.status.noRemote') || 'No remote data found. Will create it on upload.',
                    false
                );
            }
            return null;
        }
    }

    /**
     * Load base payload from last successful sync.
     * @private
     */
    _loadBasePayload() {
        try {
            const baseStr = localStorage.getItem(this.getLastSyncStorageKey());
            return baseStr ? JSON.parse(baseStr) : null;
        } catch (e) {
            this.app.errorHandler.warning('googleDrive.syncError', { message: 'Failed to parse base payload from localStorage; clearing corrupted entry' }, e, { context: 'parseBasePayload' });
            localStorage.removeItem(this.getLastSyncStorageKey());
            return null;
        }
    }

    /**
     * Upload merged data if changes detected.
     * @private
     */
    async _uploadIfChanged(merged, remotePayload, statusView, background) {
        const canonicalize = (payload) => {
            if (!payload) return null;
            const migrated = migratePayloadToCurrent(payload);
            const goals = Array.isArray(migrated.goals) ? migrated.goals.map(g => {
                const c = { ...g };
                if (c.createdAt instanceof Date) c.createdAt = c.createdAt.toISOString();
                if (c.lastUpdated instanceof Date) c.lastUpdated = c.lastUpdated.toISOString();
                if (c.deadline instanceof Date) c.deadline = c.deadline.toISOString();
                return c;
            }).sort((a, b) => (a.id || '').localeCompare(b.id || '')) : [];
            return {
                version: migrated.version,
                exportDate: null,
                goals,
                settings: migrated.settings || {}
            };
        };

        const mergedCanonical = canonicalize(merged);
        const remoteCanonical = canonicalize(remotePayload);
        const shouldUpload =
            !remoteCanonical ||
            JSON.stringify(mergedCanonical) !== JSON.stringify(remoteCanonical);

        if (shouldUpload) {
            if (!background) {
                statusView.showGoogleDriveStatus(
                    this.app.languageService.translate('googleDrive.status.uploading') || 'Uploading merged data to Google Drive…',
                    false
                );
            }
            await this.driveService.uploadData(
                this.app.goalService.goals,
                this.app.settingsService.getSettings()
            );
        }

        return shouldUpload;
    }

    /**
     * Sync with Google Drive (three-way merge).
     * @param {Object} options
     * @param {boolean} options.background - Whether this is a background sync
     */
    async syncWithGoogleDrive({ background = false } = {}) {
        if (!this.driveService) {
            this.app.errorHandler.error('googleDrive.notConfigured', {});
            return;
        }

        if (!this.authService.isAuthenticated()) {
            this.app.errorHandler.error('googleDrive.authError', { message: 'Not authenticated' });
            return;
        }

        if (typeof this.authService.ensureAuthenticated === 'function') {
            try {
                await this.authService.ensureAuthenticated();
            } catch (error) {
                this.app.errorHandler.warning('googleDrive.syncError', { message: 'Token refresh check failed, proceeding with sync' }, error, { context: 'tokenRefresh' });
            }
        }

        const statusView = this.app.uiController.settingsView;
        if (!background) {
            statusView.showGoogleDriveStatus(
                this.app.languageService.translate('googleDrive.syncing'),
                false
            );
            statusView.showGoogleDriveStatus(
                this.app.languageService.translate('googleDrive.status.buildingLocalPayload') || 'Building local payload…',
                false
            );
        }

        try {
            if (this._isSyncing) {
                return;
            }
            this._isSyncing = true;
            this._suppressAutoSync = true;

            const localPayload = prepareExportPayload(
                this.app.goalService.goals || [],
                this.app.settingsService.getSettings()
            );

            const remotePayload = await this._downloadRemoteData(statusView, background);
            const basePayload = this._loadBasePayload();

            if (!background) {
                statusView.showGoogleDriveStatus(
                    this.app.languageService.translate('googleDrive.status.merging') || 'Merging data (base/local/remote)…',
                    false
                );
            }
            const merged = mergePayloads({
                base: basePayload,
                local: localPayload,
                remote: remotePayload
            });

            if (!background) {
                statusView.showGoogleDriveStatus(
                    this.app.languageService.translate('googleDrive.status.applying') || 'Applying merged data locally…',
                    false
                );
            }
            this.app.applyImportedPayload(merged);

            const shouldUpload = await this._uploadIfChanged(merged, remotePayload, statusView, background);

            localStorage.setItem(this.getLastSyncStorageKey(), JSON.stringify(prepareExportPayload(
                this.app.goalService.goals,
                this.app.settingsService.getSettings()
            )));

            if (!background) {
                const finalKey = shouldUpload ? 'googleDrive.uploadSuccess' : 'googleDrive.noChanges';
                statusView.showGoogleDriveStatus(
                    this.app.languageService.translate(finalKey),
                    false,
                    true
                );
            }
        } catch (error) {
            const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
            this.app.errorHandler.error('googleDrive.syncError', { message: errorMessage }, error);
        } finally {
            this._isSyncing = false;
            this._suppressAutoSync = false;
        }
    }

    /**
     * Download data from Google Drive.
     */
    async downloadFromGoogleDrive() {
        if (!this.authService?.isAuthenticated()) {
            return;
        }

        if (typeof this.authService.ensureAuthenticated === 'function') {
            try {
                await this.authService.ensureAuthenticated();
            } catch (error) {
                this.app.errorHandler.warning('googleDrive.syncError', { message: 'Token refresh check failed, proceeding with download' }, error, { context: 'tokenRefresh' });
            }
        }

        const statusView = this.app.uiController.settingsView;

        try {
            const result = await this.driveService.downloadData();
            const data = result.data;

            const fileVersion = Array.isArray(data) ? null : data.version ?? null;

            if (fileVersion && !isValidVersion(fileVersion)) {
                this.app.errorHandler.error('import.invalidVersionFormat', { version: fileVersion });
                return;
            }

            if (isSameVersion(fileVersion, this.app.currentDataVersion)) {
                this.app.applyImportedPayload(data);
                statusView.showGoogleDriveStatus(
                    this.app.languageService.translate('googleDrive.downloadSuccess'),
                    false
                );
            } else if (isOlderVersion(fileVersion, this.app.currentDataVersion)) {
                this.app.beginMigration({
                    originalPayload: data,
                    sourceVersion: fileVersion,
                    fileName: 'Google Drive'
                });
            } else if (isNewerVersion(fileVersion, this.app.currentDataVersion)) {
                this.app.errorHandler.error('import.versionTooNew', {
                    fileVersion,
                    currentVersion: this.app.currentDataVersion
                });
            } else {
                this.app.errorHandler.error('import.incompatible', {});
            }
        } catch (error) {
            const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
            this.app.errorHandler.error('googleDrive.downloadError', { message: errorMessage }, error);
        }
    }

    /**
     * Show Google Drive error message.
     * @deprecated Use app.errorHandler instead
     */
    showError(messageKey, replacements = {}) {
        this.app.errorHandler.error(messageKey, replacements);
    }

    /**
     * Check if Google Drive sync is available.
     * @returns {boolean}
     */
    isAvailable() {
        return this.authService !== null;
    }

    /**
     * Check if authenticated.
     * @returns {boolean}
     */
    isAuthenticated() {
        return this.authService?.isAuthenticated() || false;
    }

    /**
     * Get sync status information.
     * @returns {Promise<Object>}
     */
    async getSyncStatus() {
        if (!this.driveService) {
            return {
                authenticated: false,
                synced: false,
                lastSyncTime: null
            };
        }
        return this.driveService.getSyncStatus();
    }
}

export default SyncService;
