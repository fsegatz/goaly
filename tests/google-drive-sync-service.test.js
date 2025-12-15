// tests/google-drive-sync-service.test.js

const GoogleDriveSyncService = require('../src/domain/sync/google-drive-sync-service').default;

describe('GoogleDriveSyncService', () => {
    let service;
    let mockGapi;
    let mockGoogleAccounts;

    beforeEach(() => {
        // Mock console.warn and console.error to suppress expected warnings during tests
        jest.spyOn(console, 'warn').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });

        // Mock localStorage
        global.localStorage = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            removeItem: jest.fn(),
            clear: jest.fn()
        };

        // Mock window.gapi
        mockGapi = {
            load: jest.fn((module, callback) => {
                if (typeof callback === 'function') {
                    callback();
                }
            }),
            client: {
                init: jest.fn(() => Promise.resolve()),
                setToken: jest.fn(),
                drive: {
                    files: {
                        list: jest.fn(() => Promise.resolve({
                            result: { files: [] }
                        })),
                        create: jest.fn(() => Promise.resolve({
                            result: { id: 'folder-id-123' }
                        })),
                        get: jest.fn(() => Promise.resolve({
                            result: { id: 'file-id', name: 'goaly-data.json', modifiedTime: '2025-01-01T00:00:00Z', trashed: false }
                        }))
                    }
                }
            }
        };

        // Mock window.google.accounts
        mockGoogleAccounts = {
            oauth2: {
                initCodeClient: jest.fn(() => ({
                    requestCode: jest.fn()
                })),
                revoke: jest.fn()
            }
        };

        global.window = {
            gapi: mockGapi,
            google: {
                accounts: mockGoogleAccounts
            },
            document: {
                createElement: jest.fn(() => ({
                    src: '',
                    onload: null,
                    onerror: null
                })),
                head: {
                    appendChild: jest.fn()
                }
            }
        };

        global.fetch = jest.fn();

        service = new GoogleDriveSyncService();
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    describe('initialization', () => {
        test('should initialize with API key and client ID', async () => {
            const apiKey = 'test-api-key';
            const clientId = 'test-client-id';

            // Mock script loading
            const mockScript = {
                src: '',
                onload: null,
                onerror: null
            };
            window.document.createElement.mockReturnValue(mockScript);

            // Mock gapi and gis already loaded
            window.gapi = mockGapi;
            window.google = { accounts: mockGoogleAccounts };

            // Mock refresh call failure on init (no existing session)
            global.fetch.mockImplementation((url) => {
                if (url === '/api/auth/refresh') {
                    return Promise.resolve({ ok: false });
                }
                return Promise.resolve({ ok: true });
            });

            await service.initialize(apiKey, clientId);

            expect(service.apiKey).toBe(apiKey);
            expect(service.clientId).toBe(clientId);
            expect(service.initialized).toBe(true);
        });

        test('should throw error if API key or client ID is missing', async () => {
            await expect(service.initialize(null, 'client-id')).rejects.toThrow('Google API key and client ID are required');
            await expect(service.initialize('api-key', null)).rejects.toThrow('Google API key and client ID are required');
        });
    });

    describe('authentication', () => {
        beforeEach(async () => {
            service.apiKey = 'test-api-key';
            service.clientId = 'test-client-id';
            service.gapiLoaded = true;
            service.gisLoaded = true;
            service.initialized = true;
        });

        test('should check if authenticated', () => {
            expect(service.isAuthenticated()).toBe(false);

            service.accessToken = 'test-token';
            expect(service.isAuthenticated()).toBe(true);
        });

        test('should authenticate with Google', async () => {
            let storedCallback = null;
            const mockCodeClient = {
                requestCode: jest.fn(() => {
                    if (storedCallback) {
                        storedCallback({ code: 'test-auth-code' });
                    }
                })
            };

            mockGoogleAccounts.oauth2.initCodeClient.mockImplementation((config) => {
                storedCallback = config.callback;
                return mockCodeClient;
            });

            // Mock exchange endpoint
            global.fetch.mockImplementation((url) => {
                if (url === '/api/auth/exchange') {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            access_token: 'test-token',
                            expires_in: 3600
                        })
                    });
                }
                return Promise.reject(new Error('Unknown URL'));
            });

            const token = await service.authenticate();

            expect(mockCodeClient.requestCode).toHaveBeenCalled();
            // authenticate method returns Promise<void> in current impl or access token? 
            // Checking the file, it resolves with token.
            expect(service.accessToken).toBe('test-token');
        });

        test('should sign out and clean up', async () => {
            service.accessToken = 'test-token';
            service.fileId = 'test-file-id';
            localStorage.setItem('goaly_gdrive_file_id', 'test-file-id');

            window.google.accounts.oauth2.revoke = jest.fn();
            global.fetch.mockResolvedValue({ ok: true });

            await service.signOut();

            expect(service.accessToken).toBeNull();
            expect(localStorage.removeItem).toHaveBeenCalledWith('goaly_gdrive_file_id');
            // Check revoke and logout endpoint
            expect(window.google.accounts.oauth2.revoke).toHaveBeenCalledWith('test-token', expect.any(Function));
            expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
        });

        test('should handle sign out when not authenticated', async () => {
            service.accessToken = null;
            service.fileId = null;
            global.fetch.mockResolvedValue({ ok: true });

            await expect(service.signOut()).resolves.not.toThrow();
        });
    });

    describe('token refresh', () => {
        beforeEach(() => {
            service.apiKey = 'test-api-key';
            service.clientId = 'test-client-id';
            service.gapiLoaded = true;
            service.gisLoaded = true;
            service.initialized = true;
        });

        test('should refresh token if needed', async () => {
            // Mock refresh endpoint
            global.fetch.mockImplementation((url) => {
                if (url === '/api/auth/refresh') {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            access_token: 'new-token',
                            expires_in: 3600
                        })
                    });
                }
                return Promise.reject(new Error('Unknown URL: ' + url));
            });

            const result = await service.refreshTokenIfNeeded(true);

            expect(result).toBe(true);
            expect(service.accessToken).toBe('new-token');
        });

        test('should handle refresh failure', async () => {
            global.fetch.mockImplementation((url) => {
                if (url === '/api/auth/refresh') {
                    // Return 401 or ok: false to simulate failure
                    return Promise.resolve({ ok: false, status: 401 });
                }
                return Promise.reject(new Error('Unknown URL'));
            });

            await expect(service.refreshTokenIfNeeded(true)).rejects.toThrow('Refresh failed');
            expect(service.accessToken).toBeNull();
        });
    });

    describe('file operations', () => {
        beforeEach(async () => {
            service.apiKey = 'test-api-key';
            service.clientId = 'test-client-id';
            service.accessToken = 'test-token';
            service.gapiLoaded = true;
            service.gisLoaded = true;
            service.initialized = true;
            window.gapi.client.setToken = jest.fn();
            // Reset fileId
            service.fileId = null;
            localStorage.getItem.mockReturnValue(null);

            // Default fetch mock for drive operations (if any use fetch)
            // But existing tests mock gapi, which we kept. 
            service.tokenExpiresAt = Date.now() + 3600000;
        });

        test('should find or create folder', async () => {
            // Mock folder exists
            mockGapi.client.drive.files.list.mockResolvedValue({
                result: {
                    files: [{ id: 'existing-folder-id', name: 'Goaly' }]
                }
            });

            const folderId = await service.findOrCreateFolder();

            expect(folderId).toBe('existing-folder-id');
        });

        test('should create folder if it does not exist', async () => {
            // Mock folder does not exist
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

        test('should handle ensureAuthenticated when not authenticated', async () => {
            service.accessToken = null;
            // Mock refresh failing
            global.fetch.mockResolvedValue({ ok: false });

            await expect(service.ensureAuthenticated()).rejects.toThrow('Not authenticated. Please sign in first.');
        });

        test('should successfully download data', async () => {
            const testData = { version: '1.0.0', goals: [] };

            mockGapi.client.drive.files.list
                .mockResolvedValueOnce({ result: { files: [{ id: 'folder-id' }] } })
                .mockResolvedValueOnce({
                    result: {
                        files: [{ id: 'file-id', name: 'goaly-data.json', modifiedTime: '2025-01-01T00:00:00Z' }]
                    }
                });

            // Mock fetch for download - Wait, downloadData uses gapi or fetch? 
            // Looking at the service code: it gets fileId then uses fetch to download alt=media
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                text: async () => JSON.stringify(testData)
            });

            const result = await service.downloadData();

            expect(result.data).toEqual(testData);
            expect(result.fileId).toBe('file-id');
        });
        test('should recover from 404 on upload by creating new file', async () => {
            service.fileId = 'old-file-id';

            // Mock upload fail with 404
            global.fetch.mockImplementation((url) => {
                if (url.includes('/upload/drive/v3/files/old-file-id')) {
                    return Promise.resolve({ ok: false, status: 404 });
                }
                if (url.includes('/upload/drive/v3/files?uploadType=multipart')) {
                    // Create new file
                    return Promise.resolve({
                        ok: true,
                        json: async () => ({ id: 'new-file-id' })
                    });
                }
                return Promise.resolve({ ok: true, json: async () => ({ files: [] }) });
            });

            // Mock findDataFile returning null (file really gone)
            mockGapi.client.drive.files.list.mockResolvedValue({ result: { files: [] } });

            await service.uploadData([], {});

            expect(service.fileId).toBe('new-file-id');
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/upload/drive/v3/files?uploadType=multipart'),
                expect.objectContaining({ method: 'POST' })
            );
        });

        test('should recover from 403 on upload by refreshing folder and file', async () => {
            service.fileId = 'old-file-id';

            // Mock upload fail with 403
            global.fetch.mockImplementation((url) => {
                if (url.includes('/upload/drive/v3/files/old-file-id')) {
                    return Promise.resolve({ ok: false, status: 403 });
                }
                if (url.includes('/upload/drive/v3/files/found-file-id')) {
                    // Update found file
                    return Promise.resolve({
                        ok: true,
                        json: async () => ({ id: 'found-file-id' })
                    });
                }
                return Promise.resolve({ ok: true, json: async () => ({ files: [] }) });
            });

            // Mock list calls:
            // 0. Initial findOrCreateFolder (called at start of uploadData)
            // 1. Find folder (called after 403 clears cache)
            // 2. Find file in folder
            mockGapi.client.drive.files.list
                .mockResolvedValueOnce({ result: { files: [{ id: 'initial-folder-id' }] } })
                .mockResolvedValueOnce({ result: { files: [{ id: 'new-folder-id' }] } })
                .mockResolvedValueOnce({ result: { files: [{ id: 'found-file-id' }] } });

            await service.uploadData([], {});

            expect(service.fileId).toBe('found-file-id');
        });
    });

    describe('conflict detection', () => {
        beforeEach(async () => {
            service.apiKey = 'test-api-key';
            service.clientId = 'test-client-id';
            service.accessToken = 'test-token';
            service.gapiLoaded = true;
            service.gisLoaded = true;
            service.initialized = true;
            window.gapi.client.setToken = jest.fn();
            service.tokenExpiresAt = Date.now() + 3600000;
        });

        test('should prioritize empty local data - download from remote', async () => {
            const localVersion = '1.0.0';
            const localExportDate = new Date().toISOString();
            const remoteData = {
                version: '1.0.0',
                exportDate: new Date(Date.now() - 10000).toISOString(), // Remote is older
                goals: [{ id: '1', title: 'Test Goal' }] // But remote has data
            };

            mockGapi.client.drive.files.list
                .mockResolvedValueOnce({
                    result: { files: [{ id: 'folder-id' }] }
                })
                .mockResolvedValueOnce({
                    result: {
                        files: [{ id: 'file-id', modifiedTime: new Date().toISOString() }]
                    }
                });

            global.fetch.mockResolvedValue({
                ok: true,
                text: async () => JSON.stringify(remoteData)
            });

            // Local has no data (empty)
            const syncDirection = await service.checkSyncDirection(localVersion, localExportDate, false);

            expect(syncDirection.shouldUpload).toBe(false); // Should download
            expect(syncDirection.reason).toBe('local_empty_remote_has_data');
        });

        test('should prioritize empty remote data - upload local', async () => {
            const localVersion = '1.0.0';
            const localExportDate = new Date().toISOString();
            const remoteData = {
                version: '1.0.0',
                exportDate: new Date().toISOString(),
                goals: [] // Remote is empty
            };

            mockGapi.client.drive.files.list
                .mockResolvedValueOnce({
                    result: { files: [{ id: 'folder-id' }] }
                })
                .mockResolvedValueOnce({
                    result: {
                        files: [{ id: 'file-id', modifiedTime: new Date().toISOString() }]
                    }
                });

            global.fetch.mockResolvedValue({
                ok: true,
                text: async () => JSON.stringify(remoteData)
            });

            // Local has data
            const syncDirection = await service.checkSyncDirection(localVersion, localExportDate, true);

            expect(syncDirection.shouldUpload).toBe(true); // Should upload
            expect(syncDirection.reason).toBe('local_has_data_remote_empty');
        });

        test('should handle remote not found - upload local', async () => {
            const localVersion = '1.0.0';
            const localExportDate = new Date().toISOString();

            mockGapi.client.drive.files.list
                .mockResolvedValueOnce({
                    result: { files: [{ id: 'folder-id' }] }
                })
                .mockResolvedValueOnce({
                    result: { files: [] } // No file found
                });

            const syncDirection = await service.checkSyncDirection(localVersion, localExportDate, true);

            expect(syncDirection.shouldUpload).toBe(true);
            expect(syncDirection.reason).toBe('remote_not_found');
        });

        test('should handle remote not found with empty local - do not upload', async () => {
            const localVersion = '1.0.0';
            const localExportDate = new Date().toISOString();

            mockGapi.client.drive.files.list
                .mockResolvedValueOnce({
                    result: { files: [{ id: 'folder-id' }] }
                })
                .mockResolvedValueOnce({
                    result: { files: [] } // No file found
                });

            const syncDirection = await service.checkSyncDirection(localVersion, localExportDate, false);

            expect(syncDirection.shouldUpload).toBe(false);
            expect(syncDirection.reason).toBe('remote_not_found_local_empty');
        });
    });
});
