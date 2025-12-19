// tests/sync-service.test.js

const SyncService = require('../src/domain/services/sync-service').default;
const { GoogleDriveFileNotFoundError } = require('../src/domain/services/google-drive-service');
const { GOAL_FILE_VERSION } = require('../src/domain/utils/versioning');
const { GOOGLE_DRIVE_SYNC_DEBOUNCE_MS, STORAGE_KEY_GDRIVE_FILE_ID } = require('../src/domain/utils/constants');
const {
    createBasicDOM,
    setupGlobalDOM,
    cleanupGlobalDOM,
    createSimpleLocalStorageMock,
    createMockApp,
    setupBrowserMocks,
    cleanupBrowserMocks
} = require('./mocks');

describe('SyncService', () => {
    let dom;
    let mockApp;
    let manager;

    beforeEach(() => {
        jest.useFakeTimers();
        dom = createBasicDOM();
        setupGlobalDOM(dom);
        globalThis.localStorage = createSimpleLocalStorageMock();
        setupBrowserMocks();
        globalThis.console.error = jest.fn();

        const translations = {
            'googleDrive.notConfigured': 'Not configured',
            'googleDrive.authError': (replacements) => `Auth error: ${replacements?.message || ''}`,
            'googleDrive.authenticated': 'Authenticated',
            'googleDrive.syncing': 'Syncing',
            'googleDrive.status.buildingLocalPayload': 'Building payload',
            'googleDrive.status.checkingRemote': 'Checking remote',
            'googleDrive.status.remoteFound': 'Remote found',
            'googleDrive.status.noRemote': 'No remote',
            'googleDrive.status.merging': 'Merging',
            'googleDrive.status.applying': 'Applying',
            'googleDrive.status.uploading': 'Uploading',
            'googleDrive.uploadSuccess': 'Upload success',
            'googleDrive.noChanges': 'No changes',
            'googleDrive.syncError': (replacements) => `Sync error: ${replacements?.message || ''}`,
            'googleDrive.downloadSuccess': 'Download success',
            'googleDrive.downloadError': (replacements) => `Download error: ${replacements?.message || ''}`,
            'import.invalidVersionFormat': (replacements) => `Invalid version: ${replacements?.version || ''}`,
            'import.versionTooNew': 'Version too new',
            'import.incompatible': 'Incompatible'
        };

        const ErrorHandler = require('../src/domain/services/error-handler').default;
        const mockErrorHandler = new ErrorHandler({
            translate: jest.fn((key, replacements) => {
                if (translations[key]) {
                    if (typeof translations[key] === 'function') {
                        return translations[key](replacements);
                    }
                    return translations[key];
                }
                return key;
            })
        });
        mockErrorHandler.error = jest.fn();
        mockErrorHandler.warning = jest.fn();
        mockErrorHandler.info = jest.fn();
        mockErrorHandler.critical = jest.fn();
        mockErrorHandler.showError = jest.fn();

        mockApp = createMockApp({
            goalService: {
                goals: [{ id: '1', title: 'Test' }],
                onAfterSave: jest.fn()
            },
            languageService: {
                translate: jest.fn((key, replacements) => {
                    if (translations[key]) {
                        if (typeof translations[key] === 'function') {
                            return translations[key](replacements);
                        }
                        return translations[key];
                    }
                    return key;
                })
            },
            errorHandler: mockErrorHandler,
            currentDataVersion: GOAL_FILE_VERSION
        });

        manager = new SyncService(mockApp);
    });

    afterEach(() => {
        if (manager?.syncDebounce) {
            clearTimeout(manager.syncDebounce);
            manager.syncDebounce = null;
        }
        jest.useRealTimers();
        cleanupGlobalDOM(dom);
        cleanupBrowserMocks();
        delete globalThis.localStorage;
    });

    // ========== Initialization Tests ==========

    test('initGoogleDriveSync should not initialize without credentials', async () => {
        delete globalThis.GOOGLE_API_KEY;
        delete globalThis.GOOGLE_CLIENT_ID;
        if (process.env) {
            delete process.env.GOOGLE_API_KEY;
            delete process.env.GOOGLE_CLIENT_ID;
        }

        await manager.initGoogleDriveSync();

        expect(manager.authService).toBeNull();
        expect(manager.driveService).toBeNull();
    }, 10000);

    // ========== Hook Tests ==========

    test('hookGoalSavesForBackgroundSync should register listener', () => {
        manager.hookGoalSavesForBackgroundSync();
        expect(mockApp.goalService.onAfterSave).toHaveBeenCalled();
    });

    test('hookGoalSavesForBackgroundSync should handle missing goalService', () => {
        mockApp.goalService = null;
        expect(() => manager.hookGoalSavesForBackgroundSync()).not.toThrow();
    });

    test('hookSettingsUpdatesForBackgroundSync should register listener', () => {
        manager.hookSettingsUpdatesForBackgroundSync();
        expect(mockApp.settingsService.onAfterSave).toHaveBeenCalled();
    });

    test('hookSettingsUpdatesForBackgroundSync should handle missing settingsService', () => {
        mockApp.settingsService = null;
        expect(() => manager.hookSettingsUpdatesForBackgroundSync()).not.toThrow();
    });

    // ========== Scheduling Tests ==========

    test('scheduleBackgroundSyncSoon should not schedule without authService', () => {
        manager.authService = null;
        manager.scheduleBackgroundSyncSoon();
        expect(manager.syncDebounce).toBeNull();
    });

    test('scheduleBackgroundSyncSoon should not schedule when syncing', () => {
        manager.authService = { isAuthenticated: jest.fn(() => true) };
        manager._isSyncing = true;
        manager.scheduleBackgroundSyncSoon();
        expect(manager.syncDebounce).toBeNull();
    });

    test('scheduleBackgroundSyncSoon should schedule sync when authenticated', () => {
        manager.authService = { isAuthenticated: jest.fn(() => true) };
        manager.driveService = {};
        manager.syncWithGoogleDrive = jest.fn(() => Promise.resolve());

        manager.scheduleBackgroundSyncSoon();

        expect(manager.syncDebounce).not.toBeNull();
        jest.advanceTimersByTime(GOOGLE_DRIVE_SYNC_DEBOUNCE_MS);
        expect(manager.syncWithGoogleDrive).toHaveBeenCalledWith({ background: true });
    });

    // ========== Authentication Tests ==========

    test('authenticateGoogleDrive should show error when not configured', async () => {
        manager.authService = null;
        await manager.authenticateGoogleDrive();
        expect(mockApp.errorHandler.error).toHaveBeenCalledWith('googleDrive.notConfigured', {});
    });

    test('authenticateGoogleDrive should authenticate and sync', async () => {
        manager.authService = {
            authenticate: jest.fn(() => Promise.resolve()),
            isAuthenticated: jest.fn(() => true)
        };
        manager.driveService = {};
        manager.syncWithGoogleDrive = jest.fn(() => Promise.resolve());

        await manager.authenticateGoogleDrive();

        expect(manager.authService.authenticate).toHaveBeenCalled();
        expect(mockApp.uiController.settingsView.updateGoogleDriveUI).toHaveBeenCalled();
        expect(manager.syncWithGoogleDrive).toHaveBeenCalledWith({ background: true });
    });

    test('authenticateGoogleDrive should handle authentication error', async () => {
        manager.authService = {
            authenticate: jest.fn(() => Promise.reject(new Error('Auth failed')))
        };

        await manager.authenticateGoogleDrive();

        expect(mockApp.errorHandler.error).toHaveBeenCalledWith(
            'googleDrive.authError',
            { message: 'Auth failed' },
            expect.any(Error)
        );
    });

    // ========== Sign Out Tests ==========

    test('signOutGoogleDrive should sign out and cleanup', () => {
        manager.authService = { signOut: jest.fn() };
        manager.driveService = { clearCache: jest.fn() };
        manager.syncDebounce = setTimeout(() => { }, 1000);

        manager.signOutGoogleDrive();

        expect(manager.authService.signOut).toHaveBeenCalled();
        expect(manager.driveService.clearCache).toHaveBeenCalled();
        expect(manager.syncDebounce).toBeNull();
        expect(mockApp.uiController.settingsView.updateGoogleDriveUI).toHaveBeenCalled();
    });

    test('signOutGoogleDrive should handle null authService', () => {
        manager.authService = null;
        expect(() => manager.signOutGoogleDrive()).not.toThrow();
    });

    // ========== Availability Tests ==========

    test('isAvailable should return false when authService is null', () => {
        manager.authService = null;
        expect(manager.isAvailable()).toBe(false);
    });

    test('isAvailable should return true when authService exists', () => {
        manager.authService = {};
        expect(manager.isAvailable()).toBe(true);
    });

    test('isAuthenticated should return false when authService is null', () => {
        manager.authService = null;
        expect(manager.isAuthenticated()).toBe(false);
    });

    test('isAuthenticated should delegate to authService', () => {
        manager.authService = { isAuthenticated: jest.fn(() => true) };
        expect(manager.isAuthenticated()).toBe(true);
        expect(manager.authService.isAuthenticated).toHaveBeenCalled();
    });

    // ========== Sync Tests ==========

    test('syncWithGoogleDrive should show error when driveService is null', async () => {
        manager.driveService = null;
        await manager.syncWithGoogleDrive();
        expect(mockApp.errorHandler.error).toHaveBeenCalledWith('googleDrive.notConfigured', {});
    });

    test('syncWithGoogleDrive should show error when not authenticated', async () => {
        manager.authService = { isAuthenticated: jest.fn(() => false) };
        manager.driveService = {};

        await manager.syncWithGoogleDrive();

        expect(mockApp.errorHandler.error).toHaveBeenCalledWith(
            'googleDrive.authError',
            { message: 'Not authenticated' }
        );
    });

    test('syncWithGoogleDrive should skip if already syncing', async () => {
        manager.authService = { isAuthenticated: jest.fn(() => true) };
        manager.driveService = { downloadData: jest.fn() };
        manager._isSyncing = true;

        await manager.syncWithGoogleDrive();

        expect(manager.driveService.downloadData).not.toHaveBeenCalled();
    });

    test('syncWithGoogleDrive should handle GoogleDriveFileNotFoundError', async () => {
        manager.authService = {
            isAuthenticated: jest.fn(() => true),
            ensureAuthenticated: jest.fn()
        };
        manager.driveService = {
            downloadData: jest.fn(() => Promise.reject(new GoogleDriveFileNotFoundError())),
            uploadData: jest.fn(() => Promise.resolve())
        };
        mockApp.goalService.goals = [];
        globalThis.localStorage.getItem.mockReturnValue(null);

        await manager.syncWithGoogleDrive({ background: false });

        expect(mockApp.uiController.settingsView.showGoogleDriveStatus).toHaveBeenCalledWith('No remote', false);
        expect(manager.driveService.uploadData).toHaveBeenCalled();
    });

    // ========== Download Tests ==========

    test('downloadFromGoogleDrive should return early when not authenticated', async () => {
        manager.authService = { isAuthenticated: jest.fn(() => false) };

        await manager.downloadFromGoogleDrive();

        expect(mockApp.applyImportedPayload).not.toHaveBeenCalled();
    });

    test('downloadFromGoogleDrive should handle same version', async () => {
        const data = {
            version: GOAL_FILE_VERSION,
            goals: [{ id: '1', title: 'Test' }]
        };
        manager.authService = { isAuthenticated: jest.fn(() => true) };
        manager.driveService = {
            downloadData: jest.fn(() => Promise.resolve({ data }))
        };

        await manager.downloadFromGoogleDrive();

        expect(mockApp.applyImportedPayload).toHaveBeenCalledWith(data);
        expect(mockApp.uiController.settingsView.showGoogleDriveStatus).toHaveBeenCalledWith('Download success', false);
    });

    test('downloadFromGoogleDrive should handle newer version', async () => {
        const data = { version: '2.0.0', goals: [] };
        manager.authService = { isAuthenticated: jest.fn(() => true) };
        manager.driveService = {
            downloadData: jest.fn(() => Promise.resolve({ data }))
        };

        await manager.downloadFromGoogleDrive();

        expect(mockApp.errorHandler.error).toHaveBeenCalledWith('import.versionTooNew', {
            fileVersion: '2.0.0',
            currentVersion: GOAL_FILE_VERSION
        });
    });

    test('downloadFromGoogleDrive should handle download error', async () => {
        manager.authService = { isAuthenticated: jest.fn(() => true) };
        manager.driveService = {
            downloadData: jest.fn(() => Promise.reject(new Error('Network error')))
        };

        await manager.downloadFromGoogleDrive();

        expect(mockApp.errorHandler.error).toHaveBeenCalledWith(
            'googleDrive.downloadError',
            { message: 'Network error' },
            expect.any(Error)
        );
    });

    // ========== Storage Key Tests ==========

    test('getLastSyncStorageKey should use driveService fileId', () => {
        manager.driveService = { fileId: 'test-file-id' };
        const key = manager.getLastSyncStorageKey();
        expect(key).toBe('goaly_gdrive_last_sync_test-file-id');
    });

    test('getLastSyncStorageKey should use localStorage fileId as fallback', () => {
        manager.driveService = null;
        globalThis.localStorage.getItem.mockReturnValue('stored-file-id');
        const key = manager.getLastSyncStorageKey();
        expect(key).toBe('goaly_gdrive_last_sync_stored-file-id');
    });

    test('getLastSyncStorageKey should use unknown as final fallback', () => {
        manager.driveService = null;
        globalThis.localStorage.getItem.mockReturnValue(null);
        const key = manager.getLastSyncStorageKey();
        expect(key).toBe('goaly_gdrive_last_sync_unknown');
    });
});
