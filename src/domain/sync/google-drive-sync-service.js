// src/domain/google-drive-sync-service.js

import { prepareExportPayload } from '../migration/migration-service.js';
import { GOAL_FILE_VERSION, isSameVersion, isOlderVersion, isNewerVersion } from '../utils/versioning.js';
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
    constructor() {
        this.tokenClient = null;
        this.gapiLoaded = false;
        this.gisLoaded = false;
        this.accessToken = null;
        this.fileId = null;
        this.folderId = null;
        this.initialized = false;
        this.pendingRefreshPromise = null;
        this.refreshResolve = null;
        this.refreshReject = null;
        this._lastStatusCheck = 0;
        this._cachedStatus = null;
        this._statusCacheTimeout = 60000; // Cache status for 1 minute
    }

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

        // Load saved token and file ID
        const savedToken = localStorage.getItem(STORAGE_KEY_GDRIVE_TOKEN);
        if (savedToken) {
            try {
                const tokenData = JSON.parse(savedToken);
                this.accessToken = tokenData.access_token;
                this.fileId = localStorage.getItem(STORAGE_KEY_GDRIVE_FILE_ID);
                this.folderId = localStorage.getItem(STORAGE_KEY_GDRIVE_FOLDER_ID);
                
                // Re-initialize token client if we have a saved token
                // This allows token refresh to work after page reload
                if (this.gisLoaded && window.google?.accounts?.oauth2 && this.accessToken) {
                    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
                        client_id: this.clientId,
                        scope: SCOPES,
                        callback: async (response) => {
                            if (response.error) {
                                let errorMessage = response.error;
                                if (response.error === 'popup_closed_by_user') {
                                    errorMessage = 'Authentication cancelled. Please try again.';
                                } else if (response.error === 'access_denied') {
                                    errorMessage = 'Access denied. Make sure you are added as a test user in Google Cloud Console.';
                                } else if (response.error === 'invalid_client') {
                                    errorMessage = 'Invalid client ID. Please check your configuration.';
                                } else if (response.error === 'redirect_uri_mismatch') {
                                    errorMessage = 'Redirect URI mismatch. Please check your OAuth configuration in Google Cloud Console.';
                                } else if (response.error === 'immediate_failed' || response.error === 'popup_blocked') {
                                    // Silent refresh failed - user needs to re-authenticate
                                    errorMessage = 'Session expired. Please sign in again.';
                                }
                                
                                // Handle refresh promise if pending
                                if (this.refreshReject) {
                                    this.refreshReject(new Error(errorMessage));
                                    this._clearPendingRefreshState();
                                }
                                return;
                            }

                            if (!response.access_token) {
                                const error = new Error('No access token received from Google. Please try again.');
                                if (this.refreshReject) {
                                    this.refreshReject(error);
                                    this._clearPendingRefreshState();
                                }
                                return;
                            }

                            this.accessToken = response.access_token;
                            localStorage.setItem(STORAGE_KEY_GDRIVE_TOKEN, JSON.stringify({
                                access_token: this.accessToken,
                                expires_at: Date.now() + (response.expires_in * 1000)
                            }));

                            // Set token for gapi requests
                            if (window.gapi && window.gapi.client) {
                                window.gapi.client.setToken({ access_token: this.accessToken });
                            }

                            // Handle refresh promise if pending
                            if (this.refreshResolve) {
                                this.refreshResolve(true);
                                this._clearPendingRefreshState();
                            }
                        }
                    });
                }
            } catch (error) {
                console.error('Failed to load saved token', error);
            }
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
            if (!this.gapiLoaded) {
                if (window.gapi) {
                    this.gapiLoaded = true;
                    gapiResolved = true;
                    checkResolved();
                } else {
                    const gapiScript = document.createElement('script');
                    gapiScript.src = 'https://apis.google.com/js/api.js';
                    gapiScript.onload = () => {
                        window.gapi.load('client', async () => {
                            try {
                                await window.gapi.client.init({
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
            } else {
                gapiResolved = true;
                checkResolved();
            }

            // Load gis (Google Identity Services)
            if (!this.gisLoaded) {
                if (window.google?.accounts) {
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
            } else {
                gisResolved = true;
                checkResolved();
            }
        });
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.accessToken;
    }

    /**
     * Authenticate with Google using OAuth2
     */
    async authenticate() {
        if (!this.gisLoaded) {
            throw new Error('Google Identity Services not loaded. Please refresh the page and try again.');
        }

        if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
            throw new Error('Google Identity Services failed to load. Please check your internet connection and refresh the page.');
        }

        return new Promise((resolve, reject) => {
            try {
                this.tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: this.clientId,
                    scope: SCOPES,
                    callback: async (response) => {
                        if (response.error) {
                            let errorMessage = response.error;
                            if (response.error === 'popup_closed_by_user') {
                                errorMessage = 'Authentication cancelled. Please try again.';
                            } else if (response.error === 'access_denied') {
                                errorMessage = 'Access denied. Make sure you are added as a test user in Google Cloud Console.';
                            } else if (response.error === 'invalid_client') {
                                errorMessage = 'Invalid client ID. Please check your configuration.';
                            } else if (response.error === 'redirect_uri_mismatch') {
                                errorMessage = 'Redirect URI mismatch. Please check your OAuth configuration in Google Cloud Console.';
                            } else if (response.error === 'immediate_failed' || response.error === 'popup_blocked') {
                                // Silent refresh failed - user needs to re-authenticate
                                errorMessage = 'Session expired. Please sign in again.';
                            }
                            
                            // Handle refresh promise if pending
                            if (this.refreshReject) {
                                this.refreshReject(new Error(errorMessage));
                                this._clearPendingRefreshState();
                            } else {
                                reject(new Error(errorMessage));
                            }
                            return;
                        }

                        if (!response.access_token) {
                            const error = new Error('No access token received from Google. Please try again.');
                            if (this.refreshReject) {
                                this.refreshReject(error);
                                this._clearPendingRefreshState();
                            } else {
                                reject(error);
                            }
                            return;
                        }

                        this.accessToken = response.access_token;
                        localStorage.setItem(STORAGE_KEY_GDRIVE_TOKEN, JSON.stringify({
                            access_token: this.accessToken,
                            expires_at: Date.now() + (response.expires_in * 1000)
                        }));

                        // Set token for gapi requests
                        if (window.gapi && window.gapi.client) {
                            window.gapi.client.setToken({ access_token: this.accessToken });
                        }

                        // Handle refresh promise if pending
                        if (this.refreshResolve) {
                            this.refreshResolve(true);
                            this._clearPendingRefreshState();
                        } else {
                            resolve(this.accessToken);
                        }
                    }
                });

                if (!this.tokenClient) {
                    reject(new Error('Failed to initialize Google OAuth client. Please check your Client ID.'));
                    return;
                }

                this.tokenClient.requestAccessToken({ prompt: 'consent' });
            } catch (error) {
                reject(new Error(`Authentication failed: ${error.message || 'Unknown error'}`));
            }
        });
    }

    /**
     * Sign out and clear stored tokens
     */
    signOut() {
        if (this.accessToken && window.google?.accounts) {
            window.google.accounts.oauth2.revoke(this.accessToken, () => {});
        }
        this.accessToken = null;
        this.fileId = null;
        this.folderId = null;
        this._cachedStatus = null;
        this._lastStatusCheck = 0;
        localStorage.removeItem(STORAGE_KEY_GDRIVE_TOKEN);
        localStorage.removeItem(STORAGE_KEY_GDRIVE_FILE_ID);
        localStorage.removeItem(STORAGE_KEY_GDRIVE_FOLDER_ID);
        if (window.gapi?.client) {
            window.gapi.client.setToken(null);
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
     * Get current access token from memory or localStorage
     * @private
     * @returns {string|null} The current access token or null if not available
     */
    _getCurrentAccessToken() {
        if (this.accessToken) {
            return this.accessToken;
        }
        const savedToken = localStorage.getItem(STORAGE_KEY_GDRIVE_TOKEN);
        if (savedToken) {
            try {
                const tokenData = JSON.parse(savedToken);
                return tokenData.access_token || null;
            } catch (error) {
                console.error('Failed to parse token from storage', error);
                return null;
            }
        }
        return null;
    }

    /**
     * Refresh access token if needed
     * @param {boolean} force - Force refresh even if token is still valid
     * @returns {Promise<boolean>} Returns true if a refresh was initiated, false if not needed
     * @throws {Error} Throws an error if refresh fails
     */
    async refreshTokenIfNeeded(force = false) {
        if (!this.accessToken) {
            return false;
        }

        const savedToken = localStorage.getItem(STORAGE_KEY_GDRIVE_TOKEN);
        if (!savedToken) {
            return false;
        }

        try {
            const tokenData = JSON.parse(savedToken);
            const expiresAt = tokenData.expires_at || 0;
            const now = Date.now();

            // Refresh if forced or token expires in less than 5 minutes
            if (force || expiresAt - now < 5 * 60 * 1000) {
                // Ensure token client is initialized - re-initialize if needed
                if (!this.tokenClient && this.gisLoaded && window.google?.accounts?.oauth2) {
                    // Re-initialize token client if it's not available
                    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
                        client_id: this.clientId,
                        scope: SCOPES,
                        callback: async (response) => {
                            if (response.error) {
                                let errorMessage = response.error;
                                if (response.error === 'popup_closed_by_user') {
                                    errorMessage = 'Authentication cancelled. Please try again.';
                                } else if (response.error === 'access_denied') {
                                    errorMessage = 'Access denied. Make sure you are added as a test user in Google Cloud Console.';
                                } else if (response.error === 'invalid_client') {
                                    errorMessage = 'Invalid client ID. Please check your configuration.';
                                } else if (response.error === 'redirect_uri_mismatch') {
                                    errorMessage = 'Redirect URI mismatch. Please check your OAuth configuration in Google Cloud Console.';
                                } else if (response.error === 'immediate_failed' || response.error === 'popup_blocked') {
                                    // Silent refresh failed - user needs to re-authenticate
                                    errorMessage = 'Session expired. Please sign in again.';
                                }
                                
                                // Handle refresh promise if pending
                                if (this.refreshReject) {
                                    this.refreshReject(new Error(errorMessage));
                                    this._clearPendingRefreshState();
                                }
                                return;
                            }

                            if (!response.access_token) {
                                const error = new Error('No access token received from Google. Please try again.');
                                if (this.refreshReject) {
                                    this.refreshReject(error);
                                    this._clearPendingRefreshState();
                                }
                                return;
                            }

                            this.accessToken = response.access_token;
                            localStorage.setItem(STORAGE_KEY_GDRIVE_TOKEN, JSON.stringify({
                                access_token: this.accessToken,
                                expires_at: Date.now() + (response.expires_in * 1000)
                            }));

                            // Set token for gapi requests
                            if (window.gapi && window.gapi.client) {
                                window.gapi.client.setToken({ access_token: this.accessToken });
                            }

                            // Handle refresh promise if pending
                            if (this.refreshResolve) {
                                this.refreshResolve(true);
                                this._clearPendingRefreshState();
                            }
                        }
                    });
                }

                if (this.tokenClient) {
                    // If there's already a pending refresh, return that promise
                    if (this.pendingRefreshPromise) {
                        return this.pendingRefreshPromise;
                    }

                    // Create a new promise for this refresh operation
                    this.pendingRefreshPromise = new Promise((resolve, reject) => {
                        this.refreshResolve = resolve;
                        this.refreshReject = reject;

                        try {
                            // Request token refresh (silent, no prompt)
                            // Use 'none' for silent refresh - this will fail if user needs to re-authenticate
                            this.tokenClient.requestAccessToken({ prompt: 'none' });
                            
                            // Set timeout to reject if refresh takes too long (30 seconds)
                            setTimeout(() => {
                                if (this.pendingRefreshPromise) {
                                    this.refreshReject(new Error('Token refresh timeout'));
                                    this._clearPendingRefreshState();
                                }
                            }, 30000);
                        } catch (error) {
                            this.refreshReject(new Error(`Failed to request token refresh: ${error.message}`));
                            this._clearPendingRefreshState();
                        }
                    });

                    return this.pendingRefreshPromise;
                } else {
                    console.warn('Token client not available for refresh');
                    return false;
                }
            }
        } catch (error) {
            console.error('Failed to check token expiration', error);
            throw error;
        }

        return false;
    }

    /**
     * Ensure we have a valid access token
     * Automatically refreshes token if needed
     * Throws an error if authentication fails
     */
    async ensureAuthenticated() {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated. Please sign in first.');
        }

        try {
            await this.refreshTokenIfNeeded();
        } catch (error) {
            console.error('Token refresh failed, may need re-authentication:', error);
            // Don't throw here - try to continue with existing token
            // If it's expired, the API call will fail and we'll handle it there
        }

        // Reload token from storage in case it was refreshed
        const currentToken = this._getCurrentAccessToken();
        if (currentToken) {
            this.accessToken = currentToken;
        }

        if (window.gapi?.client && this.accessToken) {
            window.gapi.client.setToken({ access_token: this.accessToken });
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
                // Ensure token is fresh before each attempt
                await this.ensureAuthenticated();
                const currentToken = this._getCurrentAccessToken();
                
                if (!currentToken) {
                    throw new Error('No access token available');
                }

                // Add/update Authorization header
                const headers = new Headers(options.headers || {});
                headers.set('Authorization', `Bearer ${currentToken}`);
                
                // Execute the fetch request
                const response = await fetch(url, {
                    ...options,
                    headers
                });

                // If fetch succeeds, return the response
                if (response.ok || response.status !== 401) {
                    return response;
                }

                // Handle 401 error - try to refresh and retry
                if (response.status === 401 && attempt < maxRetries) {
                    console.warn(`Fetch request failed with 401, attempting token refresh (attempt ${attempt + 1}/${maxRetries + 1})`);
                    
                    try {
                        // Force token refresh
                        await this.refreshTokenIfNeeded(true);
                        // Wait a bit before retrying
                        await new Promise(resolve => setTimeout(resolve, 500));
                        continue;
                    } catch (refreshError) {
                        console.error('Token refresh failed during fetch retry:', refreshError);
                        throw new Error('Authentication failed. Please sign in again.');
                    }
                }

                // If not 401 or no retries left, return the response (even if error)
                return response;
            } catch (error) {
                lastError = error;
                
                // If it's an auth error and we have retries left, continue
                if (error.message?.includes('Authentication failed') && attempt < maxRetries) {
                    continue;
                }
                
                // Otherwise, throw the error
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
                // Ensure token is fresh before each attempt
                await this.ensureAuthenticated();
                
                // Execute the API call
                const result = await apiCall();
                return result;
            } catch (error) {
                lastError = error;
                
                // Check if it's an authentication error
                const isAuthError = error.status === 401 || 
                                   error.status === 403 ||
                                   (error.result && (error.result.error?.code === 401 || error.result.error?.code === 403)) ||
                                   error.message?.includes('Invalid Credentials') ||
                                   error.message?.includes('unauthorized');
                
                if (isAuthError && attempt < maxRetries) {
                    console.warn(`API call failed with auth error, attempting token refresh (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
                    
                    // Try to refresh token
                    try {
                        // Force token refresh
                        await this.refreshTokenIfNeeded(true);
                        
                        // Update gapi token
                        const refreshedToken = this._getCurrentAccessToken();
                        if (refreshedToken) {
                            this.accessToken = refreshedToken;
                            if (window.gapi?.client) {
                                window.gapi.client.setToken({ access_token: this.accessToken });
                            }
                        }
                        
                        // Wait a bit before retrying
                        await new Promise(resolve => setTimeout(resolve, 500));
                        continue;
                    } catch (refreshError) {
                        console.error('Token refresh failed during API retry:', refreshError);
                        throw new Error('Authentication failed. Please sign in again.');
                    }
                } else {
                    // Not an auth error or no retries left
                    throw error;
                }
            }
        }
        
        throw lastError;
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
            return await window.gapi.client.drive.files.list({
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
            return await window.gapi.client.drive.files.create({
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
            return await window.gapi.client.drive.files.list({
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

        let folderId = await this.findOrCreateFolder();
        const payload = prepareExportPayload(goals, settings);
        const fileContent = JSON.stringify(payload, null, 2);
        const blob = new Blob([fileContent], { type: 'application/json' });

        // First, try to use stored fileId
        let fileId = this.fileId || localStorage.getItem(STORAGE_KEY_GDRIVE_FILE_ID);
        
        // If no stored fileId, search for existing file
        if (!fileId) {
            const existingFile = await this.findDataFile(folderId);
            fileId = existingFile ? existingFile.id : null;
            if (fileId) {
                this.fileId = fileId;
                localStorage.setItem(STORAGE_KEY_GDRIVE_FILE_ID, fileId);
            }
        }

        const metadata = {
            name: GOOGLE_DRIVE_FILE_NAME
        };

        let response;
        if (fileId) {
            // Update existing file - this creates a new revision in Google Drive
            // Use resumable upload for better reliability with file updates
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', blob);

            // Use executeFetchWithTokenRefresh for automatic token refresh on 401 errors
            response = await this.executeFetchWithTokenRefresh(
                `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
                {
                    method: 'PATCH',
                    body: form
                }
            );

            // If update fails, try to find the file again (might have been moved/deleted)
            if (!response.ok && (response.status === 403 || response.status === 404)) {
                // Clear folder cache if folder might be invalid
                if (response.status === 403) {
                    this.folderId = null;
                    localStorage.removeItem(STORAGE_KEY_GDRIVE_FOLDER_ID);
                    // Re-fetch folder ID
                    folderId = await this.findOrCreateFolder();
                }
                // Search for the file again
                const existingFile = await this.findDataFile(folderId);
                if (existingFile && existingFile.id !== fileId) {
                    // Found a different file with the same name - use it
                    fileId = existingFile.id;
                    this.fileId = fileId;
                    localStorage.setItem(STORAGE_KEY_GDRIVE_FILE_ID, fileId);
                    
                    // Try updating the found file
                    const retryForm = new FormData();
                    retryForm.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
                    retryForm.append('file', blob);
                    
                    response = await this.executeFetchWithTokenRefresh(
                        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
                        {
                            method: 'PATCH',
                            body: retryForm
                        }
                    );
                }
                
                // If still failing, create new file only as last resort
                if (!response.ok) {
                    metadata.parents = [folderId];
                    const newForm = new FormData();
                    newForm.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
                    newForm.append('file', blob);

                    response = await this.executeFetchWithTokenRefresh(
                        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                        {
                            method: 'POST',
                            body: newForm
                        }
                    );
                }
            }
        } else {
            // No existing file - create new one
            metadata.parents = [folderId];
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', blob);

            // Use executeFetchWithTokenRefresh for automatic token refresh on 401 errors
            response = await this.executeFetchWithTokenRefresh(
                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                {
                    method: 'POST',
                    body: form
                }
            );
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Upload failed' }));
            const errorMessage = error.error?.message || `Failed to upload to Google Drive (${response.status})`;
            throw new Error(errorMessage);
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
            throw new Error('Invalid JSON in Google Drive file');
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
    async checkSyncDirection(localVersion, localExportDate, localHasData = true) {
        try {
            // downloadData already handles token refresh, so we can call it directly
            const remote = await this.downloadData();
            const remoteVersion = remote.data?.version || null;
            const remoteExportDate = remote.data?.exportDate || null;
            const remoteGoals = remote.data?.goals || [];
            const remoteHasData = Array.isArray(remoteGoals) && remoteGoals.length > 0;

            // Priority 1: If local is empty and remote has data, always download
            if (!localHasData && remoteHasData) {
                return {
                    shouldUpload: false,
                    reason: 'local_empty_remote_has_data',
                    localVersion,
                    remoteVersion,
                    localExportDate,
                    remoteExportDate
                };
            }

            // Priority 2: If local has data and remote is empty, always upload
            if (localHasData && !remoteHasData) {
                return {
                    shouldUpload: true,
                    reason: 'local_has_data_remote_empty',
                    localVersion,
                    remoteVersion,
                    localExportDate,
                    remoteExportDate
                };
            }

            // Priority 3: If no remote export date, treat as older and upload local
            if (!remoteExportDate) {
                return {
                    shouldUpload: true,
                    reason: 'remote_no_date',
                    localVersion,
                    remoteVersion,
                    localExportDate,
                    remoteExportDate
                };
            }

            // Priority 4: If no local export date, treat as older and download remote
            if (!localExportDate) {
                return {
                    shouldUpload: false,
                    reason: 'local_no_date',
                    localVersion,
                    remoteVersion,
                    localExportDate,
                    remoteExportDate
                };
            }

            const localDate = new Date(localExportDate);
            const remoteDate = new Date(remoteExportDate);

            // Priority 5: Always sync toward older state (compare dates)
            if (remoteDate < localDate) {
                // Remote is older - upload local to update remote
                return {
                    shouldUpload: true,
                    reason: 'remote_older',
                    localVersion,
                    remoteVersion,
                    localExportDate,
                    remoteExportDate
                };
            } else if (localDate < remoteDate) {
                // Local is older - download remote to update local
                return {
                    shouldUpload: false,
                    reason: 'local_older',
                    localVersion,
                    remoteVersion,
                    localExportDate,
                    remoteExportDate
                };
            } else {
                // Same date - check versions
                if (isOlderVersion(remoteVersion, localVersion)) {
                    // Remote version is older - upload local
                    return {
                        shouldUpload: true,
                        reason: 'remote_version_older',
                        localVersion,
                        remoteVersion,
                        localExportDate,
                        remoteExportDate
                    };
                } else if (isOlderVersion(localVersion, remoteVersion)) {
                    // Local version is older - download remote
                    return {
                        shouldUpload: false,
                        reason: 'local_version_older',
                        localVersion,
                        remoteVersion,
                        localExportDate,
                        remoteExportDate
                    };
                } else {
                    // Same version and date - no sync needed, but default to upload
                    return {
                        shouldUpload: true,
                        reason: 'same_state',
                        localVersion,
                        remoteVersion,
                        localExportDate,
                        remoteExportDate
                    };
                }
            }
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
     * Get sync status information
     * Uses caching to avoid excessive API calls
     */
    async getSyncStatus() {
        if (!this.isAuthenticated()) {
            return {
                authenticated: false,
                synced: false
            };
        }

        // Return cached status if still valid (within 1 minute)
        const now = Date.now();
        if (this._cachedStatus && (now - this._lastStatusCheck) < this._statusCacheTimeout) {
            return this._cachedStatus;
        }

        try {
            // Use cached folder ID if available, otherwise search for it
            let folderId = this.folderId || localStorage.getItem(STORAGE_KEY_GDRIVE_FOLDER_ID);
            
            if (!folderId) {
                // Only search for folder if we don't have it cached
                const folderList = await this.executeWithTokenRefresh(async () => {
                    return await window.gapi.client.drive.files.list({
                        q: `name='${GOOGLE_DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                        fields: 'files(id, name)',
                        spaces: 'drive'
                    });
                });
                folderId = (folderList.result.files && folderList.result.files[0]?.id) || null;
                if (folderId) {
                    this.folderId = folderId;
                    localStorage.setItem(STORAGE_KEY_GDRIVE_FOLDER_ID, folderId);
                }
            }

            let file = null;
            if (folderId) {
                // Use cached file ID if available, otherwise search for it
                const cachedFileId = this.fileId || localStorage.getItem(STORAGE_KEY_GDRIVE_FILE_ID);
                
                if (cachedFileId) {
                    // Try to get file metadata directly using cached ID (more efficient)
                    try {
                        const fileResponse = await this.executeWithTokenRefresh(async () => {
                            return await window.gapi.client.drive.files.get({
                                fileId: cachedFileId,
                                fields: 'id, name, modifiedTime, trashed'
                            });
                        });
                        
                        // Verify it's not trashed and is the correct file
                        if (fileResponse.result && !fileResponse.result.trashed && fileResponse.result.name === GOOGLE_DRIVE_FILE_NAME) {
                            file = {
                                id: fileResponse.result.id,
                                modifiedTime: fileResponse.result.modifiedTime
                            };
                        }
                    } catch (error) {
                        // File might have been deleted or moved, fall back to listing
                        console.warn('Cached file ID invalid, falling back to list:', error);
                    }
                }
                
                // If we don't have file info yet, search for it
                if (!file) {
                    const fileList = await this.executeWithTokenRefresh(async () => {
                        return await window.gapi.client.drive.files.list({
                            q: `name='${GOOGLE_DRIVE_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
                            fields: 'files(id, name, modifiedTime)',
                            spaces: 'drive'
                        });
                    });
                    file = (fileList.result.files && fileList.result.files[0]) || null;
                    if (file) {
                        this.fileId = file.id;
                        localStorage.setItem(STORAGE_KEY_GDRIVE_FILE_ID, file.id);
                    }
                }
            }
            
            const status = {
                authenticated: true,
                synced: !!file,
                lastSyncTime: file ? file.modifiedTime : null,
                fileId: file ? file.id : null
            };
            
            // Cache the status
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
}

export default GoogleDriveSyncService;

