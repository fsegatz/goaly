// src/domain/sync-manager.js

import GoogleDriveSyncService, { GoogleDriveFileNotFoundError } from './google-drive-sync-service.js';
import { prepareExportPayload, migratePayloadToCurrent } from '../migration/migration-service.js';
import { mergePayloads } from './sync-merge-service.js';
import { isValidVersion, isSameVersion, isOlderVersion, isNewerVersion } from '../utils/versioning.js';
import { GOOGLE_DRIVE_SYNC_DEBOUNCE_MS, STORAGE_KEY_GDRIVE_FILE_ID } from '../utils/constants.js';

/**
 * Manages Google Drive synchronization for the app
 */
class SyncManager {
    constructor(app) {
        this.app = app;
        this.googleDriveSyncService = null;
        this.syncDebounce = null;
        this._isSyncing = false;
        this._suppressAutoSync = false;
    }

    /**
     * Initialize Google Drive sync service if credentials are available
     */
    async initGoogleDriveSync() {
        const apiKey = window.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY;
        const clientId = window.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;

        if (apiKey && clientId) {
            this.googleDriveSyncService = new GoogleDriveSyncService();
            try {
                await this.googleDriveSyncService.initialize(apiKey, clientId);
                // If already authenticated at startup, perform a one-time background sync
                if (this.googleDriveSyncService.isAuthenticated()) {
                    this.syncWithGoogleDrive({ background: true }).catch(error => {
                        console.error('Background sync failed during initialization:', error);
                    });
                }
            } catch (error) {
                console.error('Failed to initialize Google Drive sync:', error);
                this.googleDriveSyncService = null;
            }
        }
    }

