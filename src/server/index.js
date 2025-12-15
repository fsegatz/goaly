const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = process.env.PORT || 8080;
const ROOT_DIR = path.join(__dirname, '../../'); // Assuming src/server/index.js, so up two levels to root
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// MIME types for static files
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

// Encryption key for refresh token (in memory, generates new one on restart currently)
// For persistent sessions across server restarts you would want a fixed key,
// but for this implementation a random key per instance is secure enough.
// The user just has to login again if the server restarts.
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

function parseCookies(request) {
    const list = {};
    const cookieHeader = request.headers.cookie;
    if (cookieHeader) {
        cookieHeader.split(';').forEach(function (cookie) {
            const parts = cookie.split('=');
            list[parts.shift().trim()] = decodeURI(parts.join('='));
        });
    }
    return list;
}

function readBody(request) {
    return new Promise((resolve, reject) => {
        let body = [];
        request.on('error', (err) => {
            console.error(err);
            reject(err);
        }).on('data', (chunk) => {
            body.push(chunk);
        }).on('end', () => {
            try {
                const str = Buffer.concat(body).toString();
                if (!str) resolve({});
                else resolve(JSON.parse(str));
            } catch (e) {
                reject(e);
            }
        });
    });
}

function sendResponse(res, status, data, headers = {}) {
    res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
    res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
    // API Routes
    if (req.url.startsWith('/api/auth/')) {
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

    // Static File Serving
    if (req.method === 'GET') {
        let filePath = path.join(ROOT_DIR, req.url === '/' ? 'index.html' : req.url);

        // Prevent directory traversal
        if (!filePath.startsWith(ROOT_DIR)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        // Generate config.local.js dynamically if requested
        if (req.url === '/config.local.js') {
            const configContent = `window.GOOGLE_API_KEY = "${process.env.GOOGLE_API_KEY || ''}";\nwindow.GOOGLE_CLIENT_ID = "${process.env.GOOGLE_CLIENT_ID || ''}";`;
            res.writeHead(200, { 'Content-Type': 'text/javascript' });
            res.end(configContent);
            return;
        }

        // SPA Fallback check: if file doesn't exist and it's not an asset, serve index.html
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
            // Basic heuristic: if it has an extension, it's an asset (404), otherwise it's a route (serve index.html)
            // But actually, for single page apps, we usually try the file, if missing serve index.html
            // EXCEPT for static assets (js, css, png).

            const ext = path.extname(filePath);
            if (ext) {
                res.writeHead(404);
                res.end('Not Found');
                return;
            }

            // Fallback to index.html
            filePath = path.join(ROOT_DIR, 'index.html');
        }

        const extname = path.extname(filePath);
        const contentType = MIME_TYPES[extname] || 'application/octet-stream';

        fs.readFile(filePath, (err, content) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    res.writeHead(404);
                    res.end('Page Not Found');
                } else {
                    res.writeHead(500);
                    res.end(`Server Error: ${err.code}`);
                }
            } else {
                // Cache control like Nginx
                const isAsset = ['.js', '.css', '.png', '.jpg'].includes(extname);
                const headers = { 'Content-Type': contentType };
                if (isAsset) {
                    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
                }
                res.writeHead(200, headers);
                res.end(content, 'utf-8');
            }
        });
        return;
    }

    res.writeHead(405);
    res.end('Method Not Allowed');
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
