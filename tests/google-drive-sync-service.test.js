// tests/google-drive-sync-service.test.js

const GoogleDriveSyncService = require('../src/domain/sync/google-drive-sync-service').default;

describe('GoogleDriveSyncService', () => {
    let service;
    let mockGapi;
    let mockGoogleAccounts;

    beforeEach(() => {
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
                        }))
                    }
                }
            }
        };

        // Mock window.google.accounts
        mockGoogleAccounts = {
            oauth2: {
                initTokenClient: jest.fn(() => ({
                    requestAccessToken: jest.fn()
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
            const mockTokenClient = {
                requestAccessToken: jest.fn((options) => {
                    // The callback is stored in initTokenClient, not passed to requestAccessToken
                    // Simulate the callback being invoked immediately
                    if (storedCallback) {
                        // Invoke callback synchronously to avoid timeout
                        storedCallback({
                            access_token: 'test-token',
                            expires_in: 3600
                        });
                    }
                })
            };

            mockGoogleAccounts.oauth2.initTokenClient.mockImplementation((config) => {
                // Store the callback from the config
                storedCallback = config.callback;
                return mockTokenClient;
            });

            const token = await service.authenticate();

            expect(token).toBe('test-token');
            expect(service.accessToken).toBe('test-token');
            expect(localStorage.setItem).toHaveBeenCalled();
        }, 10000); // Increase timeout to 10 seconds

        test('should sign out and clear tokens', () => {
            service.accessToken = 'test-token';
            service.fileId = 'test-file-id';
            localStorage.setItem('goaly_gdrive_token', JSON.stringify({ access_token: 'test-token' }));
            localStorage.setItem('goaly_gdrive_file_id', 'test-file-id');

            // Mock google.accounts.oauth2.revoke
            window.google.accounts.oauth2.revoke = jest.fn();

            service.signOut();

            expect(service.accessToken).toBeNull();
            expect(service.fileId).toBeNull();
            expect(localStorage.removeItem).toHaveBeenCalledWith('goaly_gdrive_token');
            expect(localStorage.removeItem).toHaveBeenCalledWith('goaly_gdrive_file_id');
            expect(window.google.accounts.oauth2.revoke).toHaveBeenCalledWith('test-token', expect.any(Function));
        });

        test('should handle sign out when not authenticated', () => {
            service.accessToken = null;
            service.fileId = null;

            expect(() => service.signOut()).not.toThrow();
        });

        test('should handle authentication error with specific error types', async () => {
            let storedCallback = null;
            const mockTokenClient = {
                requestAccessToken: jest.fn((options) => {
                    if (storedCallback) {
                        storedCallback({ error: 'access_denied' });
                    }
                })
            };

            mockGoogleAccounts.oauth2.initTokenClient.mockImplementation((config) => {
                storedCallback = config.callback;
                return mockTokenClient;
            });

            await expect(service.authenticate()).rejects.toThrow('Access denied. Make sure you are added as a test user in Google Cloud Console.');
        });

        test('should handle popup closed error', async () => {
            let storedCallback = null;
            const mockTokenClient = {
                requestAccessToken: jest.fn((options) => {
                    if (storedCallback) {
                        storedCallback({ error: 'popup_closed_by_user' });
                    }
                })
            };

            mockGoogleAccounts.oauth2.initTokenClient.mockImplementation((config) => {
                storedCallback = config.callback;
                return mockTokenClient;
            });

            await expect(service.authenticate()).rejects.toThrow('Authentication cancelled. Please try again.');
        });

        test('should handle invalid client error', async () => {
            let storedCallback = null;
            const mockTokenClient = {
                requestAccessToken: jest.fn((options) => {
                    if (storedCallback) {
                        storedCallback({ error: 'invalid_client' });
                    }
                })
            };

            mockGoogleAccounts.oauth2.initTokenClient.mockImplementation((config) => {
                storedCallback = config.callback;
                return mockTokenClient;
            });

            await expect(service.authenticate()).rejects.toThrow('Invalid client ID. Please check your configuration.');
        });

        test('should handle missing access token in response', async () => {
            let storedCallback = null;
            const mockTokenClient = {
                requestAccessToken: jest.fn((options) => {
                    if (storedCallback) {
                        storedCallback({}); // No access_token
                    }
                })
            };

            mockGoogleAccounts.oauth2.initTokenClient.mockImplementation((config) => {
                storedCallback = config.callback;
                return mockTokenClient;
            });

            await expect(service.authenticate()).rejects.toThrow('No access token received from Google. Please try again.');
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

            await expect(service.ensureAuthenticated()).rejects.toThrow('Not authenticated. Please sign in first.');
        });

        test('should handle ensureAuthenticated when authenticated', async () => {
            service.accessToken = 'test-token';
            const savedToken = {
                access_token: 'test-token',
                expires_at: Date.now() + 600000
            };
            localStorage.getItem.mockReturnValue(JSON.stringify(savedToken));
            window.gapi.client.setToken = jest.fn();

            await service.ensureAuthenticated();

            expect(window.gapi.client.setToken).toHaveBeenCalledWith({ access_token: 'test-token' });
        });

        test('should upload data successfully when no file exists', async () => {
            const goals = [];
            const settings = { maxActiveGoals: 3 };

            // Mock folder and file operations
            mockGapi.client.drive.files.list
                .mockResolvedValueOnce({
                    result: { files: [{ id: 'folder-id' }] }
                })
                .mockResolvedValueOnce({
                    result: { files: [] } // No existing file
                });

            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ id: 'file-id-123' })
            });

            const result = await service.uploadData(goals, settings);

            expect(result.fileId).toBe('file-id-123');
            expect(result.version).toBeDefined();
            expect(localStorage.setItem).toHaveBeenCalledWith('goaly_gdrive_file_id', 'file-id-123');
        });

        test('should update existing file when fileId is stored', async () => {
            const goals = [];
            const settings = { maxActiveGoals: 3 };

            service.fileId = 'existing-file-id';
            localStorage.setItem('goaly_gdrive_file_id', 'existing-file-id');

            // Mock folder exists
            mockGapi.client.drive.files.list
                .mockResolvedValueOnce({
                    result: { files: [{ id: 'folder-id' }] }
                });

            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ id: 'existing-file-id' })
            });

            const result = await service.uploadData(goals, settings);

            expect(result.fileId).toBe('existing-file-id');
            // Should use PATCH to update existing file
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/files/existing-file-id'),
                expect.objectContaining({ method: 'PATCH' })
            );
        });

        test('should download data successfully', async () => {
            const testData = {
                version: '1.0.0',
                goals: [],
                settings: {}
            };

            // Mock folder and file operations
            mockGapi.client.drive.files.list
                .mockResolvedValueOnce({
                    result: { files: [{ id: 'folder-id' }] }
                })
                .mockResolvedValueOnce({
                    result: {
                        files: [{
                            id: 'file-id',
                            name: 'goaly-data.json',
                            modifiedTime: '2025-01-01T00:00:00Z'
                        }]
                    }
                });

            global.fetch.mockResolvedValue({
                ok: true,
                text: async () => JSON.stringify(testData)
            });

            const result = await service.downloadData();

            expect(result.data).toEqual(testData);
            expect(result.fileId).toBe('file-id');
        });

        test('should throw error if file not found when downloading', async () => {
            mockGapi.client.drive.files.list
                .mockResolvedValueOnce({
                    result: { files: [{ id: 'folder-id' }] }
                })
                .mockResolvedValueOnce({
                    result: { files: [] } // No file found
                });

            await expect(service.downloadData()).rejects.toThrow('No data file found in Google Drive');
        });

        test('should handle download with invalid JSON', async () => {
            mockGapi.client.drive.files.list
                .mockResolvedValueOnce({
                    result: { files: [{ id: 'folder-id' }] }
                })
                .mockResolvedValueOnce({
                    result: {
                        files: [{
                            id: 'file-id',
                            name: 'goaly-data.json',
                            modifiedTime: '2025-01-01T00:00:00Z'
                        }]
                    }
                });

            global.fetch.mockResolvedValue({
                ok: true,
                text: async () => 'invalid json'
            });

            await expect(service.downloadData()).rejects.toThrow('Invalid JSON in Google Drive file');
        });

        test('should handle download failure', async () => {
            mockGapi.client.drive.files.list
                .mockResolvedValueOnce({
                    result: { files: [{ id: 'folder-id' }] }
                })
                .mockResolvedValueOnce({
                    result: {
                        files: [{
                            id: 'file-id',
                            name: 'goaly-data.json',
                            modifiedTime: '2025-01-01T00:00:00Z'
                        }]
                    }
                });

            global.fetch.mockResolvedValue({
                ok: false,
                status: 500
            });

            await expect(service.downloadData()).rejects.toThrow('Failed to download from Google Drive');
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

        test('should handle upload failure and retry with new file', async () => {
            const goals = [{ id: '1', title: 'Test' }];
            const settings = { maxActiveGoals: 3 };

            service.fileId = 'existing-file-id';
            localStorage.setItem('goaly_gdrive_file_id', 'existing-file-id');

            // Mock folder exists
            mockGapi.client.drive.files.list
                .mockResolvedValueOnce({
                    result: { files: [{ id: 'folder-id' }] }
                });

            // First PATCH update fails with 403
            global.fetch
                .mockResolvedValueOnce({
                    ok: false,
                    status: 403,
                    json: async () => ({ error: { message: 'Forbidden' } })
                });

            // After failure, clear fileId and search for existing file
            mockGapi.client.drive.files.list
                .mockResolvedValueOnce({
                    result: { files: [{ id: 'folder-id' }] }
                })
                .mockResolvedValueOnce({
                    result: { files: [{ id: 'found-file-id' }] }
                });

            // Retry update with found file succeeds
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'found-file-id' })
            });

            const result = await service.uploadData(goals, settings);

            expect(result.fileId).toBe('found-file-id');
        });

        test('should use stored fileId when available', async () => {
            const goals = [];
            const settings = { maxActiveGoals: 3 };

            service.fileId = 'stored-file-id';
            localStorage.setItem('goaly_gdrive_file_id', 'stored-file-id');

            mockGapi.client.drive.files.list
                .mockResolvedValueOnce({
                    result: { files: [{ id: 'folder-id' }] }
                });

            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ id: 'stored-file-id' })
            });

            const result = await service.uploadData(goals, settings);

            expect(result.fileId).toBe('stored-file-id');
            // Should not search for file since we have stored fileId
            expect(mockGapi.client.drive.files.list).toHaveBeenCalledTimes(1);
        });

        test('should refresh token if needed', async () => {
            service.accessToken = 'old-token';
            const savedToken = {
                access_token: 'old-token',
                expires_at: Date.now() - 10000 // Expired (less than 5 minutes remaining)
            };
            localStorage.getItem.mockReturnValue(JSON.stringify(savedToken));

            let storedCallback = null;
            const mockTokenClient = {
                requestAccessToken: jest.fn((options) => {
                    if (storedCallback) {
                        storedCallback({
                            access_token: 'new-token',
                            expires_in: 3600
                        });
                    }
                })
            };

            mockGoogleAccounts.oauth2.initTokenClient.mockImplementation((config) => {
                storedCallback = config.callback;
                return mockTokenClient;
            });

            service.tokenClient = mockTokenClient;

            const result = await service.refreshTokenIfNeeded();

            expect(result).toBe(true);
            expect(service.tokenClient.requestAccessToken).toHaveBeenCalledWith({ prompt: '' });
        });

        test('should not refresh token if still valid', async () => {
            service.accessToken = 'valid-token';
            const savedToken = {
                access_token: 'valid-token',
                expires_at: Date.now() + 600000 // Valid for 10 more minutes (more than 5 minutes)
            };
            localStorage.getItem.mockReturnValue(JSON.stringify(savedToken));

            service.tokenClient = {
                requestAccessToken: jest.fn()
            };

            const result = await service.refreshTokenIfNeeded();

            expect(result).toBe(false);
            expect(service.tokenClient.requestAccessToken).not.toHaveBeenCalled();
        });

        test('should not refresh token if no token client', async () => {
            service.accessToken = 'old-token';
            const savedToken = {
                access_token: 'old-token',
                expires_at: Date.now() - 10000 // Expired
            };
            localStorage.getItem.mockReturnValue(JSON.stringify(savedToken));

            service.tokenClient = null;

            const result = await service.refreshTokenIfNeeded();

            expect(result).toBe(false);
        });

        test('should not refresh token if no saved token', async () => {
            service.accessToken = 'token';
            localStorage.getItem.mockReturnValue(null);

            const result = await service.refreshTokenIfNeeded();

            expect(result).toBe(false);
        });

        test('should not refresh token if no access token', async () => {
            service.accessToken = null;

            const result = await service.refreshTokenIfNeeded();

            expect(result).toBe(false);
        });

        test('getSyncStatus should return authenticated and synced status', async () => {
            mockGapi.client.drive.files.list
                .mockResolvedValueOnce({
                    result: { files: [{ id: 'folder-id' }] }
                })
                .mockResolvedValueOnce({
                    result: {
                        files: [{
                            id: 'file-id',
                            modifiedTime: '2025-01-01T00:00:00Z'
                        }]
                    }
                });

            const status = await service.getSyncStatus();

            expect(status.authenticated).toBe(true);
            expect(status.synced).toBe(true);
            expect(status.lastSyncTime).toBe('2025-01-01T00:00:00Z');
        });

        test('getSyncStatus should return not synced when file not found', async () => {
            mockGapi.client.drive.files.list
                .mockResolvedValueOnce({
                    result: { files: [{ id: 'folder-id' }] }
                })
                .mockResolvedValueOnce({
                    result: { files: [] }
                });

            const status = await service.getSyncStatus();

            expect(status.authenticated).toBe(true);
            expect(status.synced).toBe(false);
        });
    });
});

