/**
 * @jest-environment node
 */
const { handleAuthRequest } = require('../src/domain/sync/google-oauth-server');
const { EventEmitter } = require('node:events');

describe('Google OAuth Server', () => {
    let req;
    let res;

    beforeEach(() => {
        req = new EventEmitter();
        req.headers = {};
        res = {
            writeHead: jest.fn((status, headers) => {
                res.statusCode = status;
                res.headers = headers || {};
            }),
            end: jest.fn()
        };
        // Mock window.console to suppress expected error logs
        jest.spyOn(console, 'error').mockImplementation(() => { });
        jest.spyOn(console, 'warn').mockImplementation(() => { });

        globalThis.fetch = jest.fn();
    });

    afterEach(async () => {
        // Wait for any pending setImmediate callbacks to complete
        await new Promise(resolve => setImmediate(resolve));
        jest.restoreAllMocks();
    });

    const simulatePost = (url, body) => {
        req.method = 'POST';
        req.url = url;
        // Schedule events on next tick to allow handleAuthRequest to set up listeners first
        setImmediate(() => {
            if (body) {
                req.emit('data', Buffer.from(JSON.stringify(body)));
            }
            req.emit('end');
        });
    };

    const getResponseCookie = () => {
        if (!res.headers?.['Set-Cookie']) {
            if (console.error.mock && console.error.mock.calls.length > 0) {
                const errors = console.error.mock.calls.map(c => JSON.stringify(c)).join('; ');
                throw new Error(`Set-Cookie missing. Suppressed errors: ${errors}`);
            }
            throw new Error(`Set-Cookie header missing. Response Status: ${res.statusCode}. Headers: ${JSON.stringify(res.headers)}`);
        }
        return res.headers['Set-Cookie'][0].split(';')[0];
    };

    test('POST /api/auth/exchange should exchange code for tokens', async () => {
        globalThis.fetch.mockResolvedValue({
            json: async () => ({
                access_token: 'access-123',
                refresh_token: 'refresh-456',
                expires_in: 3600
            })
        });

        simulatePost('/api/auth/exchange', { code: 'auth-code' });
        await handleAuthRequest(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
            'Set-Cookie': expect.any(Array)
        }));

        const responseBody = JSON.parse(res.end.mock.calls[0][0]);
        expect(responseBody.access_token).toBe('access-123');
    });

    test('POST /api/auth/exchange should handle missing code', async () => {
        simulatePost('/api/auth/exchange', {});
        await handleAuthRequest(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        const responseBody = JSON.parse(res.end.mock.calls[0][0]);
        expect(responseBody.error).toBe('Authorization code required');
    });

    test('POST /api/auth/logout should clear cookie', async () => {
        simulatePost('/api/auth/logout', {});
        await handleAuthRequest(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
            'Set-Cookie': expect.arrayContaining([expect.stringContaining('Max-Age=0')])
        }));
    });

    test('POST /api/auth/exchange should handle upstream error', async () => {
        globalThis.fetch.mockResolvedValue({
            json: async () => ({ error: 'invalid_grant', error_description: 'Bad code' })
        });

        simulatePost('/api/auth/exchange', { code: 'bad-code' });
        await handleAuthRequest(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        const responseBody = JSON.parse(res.end.mock.calls[0][0]);
        expect(responseBody.error).toBe('Bad code');
    });

    test('POST /api/auth/exchange should handle fetch exception', async () => {
        globalThis.fetch.mockRejectedValue(new Error('Network error'));

        simulatePost('/api/auth/exchange', { code: 'code' });
        await handleAuthRequest(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    });

    test('POST /api/auth/refresh should fail if no cookie', async () => {
        simulatePost('/api/auth/refresh', {});
        await handleAuthRequest(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
        const body = JSON.parse(res.end.mock.calls[0][0]);
        expect(body.error).toBe('No refresh token');
    });

    test('POST /api/auth/refresh should fail if invalid cookie (decrypt fails)', async () => {
        req.headers.cookie = 'refresh_token=invalid-garbage';
        simulatePost('/api/auth/refresh', {});
        await handleAuthRequest(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
        const body = JSON.parse(res.end.mock.calls[0][0]);
        expect(body.error).toBe('Invalid refresh token');
    });

    test('POST /api/auth/refresh should succeed with valid cookie', async () => {
        // 1. First exchange to generate a valid encrypted cookie
        globalThis.fetch.mockResolvedValueOnce({
            json: async () => ({ access_token: 'a1', refresh_token: 'r1', expires_in: 3600 })
        });

        simulatePost('/api/auth/exchange', { code: 'c1' });
        const handlePromise = handleAuthRequest(req, res);
        await handlePromise;

        const cookieStr = getResponseCookie();

        // Reset mocks for refresh
        res.writeHead.mockClear();
        res.end.mockClear();
        res.headers = {};
        res.statusCode = undefined;
        req = new EventEmitter();
        req.headers = { cookie: cookieStr };

        // 2. Mock refresh upstream response
        globalThis.fetch.mockResolvedValueOnce({
            json: async () => ({ access_token: 'new-access', expires_in: 3600 })
        });

        simulatePost('/api/auth/refresh', {});
        await handleAuthRequest(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
        const body = JSON.parse(res.end.mock.calls[0][0]);
        expect(body.access_token).toBe('new-access');
    });

    test('POST /api/auth/refresh should clear cookie if upstream returns error (revoked)', async () => {
        // 1. Generate valid cookie
        globalThis.fetch.mockResolvedValueOnce({
            json: async () => ({ access_token: 'a1', refresh_token: 'r1', expires_in: 3600 })
        });
        simulatePost('/api/auth/exchange', { code: 'c1' });
        await handleAuthRequest(req, res);
        const cookieStr = getResponseCookie();

        // 2. Refresh fails upstream
        res.writeHead.mockClear();
        res.end.mockClear();
        res.headers = {};
        res.statusCode = undefined;
        req = new EventEmitter();
        req.headers = { cookie: cookieStr };

        globalThis.fetch.mockResolvedValueOnce({
            json: async () => ({ error: 'invalid_grant' })
        });

        simulatePost('/api/auth/refresh', {});
        await handleAuthRequest(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(401, expect.objectContaining({
            'Set-Cookie': expect.arrayContaining([expect.stringContaining('Max-Age=0')])
        }));
    });

    test('POST /api/auth/refresh should handle fetch exception', async () => {
        // 1. Generate valid cookie
        globalThis.fetch.mockResolvedValueOnce({
            json: async () => ({ access_token: 'a1', refresh_token: 'r1', expires_in: 3600 })
        });
        simulatePost('/api/auth/exchange', { code: 'c1' });
        await handleAuthRequest(req, res);
        const cookieStr = getResponseCookie();

        // 2. Exception
        res.writeHead.mockClear();
        res.end.mockClear();
        res.headers = {};
        res.statusCode = undefined;
        req = new EventEmitter();
        req.headers = { cookie: cookieStr };

        globalThis.fetch.mockRejectedValue(new Error('Net err'));

        simulatePost('/api/auth/refresh', {});
        await handleAuthRequest(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    });

    test('should return 404 for unknown routes', async () => {
        simulatePost('/api/auth/unknown', {});
        await handleAuthRequest(req, res);
        expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    });
});
