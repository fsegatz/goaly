// src/domain/services/google-auth-service.js

/**
 * @module GoogleAuthService
 * @description Handles Google OAuth authentication and token management.
 * Manages Google API script loading, OAuth popup flow, and token refresh.
 */

import {
    STORAGE_KEY_GDRIVE_TOKEN,
    STORAGE_KEY_GDRIVE_FILE_ID,
    STORAGE_KEY_GDRIVE_FOLDER_ID
} from '../utils/constants.js';

/** @constant {string} SCOPES - OAuth scopes required */
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

/** @constant {Array<string>} DISCOVERY_DOCS - Google API discovery docs */
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];

/**
 * Service to manage Google OAuth authentication.
 * @class
 */
class GoogleAuthService {
    constructor() {
        this.tokenClient = null;
        this.gapiLoaded = false;
        this.gisLoaded = false;
        this.accessToken = null;
        this.tokenExpiresAt = null;
        this.initialized = false;
        this.pendingRefreshPromise = null;
        this.refreshResolve = null;
        this.refreshReject = null;
        this.apiKey = null;
        this.clientId = null;
    }

    /**
     * Initialize the auth service - must be called before using.
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

        await this.loadGoogleAPIs();

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
        }

        this.initialized = true;
    }

    /**
     * Load Google APIs scripts (gapi + gis).
     * @returns {Promise<void>}
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
     * Check if user is authenticated.
     * @returns {boolean}
     */
    isAuthenticated() {
        return !!this.accessToken;
    }

    /**
     * Authenticate with Google using OAuth2 popup.
     * @returns {Promise<string>} The access token
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
     * Handle Authorization Code response from Google.
     * @param {Object} response - The response containing auth code
     * @private
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
     * Update access token and gapi client.
     * @param {string} token - The access token
     * @param {number} expiresInSeconds - Token expiration time in seconds
     * @private
     */
    _updateAccessToken(token, expiresInSeconds) {
        this.accessToken = token;
        this.tokenExpiresAt = Date.now() + (expiresInSeconds * 1000);

        if (globalThis.gapi?.client) {
            globalThis.gapi.client.setToken({ access_token: this.accessToken });
        }
    }

    /**
     * Clear pending refresh state.
     * @private
     */
    _clearPendingRefreshState() {
        this.refreshResolve = null;
        this.refreshReject = null;
        this.pendingRefreshPromise = null;
    }

    /**
     * Get current access token.
     * @returns {string|null}
     */
    getAccessToken() {
        return this.accessToken;
    }

    /**
     * Refresh access token if needed.
     * @param {boolean} force - Force refresh even if token is still valid
     * @returns {Promise<boolean>} True if refresh was performed
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
                this.accessToken = null;
                throw error;
            } finally {
                this.pendingRefreshPromise = null;
            }
        })();

        return this.pendingRefreshPromise;
    }

    /**
     * Ensure we have a valid access token, refreshing if needed.
     * @throws {Error} If not authenticated and refresh fails
     */
    async ensureAuthenticated() {
        try {
            await this.refreshTokenIfNeeded();
        } catch (e) {
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
     * Sign out and clear stored tokens.
     */
    async signOut() {
        if (this.accessToken && globalThis.google?.accounts) {
            globalThis.google.accounts.oauth2.revoke(this.accessToken, () => { });
        }

        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (e) {
            console.error('Logout error', e);
        }

        this.accessToken = null;
        this.tokenExpiresAt = null;

        localStorage.removeItem(STORAGE_KEY_GDRIVE_FILE_ID);
        localStorage.removeItem(STORAGE_KEY_GDRIVE_FOLDER_ID);
        localStorage.removeItem(STORAGE_KEY_GDRIVE_TOKEN);

        if (globalThis.gapi?.client) {
            globalThis.gapi.client.setToken(null);
        }
    }
}

export default GoogleAuthService;
