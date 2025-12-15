/**
 * @jest-environment node
 */
const { handleAuthRequest } = require('../src/domain/sync/google-oauth-server');
const { EventEmitter } = require('events');

describe('Google OAuth Server', () => {
    let req;
    let res;

    beforeEach(() => {
        // Simple mock request using EventEmitter to support readBody
        req = new EventEmitter();
        req.headers = {};

        // Mock response
        res = {
            writeHead: jest.fn(),
            end: jest.fn()
        };

        global.fetch = jest.fn();
    });

    const simulatePost = (url, body) => {
        req.method = 'POST';
        req.url = url;
        // Trigger data events for readBody (if body exists)
        // We need to do this asynchronously usually, or right after calling the handler? 
        // readBody returns a promise that waits for 'end'. 
        // So we can emit events after calling handler.
        process.nextTick(() => {
            if (body) {
                req.emit('data', Buffer.from(JSON.stringify(body)));
            }
            req.emit('end');
        });
    };

    test('POST /api/auth/exchange should exchange code for tokens', async () => {
        global.fetch.mockResolvedValue({
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

    test('should return 404 for unknown routes', async () => {
        simulatePost('/api/auth/unknown', {});
        await handleAuthRequest(req, res);
        expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    });
});
