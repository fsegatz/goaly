// tests/google-drive-sync-service.test.js

const GoogleDriveSyncService = require('../src/domain/sync/google-drive-sync-service').default;

describe('GoogleDriveSyncService', () => {
    let service;
    let mockGapi;
    let mockGoogleAccounts;

    beforeEach(() => {
        // Mock console.warn and console.error to suppress expected warnings during tests
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        
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
        // Restore console methods
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
            service.clientId = 'test-client-id';
            const savedToken = {
                access_token: 'old-token',
                expires_at: Date.now() - 10000 // Expired (less than 5 minutes remaining)
            };
            localStorage.getItem.mockReturnValue(JSON.stringify(savedToken));

            // Create a mock callback that will be used by both authenticate and refresh
            let tokenCallback = null;
            const mockTokenClient = {
                requestAccessToken: jest.fn((options) => {
                    // Don't invoke immediately - let refreshTokenIfNeeded set up the promise first
                    // The callback will be invoked manually after the promise is created
                })
            };

            // Set up initTokenClient to store the callback
            mockGoogleAccounts.oauth2.initTokenClient.mockImplementation((config) => {
                tokenCallback = config.callback;
                return mockTokenClient;
            });

            // First authenticate to set up the token client and callback
            // But we need to manually invoke the callback to complete authenticate
            const authPromise = service.authenticate();
            // Invoke callback to complete authentication
            if (tokenCallback) {
                tokenCallback({
                    access_token: 'initial-token',
                    expires_in: 3600
                });
            }
            await authPromise;
            
            // Now test refresh - create the promise first
            const refreshPromise = service.refreshTokenIfNeeded();
            // Now invoke the callback to complete the refresh
            if (tokenCallback) {
                tokenCallback({
                    access_token: 'new-token',
                    expires_in: 3600
                });
            }
            const result = await refreshPromise;
            
            expect(mockTokenClient.requestAccessToken).toHaveBeenCalledWith({ prompt: 'none' });
            expect(result).toBe(true);
            expect(localStorage.setItem).toHaveBeenCalled();
        }, 15000);

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

        test('should not refresh token if no token client and gis not loaded', async () => {
            service.accessToken = 'old-token';
            service.clientId = 'test-client-id';
            const savedToken = {
                access_token: 'old-token',
                expires_at: Date.now() - 10000 // Expired
            };
            localStorage.getItem.mockReturnValue(JSON.stringify(savedToken));

            service.tokenClient = null;
            service.gisLoaded = false; // Prevent token client re-initialization

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

        test('should handle token refresh error', async () => {
            service.accessToken = 'old-token';
            service.clientId = 'test-client-id';
            const savedToken = {
                access_token: 'old-token',
                expires_at: Date.now() - 10000
            };
            localStorage.getItem.mockReturnValue(JSON.stringify(savedToken));

            let tokenCallback = null;
            const mockTokenClient = {
                requestAccessToken: jest.fn((options) => {
                    // Don't invoke immediately
                })
            };

            mockGoogleAccounts.oauth2.initTokenClient.mockImplementation((config) => {
                tokenCallback = config.callback;
                return mockTokenClient;
            });

            // First authenticate to set up the callback
            const authPromise = service.authenticate();
            if (tokenCallback) {
                tokenCallback({
                    access_token: 'initial-token',
                    expires_in: 3600
                });
            }
            await authPromise;

            // Now test refresh error - create promise first
            const refreshPromise = service.refreshTokenIfNeeded();
            // Invoke callback with error
            if (tokenCallback) {
                tokenCallback({ error: 'invalid_grant' });
            }

            await expect(refreshPromise).rejects.toThrow();
        }, 15000);

        test('executeWithTokenRefresh should retry on 401 error', async () => {
            service.accessToken = 'token';
            service.clientId = 'test-client-id';
            service.gapiLoaded = true;
            service.gisLoaded = true;
            service.initialized = true;
            
            const savedToken = {
                access_token: 'token',
                expires_at: Date.now() + 600000
            };
            localStorage.getItem.mockReturnValue(JSON.stringify(savedToken));
            window.gapi.client.setToken = jest.fn();

            let callCount = 0;
            const apiCall = jest.fn(async () => {
                callCount++;
                if (callCount === 1) {
                    const error = new Error('Unauthorized');
                    error.status = 401;
                    throw error;
                }
                return { result: { success: true } };
            });

            // Mock token refresh - need to set up callback before refresh is called
            let refreshCallback = null;
            const mockTokenClient = {
                requestAccessToken: jest.fn((options) => {
                    // Don't invoke immediately - let the refresh promise be created first
                }),
                callback: null
            };

            mockGoogleAccounts.oauth2.initTokenClient.mockImplementation((config) => {
                refreshCallback = config.callback;
                mockTokenClient.callback = config.callback;
                return mockTokenClient;
            });

            // First authenticate to set up the callback
            const authPromise = service.authenticate();
            if (refreshCallback) {
                refreshCallback({
                    access_token: 'initial-token',
                    expires_in: 3600
                });
            }
            await authPromise;
            service.tokenClient = mockTokenClient;
            service.tokenClient.callback = refreshCallback;

            // Now test executeWithTokenRefresh
            const executePromise = service.executeWithTokenRefresh(apiCall);
            
            // When refresh is called, invoke the callback
            // The refresh will be triggered by executeWithTokenRefresh when it sees the 401
            // We need to wait a bit for the refresh to be initiated, then invoke the callback
            await new Promise(resolve => setTimeout(resolve, 50));
            if (refreshCallback && mockTokenClient.requestAccessToken.mock.calls.length > 0) {
                refreshCallback({
                    access_token: 'new-token',
                    expires_in: 3600
                });
            }

            const result = await executePromise;

            expect(apiCall).toHaveBeenCalledTimes(2);
            expect(result.result.success).toBe(true);
        }, 20000);

        test('executeWithTokenRefresh should throw on non-auth errors', async () => {
            service.accessToken = 'token';
            const savedToken = {
                access_token: 'token',
                expires_at: Date.now() + 600000
            };
            localStorage.getItem.mockReturnValue(JSON.stringify(savedToken));

            const apiCall = jest.fn(async () => {
                throw new Error('Network error');
            });

            await expect(service.executeWithTokenRefresh(apiCall)).rejects.toThrow('Network error');
            expect(apiCall).toHaveBeenCalledTimes(1);
        });

        test('getSyncStatus should use cached folder ID', async () => {
            service.accessToken = 'token';
            service.folderId = 'cached-folder-id';
            service.fileId = 'cached-file-id';
            localStorage.getItem.mockImplementation((key) => {
                if (key === 'goaly_gdrive_file_id') {
                    return 'cached-file-id';
                }
                if (key === 'goaly_gdrive_token') {
                    return JSON.stringify({
                        access_token: 'token',
                        expires_at: Date.now() + 600000
                    });
                }
                return null;
            });

            mockGapi.client.drive.files.get.mockResolvedValue({
                result: {
                    id: 'cached-file-id',
                    name: 'goaly-data.json',
                    modifiedTime: '2025-01-01T00:00:00Z',
                    trashed: false
                }
            });

            const status = await service.getSyncStatus();

            expect(status.authenticated).toBe(true);
            expect(status.synced).toBe(true);
            expect(status.lastSyncTime).toBe('2025-01-01T00:00:00Z');
            // Should use files.get instead of files.list when we have cached IDs
            expect(mockGapi.client.drive.files.list).not.toHaveBeenCalled();
            expect(mockGapi.client.drive.files.get).toHaveBeenCalledWith({
                fileId: 'cached-file-id',
                fields: 'id, name, modifiedTime, trashed'
            });
        });

        test('getSyncStatus should fallback to list when cached file ID is invalid', async () => {
            service.accessToken = 'token';
            service.folderId = 'cached-folder-id';
            service.fileId = 'invalid-file-id';
            localStorage.getItem.mockImplementation((key) => {
                if (key === 'goaly_gdrive_file_id') {
                    return 'invalid-file-id';
                }
                if (key === 'goaly_gdrive_token') {
                    return JSON.stringify({
                        access_token: 'token',
                        expires_at: Date.now() + 600000
                    });
                }
                return null;
            });

            // files.get fails (file deleted/moved)
            mockGapi.client.drive.files.get.mockRejectedValue(new Error('File not found'));

            // Fallback to list
            mockGapi.client.drive.files.list.mockResolvedValue({
                result: {
                    files: [{
                        id: 'new-file-id',
                        modifiedTime: '2025-01-02T00:00:00Z'
                    }]
                }
            });

            const status = await service.getSyncStatus();

            expect(status.authenticated).toBe(true);
            expect(status.synced).toBe(true);
            expect(status.lastSyncTime).toBe('2025-01-02T00:00:00Z');
            expect(mockGapi.client.drive.files.get).toHaveBeenCalled();
            expect(mockGapi.client.drive.files.list).toHaveBeenCalled();
        });

        test('getSyncStatus should return cached status if still valid', async () => {
            service.accessToken = 'token';
            const cachedStatus = {
                authenticated: true,
                synced: true,
                lastSyncTime: '2025-01-01T00:00:00Z',
                fileId: 'file-id'
            };
            service._cachedStatus = cachedStatus;
            service._lastStatusCheck = Date.now() - 30000; // 30 seconds ago (within 1 minute cache)
            localStorage.getItem.mockImplementation((key) => {
                if (key === 'goaly_gdrive_token') {
                    return JSON.stringify({
                        access_token: 'token',
                        expires_at: Date.now() + 600000
                    });
                }
                return null;
            });

            const status = await service.getSyncStatus();

            expect(status).toBe(cachedStatus);
            // Should not make any API calls
            expect(mockGapi.client.drive.files.list).not.toHaveBeenCalled();
            expect(mockGapi.client.drive.files.get).not.toHaveBeenCalled();
        });

        test('getSyncStatus should handle errors gracefully', async () => {
            service.accessToken = 'token';
            localStorage.getItem.mockImplementation((key) => {
                if (key === 'goaly_gdrive_token') {
                    return JSON.stringify({
                        access_token: 'token',
                        expires_at: Date.now() + 600000
                    });
                }
                return null;
            });
            mockGapi.client.drive.files.list.mockRejectedValue(new Error('API Error'));

            const status = await service.getSyncStatus();

            expect(status.authenticated).toBe(true);
            expect(status.synced).toBe(false);
            expect(status.error).toBe('API Error');
        });

        test('getSyncStatus should handle no folder ID', async () => {
            service.accessToken = 'token';
            service.folderId = null;
            localStorage.getItem.mockImplementation((key) => {
                if (key === 'goaly_gdrive_token') {
                    return JSON.stringify({
                        access_token: 'token',
                        expires_at: Date.now() + 600000
                    });
                }
                return null;
            });

            // Search for folder
            mockGapi.client.drive.files.list.mockResolvedValueOnce({
                result: { files: [{ id: 'new-folder-id' }] }
            });

            // Search for file
            mockGapi.client.drive.files.list.mockResolvedValueOnce({
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
            expect(service.folderId).toBe('new-folder-id');
        });

        test('findOrCreateFolder should use cached folder ID from instance', async () => {
            service.accessToken = 'token';
            service.folderId = 'cached-folder-id';
            localStorage.getItem.mockImplementation((key) => {
                if (key === 'goaly_gdrive_token') {
                    return JSON.stringify({
                        access_token: 'token',
                        expires_at: Date.now() + 600000
                    });
                }
                return null;
            });

            const folderId = await service.findOrCreateFolder();

            expect(folderId).toBe('cached-folder-id');
            expect(mockGapi.client.drive.files.list).not.toHaveBeenCalled();
        });

        test('findOrCreateFolder should use cached folder ID from localStorage', async () => {
            service.accessToken = 'token';
            localStorage.getItem.mockImplementation((key) => {
                if (key === 'goaly_gdrive_folder_id') {
                    return 'localStorage-folder-id';
                }
                if (key === 'goaly_gdrive_token') {
                    return JSON.stringify({
                        access_token: 'token',
                        expires_at: Date.now() + 600000
                    });
                }
                return null;
            });

            const folderId = await service.findOrCreateFolder();

            expect(folderId).toBe('localStorage-folder-id');
            expect(service.folderId).toBe('localStorage-folder-id');
            expect(mockGapi.client.drive.files.list).not.toHaveBeenCalled();
        });

        test('getSyncStatus should handle trashed file', async () => {
            service.accessToken = 'token';
            service.folderId = 'folder-id';
            service.fileId = 'trashed-file-id';
            localStorage.getItem.mockImplementation((key) => {
                if (key === 'goaly_gdrive_file_id') {
                    return 'trashed-file-id';
                }
                if (key === 'goaly_gdrive_token') {
                    return JSON.stringify({
                        access_token: 'token',
                        expires_at: Date.now() + 600000
                    });
                }
                return null;
            });

            // files.get returns trashed file
            mockGapi.client.drive.files.get.mockResolvedValue({
                result: {
                    id: 'trashed-file-id',
                    name: 'goaly-data.json',
                    modifiedTime: '2025-01-01T00:00:00Z',
                    trashed: true
                }
            });

            // Should fallback to list
            mockGapi.client.drive.files.list.mockResolvedValue({
                result: { files: [] }
            });

            const status = await service.getSyncStatus();

            expect(status.authenticated).toBe(true);
            expect(status.synced).toBe(false);
            expect(mockGapi.client.drive.files.get).toHaveBeenCalled();
            expect(mockGapi.client.drive.files.list).toHaveBeenCalled();
        });

        test('getSyncStatus should handle file with wrong name', async () => {
            service.accessToken = 'token';
            service.folderId = 'folder-id';
            service.fileId = 'wrong-file-id';
            localStorage.getItem.mockImplementation((key) => {
                if (key === 'goaly_gdrive_file_id') {
                    return 'wrong-file-id';
                }
                if (key === 'goaly_gdrive_token') {
                    return JSON.stringify({
                        access_token: 'token',
                        expires_at: Date.now() + 600000
                    });
                }
                return null;
            });

            // files.get returns file with wrong name
            mockGapi.client.drive.files.get.mockResolvedValue({
                result: {
                    id: 'wrong-file-id',
                    name: 'wrong-name.json',
                    modifiedTime: '2025-01-01T00:00:00Z',
                    trashed: false
                }
            });

            // Should fallback to list
            mockGapi.client.drive.files.list.mockResolvedValue({
                result: {
                    files: [{
                        id: 'correct-file-id',
                        modifiedTime: '2025-01-02T00:00:00Z'
                    }]
                }
            });

            const status = await service.getSyncStatus();

            expect(status.authenticated).toBe(true);
            expect(status.synced).toBe(true);
            expect(status.fileId).toBe('correct-file-id');
        });


        test('refreshTokenIfNeeded should handle requestAccessToken error', async () => {
            service.accessToken = 'token';
            service.clientId = 'test-client-id';
            const savedToken = {
                access_token: 'token',
                expires_at: Date.now() - 10000
            };
            localStorage.getItem.mockReturnValue(JSON.stringify(savedToken));

            const mockTokenClient = {
                requestAccessToken: jest.fn(() => {
                    throw new Error('Request failed');
                })
            };

            mockGoogleAccounts.oauth2.initTokenClient.mockReturnValue(mockTokenClient);
            service.tokenClient = mockTokenClient;

            await expect(service.refreshTokenIfNeeded()).rejects.toThrow('Failed to request token refresh');
        });

        test('executeFetchWithTokenRefresh should handle non-401 error response', async () => {
            service.accessToken = 'token';
            localStorage.getItem.mockReturnValue(JSON.stringify({
                access_token: 'token',
                expires_at: Date.now() + 600000
            }));

            global.fetch.mockResolvedValue({
                ok: false,
                status: 500,
                json: async () => ({ error: 'Server error' })
            });

            const response = await service.executeFetchWithTokenRefresh('https://api.example.com/data');

            expect(response.status).toBe(500);
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        test('executeFetchWithTokenRefresh should handle no current token', async () => {
            service.accessToken = null;
            localStorage.getItem.mockReturnValue(null);

            await expect(service.executeFetchWithTokenRefresh('https://api.example.com/data'))
                .rejects.toThrow('Not authenticated. Please sign in first.');
        });

        test('executeWithTokenRefresh should handle refreshed token path', async () => {
            service.accessToken = 'old-token';
            service.clientId = 'test-client-id';
            service.gapiLoaded = true;
            service.gisLoaded = true;
            service.initialized = true;
            
            const savedToken = {
                access_token: 'old-token',
                expires_at: Date.now() + 600000
            };
            localStorage.getItem.mockReturnValue(JSON.stringify(savedToken));
            window.gapi.client.setToken = jest.fn();

            let callCount = 0;
            const apiCall = jest.fn(async () => {
                callCount++;
                if (callCount === 1) {
                    const error = new Error('Unauthorized');
                    error.status = 401;
                    throw error;
                }
                return { result: { success: true } };
            });

            let refreshCallback = null;
            const mockTokenClient = {
                requestAccessToken: jest.fn(),
                callback: null
            };

            mockGoogleAccounts.oauth2.initTokenClient.mockImplementation((config) => {
                refreshCallback = config.callback;
                return mockTokenClient;
            });

            // Authenticate first
            const authPromise = service.authenticate();
            if (refreshCallback) {
                refreshCallback({
                    access_token: 'initial-token',
                    expires_in: 3600
                });
            }
            await authPromise;
            service.tokenClient = mockTokenClient;

            // Mock _getCurrentAccessToken to return refreshed token
            service._getCurrentAccessToken = jest.fn()
                .mockReturnValueOnce('old-token')
                .mockReturnValueOnce('refreshed-token');

            const executePromise = service.executeWithTokenRefresh(apiCall);
            
            await new Promise(resolve => setTimeout(resolve, 50));
            if (refreshCallback && mockTokenClient.requestAccessToken.mock.calls.length > 0) {
                refreshCallback({
                    access_token: 'refreshed-token',
                    expires_in: 3600
                });
            }

            const result = await executePromise;

            expect(apiCall).toHaveBeenCalledTimes(2);
            expect(result.result.success).toBe(true);
            expect(service.accessToken).toBe('refreshed-token');
        }, 20000);

        test('uploadData should handle 404 error and retry', async () => {
            const goals = [];
            const settings = { maxActiveGoals: 3 };
            service.accessToken = 'token';
            service.fileId = 'file-id';
            service.folderId = 'folder-id';
            localStorage.getItem.mockImplementation((key) => {
                if (key === 'goaly_gdrive_file_id') {
                    return 'file-id';
                }
                if (key === 'goaly_gdrive_token') {
                    return JSON.stringify({
                        access_token: 'token',
                        expires_at: Date.now() + 600000
                    });
                }
                return null;
            });

            // First PATCH update fails with 404
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: async () => ({ error: { message: 'Not found' } })
            });

            // Search for file again
            mockGapi.client.drive.files.list.mockResolvedValueOnce({
                result: { files: [{ id: 'new-file-id' }] }
            });

            // Retry update succeeds
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'new-file-id' })
            });

            const result = await service.uploadData(goals, settings);

            expect(result.fileId).toBe('new-file-id');
        });

        test('uploadData should handle retry with different file ID', async () => {
            const goals = [];
            const settings = { maxActiveGoals: 3 };
            service.accessToken = 'token';
            service.fileId = 'old-file-id';
            service.folderId = 'folder-id';
            localStorage.getItem.mockImplementation((key) => {
                if (key === 'goaly_gdrive_file_id') {
                    return 'old-file-id';
                }
                if (key === 'goaly_gdrive_token') {
                    return JSON.stringify({
                        access_token: 'token',
                        expires_at: Date.now() + 600000
                    });
                }
                return null;
            });

            // First PATCH fails with 404
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: async () => ({ error: { message: 'Not found' } })
            });

            // Find different file
            mockGapi.client.drive.files.list.mockResolvedValueOnce({
                result: { files: [{ id: 'different-file-id', modifiedTime: '2025-01-01T00:00:00Z' }] }
            });

            // Retry with different file succeeds
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'different-file-id' })
            });

            const result = await service.uploadData(goals, settings);

            expect(result.fileId).toBe('different-file-id');
            expect(service.fileId).toBe('different-file-id');
        });

        test('uploadData should create new file if retry still fails', async () => {
            const goals = [];
            const settings = { maxActiveGoals: 3 };
            service.accessToken = 'token';
            service.fileId = 'file-id';
            service.folderId = 'folder-id';
            localStorage.getItem.mockImplementation((key) => {
                if (key === 'goaly_gdrive_file_id') {
                    return 'file-id';
                }
                if (key === 'goaly_gdrive_token') {
                    return JSON.stringify({
                        access_token: 'token',
                        expires_at: Date.now() + 600000
                    });
                }
                return null;
            });

            // First PATCH fails
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: async () => ({ error: { message: 'Not found' } })
            });

            // Search finds no file
            mockGapi.client.drive.files.list.mockResolvedValueOnce({
                result: { files: [] }
            });

            // Create new file succeeds
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'new-file-id' })
            });

            const result = await service.uploadData(goals, settings);

            expect(result.fileId).toBe('new-file-id');
        });

        test('ensureAuthenticated should reload token from storage', async () => {
            service.accessToken = 'old-token';
            localStorage.getItem.mockImplementation((key) => {
                if (key === 'goaly_gdrive_token') {
                    return JSON.stringify({
                        access_token: 'new-token-from-storage',
                        expires_at: Date.now() + 600000
                    });
                }
                return null;
            });

            service.tokenClient = {
                requestAccessToken: jest.fn()
            };

            // Mock _getCurrentAccessToken to return new token
            const originalGetToken = service._getCurrentAccessToken;
            service._getCurrentAccessToken = jest.fn(() => 'new-token-from-storage');

            await service.ensureAuthenticated();

            expect(service.accessToken).toBe('new-token-from-storage');
            
            // Restore original method
            service._getCurrentAccessToken = originalGetToken;
        });

        test('ensureAuthenticated should set gapi token if available', async () => {
            service.accessToken = 'token';
            localStorage.getItem.mockReturnValue(JSON.stringify({
                access_token: 'token',
                expires_at: Date.now() + 600000
            }));

            service.tokenClient = {
                requestAccessToken: jest.fn()
            };

            window.gapi.client.setToken = jest.fn();

            await service.ensureAuthenticated();

            expect(window.gapi.client.setToken).toHaveBeenCalledWith({ access_token: 'token' });
        });

        test('authenticate should handle tokenClient initialization failure', async () => {
            service.gisLoaded = true;
            service.clientId = 'test-client-id';
            mockGoogleAccounts.oauth2.initTokenClient.mockReturnValue(null);

            await expect(service.authenticate()).rejects.toThrow('Failed to initialize Google OAuth client');
        });

        test('authenticate should handle popup_closed_by_user error', async () => {
            service.gisLoaded = true;
            service.clientId = 'test-client-id';
            let tokenCallback = null;
            const mockTokenClient = {
                requestAccessToken: jest.fn()
            };
            mockGoogleAccounts.oauth2.initTokenClient.mockImplementation((config) => {
                tokenCallback = config.callback;
                return mockTokenClient;
            });

            const authPromise = service.authenticate();
            if (tokenCallback) {
                tokenCallback({ error: 'popup_closed_by_user' });
            }

            await expect(authPromise).rejects.toThrow('Authentication cancelled. Please try again.');
        });

        test('authenticate should handle access_denied error', async () => {
            service.gisLoaded = true;
            service.clientId = 'test-client-id';
            let tokenCallback = null;
            const mockTokenClient = {
                requestAccessToken: jest.fn()
            };
            mockGoogleAccounts.oauth2.initTokenClient.mockImplementation((config) => {
                tokenCallback = config.callback;
                return mockTokenClient;
            });

            const authPromise = service.authenticate();
            if (tokenCallback) {
                tokenCallback({ error: 'access_denied' });
            }

            await expect(authPromise).rejects.toThrow('Access denied');
        });

        test('authenticate should handle invalid_client error', async () => {
            service.gisLoaded = true;
            service.clientId = 'test-client-id';
            let tokenCallback = null;
            const mockTokenClient = {
                requestAccessToken: jest.fn()
            };
            mockGoogleAccounts.oauth2.initTokenClient.mockImplementation((config) => {
                tokenCallback = config.callback;
                return mockTokenClient;
            });

            const authPromise = service.authenticate();
            if (tokenCallback) {
                tokenCallback({ error: 'invalid_client' });
            }

            await expect(authPromise).rejects.toThrow('Invalid client ID');
        });

        test('authenticate should handle redirect_uri_mismatch error', async () => {
            service.gisLoaded = true;
            service.clientId = 'test-client-id';
            let tokenCallback = null;
            const mockTokenClient = {
                requestAccessToken: jest.fn()
            };
            mockGoogleAccounts.oauth2.initTokenClient.mockImplementation((config) => {
                tokenCallback = config.callback;
                return mockTokenClient;
            });

            const authPromise = service.authenticate();
            if (tokenCallback) {
                tokenCallback({ error: 'redirect_uri_mismatch' });
            }

            await expect(authPromise).rejects.toThrow('Redirect URI mismatch');
        });

        test('authenticate should handle immediate_failed error', async () => {
            service.gisLoaded = true;
            service.clientId = 'test-client-id';
            let tokenCallback = null;
            const mockTokenClient = {
                requestAccessToken: jest.fn()
            };
            mockGoogleAccounts.oauth2.initTokenClient.mockImplementation((config) => {
                tokenCallback = config.callback;
                return mockTokenClient;
            });

            const authPromise = service.authenticate();
            if (tokenCallback) {
                tokenCallback({ error: 'immediate_failed' });
            }

            await expect(authPromise).rejects.toThrow('Session expired');
        });

        test('authenticate should handle popup_blocked error', async () => {
            service.gisLoaded = true;
            service.clientId = 'test-client-id';
            let tokenCallback = null;
            const mockTokenClient = {
                requestAccessToken: jest.fn()
            };
            mockGoogleAccounts.oauth2.initTokenClient.mockImplementation((config) => {
                tokenCallback = config.callback;
                return mockTokenClient;
            });

            const authPromise = service.authenticate();
            if (tokenCallback) {
                tokenCallback({ error: 'popup_blocked' });
            }

            await expect(authPromise).rejects.toThrow('Session expired');
        });

        test('authenticate should handle response without access_token', async () => {
            service.gisLoaded = true;
            service.clientId = 'test-client-id';
            let tokenCallback = null;
            const mockTokenClient = {
                requestAccessToken: jest.fn()
            };
            mockGoogleAccounts.oauth2.initTokenClient.mockImplementation((config) => {
                tokenCallback = config.callback;
                return mockTokenClient;
            });

            const authPromise = service.authenticate();
            if (tokenCallback) {
                tokenCallback({ expires_in: 3600 }); // No access_token
            }

            await expect(authPromise).rejects.toThrow('No access token received');
        });

        test('_getCurrentAccessToken should handle invalid JSON in localStorage', () => {
            service.accessToken = null; // Clear in-memory token
            localStorage.getItem.mockReturnValue('invalid-json');
            const token = service._getCurrentAccessToken();
            expect(token).toBeNull();
        });

        test('_getCurrentAccessToken should handle token without access_token field', () => {
            service.accessToken = null; // Clear in-memory token
            localStorage.getItem.mockReturnValue(JSON.stringify({ expires_at: 123456 }));
            const token = service._getCurrentAccessToken();
            expect(token).toBeNull();
        });

        test('signOut should not revoke if no access token', () => {
            service.accessToken = null;
            service.signOut();
            expect(mockGoogleAccounts.oauth2.revoke).not.toHaveBeenCalled();
        });

        test('signOut should not revoke if google.accounts not available', () => {
            service.accessToken = 'token';
            window.google = null;
            service.signOut();
            expect(mockGoogleAccounts.oauth2.revoke).not.toHaveBeenCalled();
        });

        test('signOut should not set gapi token if gapi not available', () => {
            service.accessToken = 'token';
            window.gapi = null;
            service.signOut();
            // Should not throw
        });

        test('ensureAuthenticated should not set gapi token if gapi not available', async () => {
            service.accessToken = 'token';
            localStorage.getItem.mockReturnValue(JSON.stringify({
                access_token: 'token',
                expires_at: Date.now() + 600000
            }));
            service.tokenClient = { requestAccessToken: jest.fn() };
            window.gapi = null;

            await service.ensureAuthenticated();
            // Should not throw
        });

        test('ensureAuthenticated should not set gapi token if no access token', async () => {
            service.accessToken = null;
            localStorage.getItem.mockReturnValue(JSON.stringify({
                access_token: 'token',
                expires_at: Date.now() + 600000
            }));
            service.tokenClient = { requestAccessToken: jest.fn() };
            window.gapi.client.setToken = jest.fn();

            // Mock _getCurrentAccessToken to return null
            service._getCurrentAccessToken = jest.fn(() => null);

            // ensureAuthenticated throws if not authenticated
            await expect(service.ensureAuthenticated()).rejects.toThrow('Not authenticated');
            expect(window.gapi.client.setToken).not.toHaveBeenCalled();
        });

        test('executeFetchWithTokenRefresh should return response if ok is true', async () => {
            service.accessToken = 'token';
            localStorage.getItem.mockReturnValue(JSON.stringify({
                access_token: 'token',
                expires_at: Date.now() + 600000
            }));
            service.tokenClient = { requestAccessToken: jest.fn() };

            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ success: true })
            });

            const response = await service.executeFetchWithTokenRefresh('https://api.example.com/data');
            expect(response.ok).toBe(true);
            expect(response.status).toBe(200);
        });

        test('executeFetchWithTokenRefresh should return response if status is not 401', async () => {
            service.accessToken = 'token';
            localStorage.getItem.mockReturnValue(JSON.stringify({
                access_token: 'token',
                expires_at: Date.now() + 600000
            }));
            service.tokenClient = { requestAccessToken: jest.fn() };

            global.fetch.mockResolvedValue({
                ok: false,
                status: 500,
                json: async () => ({ error: 'Server error' })
            });

            const response = await service.executeFetchWithTokenRefresh('https://api.example.com/data');
            expect(response.status).toBe(500);
        });

        test('executeFetchWithTokenRefresh should handle Authentication failed error and retry', async () => {
            service.accessToken = 'token';
            localStorage.getItem.mockImplementation((key) => {
                if (key === 'goaly_gdrive_token') {
                    return JSON.stringify({
                        access_token: 'token',
                        expires_at: Date.now() + 600000
                    });
                }
                return null;
            });
            service.tokenClient = { requestAccessToken: jest.fn() };

            let callCount = 0;
            global.fetch.mockImplementation(async () => {
                callCount++;
                if (callCount === 1) {
                    throw new Error('Authentication failed. Please sign in again.');
                }
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ success: true })
                };
            });

            // Mock ensureAuthenticated to not throw
            service.ensureAuthenticated = jest.fn().mockResolvedValue(undefined);
            // Mock refresh to succeed
            service.refreshTokenIfNeeded = jest.fn().mockResolvedValue(true);
            service._getCurrentAccessToken = jest.fn()
                .mockReturnValueOnce('token')
                .mockReturnValueOnce('refreshed-token');

            const response = await service.executeFetchWithTokenRefresh('https://api.example.com/data', {}, 1);
            expect(response.ok).toBe(true);
            expect(callCount).toBe(2);
        });

        test('executeWithTokenRefresh should handle error with result.error.code 401', async () => {
            service.accessToken = 'token';
            service.clientId = 'test-client-id';
            service.gapiLoaded = true;
            service.gisLoaded = true;
            service.initialized = true;
            
            const savedToken = {
                access_token: 'token',
                expires_at: Date.now() + 600000
            };
            localStorage.getItem.mockReturnValue(JSON.stringify(savedToken));
            window.gapi.client.setToken = jest.fn();

            let callCount = 0;
            const apiCall = jest.fn(async () => {
                callCount++;
                if (callCount === 1) {
                    const error = new Error('API Error');
                    error.result = { error: { code: 401 } };
                    throw error;
                }
                return { result: { success: true } };
            });

            let refreshCallback = null;
            const mockTokenClient = {
                requestAccessToken: jest.fn(),
                callback: null
            };

            mockGoogleAccounts.oauth2.initTokenClient.mockImplementation((config) => {
                refreshCallback = config.callback;
                return mockTokenClient;
            });

            const authPromise = service.authenticate();
            if (refreshCallback) {
                refreshCallback({
                    access_token: 'initial-token',
                    expires_in: 3600
                });
            }
            await authPromise;
            service.tokenClient = mockTokenClient;

            const executePromise = service.executeWithTokenRefresh(apiCall);
            
            await new Promise(resolve => setTimeout(resolve, 50));
            if (refreshCallback && mockTokenClient.requestAccessToken.mock.calls.length > 0) {
                refreshCallback({
                    access_token: 'new-token',
                    expires_in: 3600
                });
            }

            const result = await executePromise;
            expect(apiCall).toHaveBeenCalledTimes(2);
            expect(result.result.success).toBe(true);
        }, 20000);

        test('executeWithTokenRefresh should handle error with result.error.code 403', async () => {
            service.accessToken = 'token';
            service.clientId = 'test-client-id';
            service.gapiLoaded = true;
            service.gisLoaded = true;
            service.initialized = true;
            
            const savedToken = {
                access_token: 'token',
                expires_at: Date.now() + 600000
            };
            localStorage.getItem.mockReturnValue(JSON.stringify(savedToken));
            window.gapi.client.setToken = jest.fn();

            let callCount = 0;
            const apiCall = jest.fn(async () => {
                callCount++;
                if (callCount === 1) {
                    const error = new Error('API Error');
                    error.result = { error: { code: 403 } };
                    throw error;
                }
                return { result: { success: true } };
            });

            let refreshCallback = null;
            const mockTokenClient = {
                requestAccessToken: jest.fn(),
                callback: null
            };

            mockGoogleAccounts.oauth2.initTokenClient.mockImplementation((config) => {
                refreshCallback = config.callback;
                return mockTokenClient;
            });

            const authPromise = service.authenticate();
            if (refreshCallback) {
                refreshCallback({
                    access_token: 'initial-token',
                    expires_in: 3600
                });
            }
            await authPromise;
            service.tokenClient = mockTokenClient;

            const executePromise = service.executeWithTokenRefresh(apiCall);
            
            await new Promise(resolve => setTimeout(resolve, 50));
            if (refreshCallback && mockTokenClient.requestAccessToken.mock.calls.length > 0) {
                refreshCallback({
                    access_token: 'new-token',
                    expires_in: 3600
                });
            }

            const result = await executePromise;
            expect(apiCall).toHaveBeenCalledTimes(2);
            expect(result.result.success).toBe(true);
        }, 20000);

        test('executeWithTokenRefresh should handle error with Invalid Credentials message', async () => {
            service.accessToken = 'token';
            service.clientId = 'test-client-id';
            service.gapiLoaded = true;
            service.gisLoaded = true;
            service.initialized = true;
            
            const savedToken = {
                access_token: 'token',
                expires_at: Date.now() + 600000
            };
            localStorage.getItem.mockReturnValue(JSON.stringify(savedToken));
            window.gapi.client.setToken = jest.fn();

            let callCount = 0;
            const apiCall = jest.fn(async () => {
                callCount++;
                if (callCount === 1) {
                    throw new Error('Invalid Credentials');
                }
                return { result: { success: true } };
            });

            let refreshCallback = null;
            const mockTokenClient = {
                requestAccessToken: jest.fn(),
                callback: null
            };

            mockGoogleAccounts.oauth2.initTokenClient.mockImplementation((config) => {
                refreshCallback = config.callback;
                return mockTokenClient;
            });

            const authPromise = service.authenticate();
            if (refreshCallback) {
                refreshCallback({
                    access_token: 'initial-token',
                    expires_in: 3600
                });
            }
            await authPromise;
            service.tokenClient = mockTokenClient;

            const executePromise = service.executeWithTokenRefresh(apiCall);
            
            await new Promise(resolve => setTimeout(resolve, 50));
            if (refreshCallback && mockTokenClient.requestAccessToken.mock.calls.length > 0) {
                refreshCallback({
                    access_token: 'new-token',
                    expires_in: 3600
                });
            }

            const result = await executePromise;
            expect(apiCall).toHaveBeenCalledTimes(2);
            expect(result.result.success).toBe(true);
        }, 20000);

        test('executeWithTokenRefresh should handle error with unauthorized message', async () => {
            service.accessToken = 'token';
            service.clientId = 'test-client-id';
            service.gapiLoaded = true;
            service.gisLoaded = true;
            service.initialized = true;
            
            const savedToken = {
                access_token: 'token',
                expires_at: Date.now() + 600000
            };
            localStorage.getItem.mockReturnValue(JSON.stringify(savedToken));
            window.gapi.client.setToken = jest.fn();

            let callCount = 0;
            const apiCall = jest.fn(async () => {
                callCount++;
                if (callCount === 1) {
                    throw new Error('unauthorized');
                }
                return { result: { success: true } };
            });

            let refreshCallback = null;
            const mockTokenClient = {
                requestAccessToken: jest.fn(),
                callback: null
            };

            mockGoogleAccounts.oauth2.initTokenClient.mockImplementation((config) => {
                refreshCallback = config.callback;
                return mockTokenClient;
            });

            const authPromise = service.authenticate();
            if (refreshCallback) {
                refreshCallback({
                    access_token: 'initial-token',
                    expires_in: 3600
                });
            }
            await authPromise;
            service.tokenClient = mockTokenClient;

            const executePromise = service.executeWithTokenRefresh(apiCall);
            
            await new Promise(resolve => setTimeout(resolve, 50));
            if (refreshCallback && mockTokenClient.requestAccessToken.mock.calls.length > 0) {
                refreshCallback({
                    access_token: 'new-token',
                    expires_in: 3600
                });
            }

            const result = await executePromise;
            expect(apiCall).toHaveBeenCalledTimes(2);
            expect(result.result.success).toBe(true);
        }, 20000);

        test('executeWithTokenRefresh should handle null refreshedToken from _getCurrentAccessToken', async () => {
            service.accessToken = 'token';
            service.clientId = 'test-client-id';
            service.gapiLoaded = true;
            service.gisLoaded = true;
            service.initialized = true;
            
            const savedToken = {
                access_token: 'token',
                expires_at: Date.now() + 600000
            };
            localStorage.getItem.mockReturnValue(JSON.stringify(savedToken));
            window.gapi.client.setToken = jest.fn();

            let callCount = 0;
            const apiCall = jest.fn(async () => {
                callCount++;
                if (callCount === 1) {
                    const error = new Error('Unauthorized');
                    error.status = 401;
                    throw error;
                }
                return { result: { success: true } };
            });

            let refreshCallback = null;
            const mockTokenClient = {
                requestAccessToken: jest.fn(),
                callback: null
            };

            mockGoogleAccounts.oauth2.initTokenClient.mockImplementation((config) => {
                refreshCallback = config.callback;
                return mockTokenClient;
            });

            const authPromise = service.authenticate();
            if (refreshCallback) {
                refreshCallback({
                    access_token: 'initial-token',
                    expires_in: 3600
                });
            }
            await authPromise;
            service.tokenClient = mockTokenClient;

            // Mock _getCurrentAccessToken to return null after refresh
            // This tests the branch where refreshedToken is null (line 612)
            service._getCurrentAccessToken = jest.fn()
                .mockReturnValueOnce('token') // First call in ensureAuthenticated
                .mockReturnValueOnce('token') // Second call before API call
                .mockReturnValueOnce(null); // After refresh - no token available

            const executePromise = service.executeWithTokenRefresh(apiCall);
            
            await new Promise(resolve => setTimeout(resolve, 50));
            if (refreshCallback && mockTokenClient.requestAccessToken.mock.calls.length > 0) {
                refreshCallback({
                    access_token: 'new-token',
                    expires_in: 3600
                });
            }

            const result = await executePromise;
            expect(apiCall).toHaveBeenCalledTimes(2);
            expect(result.result.success).toBe(true);
            // Verify that _getCurrentAccessToken was called and returned null
            // This covers the branch where refreshedToken is null
            expect(service._getCurrentAccessToken).toHaveBeenCalled();
        }, 20000);

        test('uploadData should handle case where existingFile.id equals fileId', async () => {
            const goals = [];
            const settings = { maxActiveGoals: 3 };
            service.accessToken = 'token';
            service.fileId = 'file-id';
            service.folderId = 'folder-id';
            localStorage.getItem.mockImplementation((key) => {
                if (key === 'goaly_gdrive_file_id') {
                    return 'file-id';
                }
                if (key === 'goaly_gdrive_token') {
                    return JSON.stringify({
                        access_token: 'token',
                        expires_at: Date.now() + 600000
                    });
                }
                return null;
            });

            // First PATCH fails with 404
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: async () => ({ error: { message: 'Not found' } })
            });

            // Find same file (same ID)
            mockGapi.client.drive.files.list.mockResolvedValueOnce({
                result: { files: [{ id: 'file-id', modifiedTime: '2025-01-01T00:00:00Z' }] }
            });

            // Create new file succeeds
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'new-file-id' })
            });

            const result = await service.uploadData(goals, settings);

            expect(result.fileId).toBe('new-file-id');
        });

        test('uploadData should handle response.json() failure', async () => {
            const goals = [];
            const settings = { maxActiveGoals: 3 };
            service.accessToken = 'token';
            service.fileId = 'file-id';
            service.folderId = 'folder-id';
            localStorage.getItem.mockImplementation((key) => {
                if (key === 'goaly_gdrive_file_id') {
                    return 'file-id';
                }
                if (key === 'goaly_gdrive_token') {
                    return JSON.stringify({
                        access_token: 'token',
                        expires_at: Date.now() + 600000
                    });
                }
                return null;
            });

            global.fetch.mockResolvedValue({
                ok: false,
                status: 500,
                json: async () => {
                    throw new Error('JSON parse error');
                }
            });

            await expect(service.uploadData(goals, settings)).rejects.toThrow('Failed to upload to Google Drive (500)');
        });

        test('uploadData should handle error without error.message', async () => {
            const goals = [];
            const settings = { maxActiveGoals: 3 };
            service.accessToken = 'token';
            service.fileId = 'file-id';
            service.folderId = 'folder-id';
            localStorage.getItem.mockImplementation((key) => {
                if (key === 'goaly_gdrive_file_id') {
                    return 'file-id';
                }
                if (key === 'goaly_gdrive_token') {
                    return JSON.stringify({
                        access_token: 'token',
                        expires_at: Date.now() + 600000
                    });
                }
                return null;
            });

            global.fetch.mockResolvedValue({
                ok: false,
                status: 500,
                json: async () => ({ error: {} }) // No message field
            });

            await expect(service.uploadData(goals, settings)).rejects.toThrow('Failed to upload to Google Drive (500)');
        });

        test('downloadData should handle invalid JSON', async () => {
            service.accessToken = 'token';
            service.folderId = 'folder-id';
            localStorage.getItem.mockImplementation((key) => {
                if (key === 'goaly_gdrive_token') {
                    return JSON.stringify({
                        access_token: 'token',
                        expires_at: Date.now() + 600000
                    });
                }
                return null;
            });

            mockGapi.client.drive.files.list.mockResolvedValueOnce({
                result: { files: [{ id: 'folder-id' }] }
            }).mockResolvedValueOnce({
                result: {
                    files: [{
                        id: 'file-id',
                        modifiedTime: '2025-01-01T00:00:00Z'
                    }]
                }
            });

            global.fetch.mockResolvedValue({
                ok: true,
                text: async () => 'invalid json {'
            });

            await expect(service.downloadData()).rejects.toThrow('Invalid JSON in Google Drive file');
        });

        test('executeWithTokenRefresh should not set gapi token if gapi.client is null', async () => {
            service.accessToken = 'token';
            service.clientId = 'test-client-id';
            service.gapiLoaded = true;
            service.gisLoaded = true;
            service.initialized = true;
            
            const savedToken = {
                access_token: 'token',
                expires_at: Date.now() + 600000
            };
            localStorage.getItem.mockReturnValue(JSON.stringify(savedToken));

            let callCount = 0;
            const apiCall = jest.fn(async () => {
                callCount++;
                if (callCount === 1) {
                    const error = new Error('Unauthorized');
                    error.status = 401;
                    throw error;
                }
                return { result: { success: true } };
            });

            let refreshCallback = null;
            const mockTokenClient = {
                requestAccessToken: jest.fn(),
                callback: null
            };

            mockGoogleAccounts.oauth2.initTokenClient.mockImplementation((config) => {
                refreshCallback = config.callback;
                return mockTokenClient;
            });

            const authPromise = service.authenticate();
            if (refreshCallback) {
                refreshCallback({
                    access_token: 'initial-token',
                    expires_in: 3600
                });
            }
            await authPromise;
            service.tokenClient = mockTokenClient;

            // Mock gapi.client to be null
            window.gapi.client = null;

            service._getCurrentAccessToken = jest.fn()
                .mockReturnValueOnce('token')
                .mockReturnValueOnce('refreshed-token');

            const executePromise = service.executeWithTokenRefresh(apiCall);
            
            await new Promise(resolve => setTimeout(resolve, 50));
            if (refreshCallback && mockTokenClient.requestAccessToken.mock.calls.length > 0) {
                refreshCallback({
                    access_token: 'new-token',
                    expires_in: 3600
                });
            }

            const result = await executePromise;
            expect(apiCall).toHaveBeenCalledTimes(2);
            expect(result.result.success).toBe(true);
        }, 20000);
    });
});