    /**
     * Hook into goal saves to trigger background sync
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
     * Schedule a background sync after a debounce period
     */
    scheduleBackgroundSyncSoon() {
        if (!this.googleDriveSyncService || !this.googleDriveSyncService.isAuthenticated()) {
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
                console.error('Background sync failed (debounced):', error);
            });
            this.syncDebounce = null;
        }, GOOGLE_DRIVE_SYNC_DEBOUNCE_MS);
        if (typeof this.syncDebounce?.unref === 'function') {
            this.syncDebounce.unref();
        }
    }

    /**
     * Get the localStorage key for last sync data
     */
    getLastSyncStorageKey() {
        const fileId = this.googleDriveSyncService?.fileId || 
                      localStorage.getItem(STORAGE_KEY_GDRIVE_FILE_ID) || 
                      'unknown';
        return `goaly_gdrive_last_sync_${fileId}`;
    }

    /**
     * Authenticate with Google Drive
     */
    async authenticateGoogleDrive() {
        if (!this.googleDriveSyncService) {
            this.showError('googleDrive.notConfigured');
            return;
        }

        try {
            await this.googleDriveSyncService.authenticate();
            this.app.uiController.settingsView.updateGoogleDriveUI();
            // Perform a one-time sync after successful authentication
            this.syncWithGoogleDrive({ background: true }).catch(() => {});
            this.app.uiController.settingsView.showGoogleDriveStatus(
                this.app.languageService.translate('googleDrive.authenticated'),
                false
            );
        } catch (error) {
            console.error('Google Drive authentication error:', error);
            const errorMessage = error.message || 'Unknown error occurred';
            this.showError('googleDrive.authError', { message: errorMessage });
        }
    }

    /**
     * Sign out from Google Drive
     */
    signOutGoogleDrive() {
        if (!this.googleDriveSyncService) {
            return;
        }

        this.googleDriveSyncService.signOut();
        // Cleanup debounce timer
        if (this.syncDebounce) {
            clearTimeout(this.syncDebounce);
            this.syncDebounce = null;
        }
        this.app.uiController.settingsView.updateGoogleDriveUI();
    }

    /**
     * Sync with Google Drive (three-way merge)
     */
    async syncWithGoogleDrive({ background = false } = {}) {
        if (!this.googleDriveSyncService) {
            this.showError('googleDrive.notConfigured');
            return;
        }

        if (!this.googleDriveSyncService.isAuthenticated()) {
            this.showError('googleDrive.authError', { message: 'Not authenticated' });
            return;
        }

        // Ensure token is fresh before starting sync
        if (typeof this.googleDriveSyncService.ensureAuthenticated === 'function') {
            try {
                await this.googleDriveSyncService.ensureAuthenticated();
            } catch (error) {
                // If token refresh fails, show error but don't block sync attempt
                // The API call will handle auth errors and retry
                console.warn('Token refresh check failed, proceeding with sync:', error);
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
                // Drop overlapping syncs; background triggers are frequent
                return;
            }
            this._isSyncing = true;
            this._suppressAutoSync = true;

            // Build local payload
            const localPayload = prepareExportPayload(
                this.app.goalService.goals || [],
                this.app.settingsService.getSettings()
            );

            // Download remote if exists
            let remotePayload = null;
            try {
                if (!background) {
                    statusView.showGoogleDriveStatus(
                        this.app.languageService.translate('googleDrive.status.checkingRemote') || 'Checking remote data…',
                        false
                    );
                }
                const downloaded = await this.googleDriveSyncService.downloadData();
                remotePayload = downloaded?.data ?? null;
                if (!background) {
                    statusView.showGoogleDriveStatus(
                        this.app.languageService.translate('googleDrive.status.remoteFound') || 'Remote data found. Downloaded successfully.',
                        false
                    );
                }
            } catch (e) {
                // If no file found, proceed with local as source
                if (!(e instanceof GoogleDriveFileNotFoundError)) {
                    throw e;
                }
                if (!background) {
                    statusView.showGoogleDriveStatus(
                        this.app.languageService.translate('googleDrive.status.noRemote') || 'No remote data found. Will create it on upload.',
                        false
                    );
                }
            }

            // Load base from last successful sync
            let basePayload = null;
            try {
                const baseStr = localStorage.getItem(this.getLastSyncStorageKey());
                if (baseStr) basePayload = JSON.parse(baseStr);
            } catch (e) {
                console.error('Failed to parse base payload from localStorage; clearing corrupted entry.', e);
                localStorage.removeItem(this.getLastSyncStorageKey());
            }

            // Merge (three-way if possible)
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

            // Apply merged locally
            if (!background) {
                statusView.showGoogleDriveStatus(
                    this.app.languageService.translate('googleDrive.status.applying') || 'Applying merged data locally…',
                    false
                );
            }
            this.app.applyImportedPayload(merged);

            // Determine if upload is necessary (skip if no content changes)
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
                await this.googleDriveSyncService.uploadData(
                    this.app.goalService.goals,
                    this.app.settingsService.getSettings()
                );
            }

            // Persist last sync base for future merges
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
            // Provide better error messages - handle undefined error.message
            const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
            this.showError('googleDrive.syncError', { message: errorMessage });
        } finally {
            this._isSyncing = false;
            this._suppressAutoSync = false;
        }
    }

    /**
     * Download data from Google Drive
     */
    async downloadFromGoogleDrive() {
        if (!this.googleDriveSyncService || !this.googleDriveSyncService.isAuthenticated()) {
            return;
        }

        // Ensure token is fresh before downloading
        if (typeof this.googleDriveSyncService.ensureAuthenticated === 'function') {
            try {
                await this.googleDriveSyncService.ensureAuthenticated();
            } catch (error) {
                // If token refresh fails, show error but don't block download attempt
                // The API call will handle auth errors and retry
                console.warn('Token refresh check failed, proceeding with download:', error);
            }
        }

        const statusView = this.app.uiController.settingsView;

        try {
            const result = await this.googleDriveSyncService.downloadData();
            const data = result.data;

            // Validate and import the data
            const fileVersion = Array.isArray(data) ? null : data.version ?? null;

            if (fileVersion && !isValidVersion(fileVersion)) {
                this.showError('import.invalidVersionFormat', { version: fileVersion });
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
                this.showError('import.versionTooNew', {
                    fileVersion,
                    currentVersion: this.app.currentDataVersion
                });
            } else {
                this.showError('import.incompatible');
            }
        } catch (error) {
            // Provide better error messages - handle undefined error.message
            const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
            this.showError('googleDrive.downloadError', { message: errorMessage });
        }
    }

    /**
     * Show Google Drive error message
     */
    showError(messageKey, replacements = {}) {
        const message = this.app.languageService.translate(messageKey, replacements);
        if (this.app.uiController && this.app.uiController.settingsView) {
            this.app.uiController.settingsView.showGoogleDriveStatus(message, true);
        } else {
            alert(message);
        }
    }

    /**
     * Check if Google Drive sync is available
     */
    isAvailable() {
        return this.googleDriveSyncService !== null;
    }

    /**
     * Check if authenticated
     */
    isAuthenticated() {
        return this.googleDriveSyncService?.isAuthenticated() || false;
    }

    /**
     * Get sync status information
     * Delegates to the internal GoogleDriveSyncService to maintain encapsulation
     */
    async getSyncStatus() {
        if (!this.googleDriveSyncService) {
            return {
                authenticated: false,
                synced: false,
                lastSyncTime: null
            };
        }
        return this.googleDriveSyncService.getSyncStatus();
    }
}

export default SyncManager;

