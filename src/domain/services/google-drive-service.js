// src/domain/services/google-drive-service.js

/**
 * @module GoogleDriveService
 * @description Service for Google Drive API operations.
 * Handles file/folder CRUD, upload/download, with automatic token refresh.
 */

import { prepareExportPayload } from '../migration/migration-service.js';
import { isOlderVersion } from '../utils/versioning.js';
import { STORAGE_KEY_GDRIVE_FILE_ID, STORAGE_KEY_GDRIVE_FOLDER_ID } from '../utils/constants.js';

/** @constant {string} GOOGLE_DRIVE_FOLDER_NAME - Name of the application folder in Google Drive */
const GOOGLE_DRIVE_FOLDER_NAME = 'Goaly';

/** @constant {string} GOOGLE_DRIVE_FILE_NAME - Name of the data file */
const GOOGLE_DRIVE_FILE_NAME = 'goaly-data.json';

/**
 * Error class for when the data file is not found in Google Drive.
 * @class
 * @extends Error
 */
export class GoogleDriveFileNotFoundError extends Error {
    constructor(message = 'No data file found in Google Drive') {
        super(message);
        this.name = 'GoogleDriveFileNotFoundError';
    }
}

/**
 * Service to manage Google Drive file operations.
 * @class
 */
class GoogleDriveService {
    /**
     * Create a GoogleDriveService.
     * @param {import('./google-auth-service.js').default} authService - The auth service instance
     */
    constructor(authService) {
        this.authService = authService;
        this.fileId = null;
        this.folderId = null;
        this._lastStatusCheck = 0;
        this._cachedStatus = null;
        this._statusCacheTimeout = 60000;
    }

