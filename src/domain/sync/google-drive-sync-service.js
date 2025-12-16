// src/domain/google-drive-sync-service.js

import { prepareExportPayload } from '../migration/migration-service.js';
import { isOlderVersion } from '../utils/versioning.js';
import { STORAGE_KEY_GDRIVE_TOKEN, STORAGE_KEY_GDRIVE_FILE_ID, STORAGE_KEY_GDRIVE_FOLDER_ID } from '../utils/constants.js';

const GOOGLE_DRIVE_FOLDER_NAME = 'Goaly';
const GOOGLE_DRIVE_FILE_NAME = 'goaly-data.json';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];

export class GoogleDriveFileNotFoundError extends Error {
    constructor(message = 'No data file found in Google Drive') {
        super(message);
        this.name = 'GoogleDriveFileNotFoundError';
    }
}

class GoogleDriveSyncService {
    tokenClient = null;
    gapiLoaded = false;
    gisLoaded = false;
    accessToken = null;
    fileId = null;
    folderId = null;
    initialized = false;
    pendingRefreshPromise = null;
    refreshResolve = null;
    refreshReject = null;
    _lastStatusCheck = 0;
    _cachedStatus = null;
    _statusCacheTimeout = 60000; // Cache status for 1 minute



    /**
     * Initialize Google APIs - must be called before using the service
     * @param {string} apiKey - Google API key
     * @param {string} clientId - Google OAuth2 client ID
     */
    async initialize(apiKey, clientId) {
        if (this.initialized) {
            return;
        }

        if (!apiKey || !clientId) {
            throw new Error('Google API key and client ID are required');
        }

        this.apiKey = apiKey;
        this.clientId = clientId;

        // Load Google APIs first (needed for token client initialization)
        await this.loadGoogleAPIs();

        // Initialize code client for authorization code flow
        if (this.gisLoaded && globalThis.google?.accounts?.oauth2) {
            this.tokenClient = globalThis.google.accounts.oauth2.initCodeClient({
                client_id: this.clientId,
                scope: SCOPES,
                ux_mode: 'popup',
                callback: (response) => this._handleCodeResponse(response)
            });
        }

        // Try to refresh token on init (check if we have a valid session cookie)
        try {
            await this.refreshTokenIfNeeded(true);
        } catch (e) {
            console.log('No active session, user needs to login', e);
            this.accessToken = null;
            // Expected error when not logged in, maintain cleaner state
        }

        this.initialized = true;
    }

    /**
     * Load Google APIs scripts
     */
    loadGoogleAPIs() {
        return new Promise((resolve, reject) => {
            if (this.gapiLoaded && this.gisLoaded) {
                resolve();
                return;
            }

            let gapiResolved = false;
            let gisResolved = false;

            const checkResolved = () => {
                if (gapiResolved && gisResolved) {
                    resolve();
                }
            };

            // Load gapi (Google API client)
            if (this.gapiLoaded) {
                gapiResolved = true;
                checkResolved();
            } else if (globalThis.gapi) {
                this.gapiLoaded = true;
                gapiResolved = true;
                checkResolved();
            } else {
                const gapiScript = document.createElement('script');
                gapiScript.src = 'https://apis.google.com/js/api.js';
                gapiScript.onload = () => {
                    globalThis.gapi.load('client', async () => {
                        try {
                            await globalThis.gapi.client.init({
                                apiKey: this.apiKey,
                                discoveryDocs: DISCOVERY_DOCS
                            });
                            this.gapiLoaded = true;
                            gapiResolved = true;
                            checkResolved();
                        } catch (error) {
                            reject(error);
                        }
                    });
                };
                gapiScript.onerror = () => reject(new Error('Failed to load Google API'));
                document.head.appendChild(gapiScript);
            }

            // Load gis (Google Identity Services)
            if (this.gisLoaded) {
                gisResolved = true;
                checkResolved();
            } else if (globalThis.google?.accounts) {
                this.gisLoaded = true;
                gisResolved = true;
                checkResolved();
            } else {
                const gisScript = document.createElement('script');
                gisScript.src = 'https://accounts.google.com/gsi/client';
                gisScript.onload = () => {
                    this.gisLoaded = true;
                    gisResolved = true;
                    checkResolved();
                };
                gisScript.onerror = () => reject(new Error('Failed to load Google Identity Services'));
                document.head.appendChild(gisScript);
            }
        });
    }

