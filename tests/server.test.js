/**
 * @jest-environment node
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const server = require('../src/server/server');

describe('Node.js Server', () => {
    let baseUrl;
    let port;
    let serverInstance;

    beforeAll((done) => {
        // Start server on random port
        serverInstance = server.listen(0, () => {
            port = serverInstance.address().port;
            baseUrl = `http://localhost:${port}`;
            done();
        });
    });

    afterAll((done) => {
        serverInstance.close(done);
    });

    const realFetch = global.fetch;

    // Default mock response for upstream
    let mockUpstreamResponse = { ok: true, json: async () => ({}) };

    beforeEach(() => {
        jest.clearAllMocks();
        mockUpstreamResponse = { ok: true, json: async () => ({}) }; // Reset default

        global.fetch = jest.fn((url, options) => {
            if (typeof url === 'string' && url.startsWith('http://localhost')) {
                return realFetch(url, options);
            }
            // Mock upstream (Google)
            return Promise.resolve(mockUpstreamResponse);
        });
    });

    describe('Static File Serving', () => {
        test('should serve index.html for root', async () => {
            const indexContent = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

            const response = await fetch(`${baseUrl}/`);
            const text = await response.text();

            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toBe('text/html');
            expect(text).toBe(indexContent);
        });

        test('should serve static assets', async () => {
            const appJsContent = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');

            const response = await fetch(`${baseUrl}/src/app.js`);
            const text = await response.text();

            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toBe('text/javascript');
            expect(text).toBe(appJsContent);
        });

        test('should return 404 for missing assets', async () => {
            const response = await fetch(`${baseUrl}/missing.png`);
            expect(response.status).toBe(404);
        });

        test('should fallback to index.html for non-asset routes (SPA)', async () => {
            const indexContent = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
            const response = await fetch(`${baseUrl}/some/app/route`);
            const text = await response.text();

            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toBe('text/html');
            expect(text).toBe(indexContent);
        });

        test('should serve dynamic config.local.js', async () => {
            process.env.GOOGLE_API_KEY = 'test-key';
            process.env.GOOGLE_CLIENT_ID = 'test-id';

            const response = await fetch(`${baseUrl}/config.local.js`);
            const text = await response.text();

            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toBe('text/javascript');
            expect(text).toContain('window.GOOGLE_API_KEY = "test-key"');
            expect(text).toContain('window.GOOGLE_CLIENT_ID = "test-id"');
        });
    });

    describe('Auth API', () => {
        test('POST /api/auth/exchange should exchange code for tokens', async () => {
            mockUpstreamResponse = {
                ok: true,
                json: async () => ({
                    access_token: 'access-123',
                    refresh_token: 'refresh-456',
                    expires_in: 3600
                })
            };

            const response = await fetch(`${baseUrl}/api/auth/exchange`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: 'auth-code' })
            });

            const data = await response.json();
            const cookies = response.headers.get('set-cookie');

            expect(response.status).toBe(200);
            expect(data.access_token).toBe('access-123');
            expect(cookies).toContain('refresh_token=');
            expect(cookies).toContain('HttpOnly');
        });

        test('POST /api/auth/exchange should handle missing code', async () => {
            const response = await fetch(`${baseUrl}/api/auth/exchange`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            expect(response.status).toBe(400);
        });

        // Test checking failure when no cookie provided
        test('POST /api/auth/refresh should fail if no cookie', async () => {
            const response = await fetch(`${baseUrl}/api/auth/refresh`, {
                method: 'POST'
            });
            expect(response.status).toBe(401);
        });

        test('POST /api/auth/logout should clear cookie', async () => {
            const response = await fetch(`${baseUrl}/api/auth/logout`, {
                method: 'POST'
            });

            const cookie = response.headers.get('set-cookie');
            expect(response.status).toBe(200);
            expect(cookie).toContain('refresh_token=;'); // Cleared
            expect(cookie).toContain('Max-Age=0');
        });
    });
});
