// tests/google-drive-service.test.js

const GoogleDriveService = require('../src/domain/services/google-drive-service').default;
const { GoogleDriveFileNotFoundError } = require('../src/domain/services/google-drive-service');

describe('GoogleDriveService', () => {
    let service;
    let mockAuthService;
    let mockGapi;

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
            client: {
                drive: {
                    files: {
                        list: jest.fn(() => Promise.resolve({
                            result: { files: [] }
                        })),
                        create: jest.fn(() => Promise.resolve({
                            result: { id: 'folder-id-123' }
                        })),
                        get: jest.fn(() => Promise.resolve({
                            result: { id: 'file-id', name: 'goaly-data.json' }
                        }))
                    }
                }
            }
        };
        globalThis.gapi = mockGapi;

        globalThis.fetch = jest.fn();

        mockAuthService = {
            isAuthenticated: jest.fn(() => true),
            getAccessToken: jest.fn(() => 'test-token'),
            ensureAuthenticated: jest.fn(() => Promise.resolve()),
            refreshTokenIfNeeded: jest.fn(() => Promise.resolve(true))
        };

        service = new GoogleDriveService(mockAuthService);
    });

    afterEach(() => {
        delete globalThis.gapi;
        delete globalThis.localStorage;
        delete globalThis.fetch;
        jest.restoreAllMocks();
    });

    test('constructor should set authService', () => {
        expect(service.authService).toBe(mockAuthService);
    });

    test('clearCache should reset cached IDs', () => {
        service.folderId = 'folder-123';
        service.fileId = 'file-456';

        service.clearCache();

        expect(service.folderId).toBeNull();
        expect(service.fileId).toBeNull();
    });

    test('clearCache should clear internal cached status', () => {
        service._cachedStatus = { authenticated: true };
        service._lastStatusCheck = Date.now();

        service.clearCache();

        expect(service._cachedStatus).toBeNull();
        expect(service._lastStatusCheck).toBe(0);
    });

    test('GoogleDriveFileNotFoundError should be exported', () => {
        const error = new GoogleDriveFileNotFoundError();
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('GoogleDriveFileNotFoundError');
    });

    test('findOrCreateFolder should find existing folder', async () => {
        mockGapi.client.drive.files.list.mockResolvedValue({
            result: {
                files: [{ id: 'existing-folder-id', name: 'Goaly' }]
            }
        });

        const folderId = await service.findOrCreateFolder();

        expect(folderId).toBe('existing-folder-id');
        expect(service.folderId).toBe('existing-folder-id');
    });

    test('findOrCreateFolder should create folder if not found', async () => {
        mockGapi.client.drive.files.list.mockResolvedValue({
            result: { files: [] }
        });
        mockGapi.client.drive.files.create.mockResolvedValue({
            result: { id: 'new-folder-id' }
        });

        const folderId = await service.findOrCreateFolder();

        expect(folderId).toBe('new-folder-id');
        expect(mockGapi.client.drive.files.create).toHaveBeenCalled();
    });

    test('findOrCreateFolder should use cached folderId', async () => {
        service.folderId = 'cached-folder-id';

        const folderId = await service.findOrCreateFolder();

        expect(folderId).toBe('cached-folder-id');
        expect(mockGapi.client.drive.files.list).not.toHaveBeenCalled();
    });

    test('findDataFile should find existing file', async () => {
        mockGapi.client.drive.files.list.mockResolvedValue({
            result: {
                files: [{ id: 'file-id', name: 'goaly-data.json' }]
            }
        });

        const file = await service.findDataFile('folder-id');

        expect(file).toEqual({ id: 'file-id', name: 'goaly-data.json' });
    });

    test('findDataFile should return null if not found', async () => {
        mockGapi.client.drive.files.list.mockResolvedValue({
            result: { files: [] }
        });

        const file = await service.findDataFile('folder-id');

        expect(file).toBeNull();
    });

    test('downloadData should throw GoogleDriveFileNotFoundError if no file', async () => {
        mockGapi.client.drive.files.list.mockResolvedValue({
            result: { files: [{ id: 'folder-id', name: 'Goaly' }] }
        });
        mockGapi.client.drive.files.list.mockResolvedValueOnce({
            result: { files: [{ id: 'folder-id', name: 'Goaly' }] }
        }).mockResolvedValueOnce({
            result: { files: [] }
        });

        await expect(service.downloadData()).rejects.toThrow(GoogleDriveFileNotFoundError);
    });

    test('executeWithTokenRefresh should call authService.ensureAuthenticated', async () => {
        const apiCall = jest.fn(() => Promise.resolve('result'));

        await service.executeWithTokenRefresh(apiCall);

        expect(mockAuthService.ensureAuthenticated).toHaveBeenCalled();
        expect(apiCall).toHaveBeenCalled();
    });

    test('executeWithTokenRefresh should retry on auth error', async () => {
        const error = { status: 401, result: { error: { status: 'UNAUTHENTICATED' } } };
        const apiCall = jest.fn()
            .mockRejectedValueOnce(error)
            .mockResolvedValueOnce('success');

        const result = await service.executeWithTokenRefresh(apiCall, 1);

        expect(result).toBe('success');
        expect(apiCall).toHaveBeenCalledTimes(2);
        expect(mockAuthService.refreshTokenIfNeeded).toHaveBeenCalledWith(true);
    });

    test('executeFetchWithTokenRefresh should add authorization header', async () => {
        globalThis.fetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ data: 'test' })
        });

        await service.executeFetchWithTokenRefresh('https://api.example.com/test');

        expect(globalThis.fetch).toHaveBeenCalled();
        const [url, options] = globalThis.fetch.mock.calls[0];
        expect(url).toBe('https://api.example.com/test');
        expect(options.headers.get('Authorization')).toBe('Bearer test-token');
    });

    test('getSyncStatus should return status object when file exists', async () => {
        // Mock folder lookup
        mockGapi.client.drive.files.list
            .mockResolvedValueOnce({
                result: { files: [{ id: 'folder-id', name: 'Goaly' }] }
            })
            // Mock file lookup
            .mockResolvedValueOnce({
                result: {
                    files: [{
                        id: 'file-id',
                        name: 'goaly-data.json',
                        modifiedTime: '2025-01-01T00:00:00Z'
                    }]
                }
            });

        const status = await service.getSyncStatus();

        expect(status.authenticated).toBe(true);
        expect(status.synced).toBe(true);
        expect(status.lastSyncTime).toBe('2025-01-01T00:00:00Z');
    });

    test('getSyncStatus should return not authenticated if authService returns false', async () => {
        mockAuthService.isAuthenticated.mockReturnValue(false);

        const status = await service.getSyncStatus();

        expect(status.authenticated).toBe(false);
        expect(status.synced).toBe(false);
    });
});