    /**
     * Handle Authorization Code response from Google
     * @param {Object} response - The response containing auth code
     */
    async _handleCodeResponse(response) {
        if (response.error) {
            const error = new Error(response.error === 'popup_closed_by_user'
                ? 'Authentication cancelled.'
                : `Authentication failed: ${response.error}`);

            if (this.refreshReject) this.refreshReject(error);
            return;
        }

        if (!response.code) {
            const error = new Error('No authorization code received.');
            if (this.refreshReject) this.refreshReject(error);
            return;
        }

        try {
            // Exchange code for tokens via our backend
            const tokenRes = await fetch('/api/auth/exchange', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: response.code })
            });

            if (!tokenRes.ok) {
                const errData = await tokenRes.json();
                throw new Error(errData.error || 'Failed to exchange token');
            }

            const tokens = await tokenRes.json();
            this._updateAccessToken(tokens.access_token, tokens.expires_in);

            if (this.refreshResolve) {
                this.refreshResolve(this.accessToken);
                this._clearPendingRefreshState();
            }
        } catch (error) {
            console.error('Token exchange error:', error);
            if (this.refreshReject) {
                this.refreshReject(error);
                this._clearPendingRefreshState();
            }
        }
    }

    /**
     * Update access token and gapi client
     */
    _updateAccessToken(token, expiresInSeconds) {
        this.accessToken = token;

        // No longer storing token on disk for security, just in memory
        // But we can store expiration time to know when to refresh
        this.tokenExpiresAt = Date.now() + (expiresInSeconds * 1000);

        // Update gapi
        if (globalThis.gapi?.client) {
            globalThis.gapi.client.setToken({ access_token: this.accessToken });
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        // If we have a token and it's not expired (with buffer), we are good.
        // If expired, we might still be authenticated via cookie, so we return true 
        // to let the ensureAuthenticated check try to refresh.
        // But for UI "Show Login Button", we want to be optimistic if we have an accessToken.
        return !!this.accessToken;
    }

    /**
     * Authenticate with Google using OAuth2
     */
    async authenticate() {
        if (!this.gisLoaded) {
            throw new Error('Google Identity Services not loaded. Please refresh the page and try again.');
        }

        return new Promise((resolve, reject) => {
            this.refreshResolve = resolve;
            this.refreshReject = reject;

            try {
                if (!this.tokenClient) {
                    this.tokenClient = globalThis.google.accounts.oauth2.initCodeClient({
                        client_id: this.clientId,
                        scope: SCOPES,
                        ux_mode: 'popup',
                        callback: (response) => this._handleCodeResponse(response)
                    });
                }
                this.tokenClient.requestCode();
            } catch (error) {
                this._clearPendingRefreshState();
                reject(new Error(`Authentication failed: ${error.message}`));
            }
        });
    }

    /**
     * Sign out and clear stored tokens
     */
    async signOut() {
        if (this.accessToken && globalThis.google?.accounts) {
            globalThis.google.accounts.oauth2.revoke(this.accessToken, () => { });
        }

        // Call backend to clear cookie
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (e) { console.error('Logout error', e); }

        this.accessToken = null;
        this.fileId = null;
        this.folderId = null;
        this._cachedStatus = null;
        this._lastStatusCheck = 0;

        localStorage.removeItem(STORAGE_KEY_GDRIVE_FILE_ID);
        localStorage.removeItem(STORAGE_KEY_GDRIVE_FOLDER_ID);
        // Clean up old token storage if exists
        localStorage.removeItem(STORAGE_KEY_GDRIVE_TOKEN);

        if (globalThis.gapi?.client) {
            globalThis.gapi.client.setToken(null);
        }
    }

    /**
     * Clear pending refresh state
     * @private
     */
    _clearPendingRefreshState() {
        this.refreshResolve = null;
        this.refreshReject = null;
        this.pendingRefreshPromise = null;
    }

    /**
     * Get current access token from memory
     * @private
     * @returns {string|null} The current access token or null if not available
     */
    _getCurrentAccessToken() {
        return this.accessToken;
    }

    /**
     * Refresh access token if needed
     * @param {boolean} force - Force refresh even if token is still valid
     * @returns {Promise<boolean>} Returns true if a refresh was initiated, false if not needed
     * @throws {Error} Throws an error if refresh fails
     */
    async refreshTokenIfNeeded(force = false) {
        // If we have a valid token and not forced, skip
        if (!force && this.accessToken && this.tokenExpiresAt && (this.tokenExpiresAt - Date.now() > 5 * 60 * 1000)) {
            return false;
        }

        // Avoid multiple parallel refreshes
        if (this.pendingRefreshPromise) {
            return this.pendingRefreshPromise;
        }

        this.pendingRefreshPromise = (async () => {
            try {
                const res = await fetch('/api/auth/refresh', { method: 'POST' });
                if (!res.ok) {
                    throw new Error('Refresh failed');
                }
                const tokens = await res.json();
                this._updateAccessToken(tokens.access_token, tokens.expires_in);
                return true;
            } catch (error) {
                // If refresh failed, we are effectively logged out
                this.accessToken = null;
                throw error;
            } finally {
                this.pendingRefreshPromise = null;
            }
        })();

        return this.pendingRefreshPromise;
    }

    /**
     * Ensure we have a valid access token
     * Automatically refreshes token if needed
     * Throws an error if authentication fails
     */
    async ensureAuthenticated() {
        // First try to refresh if needed (this handles the "not authenticated yet but have cookie" case)
        try {
            await this.refreshTokenIfNeeded();
        } catch (e) {
            // If refresh fails, we'll check accessToken below
            // Log for debugging but don't throw if we have a backup
            if (!this.accessToken) {
                throw new Error('Not authenticated. Please sign in first.');
            }
            console.warn('Silent refresh failed, but using existing access token.', e);
        }

        if (!this.accessToken) {
            throw new Error('Not authenticated. Please sign in first.');
        }

        if (globalThis.gapi?.client) {
            globalThis.gapi.client.setToken({ access_token: this.accessToken });
        }
    }

    /**
     * Execute a fetch request with automatic token refresh on 401 errors
     * @param {string} url - The URL to fetch
     * @param {RequestInit} options - Fetch options (method, headers, body, etc.)
     * @param {number} maxRetries - Maximum number of retries (default: 1)
     * @returns {Promise<Response>} The fetch response
     */
    async executeFetchWithTokenRefresh(url, options = {}, maxRetries = 1) {
        let lastError = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                await this.ensureAuthenticated();
                const currentToken = this._getCurrentAccessToken();
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

    /**
     * Execute a gapi API call with automatic token refresh on 401/403 errors
     * @param {Function} apiCall - Function that returns a promise for the API call
     * @param {number} maxRetries - Maximum number of retries (default: 1)
     * @returns {Promise} The API call result
     */
    async executeWithTokenRefresh(apiCall, maxRetries = 1) {
        let lastError = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                await this.ensureAuthenticated();
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
     * Check if error is an auth error for fetch
     * @private
     */
    _isAuthLevelError(error) {
        return error.message?.includes('Authentication failed');
    }

    /**
     * Check if error is an auth error for gapi
     * @private
     */
    _isGapiAuthError(error) {
        return error.status === 401 ||
            error.status === 403 ||
            (error.result && (error.result.error?.code === 401 || error.result.error?.code === 403)) ||
            error.message?.includes('Invalid Credentials') ||
            error.message?.includes('unauthorized');
    }

    /**
     * Handle auth retry logic
     * @private
     */
    async _handleAuthRetry(attempt, maxRetries, message, error = null) {
        console.warn(`${message}, attempting token refresh (attempt ${attempt + 1}/${maxRetries + 1})`, error || '');
        try {
            await this.refreshTokenIfNeeded(true);
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (refreshError) {
            console.error('Token refresh failed during retry:', refreshError);
            throw new Error('Authentication failed. Please sign in again.');
        }
    }

    /**
     * Find or create the Goaly folder in Google Drive
     * Uses cached folder ID if available to avoid unnecessary API calls
     */
    async findOrCreateFolder() {
        await this.ensureAuthenticated();

        // Use cached folder ID if available
        if (this.folderId) {
            return this.folderId;
        }

        // Try to load from localStorage
        const cachedFolderId = localStorage.getItem(STORAGE_KEY_GDRIVE_FOLDER_ID);
        if (cachedFolderId) {
            this.folderId = cachedFolderId;
            // Trust the cached ID - if it's invalid, operations will fail and we'll handle it then
            return this.folderId;
        }

        // Search for existing folder with automatic retry on auth errors
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

        // Create folder if it doesn't exist
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
     * Find the Goaly data file in Google Drive
     */
    async findDataFile(folderId) {
        await this.ensureAuthenticated();

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
     * Upload goal data to Google Drive
     */
    async uploadData(goals, settings) {
        await this.ensureAuthenticated();

        // Prepare data
        let folderId = await this.findOrCreateFolder();
        const payload = prepareExportPayload(goals, settings);
        const fileContent = JSON.stringify(payload, null, 2);
        const blob = new Blob([fileContent], { type: 'application/json' });
        const metadata = { name: GOOGLE_DRIVE_FILE_NAME };

        // Determine file ID
        let fileId = await this._resolveFileId(folderId);

        let response;
        if (fileId) {
            response = await this._updateFile(fileId, metadata, blob);

            // Handle specific update failures (403/404)
            if (!response.ok && (response.status === 403 || response.status === 404)) {
                // If 403, folder might be invalid/lost access
                if (response.status === 403) {
                    this.folderId = null;
                    localStorage.removeItem(STORAGE_KEY_GDRIVE_FOLDER_ID);
                    folderId = await this.findOrCreateFolder();
                }

                // Try to recover by searching again
                const existingFile = await this.findDataFile(folderId);
                if (existingFile && existingFile.id !== fileId) {
                    fileId = existingFile.id;
                    this.fileId = fileId;
                    localStorage.setItem(STORAGE_KEY_GDRIVE_FILE_ID, fileId);
                    response = await this._updateFile(fileId, metadata, blob);
                } else {
                    // Fallback to create new
                    metadata.parents = [folderId];
                    response = await this._createFile(metadata, blob);
                }
            }
        } else {
            // No existing file - create new one
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

        // Invalidate status cache after upload
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
     * Download goal data from Google Drive
     */
    async downloadData() {
        await this.ensureAuthenticated();

        const folderId = await this.findOrCreateFolder();
        const file = await this.findDataFile(folderId);

        if (!file) {
            throw new GoogleDriveFileNotFoundError();
        }

        this.fileId = file.id;
        localStorage.setItem(STORAGE_KEY_GDRIVE_FILE_ID, this.fileId);

        // Invalidate status cache after download
        this._cachedStatus = null;
        this._lastStatusCheck = 0;

        // Download file content using fetch with automatic token refresh
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
     * Compare local and remote versions to determine sync direction
     * Returns which state is older and should be the target
     * @param {string} localVersion - Local version
     * @param {string} localExportDate - Local export date
     * @param {boolean} localHasData - Whether local has any goals (not empty)
     */
    /**
     * Compare local and remote versions to determine sync direction
     * Returns which state is older and should be the target
     * @param {string} localVersion - Local version
     * @param {string} localExportDate - Local export date
     * @param {boolean} localHasData - Whether local has any goals (not empty)
     */
    async checkSyncDirection(localVersion, localExportDate, localHasData = true) {
        try {
            // downloadData already handles token refresh, so we can call it directly
            const remote = await this.downloadData();

            return this._determineSyncAction(
                localVersion,
                localExportDate,
                localHasData,
                remote
            );
        } catch (error) {
            // If file doesn't exist, upload local (unless local is empty)
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

    /**
     * Helper to determine sync action based on local and remote state
     * @private
     */
    _determineSyncAction(localVersion, localExportDate, localHasData, remote) {
        const remoteVersion = remote.data?.version || null;
        const remoteExportDate = remote.data?.exportDate || null;
        const remoteGoals = remote.data?.goals || [];
        const remoteHasData = Array.isArray(remoteGoals) && remoteGoals.length > 0;

        // 1. Handle empty states
        if (!localHasData && remoteHasData) {
            return this._createSyncResult(false, 'local_empty_remote_has_data', localVersion, localExportDate, remoteVersion, remoteExportDate);
        }
        if (localHasData && !remoteHasData) {
            return this._createSyncResult(true, 'local_has_data_remote_empty', localVersion, localExportDate, remoteVersion, remoteExportDate);
        }

        // 2. Handle missing dates
        if (!remoteExportDate) {
            return this._createSyncResult(true, 'remote_no_date', localVersion, localExportDate, remoteVersion, remoteExportDate);
        }
        if (!localExportDate) {
            return this._createSyncResult(false, 'local_no_date', localVersion, localExportDate, remoteVersion, remoteExportDate);
        }

        // 3. Compare dates and versions
        return this._compareStates(
            { version: localVersion, date: localExportDate },
            { version: remoteVersion, date: remoteExportDate }
        );
    }

    /**
     * Helper to compare two states (local and remote)
     * @private
     */
    _compareStates(local, remote) {
        const localDate = new Date(local.date);
        const remoteDate = new Date(remote.date);

        // Priority 5: Always sync toward older state (compare dates)
        if (remoteDate < localDate) {
            return this._createSyncResult(true, 'remote_older', local.version, local.date, remote.version, remote.date);
        }

        if (localDate < remoteDate) {
            return this._createSyncResult(false, 'local_older', local.version, local.date, remote.version, remote.date);
        }

        // Same date - check versions
        if (isOlderVersion(remote.version, local.version)) {
            return this._createSyncResult(true, 'remote_version_older', local.version, local.date, remote.version, remote.date);
        }

        if (isOlderVersion(local.version, remote.version)) {
            return this._createSyncResult(false, 'local_version_older', local.version, local.date, remote.version, remote.date);
        }

        // Same version and date
        return this._createSyncResult(true, 'same_state', local.version, local.date, remote.version, remote.date);
    }

    /**
     * Create a standardized sync result object
     * @private
     */
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
     * Get sync status information
     * Uses caching to avoid excessive API calls
     */
    async getSyncStatus() {
        if (!this.isAuthenticated()) {
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
        // Try cached ID first
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

        // Fallback to list search
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
}

export default GoogleDriveSyncService;