    /**
     * Execute a gapi API call with automatic token refresh on 401/403 errors.
     * @param {Function} apiCall - Function that returns a promise for the API call
     * @param {number} maxRetries - Maximum number of retries
     * @returns {Promise} The API call result
     */
    async executeWithTokenRefresh(apiCall, maxRetries = 1) {
        let lastError = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                await this.authService.ensureAuthenticated();
                return await apiCall();
            } catch (error) {
                lastError = error;
                if (this._isGapiAuthError(error) && attempt < maxRetries) {
                    await this._handleAuthRetry(attempt, maxRetries, 'API call failed with auth error', error);
                    continue;
                }
                throw error;
            }
        }

        throw lastError;
    }

    /**
     * Execute a fetch request with automatic token refresh on 401 errors.
     * @param {string} url - The URL to fetch
     * @param {RequestInit} options - Fetch options
     * @param {number} maxRetries - Maximum number of retries
     * @returns {Promise<Response>} The fetch response
     */
    async executeFetchWithTokenRefresh(url, options = {}, maxRetries = 1) {
        let lastError = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                await this.authService.ensureAuthenticated();
                const currentToken = this.authService.getAccessToken();
                if (!currentToken) throw new Error('No access token available');

                const headers = new Headers(options.headers || {});
                headers.set('Authorization', `Bearer ${currentToken}`);

                const response = await fetch(url, { ...options, headers });

                if (response.ok || response.status !== 401) {
                    return response;
                }

                if (attempt < maxRetries) {
                    await this._handleAuthRetry(attempt, maxRetries, 'Fetch request failed with 401');
                    continue;
                }

                return response;
            } catch (error) {
                lastError = error;
                if (this._isAuthLevelError(error) && attempt < maxRetries) {
                    continue;
                }
                throw error;
            }
        }

        throw lastError || new Error('Fetch request failed');
    }

    /** @private */
    _isAuthLevelError(error) {
        return error.message?.includes('Authentication failed');
    }

    /** @private */
    _isGapiAuthError(error) {
        return error.status === 401 ||
            error.status === 403 ||
            (error.result && (error.result.error?.code === 401 || error.result.error?.code === 403)) ||
            error.message?.includes('Invalid Credentials') ||
            error.message?.includes('unauthorized');
    }

    /** @private */
    async _handleAuthRetry(attempt, maxRetries, message, error = null) {
        console.warn(`${message}, attempting token refresh (attempt ${attempt + 1}/${maxRetries + 1})`, error || '');
        try {
            await this.authService.refreshTokenIfNeeded(true);
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (refreshError) {
            console.error('Token refresh failed during retry:', refreshError);
            throw new Error('Authentication failed. Please sign in again.');
        }
    }

    /**
     * Find or create the Goaly folder in Google Drive.
     * @returns {Promise<string>} The folder ID
     */
    async findOrCreateFolder() {
        await this.authService.ensureAuthenticated();

        if (this.folderId) {
            return this.folderId;
        }

        const cachedFolderId = localStorage.getItem(STORAGE_KEY_GDRIVE_FOLDER_ID);
        if (cachedFolderId) {
            this.folderId = cachedFolderId;
            return this.folderId;
        }

        const response = await this.executeWithTokenRefresh(async () => {
            return await globalThis.gapi.client.drive.files.list({
                q: `name='${GOOGLE_DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id, name)',
                spaces: 'drive'
            });
        });

        if (response.result.files && response.result.files.length > 0) {
            this.folderId = response.result.files[0].id;
            localStorage.setItem(STORAGE_KEY_GDRIVE_FOLDER_ID, this.folderId);
            return this.folderId;
        }

        const folderResponse = await this.executeWithTokenRefresh(async () => {
            return await globalThis.gapi.client.drive.files.create({
                resource: {
                    name: GOOGLE_DRIVE_FOLDER_NAME,
                    mimeType: 'application/vnd.google-apps.folder'
                },
                fields: 'id'
            });
        });

        this.folderId = folderResponse.result.id;
        localStorage.setItem(STORAGE_KEY_GDRIVE_FOLDER_ID, this.folderId);
        return this.folderId;
    }

    /**
     * Find the Goaly data file in Google Drive.
     * @param {string} folderId - The folder to search in
     * @returns {Promise<Object|null>} The file metadata or null
     */
    async findDataFile(folderId) {
        await this.authService.ensureAuthenticated();

        const response = await this.executeWithTokenRefresh(async () => {
            return await globalThis.gapi.client.drive.files.list({
                q: `name='${GOOGLE_DRIVE_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
                fields: 'files(id, name, modifiedTime)',
                spaces: 'drive'
            });
        });

        if (response.result.files && response.result.files.length > 0) {
            return response.result.files[0];
        }

        return null;
    }

    /**
     * Upload goal data to Google Drive.
     * @param {Array} goals - The goals to upload
     * @param {Object} settings - The settings to upload
     * @returns {Promise<Object>} Upload result with fileId, version, exportDate
     */
    async uploadData(goals, settings) {
        await this.authService.ensureAuthenticated();

        let folderId = await this.findOrCreateFolder();
        const payload = prepareExportPayload(goals, settings);
        const fileContent = JSON.stringify(payload, null, 2);
        const blob = new Blob([fileContent], { type: 'application/json' });
        const metadata = { name: GOOGLE_DRIVE_FILE_NAME };

        let fileId = await this._resolveFileId(folderId);

        let response;
        if (fileId) {
            response = await this._updateFile(fileId, metadata, blob);

            if (!response.ok && (response.status === 403 || response.status === 404)) {
                if (response.status === 403) {
                    this.folderId = null;
                    localStorage.removeItem(STORAGE_KEY_GDRIVE_FOLDER_ID);
                    folderId = await this.findOrCreateFolder();
                }

                const existingFile = await this.findDataFile(folderId);
                if (existingFile && existingFile.id !== fileId) {
                    fileId = existingFile.id;
                    this.fileId = fileId;
                    localStorage.setItem(STORAGE_KEY_GDRIVE_FILE_ID, fileId);
                    response = await this._updateFile(fileId, metadata, blob);
                } else {
                    metadata.parents = [folderId];
                    response = await this._createFile(metadata, blob);
                }
            }
        } else {
            metadata.parents = [folderId];
            response = await this._createFile(metadata, blob);
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Upload failed' }));
            throw new Error(error.error?.message || `Failed to upload to Google Drive (${response.status})`);
        }

        const result = await response.json();
        this.fileId = result.id;
        localStorage.setItem(STORAGE_KEY_GDRIVE_FILE_ID, this.fileId);

        this._cachedStatus = null;
        this._lastStatusCheck = 0;

        return {
            fileId: this.fileId,
            version: payload.version,
            exportDate: payload.exportDate
        };
    }

    /** @private */
    async _resolveFileId(folderId) {
        let fileId = this.fileId || localStorage.getItem(STORAGE_KEY_GDRIVE_FILE_ID);
        if (!fileId) {
            const existingFile = await this.findDataFile(folderId);
            fileId = existingFile ? existingFile.id : null;
            if (fileId) {
                this.fileId = fileId;
                localStorage.setItem(STORAGE_KEY_GDRIVE_FILE_ID, fileId);
            }
        }
        return fileId;
    }

    /** @private */
    async _updateFile(fileId, metadata, blob) {
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        return this.executeFetchWithTokenRefresh(
            `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
            { method: 'PATCH', body: form }
        );
    }

    /** @private */
    async _createFile(metadata, blob) {
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        return this.executeFetchWithTokenRefresh(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            { method: 'POST', body: form }
        );
    }

    /**
     * Download goal data from Google Drive.
     * @returns {Promise<Object>} The downloaded data with data, fileId, modifiedTime
     */
    async downloadData() {
        await this.authService.ensureAuthenticated();

        const folderId = await this.findOrCreateFolder();
        const file = await this.findDataFile(folderId);

        if (!file) {
            throw new GoogleDriveFileNotFoundError();
        }

        this.fileId = file.id;
        localStorage.setItem(STORAGE_KEY_GDRIVE_FILE_ID, this.fileId);

        this._cachedStatus = null;
        this._lastStatusCheck = 0;

        const response = await this.executeFetchWithTokenRefresh(
            `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`
        );

        if (!response.ok) {
            throw new Error('Failed to download from Google Drive');
        }

        const fileContent = await response.text();
        let data;
        try {
            data = JSON.parse(fileContent);
        } catch (error) {
            throw new Error('Invalid JSON in Google Drive file', { cause: error });
        }

        return {
            data,
            fileId: file.id,
            modifiedTime: file.modifiedTime
        };
    }

    /**
     * Compare local and remote versions to determine sync direction.
     * @param {string} localVersion - Local version
     * @param {string} localExportDate - Local export date
     * @param {boolean} localHasData - Whether local has any goals
     * @returns {Promise<Object>} Sync direction result
     */
    async checkSyncDirection(localVersion, localExportDate, localHasData = true) {
        try {
            const remote = await this.downloadData();

            return this._determineSyncAction(
                localVersion,
                localExportDate,
                localHasData,
                remote
            );
        } catch (error) {
            if (error instanceof GoogleDriveFileNotFoundError) {
                return {
                    shouldUpload: localHasData,
                    reason: localHasData ? 'remote_not_found' : 'remote_not_found_local_empty',
                    localVersion,
                    remoteVersion: null,
                    localExportDate,
                    remoteExportDate: null
                };
            }
            throw error;
        }
    }

    /** @private */
    _determineSyncAction(localVersion, localExportDate, localHasData, remote) {
        const remoteVersion = remote.data?.version || null;
        const remoteExportDate = remote.data?.exportDate || null;
        const remoteGoals = remote.data?.goals || [];
        const remoteHasData = Array.isArray(remoteGoals) && remoteGoals.length > 0;

        if (!localHasData && remoteHasData) {
            return this._createSyncResult(false, 'local_empty_remote_has_data', localVersion, localExportDate, remoteVersion, remoteExportDate);
        }
        if (localHasData && !remoteHasData) {
            return this._createSyncResult(true, 'local_has_data_remote_empty', localVersion, localExportDate, remoteVersion, remoteExportDate);
        }

        if (!remoteExportDate) {
            return this._createSyncResult(true, 'remote_no_date', localVersion, localExportDate, remoteVersion, remoteExportDate);
        }
        if (!localExportDate) {
            return this._createSyncResult(false, 'local_no_date', localVersion, localExportDate, remoteVersion, remoteExportDate);
        }

        return this._compareStates(
            { version: localVersion, date: localExportDate },
            { version: remoteVersion, date: remoteExportDate }
        );
    }

    /** @private */
    _compareStates(local, remote) {
        const localDate = new Date(local.date);
        const remoteDate = new Date(remote.date);

        if (remoteDate < localDate) {
            return this._createSyncResult(true, 'remote_older', local.version, local.date, remote.version, remote.date);
        }

        if (localDate < remoteDate) {
            return this._createSyncResult(false, 'local_older', local.version, local.date, remote.version, remote.date);
        }

        if (isOlderVersion(remote.version, local.version)) {
            return this._createSyncResult(true, 'remote_version_older', local.version, local.date, remote.version, remote.date);
        }

        if (isOlderVersion(local.version, remote.version)) {
            return this._createSyncResult(false, 'local_version_older', local.version, local.date, remote.version, remote.date);
        }

        return this._createSyncResult(true, 'same_state', local.version, local.date, remote.version, remote.date);
    }

    /** @private */
    _createSyncResult(shouldUpload, reason, localVersion, localExportDate, remoteVersion, remoteExportDate) {
        return {
            shouldUpload,
            reason,
            localVersion,
            remoteVersion,
            localExportDate,
            remoteExportDate
        };
    }

    /**
     * Get sync status information.
     * @returns {Promise<Object>} Status with authenticated, synced, lastSyncTime, fileId
     */
    async getSyncStatus() {
        if (!this.authService.isAuthenticated()) {
            return { authenticated: false, synced: false };
        }

        const now = Date.now();
        if (this._cachedStatus && (now - this._lastStatusCheck) < this._statusCacheTimeout) {
            return this._cachedStatus;
        }

        try {
            const folderId = await this._findFolderForStatus();
            let file = null;

            if (folderId) {
                file = await this._findFileForStatus(folderId);
            }

            const status = {
                authenticated: true,
                synced: !!file,
                lastSyncTime: file ? file.modifiedTime : null,
                fileId: file ? file.id : null
            };

            this._cachedStatus = status;
            this._lastStatusCheck = now;

            return status;
        } catch (error) {
            return {
                authenticated: true,
                synced: false,
                error: error.message
            };
        }
    }

    /** @private */
    async _findFolderForStatus() {
        let folderId = this.folderId || localStorage.getItem(STORAGE_KEY_GDRIVE_FOLDER_ID);
        if (folderId) return folderId;

        const folderList = await this.executeWithTokenRefresh(async () => {
            return await globalThis.gapi.client.drive.files.list({
                q: `name='${GOOGLE_DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id, name)',
                spaces: 'drive'
            });
        });

        folderId = folderList.result.files?.[0]?.id ?? null;
        if (folderId) {
            this.folderId = folderId;
            localStorage.setItem(STORAGE_KEY_GDRIVE_FOLDER_ID, folderId);
        }
        return folderId;
    }

    /** @private */
    async _findFileForStatus(folderId) {
        const cachedFileId = this.fileId || localStorage.getItem(STORAGE_KEY_GDRIVE_FILE_ID);
        if (cachedFileId) {
            try {
                const fileResponse = await this.executeWithTokenRefresh(async () => {
                    return await globalThis.gapi.client.drive.files.get({
                        fileId: cachedFileId,
                        fields: 'id, name, modifiedTime, trashed'
                    });
                });

                if (fileResponse.result && !fileResponse.result.trashed && fileResponse.result.name === GOOGLE_DRIVE_FILE_NAME) {
                    return {
                        id: fileResponse.result.id,
                        modifiedTime: fileResponse.result.modifiedTime
                    };
                }
            } catch (error) {
                console.warn('Cached file ID invalid, falling back to list:', error);
            }
        }

        const fileList = await this.executeWithTokenRefresh(async () => {
            return await globalThis.gapi.client.drive.files.list({
                q: `name='${GOOGLE_DRIVE_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
                fields: 'files(id, name, modifiedTime)',
                spaces: 'drive'
            });
        });

        const file = fileList.result.files?.[0] ?? null;
        if (file) {
            this.fileId = file.id;
            localStorage.setItem(STORAGE_KEY_GDRIVE_FILE_ID, file.id);
        }
        return file;
    }

    /**
     * Clear cached IDs (used on sign out).
     */
    clearCache() {
        this.fileId = null;
        this.folderId = null;
        this._cachedStatus = null;
        this._lastStatusCheck = 0;
    }
}

export default GoogleDriveService;
