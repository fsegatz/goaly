const crypto = require('node:crypto');
const { parseCookies, readBody, sendResponse } = require('../../server/utils/http');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Encryption key for refresh token (in memory, generates new one on restart currently)
const ENCRYPTION_KEY = crypto.randomBytes(32);
const IV_LENGTH = 16;

function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        return null;
    }
}

/**
 * Handle Google OAuth API requests
 * @param {http.IncomingMessage} req 
 * @param {http.ServerResponse} res 
 */
async function handleAuthRequest(req, res) {
    // Exchange Auth Code
    if (req.method === 'POST' && req.url === '/api/auth/exchange') {
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
                cookies.push(`refresh_token=${encryptedRefresh}; HttpOnly; Secure; SameSite=Strict; Path=/api/auth/; Max-Age=${60 * 60 * 24 * 30}`); // 30 days
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

    // Refresh Token
    if (req.method === 'POST' && req.url === '/api/auth/refresh') {
        try {
            const cookies = parseCookies(req);
            const encryptedRefresh = cookies.refresh_token;

            if (!encryptedRefresh) {
                return sendResponse(res, 401, { error: 'No refresh token' });
            }

            const refreshToken = decrypt(encryptedRefresh);
            if (!refreshToken) {
                return sendResponse(res, 401, { error: 'Invalid refresh token' });
            }

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
                // If refresh fails (revoked?), clear cookie
                return sendResponse(res, 401, { error: 'Refresh failed' }, {
                    'Set-Cookie': ['refresh_token=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth/; Max-Age=0']
                });
            }

            return sendResponse(res, 200, {
                access_token: tokens.access_token,
                expires_in: tokens.expires_in
            });

        } catch (error) {
            console.error('Token Refresh Error:', error);
            return sendResponse(res, 500, { error: 'Internal server error' });
        }
    }

    // Logout
    if (req.method === 'POST' && req.url === '/api/auth/logout') {
        return sendResponse(res, 200, { success: true }, {
            'Set-Cookie': ['refresh_token=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth/; Max-Age=0']
        });
    }

    return sendResponse(res, 404, { error: 'Not Found' });
}

module.exports = { handleAuthRequest };
