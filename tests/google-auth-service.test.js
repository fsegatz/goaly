// tests/google-auth-service.test.js

const GoogleAuthService = require('../src/domain/services/google-auth-service').default;

describe('GoogleAuthService', () => {
    let service;
    let mockGapi;
    let mockGoogleAccounts;

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'warn').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });

        globalThis.localStorage = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            removeItem: jest.fn(),
            clear: jest.fn()
        };

        mockGapi = {
            load: jest.fn((module, callback) => {
                if (typeof callback === 'function') {
                    callback();
                }
            }),
            client: {
                init: jest.fn(() => Promise.resolve()),
                setToken: jest.fn()
            }
        };
        globalThis.gapi = mockGapi;

        mockGoogleAccounts = {
            oauth2: {
                initCodeClient: jest.fn(() => ({
                    requestCode: jest.fn()
                })),
                revoke: jest.fn()
            }
        };
        globalThis.google = { accounts: mockGoogleAccounts };

        globalThis.fetch = jest.fn();

        service = new GoogleAuthService();
    });

    afterEach(() => {
        delete globalThis.gapi;
        delete globalThis.google;
        delete globalThis.localStorage;
        delete globalThis.fetch;
        jest.restoreAllMocks();
    });

    test('isAuthenticated should return false when no access token', () => {
        expect(service.isAuthenticated()).toBe(false);
    });

    test('isAuthenticated should return true when access token exists', () => {
        service.accessToken = 'test-token';
        expect(service.isAuthenticated()).toBe(true);
    });

    test('getAccessToken should return current token', () => {
        service.accessToken = 'my-token';
        expect(service.getAccessToken()).toBe('my-token');
    });

    test('getAccessToken should return null when not authenticated', () => {
        expect(service.getAccessToken()).toBeNull();
    });

    test('signOut should clear access token', async () => {
        service.accessToken = 'test-token';
        service.tokenExpiresAt = Date.now() + 3600000;

        await service.signOut();

        expect(service.accessToken).toBeNull();
        expect(service.tokenExpiresAt).toBeNull();
    });

    test('signOut should revoke token if google accounts available', async () => {
        service.accessToken = 'test-token';

        await service.signOut();

        expect(mockGoogleAccounts.oauth2.revoke).toHaveBeenCalledWith('test-token', expect.any(Function));
    });

    test('signOut should call logout endpoint', async () => {
        service.accessToken = 'test-token';
        globalThis.fetch.mockResolvedValue({ ok: true });

        await service.signOut();

        expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
    });

    test('signOut should clear localStorage tokens', async () => {
        service.accessToken = 'test-token';

        await service.signOut();

        expect(globalThis.localStorage.removeItem).toHaveBeenCalled();
    });

    test('refreshTokenIfNeeded should skip if token is still valid', async () => {
        service.accessToken = 'valid-token';
        service.tokenExpiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes from now

        const result = await service.refreshTokenIfNeeded(false);

        expect(result).toBe(false);
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    test('refreshTokenIfNeeded should refresh if forced', async () => {
        service.accessToken = 'valid-token';
        service.tokenExpiresAt = Date.now() + 10 * 60 * 1000;

        globalThis.fetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ access_token: 'new-token', expires_in: 3600 })
        });

        const result = await service.refreshTokenIfNeeded(true);

        expect(result).toBe(true);
        expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/refresh', { method: 'POST' });
        expect(service.accessToken).toBe('new-token');
    });

    test('refreshTokenIfNeeded should clear token on failure', async () => {
        service.accessToken = 'old-token';
        service.tokenExpiresAt = Date.now() - 1000; // Expired

        globalThis.fetch.mockResolvedValue({
            ok: false
        });

        await expect(service.refreshTokenIfNeeded()).rejects.toThrow();
        expect(service.accessToken).toBeNull();
    });

    test('ensureAuthenticated should throw if not authenticated', async () => {
        service.accessToken = null;

        await expect(service.ensureAuthenticated()).rejects.toThrow('Not authenticated');
    });

    test('ensureAuthenticated should pass if authenticated', async () => {
        service.accessToken = 'valid-token';
        service.tokenExpiresAt = Date.now() + 10 * 60 * 1000;

        await expect(service.ensureAuthenticated()).resolves.not.toThrow();
    });

    test('_updateAccessToken should set token and expiry', () => {
        service._updateAccessToken('new-token', 3600);

        expect(service.accessToken).toBe('new-token');
        expect(service.tokenExpiresAt).toBeGreaterThan(Date.now());
        expect(mockGapi.client.setToken).toHaveBeenCalledWith({ access_token: 'new-token' });
    });
});
