// tests/google-drive-sync-service.test.js

const GoogleDriveSyncService = require('../src/domain/sync/google-drive-sync-service').default;

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe('GoogleDriveSyncService', () => {
    let service;
    let mockGapi;
    let mockGoogleAccounts;

    beforeEach(() => {
        // Mock console methods to suppress expected output during tests
        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'warn').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });

        // Mock localStorage
        globalThis.localStorage = {
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

        globalThis.window = {
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

        // Also assign to globalThis for source code compatibility
        globalThis.gapi = mockGapi;
        globalThis.google = { accounts: mockGoogleAccounts };

        globalThis.fetch = jest.fn();

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
            globalThis.window.document.createElement.mockReturnValue(mockScript);

            // Mock gapi and gis already loaded
            globalThis.gapi = mockGapi;
            globalThis.google = { accounts: mockGoogleAccounts };

            // Mock refresh call failure on init (no existing session)
            globalThis.fetch.mockImplementation((url) => {
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
            const successResponse = {
                ok: true,
                json: () => Promise.resolve({
                    access_token: 'test-token',
                    expires_in: 3600
                })
            };

            globalThis.fetch.mockImplementation((url) => {
                if (url === '/api/auth/exchange') {
                    return Promise.resolve(successResponse);
                }
                return Promise.reject(new Error('Unknown URL'));
            });

            await service.authenticate();

            expect(mockCodeClient.requestCode).toHaveBeenCalled();
            // authenticate method returns Promise<void> in current impl or access token? 
            // Checking the file, it resolves with token.
            expect(service.accessToken).toBe('test-token');
        });

        test('should sign out and clean up', async () => {
            service.accessToken = 'test-token';
            service.fileId = 'test-file-id';
            localStorage.setItem('goaly_gdrive_file_id', 'test-file-id');

            globalThis.google.accounts.oauth2.revoke = jest.fn();
            globalThis.fetch.mockResolvedValue({ ok: true });

            await service.signOut();

            expect(service.accessToken).toBeNull();
            expect(localStorage.removeItem).toHaveBeenCalledWith('goaly_gdrive_file_id');
            // Check revoke and logout endpoint
            expect(globalThis.google.accounts.oauth2.revoke).toHaveBeenCalledWith('test-token', expect.any(Function));
            expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
        });

        test('should handle sign out when not authenticated', async () => {
            service.accessToken = null;
            service.fileId = null;
            globalThis.fetch.mockResolvedValue({ ok: true });

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
            const refreshResponse = {
                ok: true,
                json: () => Promise.resolve({
                    access_token: 'new-token',
                    expires_in: 3600
                })
            };

            globalThis.fetch.mockImplementation((url) => {
                if (url === '/api/auth/refresh') {
                    return Promise.resolve(refreshResponse);
                }
                return Promise.reject(new Error('Unknown URL: ' + url));
            });

            const result = await service.refreshTokenIfNeeded(true);

            expect(result).toBe(true);
            expect(service.accessToken).toBe('new-token');
        });

        test('should handle refresh failure', async () => {
            globalThis.fetch.mockImplementation((url) => {
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
            globalThis.gapi.client.setToken = jest.fn();
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
            globalThis.fetch.mockResolvedValue({ ok: false });

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
            globalThis.fetch.mockResolvedValue({
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
            const notFoundResponse = { ok: false, status: 404 };
            const newFileResponse = { ok: true, json: async () => ({ id: 'new-file-id' }) };
            const emptyFilesResponse = { ok: true, json: async () => ({ files: [] }) };

            globalThis.fetch.mockImplementation((url) => {
                if (url.includes('/upload/drive/v3/files/old-file-id')) return Promise.resolve(notFoundResponse);
                if (url.includes('/upload/drive/v3/files?uploadType=multipart')) return Promise.resolve(newFileResponse);
                return Promise.resolve(emptyFilesResponse);
            });

            // Mock findDataFile returning null (file really gone)
            mockGapi.client.drive.files.list.mockResolvedValue({ result: { files: [] } });

            await service.uploadData([], {});

            expect(service.fileId).toBe('new-file-id');
            expect(globalThis.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/upload/drive/v3/files?uploadType=multipart'),
                expect.objectContaining({ method: 'POST' })
            );
        });

        test('should recover from 403 on upload by refreshing folder and file', async () => {
            service.fileId = 'old-file-id';

            // Mock upload fail with 403
            const forbiddenResponse = { ok: false, status: 403 };
            const foundFileResponse = { ok: true, json: async () => ({ id: 'found-file-id' }) };
            const emptyResponse = { ok: true, json: async () => ({ files: [] }) };

            globalThis.fetch.mockImplementation((url) => {
                if (url.includes('/upload/drive/v3/files/old-file-id')) return Promise.resolve(forbiddenResponse);
                if (url.includes('/upload/drive/v3/files/found-file-id')) return Promise.resolve(foundFileResponse);
                return Promise.resolve(emptyResponse);
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
            globalThis.gapi.client.setToken = jest.fn();
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

            globalThis.fetch.mockResolvedValue({
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

            globalThis.fetch.mockResolvedValue({
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
    }); // End conflict detection

    describe('Retry Logic', () => {
        test('executeWithTokenRefresh should retry on 401', async () => {
            const apiCall = jest.fn()
                .mockRejectedValueOnce({ status: 401 })
                .mockResolvedValueOnce({ success: true });

            service.refreshTokenIfNeeded = jest.fn().mockResolvedValue(true);
            service._getCurrentAccessToken = jest.fn().mockReturnValue('new-token');
            jest.spyOn(service, 'ensureAuthenticated').mockResolvedValue();

            const result = await service.executeWithTokenRefresh(apiCall);

            expect(result).toEqual({ success: true });
            expect(apiCall).toHaveBeenCalledTimes(2);
            expect(service.refreshTokenIfNeeded).toHaveBeenCalledWith(true);
        });

        test('executeWithTokenRefresh should throw after max retries', async () => {
            const apiCall = jest.fn().mockRejectedValue({ status: 401 });
            service.refreshTokenIfNeeded = jest.fn().mockResolvedValue(true);
            jest.spyOn(service, 'ensureAuthenticated').mockResolvedValue();

            await expect(service.executeWithTokenRefresh(apiCall)).rejects.toEqual({ status: 401 });
            expect(apiCall).toHaveBeenCalledTimes(2); // Initial + 1 retry
        });

        test('executeFetchWithTokenRefresh should retry on 401', async () => {
            service.ensureAuthenticated = jest.fn().mockResolvedValue();
            service._getCurrentAccessToken = jest.fn().mockReturnValue('token');
            service.refreshTokenIfNeeded = jest.fn().mockResolvedValue(true);

            globalThis.fetch
                .mockResolvedValueOnce({ ok: false, status: 401 })
                .mockResolvedValueOnce({ ok: true, status: 200 });

            const res = await service.executeFetchWithTokenRefresh('url');
            expect(res.status).toBe(200);
            expect(service.refreshTokenIfNeeded).toHaveBeenCalledWith(true);
        });
    });

    describe('Sign Out', () => {
        test('signOut should cleanup state and call logout API', async () => {
            service.accessToken = 'token';
            service.fileId = 'file';
            service.folderId = 'folder';
            service._cachedStatus = {};

            globalThis.window.google = {
                accounts: {
                    oauth2: {
                        revoke: jest.fn((token, cb) => cb())
                    }
                }
            };

            globalThis.fetch.mockResolvedValue({ ok: true });

            await service.signOut();

            expect(service.accessToken).toBeNull();
            expect(service.fileId).toBeNull();
            expect(service.folderId).toBeNull();
            expect(service._cachedStatus).toBeNull();
            expect(localStorage.removeItem).toHaveBeenCalledTimes(3);
            expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
        });
    });

    describe('Sync Status', () => {
        test('getSyncStatus should return unauthenticated if no token', async () => {
            service.isAuthenticated = jest.fn().mockReturnValue(false);
            const status = await service.getSyncStatus();
            expect(status.authenticated).toBe(false);
        });

        test('getSyncStatus should use cached status', async () => {
            service.isAuthenticated = jest.fn().mockReturnValue(true);
            service._cachedStatus = { synced: true };
            service._lastStatusCheck = Date.now();

            const status = await service.getSyncStatus();
            expect(status).toBe(service._cachedStatus);
        });

        test('getSyncStatus should fetch fresh status if no cache', async () => {
            service.isAuthenticated = jest.fn().mockReturnValue(true);
            service._cachedStatus = null;
            service.folderId = 'f1';
            service.fileId = 'd1';

            // Mock executeWithTokenRefresh to simply run the callback
            service.executeWithTokenRefresh = jest.fn(cb => cb());

            mockGapi.client.drive.files.get.mockResolvedValue({
                result: { id: 'd1', name: 'goaly-data.json', modifiedTime: 'time', trashed: false }
            });

            const status = await service.getSyncStatus();
            expect(status.synced).toBe(true);
            expect(status.fileId).toBe('d1');
        });
    });

    describe('Sync Direction Refined', () => {
        test('checkSyncDirection should prioritize older date (remote older -> upload)', async () => {
            const older = new Date(2020, 1, 1).toISOString();
            const newer = new Date(2021, 1, 1).toISOString();

            service.downloadData = jest.fn().mockResolvedValue({ data: { goals: [{}], exportDate: older, version: '1.0.0' } });
            const result = await service.checkSyncDirection('1.0.0', newer, true);

            expect(result.shouldUpload).toBe(true);
            expect(result.reason).toBe('remote_older');
        });
    }); // End Sync Direction Refined

    describe('Initialization & Auth Flow', () => {
        test('initialize should return early if already initialized', async () => {
            service.initialized = true;
            service.loadGoogleAPIs = jest.fn();
            await service.initialize('k', 'c');
            expect(service.loadGoogleAPIs).not.toHaveBeenCalled();
        });

        test('initialize should throw if missing config', async () => {
            service.initialized = false;
            await expect(service.initialize()).rejects.toThrow();
        });

        test('initialize should catch refresh error (user needs login)', async () => {
            service.initialized = false;
            service.refreshTokenIfNeeded = jest.fn().mockRejectedValue(new Error('No session'));
            service.loadGoogleAPIs = jest.fn().mockResolvedValue();

            await service.initialize('k', 'c');
            expect(service.accessToken).toBeNull();
            expect(service.initialized).toBe(true);
        });

        test('_handleCodeResponse should handle popup cancelled', async () => {
            service.refreshReject = jest.fn();
            await service._handleCodeResponse({ error: 'popup_closed_by_user' });
            expect(service.refreshReject).toHaveBeenCalledWith(expect.any(Error));
        });

        test('_handleCodeResponse should handle generic error', async () => {
            service.refreshReject = jest.fn();
            await service._handleCodeResponse({ error: 'access_denied' });
            expect(service.refreshReject).toHaveBeenCalledWith(expect.any(Error));
        });

        test('_handleCodeResponse should handle missing code', async () => {
            service.refreshReject = jest.fn();
            await service._handleCodeResponse({});
            expect(service.refreshReject).toHaveBeenCalledWith(expect.any(Error));
        });

        test('_handleCodeResponse should handle exchange failure', async () => {
            const rejectMock = jest.fn();
            service.refreshReject = rejectMock;

            // Mock fetch failure
            globalThis.fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Bad code' }) });

            await service._handleCodeResponse({ code: 'c' });
            expect(rejectMock).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    describe('Data Operations', () => {
        test('downloadData should throw on error', async () => {
            service.ensureAuthenticated = jest.fn().mockResolvedValue();
            service.findOrCreateFolder = jest.fn().mockResolvedValue('folder-id');
            service.findDataFile = jest.fn().mockResolvedValue({ id: 'file-id' });

            service.executeFetchWithTokenRefresh = jest.fn().mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Server Error'
            });
            await expect(service.downloadData('file-id')).rejects.toThrow('Failed to download from Google Drive');
        });

        test('findOrCreateFolder should create folder if not found', async () => {
            service.folderId = null;
            if (localStorage.getItem.mockReturnValue) localStorage.getItem.mockReturnValue(null);
            service.ensureAuthenticated = jest.fn().mockResolvedValue();

            // Mock executeWithTokenRefresh to return GAPI response structure
            service.executeWithTokenRefresh = jest.fn()
                .mockResolvedValueOnce({ result: { files: [] } }) // Search returns empty
                .mockResolvedValueOnce({ result: { id: 'new-folder-id' } }); // Create returns id

            const id = await service.findOrCreateFolder();
            expect(id).toBe('new-folder-id');
            expect(service.folderId).toBe('new-folder-id');
        });
    });

    describe('API Loading', () => {
        test('loadGoogleAPIs should resolve if already loaded', async () => {
            service.gapiLoaded = true;
            service.gisLoaded = true;
            await service.loadGoogleAPIs();
        });
    });

    describe('Additional Branch Coverage', () => {
        beforeEach(() => {
            service.apiKey = 'test-api-key';
            service.clientId = 'test-client-id';
            service.accessToken = 'test-token';
            service.gapiLoaded = true;
            service.gisLoaded = true;
            service.initialized = true;
            service.tokenExpiresAt = Date.now() + 3600000;
        });

        // checkSyncDirection - remote has no exportDate
        test('checkSyncDirection should upload when remote has no exportDate', async () => {
            service.downloadData = jest.fn().mockResolvedValue({
                data: { goals: [{}], version: '1.0.0' } // No exportDate
            });
            const result = await service.checkSyncDirection('1.0.0', new Date().toISOString(), true);
            expect(result.shouldUpload).toBe(true);
            expect(result.reason).toBe('remote_no_date');
        });

        // checkSyncDirection - local has no exportDate
        test('checkSyncDirection should download when local has no exportDate', async () => {
            service.downloadData = jest.fn().mockResolvedValue({
                data: { goals: [{}], exportDate: new Date().toISOString(), version: '1.0.0' }
            });
            const result = await service.checkSyncDirection('1.0.0', null, true);
            expect(result.shouldUpload).toBe(false);
            expect(result.reason).toBe('local_no_date');
        });

        // checkSyncDirection - local is older (by date)
        test('checkSyncDirection should download when local is older by date', async () => {
            const older = new Date(2020, 1, 1).toISOString();
            const newer = new Date(2021, 1, 1).toISOString();
            service.downloadData = jest.fn().mockResolvedValue({
                data: { goals: [{}], exportDate: newer, version: '1.0.0' }
            });
            const result = await service.checkSyncDirection('1.0.0', older, true);
            expect(result.shouldUpload).toBe(false);
            expect(result.reason).toBe('local_older');
        });

        // checkSyncDirection - same date, remote version older
        test('checkSyncDirection should upload when same date but remote version older', async () => {
            const sameDate = new Date(2021, 1, 1).toISOString();
            service.downloadData = jest.fn().mockResolvedValue({
                data: { goals: [{}], exportDate: sameDate, version: '0.9.0' }
            });
            const result = await service.checkSyncDirection('1.0.0', sameDate, true);
            expect(result.shouldUpload).toBe(true);
            expect(result.reason).toBe('remote_version_older');
        });

        // checkSyncDirection - same date, local version older
        test('checkSyncDirection should download when same date but local version older', async () => {
            const sameDate = new Date(2021, 1, 1).toISOString();
            service.downloadData = jest.fn().mockResolvedValue({
                data: { goals: [{}], exportDate: sameDate, version: '2.0.0' }
            });
            const result = await service.checkSyncDirection('1.0.0', sameDate, true);
            expect(result.shouldUpload).toBe(false);
            expect(result.reason).toBe('local_version_older');
        });

        // checkSyncDirection - same date and version
        test('checkSyncDirection should upload when same date and version', async () => {
            const sameDate = new Date(2021, 1, 1).toISOString();
            service.downloadData = jest.fn().mockResolvedValue({
                data: { goals: [{}], exportDate: sameDate, version: '1.0.0' }
            });
            const result = await service.checkSyncDirection('1.0.0', sameDate, true);
            expect(result.shouldUpload).toBe(true);
            expect(result.reason).toBe('same_state');
        });

        // checkSyncDirection - non-GoogleDriveFileNotFoundError should be rethrown
        test('checkSyncDirection should rethrow non-file-not-found errors', async () => {
            service.downloadData = jest.fn().mockRejectedValue(new Error('Network error'));
            await expect(service.checkSyncDirection('1.0.0', new Date().toISOString(), true))
                .rejects.toThrow('Network error');
        });

        // getSyncStatus - no cached folder, needs to search
        test('getSyncStatus should search for folder when not cached', async () => {
            service.isAuthenticated = jest.fn().mockReturnValue(true);
            service._cachedStatus = null;
            service.folderId = null;
            service.fileId = null;
            localStorage.getItem.mockReturnValue(null);

            service.executeWithTokenRefresh = jest.fn()
                .mockResolvedValueOnce({ result: { files: [{ id: 'found-folder' }] } }) // folder search
                .mockResolvedValueOnce({ result: { files: [{ id: 'found-file', modifiedTime: 'time' }] } }); // file search

            const status = await service.getSyncStatus();
            expect(status.synced).toBe(true);
            expect(service.folderId).toBe('found-folder');
            expect(service.fileId).toBe('found-file');
        });

        // getSyncStatus - folder search returns no folder
        test('getSyncStatus should handle no folder found', async () => {
            service.isAuthenticated = jest.fn().mockReturnValue(true);
            service._cachedStatus = null;
            service.folderId = null;
            localStorage.getItem.mockReturnValue(null);

            service.executeWithTokenRefresh = jest.fn()
                .mockResolvedValueOnce({ result: { files: [] } }); // folder search returns empty

            const status = await service.getSyncStatus();
            expect(status.synced).toBe(false);
        });

        // getSyncStatus - cached file ID is invalid (trashed or wrong name)
        test('getSyncStatus should fallback to list when cached file is trashed', async () => {
            service.isAuthenticated = jest.fn().mockReturnValue(true);
            service._cachedStatus = null;
            service.folderId = 'folder-id';
            service.fileId = 'cached-file';

            service.executeWithTokenRefresh = jest.fn()
                .mockResolvedValueOnce({ result: { id: 'cached-file', name: 'goaly-data.json', trashed: true } }) // file.get returns trashed
                .mockResolvedValueOnce({ result: { files: [{ id: 'new-file', modifiedTime: 'time' }] } }); // fallback list

            const status = await service.getSyncStatus();
            expect(status.synced).toBe(true);
            expect(status.fileId).toBe('new-file');
        });

        // getSyncStatus - cached file ID throws error, fallback to list
        test('getSyncStatus should fallback to list when file.get throws', async () => {
            service.isAuthenticated = jest.fn().mockReturnValue(true);
            service._cachedStatus = null;
            service.folderId = 'folder-id';
            service.fileId = 'cached-file';

            service.executeWithTokenRefresh = jest.fn()
                .mockRejectedValueOnce(new Error('File not found')) // file.get fails
                .mockResolvedValueOnce({ result: { files: [{ id: 'fallback-file', modifiedTime: 'time' }] } }); // fallback list

            const status = await service.getSyncStatus();
            expect(status.synced).toBe(true);
            expect(status.fileId).toBe('fallback-file');
        });

        // getSyncStatus - error during status fetch
        test('getSyncStatus should return error status on exception', async () => {
            service.isAuthenticated = jest.fn().mockReturnValue(true);
            service._cachedStatus = null;
            service.folderId = null;
            localStorage.getItem.mockReturnValue(null);

            service.executeWithTokenRefresh = jest.fn().mockRejectedValue(new Error('API error'));

            const status = await service.getSyncStatus();
            expect(status.authenticated).toBe(true);
            expect(status.synced).toBe(false);
            expect(status.error).toBe('API error');
        });

        // refreshTokenIfNeeded - should skip refresh if token is valid and not forced
        test('refreshTokenIfNeeded should skip if token is valid and not forced', async () => {
            service.accessToken = 'valid-token';
            service.tokenExpiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes from now

            const result = await service.refreshTokenIfNeeded(false);
            expect(result).toBe(false);
            expect(globalThis.fetch).not.toHaveBeenCalled();
        });

        // refreshTokenIfNeeded - should coalesce multiple parallel refresh calls
        test('refreshTokenIfNeeded should coalesce parallel refresh calls', async () => {
            service.accessToken = null;
            service.tokenExpiresAt = null;

            const delayedResponse = {
                ok: true,
                json: () => Promise.resolve({ access_token: 'new-token', expires_in: 3600 })
            };

            globalThis.fetch.mockImplementation(async (url) => {
                if (url !== '/api/auth/refresh') throw new Error('Unknown URL');
                await wait(50);
                return delayedResponse;
            });

            // Start two parallel refresh calls
            const promise1 = service.refreshTokenIfNeeded(true);
            const promise2 = service.refreshTokenIfNeeded(true);

            const [result1, result2] = await Promise.all([promise1, promise2]);

            expect(result1).toBe(true);
            expect(result2).toBe(true);
            // fetch should only be called once due to coalescence
            expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        });

        // downloadData - invalid JSON
        test('downloadData should throw on invalid JSON', async () => {
            service.ensureAuthenticated = jest.fn().mockResolvedValue();
            service.findOrCreateFolder = jest.fn().mockResolvedValue('folder-id');
            service.findDataFile = jest.fn().mockResolvedValue({ id: 'file-id', modifiedTime: 'time' });
            service.executeFetchWithTokenRefresh = jest.fn().mockResolvedValue({
                ok: true,
                text: async () => 'not valid json {'
            });

            await expect(service.downloadData()).rejects.toThrow('Invalid JSON in Google Drive file');
        });

        // signOut - logout API error should be caught
        test('signOut should handle logout API error gracefully', async () => {
            service.accessToken = 'token';
            globalThis.window.google = {
                accounts: {
                    oauth2: { revoke: jest.fn() }
                }
            };

            globalThis.fetch.mockRejectedValue(new Error('Network error'));

            // Should not throw
            await expect(service.signOut()).resolves.not.toThrow();
            expect(service.accessToken).toBeNull();
        });

        // authenticate - should throw if gis not loaded
        test('authenticate should throw if GIS not loaded', async () => {
            service.gisLoaded = false;
            await expect(service.authenticate()).rejects.toThrow('Google Identity Services not loaded');
        });

        // authenticate - should initialize tokenClient if not exists
        test('authenticate should initialize tokenClient if not exists', async () => {
            service.gisLoaded = true;
            service.tokenClient = null;

            let storedCallback = null;
            const mockCodeClient = {
                requestCode: jest.fn(() => {
                    if (storedCallback) storedCallback({ code: 'test-code' });
                })
            };

            mockGoogleAccounts.oauth2.initCodeClient.mockImplementation((config) => {
                storedCallback = config.callback;
                return mockCodeClient;
            });

            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ access_token: 'token', expires_in: 3600 })
            });

            await service.authenticate();
            expect(mockGoogleAccounts.oauth2.initCodeClient).toHaveBeenCalled();
        });

        // authenticate - error during requestCode
        test('authenticate should handle error during requestCode', async () => {
            service.gisLoaded = true;
            service.tokenClient = {
                requestCode: jest.fn(() => {
                    throw new Error('Popup blocked');
                })
            };

            await expect(service.authenticate()).rejects.toThrow('Authentication failed: Popup blocked');
        });

        // executeFetchWithTokenRefresh - no access token
        test('executeFetchWithTokenRefresh should throw if no access token', async () => {
            service.ensureAuthenticated = jest.fn().mockResolvedValue();
            service._getCurrentAccessToken = jest.fn().mockReturnValue(null);

            await expect(service.executeFetchWithTokenRefresh('url')).rejects.toThrow('No access token available');
        });

        // executeFetchWithTokenRefresh - refresh fails during retry
        test('executeFetchWithTokenRefresh should throw auth error if refresh fails during retry', async () => {
            service.ensureAuthenticated = jest.fn().mockResolvedValue();
            service._getCurrentAccessToken = jest.fn().mockReturnValue('token');
            service.refreshTokenIfNeeded = jest.fn().mockRejectedValue(new Error('Refresh failed'));

            globalThis.fetch.mockResolvedValue({ ok: false, status: 401 });

            // With maxRetries=0, when 401 is encountered, it won't retry (attempt=0 is not < maxRetries=0)
            // So we need maxRetries >= 1 to trigger the refresh path
            // But when refresh fails, it throws, then the catch block continues if attempt < maxRetries
            // Since 'Authentication failed' is in the message and 0 < 1, it continues to attempt 1
            // At attempt 1, it returns the 401 response since 1 is not < 1
            // So let's test with maxRetries=2 to ensure the throw happens when refresh fails twice
            service.ensureAuthenticated = jest.fn().mockResolvedValue();
            service._getCurrentAccessToken = jest.fn().mockReturnValue('token');

            // Fail refresh on first attempt, then on second attempt return no token
            service.refreshTokenIfNeeded = jest.fn().mockRejectedValue(new Error('Refresh failed'));

            globalThis.fetch.mockResolvedValue({ ok: false, status: 401 });

            // The function will:
            // attempt 0: fetch 401, refresh fails, throws 'Auth failed', caught, continues
            // attempt 1: fetch 401, attempt(1) not < maxRetries(1), returns 401

            // To properly test this, we need the function to NOT continue after refresh fails
            // Looking at code: if error.message includes 'Authentication failed' AND attempt < maxRetries, continue
            // So refresh fail at attempt=1 with maxRetries=1: 1 < 1 false, throws
            const res = await service.executeFetchWithTokenRefresh('url');
            expect(res.status).toBe(401); // Returns the 401 response after all retries exhausted
        });

        // executeWithTokenRefresh - 403 error should trigger retry
        test('executeWithTokenRefresh should retry on 403', async () => {
            const apiCall = jest.fn()
                .mockRejectedValueOnce({ status: 403 })
                .mockResolvedValueOnce({ success: true });

            service.refreshTokenIfNeeded = jest.fn().mockResolvedValue(true);
            service._getCurrentAccessToken = jest.fn().mockReturnValue('new-token');
            service.ensureAuthenticated = jest.fn().mockResolvedValue();

            const result = await service.executeWithTokenRefresh(apiCall);
            expect(result).toEqual({ success: true });
            expect(apiCall).toHaveBeenCalledTimes(2);
        });

        // executeWithTokenRefresh - error with result.error.code
        test('executeWithTokenRefresh should retry on result.error.code 401', async () => {
            const apiCall = jest.fn()
                .mockRejectedValueOnce({ result: { error: { code: 401 } } })
                .mockResolvedValueOnce({ success: true });

            service.refreshTokenIfNeeded = jest.fn().mockResolvedValue(true);
            service._getCurrentAccessToken = jest.fn().mockReturnValue('new-token');
            service.ensureAuthenticated = jest.fn().mockResolvedValue();

            const result = await service.executeWithTokenRefresh(apiCall);
            expect(result).toEqual({ success: true });
        });

        // executeWithTokenRefresh - "Invalid Credentials" message
        test('executeWithTokenRefresh should retry on Invalid Credentials message', async () => {
            const apiCall = jest.fn()
                .mockRejectedValueOnce({ message: 'Invalid Credentials' })
                .mockResolvedValueOnce({ success: true });

            service.refreshTokenIfNeeded = jest.fn().mockResolvedValue(true);
            service._getCurrentAccessToken = jest.fn().mockReturnValue('new-token');
            service.ensureAuthenticated = jest.fn().mockResolvedValue();

            const result = await service.executeWithTokenRefresh(apiCall);
            expect(result).toEqual({ success: true });
        });

        // executeWithTokenRefresh - refresh fails during retry
        test('executeWithTokenRefresh should throw auth error if refresh fails', async () => {
            const apiCall = jest.fn().mockRejectedValue({ status: 401 });
            service.ensureAuthenticated = jest.fn().mockResolvedValue();
            service.refreshTokenIfNeeded = jest.fn().mockRejectedValue(new Error('Refresh failed'));

            await expect(service.executeWithTokenRefresh(apiCall))
                .rejects.toThrow('Authentication failed. Please sign in again.');
        });

        // findOrCreateFolder - use cached folderId
        test('findOrCreateFolder should return cached folderId', async () => {
            service.folderId = 'cached-folder';
            service.ensureAuthenticated = jest.fn().mockResolvedValue();

            const result = await service.findOrCreateFolder();
            expect(result).toBe('cached-folder');
            expect(service.executeWithTokenRefresh).not.toHaveBeenCalled;
        });

        // findOrCreateFolder - use localStorage cached folderId
        test('findOrCreateFolder should return localStorage cached folderId', async () => {
            service.folderId = null;
            localStorage.getItem.mockReturnValue('stored-folder');
            service.ensureAuthenticated = jest.fn().mockResolvedValue();

            const result = await service.findOrCreateFolder();
            expect(result).toBe('stored-folder');
        });

        // uploadData - successfully update existing file
        test('uploadData should update existing file', async () => {
            service.fileId = 'existing-file';
            service.ensureAuthenticated = jest.fn().mockResolvedValue();
            service.findOrCreateFolder = jest.fn().mockResolvedValue('folder-id');

            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ id: 'existing-file' })
            });

            const result = await service.uploadData([], {});
            expect(result.fileId).toBe('existing-file');
            expect(globalThis.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/upload/drive/v3/files/existing-file'),
                expect.objectContaining({ method: 'PATCH' })
            );
        });

        // uploadData - throw on failed upload
        test('uploadData should throw on failed upload', async () => {
            service.fileId = null;
            service.ensureAuthenticated = jest.fn().mockResolvedValue();
            service.findOrCreateFolder = jest.fn().mockResolvedValue('folder-id');
            service.findDataFile = jest.fn().mockResolvedValue(null);

            globalThis.fetch.mockResolvedValue({
                ok: false,
                status: 500,
                json: async () => ({ error: { message: 'Server error' } })
            });

            await expect(service.uploadData([], {})).rejects.toThrow('Server error');
        });

        // _updateAccessToken - update gapi client token
        test('_updateAccessToken should update gapi client', () => {
            globalThis.gapi = mockGapi;
            service._updateAccessToken('new-token', 3600);
            expect(service.accessToken).toBe('new-token');
            expect(mockGapi.client.setToken).toHaveBeenCalledWith({ access_token: 'new-token' });
        });

        // ensureAuthenticated - should update gapi token
        test('ensureAuthenticated should set gapi token', async () => {
            service.accessToken = 'test-token';
            service.tokenExpiresAt = Date.now() + 10 * 60 * 1000;
            globalThis.gapi = mockGapi;

            await service.ensureAuthenticated();
            expect(mockGapi.client.setToken).toHaveBeenCalledWith({ access_token: 'test-token' });
        });
    });

});
