// src/server/server.js

/**
 * @module Server
 * @description Main entry point for the static file server.
 * Handles static file serving, API proxying (if any), and dynamic configuration injection.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { handleAuthRequest } = require('../domain/sync/google-oauth-server');

const PORT = process.env.PORT || 8080;
const ROOT_DIR = path.resolve(__dirname, '../../'); // Assuming src/server/server.js, so up two levels to root

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

/**
 * Serves the dynamic configuration for the client.
 * Injects environment variables like GOOGLE_API_KEY into the global window object.
 * @param {http.ServerResponse} res - The response object
 */
function serveConfig(res) {
    const configContent = `window.GOOGLE_API_KEY = "${process.env.GOOGLE_API_KEY || ''}";\nwindow.GOOGLE_CLIENT_ID = "${process.env.GOOGLE_CLIENT_ID || ''}";`;
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    res.end(configContent);
}

/** @typedef {Object} IncomingMessage */
/** @typedef {Object} ServerResponse */

/**
 * Serves static files with SPA fallback logic.
 * If a file is not found and is not a static asset, it serves index.html.
 * @async
 * @async
 * @param {IncomingMessage} req - The request object
 * @param {ServerResponse} res - The response object
 * @param {string} rootDir - The root directory to serve files from
 */
async function serveStaticFile(req, res, rootDir) {
    // Sanitize and resolve the file path to prevent path injection (S2083)
    const requestPath = req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]);
    let filePath = path.resolve(rootDir, '.' + (requestPath.startsWith('/') ? requestPath : '/' + requestPath));

    // Prevent directory traversal
    if (!filePath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    // Generate config.local.js dynamically if requested
    if (req.url === '/config.local.js') {
        return serveConfig(res);
    }

    // SPA Fallback check: if file doesn't exist and it's not an asset, serve index.html
    try {
        const stats = await fs.promises.stat(filePath);
        if (stats.isDirectory()) {
            filePath = path.join(rootDir, 'index.html');
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
            filePath = path.join(rootDir, 'index.html');
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
            // Cache control
            const isAsset = ['.js', '.css'].includes(extname);
            const isImage = ['.png', '.jpg', '.ico', '.svg'].includes(extname);
            const headers = { 'Content-Type': contentType };

            if (isAsset) {
                // Prevent aggressive caching for scripts and styles during development
                headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
                headers['Pragma'] = 'no-cache';
                headers['Expires'] = '0';
            } else if (isImage) {
                headers['Cache-Control'] = 'public, max-age=31536000, immutable';
            }

            res.writeHead(200, headers);
            res.end(content, 'utf-8');
        }
    });
}

const server = http.createServer(async (req, res) => {
    // API Routes (Delegated to Domain Module)
    if (req.url.startsWith('/api/auth/')) {
        return handleAuthRequest(req, res);
    }

    // Static File Serving
    if (req.method === 'GET') {
        return serveStaticFile(req, res, ROOT_DIR);
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
