// src/domain/sync/google-oauth-server.js

/**
 * @module GoogleOAuthServer
 * @description Server-side handler for Google OAuth flows.
 * Manages token exchange, refreshment, and secure cookie storage for auth tokens.
 */

const crypto = require('node:crypto');
const { parseCookies, readBody, sendResponse } = require('../../server/utils/http');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Encryption key for refresh token - set via environment variable for persistence
const REFRESH_TOKEN_KEY = process.env.REFRESH_TOKEN_KEY;
const ENCRYPTION_KEY = REFRESH_TOKEN_KEY
    ? Buffer.from(REFRESH_TOKEN_KEY, 'hex')
    : crypto.randomBytes(32);

if (!REFRESH_TOKEN_KEY) {
    console.warn('[WARN] REFRESH_TOKEN_KEY not set. Refresh tokens will not persist across server restarts.');
}
const IV_LENGTH = 12; // GCM recommended IV length is 12 bytes

/** @typedef {Object} IncomingMessage */
/** @typedef {Object} ServerResponse */

/**
 * Encrypt sensitive text (like refresh tokens).
 * @param {string} text - The text to encrypt
 * @returns {string} Encrypted text in format iv:authTag:encrypted
 */
function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Format: iv:authTag:encrypted (all in hex)
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypt text encrypted by this module.
 * @param {string} text - The encrypted text
 * @returns {string|null} Decrypted text or null if failed
 */
function decrypt(text) {
    try {
        const textParts = text.split(':');
        if (textParts.length < 3) return null;
        const iv = Buffer.from(textParts[0], 'hex');
        const authTag = Buffer.from(textParts[1], 'hex');
        const encryptedText = Buffer.from(textParts.slice(2).join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        console.debug('Decryption failed:', e.message);
        return null;
    }
}

/**
 * Handle exchange of authorization code for tokens.
 * @param {IncomingMessage} req - The request object
 * @param {ServerResponse} res - The response object
 */
async function handleExchange(req, res) {
    try {
        const body = await readBody(req);
        const { code } = body;

        if (!code) {
            return sendResponse(res, 400, { error: 'Authorization code required' });
        }

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code: code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: 'postmessage', // Special URI for "postmessage" flow
                grant_type: 'authorization_code'
            })
        });

        const tokens = await tokenResponse.json();

        if (tokens.error) {
            console.error('Google Token Error:', tokens);
            return sendResponse(res, 400, { error: tokens.error_description || tokens.error });
        }

        // If we got a refresh token, encrypt it and set cookie
        let cookies = [];
        if (tokens.refresh_token) {
            const encryptedRefresh = encrypt(tokens.refresh_token);
            cookies.push(`refresh_token=${encryptedRefresh}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`); // 30 days
        }

        return sendResponse(res, 200, {
            access_token: tokens.access_token,
            expires_in: tokens.expires_in
        }, cookies.length > 0 ? { 'Set-Cookie': cookies } : {});

    } catch (error) {
        console.error('Auth Exchange Error:', error);
        return sendResponse(res, 500, { error: 'Internal server error' });
    }
}

// Log key status on startup
console.log('[Auth] Server initialized. REFRESH_TOKEN_KEY is ' + (REFRESH_TOKEN_KEY ? 'SET' : 'NOT SET (using random fallback)'));

/**
 * Handle access token refresh using stored refresh token cookie.
 * @param {IncomingMessage} req - The request object
 * @param {ServerResponse} res - The response object
 */
async function handleRefreshToken(req, res) {
    try {
        console.log('[Auth] Handling refresh token request');
        const cookies = parseCookies(req);
        console.log('[Auth] Cookies received keys:', Object.keys(cookies));

        const encryptedRefresh = cookies.refresh_token;

        if (!encryptedRefresh) {
            console.warn('[Auth] No refresh_token cookie found');
            return sendResponse(res, 401, { error: 'No refresh token' });
        }

        const refreshToken = decrypt(encryptedRefresh);
        if (!refreshToken) {
            console.error('[Auth] Failed to decrypt refresh token');
            return sendResponse(res, 401, { error: 'Invalid refresh token' });
        }

        console.log('[Auth] Refresh token decrypted successfully. Exchanging with Google...');

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            })
        });

        const tokens = await tokenResponse.json();

        if (tokens.error) {
            console.error('[Auth] Google Token Refresh Error:', tokens);
            // If refresh fails (revoked?), clear cookie
            return sendResponse(res, 401, { error: 'Refresh failed' }, {
                'Set-Cookie': ['refresh_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0']
            });
        }

        console.log('[Auth] Token refresh successful');

        return sendResponse(res, 200, {
            access_token: tokens.access_token,
            expires_in: tokens.expires_in
        });

    } catch (error) {
        console.error('[Auth] Token Refresh Internal Error:', error);
        return sendResponse(res, 500, { error: 'Internal server error' });
    }
}

/**
 * Handle user logout by clearing cookies.
 * @param {ServerResponse} res - The response object
 */
function handleLogout(res) {
    return sendResponse(res, 200, { success: true }, {
        'Set-Cookie': ['refresh_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0']
    });
}

/**
 * Main router for OAuth API requests.
 * Routes to: /api/auth/exchange, /api/auth/refresh, /api/auth/logout
 * @param {IncomingMessage} req - The request object
 * @param {ServerResponse} res - The response object
 * @returns {Promise<void>}
 */
async function handleAuthRequest(req, res) {
    // Exchange Auth Code
    if (req.method === 'POST' && req.url === '/api/auth/exchange') {
        return handleExchange(req, res);
    }

    // Refresh Token
    if (req.method === 'POST' && req.url === '/api/auth/refresh') {
        return handleRefreshToken(req, res);
    }

    // Logout
    if (req.method === 'POST' && req.url === '/api/auth/logout') {
        return handleLogout(res);
    }

    return sendResponse(res, 404, { error: 'Not Found' });
}

module.exports = { handleAuthRequest };
