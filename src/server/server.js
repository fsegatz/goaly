const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { handleAuthRequest } = require('../domain/sync/google-oauth-server');

const PORT = process.env.PORT || 8080;
const ROOT_DIR = path.join(__dirname, '../../'); // Assuming src/server/server.js, so up two levels to root

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

const server = http.createServer(async (req, res) => {
    // API Routes (Delegated to Domain Module)
    if (req.url.startsWith('/api/auth/')) {
        return handleAuthRequest(req, res);
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
        try {
            const stats = await fs.promises.stat(filePath);
            if (stats.isDirectory()) {
                filePath = path.join(ROOT_DIR, 'index.html');
            }
        } catch (err) {
            if (err.code === 'ENOENT') {
                // File not found - fallback logic for SPA routes
                const ext = path.extname(filePath);
                if (ext) {
                    res.writeHead(404);
                    res.end('Not Found');
                    return;
                }
                filePath = path.join(ROOT_DIR, 'index.html');
            } else {
                // Other errors
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
                return;
            }
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

if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = server;
