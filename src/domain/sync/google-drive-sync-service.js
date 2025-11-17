// src/domain/google-drive-sync-service.js

import { prepareExportPayload } from '../migration/migration-service.js';
import { GOAL_FILE_VERSION, isSameVersion, isOlderVersion, isNewerVersion } from '../utils/versioning.js';
import { STORAGE_KEY_GDRIVE_TOKEN, STORAGE_KEY_GDRIVE_FILE_ID } from '../utils/constants.js';

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
        this.initialized = false;
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

        // Load saved token and file ID
        const savedToken = localStorage.getItem(STORAGE_KEY_GDRIVE_TOKEN);
        if (savedToken) {
            try {
                const tokenData = JSON.parse(savedToken);
                this.accessToken = tokenData.access_token;
                this.fileId = localStorage.getItem(STORAGE_KEY_GDRIVE_FILE_ID);
            } catch (error) {
                console.error('Failed to load saved token', error);
            }
        }

        // Load Google APIs
        await this.loadGoogleAPIs();
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
                            }
                            reject(new Error(errorMessage));
                            return;
                        }

                        if (!response.access_token) {
                            reject(new Error('No access token received from Google. Please try again.'));
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

                        resolve(this.accessToken);
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
        localStorage.removeItem(STORAGE_KEY_GDRIVE_TOKEN);
        localStorage.removeItem(STORAGE_KEY_GDRIVE_FILE_ID);
        if (window.gapi?.client) {
            window.gapi.client.setToken(null);
        }
    }

    /**
     * Refresh access token if needed
     */
    async refreshTokenIfNeeded() {
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

            // Refresh if token expires in less than 5 minutes
            if (expiresAt - now < 5 * 60 * 1000) {
                if (this.tokenClient) {
                    this.tokenClient.requestAccessToken({ prompt: '' });
                    return true;
                }
            }
        } catch (error) {
            console.error('Failed to check token expiration', error);
        }

        return false;
    }

    /**
     * Ensure we have a valid access token
     */
    async ensureAuthenticated() {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated. Please sign in first.');
        }

        await this.refreshTokenIfNeeded();

        if (window.gapi?.client) {
            window.gapi.client.setToken({ access_token: this.accessToken });
        }
    }

    /**
     * Find or create the Goaly folder in Google Drive
     */
    async findOrCreateFolder() {
        await this.ensureAuthenticated();

        // Search for existing folder
        const response = await window.gapi.client.drive.files.list({
            q: `name='${GOOGLE_DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        if (response.result.files && response.result.files.length > 0) {
            return response.result.files[0].id;
        }

        // Create folder if it doesn't exist
        const folderResponse = await window.gapi.client.drive.files.create({
            resource: {
                name: GOOGLE_DRIVE_FOLDER_NAME,
                mimeType: 'application/vnd.google-apps.folder'
            },
            fields: 'id'
        });

        return folderResponse.result.id;
    }

    /**
     * Find the Goaly data file in Google Drive
     */
    async findDataFile(folderId) {
        await this.ensureAuthenticated();

        const response = await window.gapi.client.drive.files.list({
            q: `name='${GOOGLE_DRIVE_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id, name, modifiedTime)',
            spaces: 'drive'
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

        const folderId = await this.findOrCreateFolder();
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

            response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                },
                body: form
            });

            // If update fails, try to find the file again (might have been moved/deleted)
            if (!response.ok && (response.status === 403 || response.status === 404)) {
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
                    
                    response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${this.accessToken}`
                        },
                        body: retryForm
                    });
                }
                
                // If still failing, create new file only as last resort
                if (!response.ok) {
                    metadata.parents = [folderId];
                    const newForm = new FormData();
                    newForm.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
                    newForm.append('file', blob);

                    response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${this.accessToken}`
                        },
                        body: newForm
                    });
                }
            }
        } else {
            // No existing file - create new one
            metadata.parents = [folderId];
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', blob);

            response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                },
                body: form
            });
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Upload failed' }));
            const errorMessage = error.error?.message || `Failed to upload to Google Drive (${response.status})`;
            throw new Error(errorMessage);
        }

        const result = await response.json();
        this.fileId = result.id;
        localStorage.setItem(STORAGE_KEY_GDRIVE_FILE_ID, this.fileId);

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

        // Download file content using fetch
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`
            }
        });

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
     */
    async getSyncStatus() {
        if (!this.isAuthenticated()) {
            return {
                authenticated: false,
                synced: false
            };
        }

        try {
            // Do not create folder on status check; list by name instead
            const folderList = await window.gapi.client.drive.files.list({
                q: `name='${GOOGLE_DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id, name)',
                spaces: 'drive'
            });
            const folderId = (folderList.result.files && folderList.result.files[0]?.id) || null;
            let file = null;
            if (folderId) {
                const fileList = await window.gapi.client.drive.files.list({
                    q: `name='${GOOGLE_DRIVE_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
                    fields: 'files(id, name, modifiedTime)',
                    spaces: 'drive'
                });
                file = (fileList.result.files && fileList.result.files[0]) || null;
            }
            return {
                authenticated: true,
                synced: !!file,
                lastSyncTime: file ? file.modifiedTime : null,
                fileId: file ? file.id : null
            };
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

