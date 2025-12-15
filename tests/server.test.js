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

    // Verify Auth routing (mocked)
    describe('Auth Routing', () => {
        // We can't easily mock the requires inside server.js because it loads them at top level.
        // But since we are doing integration test on the real server, we can rely on the fact that
        // the auth handler logic works (tested separately) and just verify specific behavior if needed,
        // OR just leave the static file tests and maybe one basic check that /api/auth/X doesn't 404 immediately.

        // Actually, for pure integration tests, verifying the 404 on unknown auth route is enough to prove routing works.
        test('should route /api/auth/* request', async () => {
            const response = await fetch(`${baseUrl}/api/auth/unknown-route`, { method: 'POST' });
            expect(response.status).toBe(404); // 404 comes from the auth handler
        });
    });
});

