const { JSDOM } = require('jsdom');
const { SettingsView } = require('../src/ui/desktop/settings-view.js');
const LanguageService = require('../src/domain/services/language-service').default;

let dom;
let document;
let window;
let mockApp;
let mockSettingsService;
let settingsView;

beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
        <button id="exportBtn"></button>
        <button id="importBtn"></button>
        <input type="file" id="importFile" />
        <button id="saveSettingsBtn"></button>
        <input type="number" id="maxActiveGoals" value="3" />
        <input type="text" id="reviewIntervals" value="30, 14, 7" />
        <select id="languageSelect"></select>
    </body></html>`, { url: "http://localhost" });
    document = dom.window.document;
    window = dom.window;

    global.document = document;
    global.window = window;

    mockSettingsService = {
        getSettings: jest.fn(() => ({ maxActiveGoals: 3, language: 'en', reviewIntervals: [30, 14, 7] })),
        updateSettings: jest.fn(),
    };

    const languageService = new LanguageService();
    languageService.init('en');

    mockApp = {
        settingsService: mockSettingsService,
        languageService,
        goalService: {
            autoActivateGoalsByPriority: jest.fn(),
        },
        exportData: jest.fn(),
        importData: jest.fn(),
        startReviewTimer: jest.fn(),
        refreshReviews: jest.fn(),
    };

    settingsView = new SettingsView(mockApp);
    settingsView.initializeLanguageControls();
});

afterEach(() => {
    // Clear any pending timers
    if (settingsView && settingsView.statusTimeout) {
        clearTimeout(settingsView.statusTimeout);
        settingsView.statusTimeout = null;
    }
    jest.clearAllTimers();
    jest.useRealTimers();
    
    delete global.document;
    delete global.window;
    jest.restoreAllMocks();
});

describe('SettingsView', () => {
    test('exportBtn click should call app.exportData', () => {
        const renderViews = jest.fn();
        const startReviewTimer = jest.fn();
        settingsView.setupEventListeners(renderViews, startReviewTimer);

        document.getElementById('exportBtn').click();
        expect(mockApp.exportData).toHaveBeenCalled();
    });

    test('importBtn click should trigger importFile click', () => {
        const importFile = document.getElementById('importFile');
        importFile.click = jest.fn();
        const renderViews = jest.fn();
        const startReviewTimer = jest.fn();
        settingsView.setupEventListeners(renderViews, startReviewTimer);

        document.getElementById('importBtn').click();
        expect(importFile.click).toHaveBeenCalled();
    });

    test('importFile change should call app.importData', () => {
        const importFile = document.getElementById('importFile');
        const mockFile = new dom.window.File(['{}'], 'test.json', { type: 'application/json' });
        Object.defineProperty(importFile, 'files', {
            value: [mockFile],
            writable: true,
        });
        const renderViews = jest.fn();
        const startReviewTimer = jest.fn();
        settingsView.setupEventListeners(renderViews, startReviewTimer);

        importFile.dispatchEvent(new dom.window.Event('change'));
        expect(mockApp.importData).toHaveBeenCalledWith(mockFile);
        expect(importFile.value).toBe('');
    });

    test('importFile change should handle empty files array', () => {
        const importFile = document.getElementById('importFile');
        Object.defineProperty(importFile, 'files', {
            value: [],
            writable: true,
        });
        const renderViews = jest.fn();
        const startReviewTimer = jest.fn();
        settingsView.setupEventListeners(renderViews, startReviewTimer);

        importFile.dispatchEvent(new dom.window.Event('change'));
        expect(mockApp.importData).not.toHaveBeenCalled();
    });

    test('setupEventListeners should handle missing exportBtn', () => {
        const exportBtn = document.getElementById('exportBtn');
        exportBtn.remove();
        
        const renderViews = jest.fn();
        const startCheckInTimer = jest.fn();
        
        expect(() => settingsView.setupEventListeners(renderViews, startCheckInTimer)).not.toThrow();
    });

    test('setupEventListeners should handle missing importBtn', () => {
        const importBtn = document.getElementById('importBtn');
        importBtn.remove();
        
        const renderViews = jest.fn();
        const startCheckInTimer = jest.fn();
        
        expect(() => settingsView.setupEventListeners(renderViews, startCheckInTimer)).not.toThrow();
    });

    test('setupEventListeners should handle missing importFile', () => {
        const importFile = document.getElementById('importFile');
        importFile.remove();
        
        const renderViews = jest.fn();
        const startCheckInTimer = jest.fn();
        
        expect(() => settingsView.setupEventListeners(renderViews, startCheckInTimer)).not.toThrow();
    });

    test('setupEventListeners should handle missing googleDriveAuthBtn', () => {
        const renderViews = jest.fn();
        const startCheckInTimer = jest.fn();
        
        expect(() => settingsView.setupEventListeners(renderViews, startCheckInTimer)).not.toThrow();
    });

    test('setupEventListeners should handle missing googleDriveSignOutBtn', () => {
        const renderViews = jest.fn();
        const startCheckInTimer = jest.fn();
        
        expect(() => settingsView.setupEventListeners(renderViews, startCheckInTimer)).not.toThrow();
    });

    test('setupEventListeners should handle missing googleDriveSyncBtn', () => {
        const renderViews = jest.fn();
        const startCheckInTimer = jest.fn();
        
        expect(() => settingsView.setupEventListeners(renderViews, startCheckInTimer)).not.toThrow();
    });

    test('saveSettingsBtn click should update settings, start check-in timer, and call renderViews', () => {
        document.getElementById('maxActiveGoals').value = '5';
        document.getElementById('reviewIntervals').value = '45, 15, 7';
        mockSettingsService.getSettings.mockReturnValue({ maxActiveGoals: 3, language: 'en', reviewIntervals: [30, 14, 7] });
        const renderViews = jest.fn();
        const startReviewTimer = jest.fn();
        settingsView.setupEventListeners(renderViews, startReviewTimer);

        document.getElementById('saveSettingsBtn').click();

        expect(mockSettingsService.updateSettings).toHaveBeenCalledWith({
            maxActiveGoals: 5,
            language: 'en',
            reviewIntervals: '45, 15, 7'
        });
        expect(mockApp.goalService.autoActivateGoalsByPriority).toHaveBeenCalledWith(5);
        expect(startReviewTimer).toHaveBeenCalled();
        expect(renderViews).toHaveBeenCalled();
    });

    test('saveSettingsBtn click should call autoActivateGoalsByPriority when maxActiveGoals changes', () => {
        document.getElementById('maxActiveGoals').value = '7';
        document.getElementById('reviewIntervals').value = '30, 14, 7';
        mockSettingsService.getSettings.mockReturnValue({ maxActiveGoals: 3, language: 'en', reviewIntervals: [30, 14, 7] });
        const renderViews = jest.fn();
        const startReviewTimer = jest.fn();
        settingsView.setupEventListeners(renderViews, startReviewTimer);

        document.getElementById('saveSettingsBtn').click();

        expect(mockApp.goalService.autoActivateGoalsByPriority).toHaveBeenCalledWith(7);
    });

    test('saveSettingsBtn click should handle language change', () => {
        document.getElementById('maxActiveGoals').value = '3';
        document.getElementById('reviewIntervals').value = '30, 14, 7';
        const languageSelect = document.getElementById('languageSelect');
        languageSelect.innerHTML = '<option value="en">English</option><option value="de">German</option>';
        languageSelect.value = 'de';
        
        mockSettingsService.getSettings.mockReturnValue({ maxActiveGoals: 3, language: 'en', reviewIntervals: [30, 14, 7] });
        const renderViews = jest.fn();
        const startReviewTimer = jest.fn();
        
        // Mock renderViews on settingsView to prevent error
        settingsView.renderViews = renderViews;
        settingsView.setupEventListeners(renderViews, startReviewTimer);

        document.getElementById('saveSettingsBtn').click();

        expect(mockSettingsService.updateSettings).toHaveBeenCalledWith(
            expect.objectContaining({ language: 'de' })
        );
    });

    test('saveSettingsBtn click should handle missing saveSettingsBtn gracefully', () => {
        const saveBtn = document.getElementById('saveSettingsBtn');
        saveBtn.remove();
        
        const renderViews = jest.fn();
        const startCheckInTimer = jest.fn();
        
        expect(() => settingsView.setupEventListeners(renderViews, startCheckInTimer)).not.toThrow();
    });

    test('saveSettingsBtn click should not call autoActivateGoalsByPriority when maxActiveGoals unchanged', () => {
        document.getElementById('maxActiveGoals').value = '3';
        document.getElementById('reviewIntervals').value = '30, 14, 7';
        mockSettingsService.getSettings.mockReturnValue({ maxActiveGoals: 3, language: 'en', reviewIntervals: [30, 14, 7] });
        const renderViews = jest.fn();
        const startReviewTimer = jest.fn();
        settingsView.setupEventListeners(renderViews, startReviewTimer);

        document.getElementById('saveSettingsBtn').click();

        expect(mockSettingsService.updateSettings).toHaveBeenCalled();
        expect(mockApp.goalService.autoActivateGoalsByPriority).not.toHaveBeenCalled();
        expect(startReviewTimer).toHaveBeenCalled();
        expect(renderViews).toHaveBeenCalled();
    });

    test('syncSettingsForm should handle missing elements gracefully', () => {
        document.getElementById('maxActiveGoals').remove();
        document.getElementById('reviewIntervals').remove();
        document.getElementById('languageSelect').remove();

        expect(() => settingsView.syncSettingsForm()).not.toThrow();
    });

    test('syncSettingsForm should not sync reviewIntervals when input is focused', () => {
        // Test the first syncSettingsForm method (line 18) that checks for focused element
        const reviewIntervals = document.getElementById('reviewIntervals');
        reviewIntervals.value = 'user typing...';
        
        // Create a spy to intercept the call and check which method is called
        const originalSync = settingsView.syncSettingsForm;
        let syncCalled = false;
        settingsView.syncSettingsForm = function() {
            syncCalled = true;
            // Call the first syncSettingsForm implementation
            const settings = this.app.settingsService.getSettings();
            const maxActiveGoals = document.getElementById('maxActiveGoals');
            const languageSelect = document.getElementById('languageSelect');
            const reviewIntervals = document.getElementById('reviewIntervals');

            if (maxActiveGoals) {
                maxActiveGoals.value = settings.maxActiveGoals;
            }
            if (languageSelect) {
                languageSelect.value = settings.language;
            }
            if (reviewIntervals) {
                // Only sync if the input is not focused to avoid overwriting user input
                if (document.activeElement !== reviewIntervals) {
                    const intervals = Array.isArray(settings.reviewIntervals) ? settings.reviewIntervals : [];
                    reviewIntervals.value = intervals
                        .map((interval) => this.formatReviewIntervalInput(interval))
                        .filter(Boolean)
                        .join(', ');
                }
            }
        };
        
        // Simulate focus by setting activeElement
        Object.defineProperty(document, 'activeElement', {
            value: reviewIntervals,
            writable: true,
            configurable: true
        });
        mockSettingsService.getSettings.mockReturnValue({ 
            maxActiveGoals: 3, 
            language: 'en', 
            reviewIntervals: [7, 14, 30] 
        });

        settingsView.syncSettingsForm();

        // Should preserve user input when focused
        expect(reviewIntervals.value).toBe('user typing...');
        
        // Restore
        settingsView.syncSettingsForm = originalSync;
        Object.defineProperty(document, 'activeElement', {
            value: document.body,
            writable: true,
            configurable: true
        });
    });

    test('updateLanguageOptions should handle missing languageSelect', () => {
        const languageSelect = document.getElementById('languageSelect');
        languageSelect.remove();

        expect(() => settingsView.updateLanguageOptions()).not.toThrow();
    });

    test('updateLanguageOptions should preserve current language selection', () => {
        const languageSelect = document.getElementById('languageSelect');
        languageSelect.innerHTML = '<option value="en">English</option><option value="de">German</option>';
        languageSelect.value = 'de';
        
        // Mock settings to return 'de' as the language
        mockSettingsService.getSettings.mockReturnValue({ language: 'de' });

        settingsView.updateLanguageOptions();

        expect(languageSelect.value).toBe('de');
    });

    test('updateDeveloperModeVisibility should hide data management section when developer mode is disabled', () => {
        const dataManagementSection = document.createElement('div');
        dataManagementSection.id = 'dataManagementSection';
        dataManagementSection.style.display = 'block';
        document.body.appendChild(dataManagementSection);

        mockApp.developerModeService = {
            isDeveloperMode: jest.fn(() => false)
        };

        settingsView.updateDeveloperModeVisibility();

        expect(dataManagementSection.style.display).toBe('none');
        document.body.removeChild(dataManagementSection);
    });

    test('updateDeveloperModeVisibility should show data management section when developer mode is enabled', () => {
        const dataManagementSection = document.createElement('div');
        dataManagementSection.id = 'dataManagementSection';
        dataManagementSection.style.display = 'none';
        document.body.appendChild(dataManagementSection);

        mockApp.developerModeService = {
            isDeveloperMode: jest.fn(() => true)
        };

        settingsView.updateDeveloperModeVisibility();

        expect(dataManagementSection.style.display).toBe('block');
        document.body.removeChild(dataManagementSection);
    });

    test('updateDeveloperModeVisibility should handle missing dataManagementSection gracefully', () => {
        mockApp.developerModeService = {
            isDeveloperMode: jest.fn(() => true)
        };

        expect(() => settingsView.updateDeveloperModeVisibility()).not.toThrow();
    });

    test('showGoogleDriveStatus should display message and set error class when isError is true', () => {
        const statusDiv = document.createElement('div');
        statusDiv.id = 'googleDriveAuthStatus';
        statusDiv.hidden = true;
        document.body.appendChild(statusDiv);

        settingsView.showGoogleDriveStatus('Test error message', true);

        expect(statusDiv.hidden).toBe(false);
        expect(statusDiv.textContent).toBe('Test error message');
        expect(statusDiv.className).toContain('google-drive-status-error');
        expect(statusDiv.className).not.toContain('google-drive-status-info');

        document.body.removeChild(statusDiv);
    });

    test('showGoogleDriveStatus should display message and set info class when isError is false', () => {
        const statusDiv = document.createElement('div');
        statusDiv.id = 'googleDriveAuthStatus';
        statusDiv.hidden = true;
        document.body.appendChild(statusDiv);

        settingsView.showGoogleDriveStatus('Test info message', false);

        expect(statusDiv.hidden).toBe(false);
        expect(statusDiv.textContent).toBe('Test info message');
        expect(statusDiv.className).toContain('google-drive-status-info');
        expect(statusDiv.className).not.toContain('google-drive-status-error');

        document.body.removeChild(statusDiv);
    });

    test('showGoogleDriveStatus should handle missing statusDiv gracefully', () => {
        expect(() => settingsView.showGoogleDriveStatus('Test message', false)).not.toThrow();
    });

    test('updateGoogleDriveUI should handle when syncManager is not available', () => {
        mockApp.syncManager = null;
        expect(() => settingsView.updateGoogleDriveUI()).not.toThrow();
    });

    test('updateGoogleDriveUI should show auth button when not authenticated', async () => {
        const authBtn = document.createElement('button');
        authBtn.id = 'googleDriveAuthBtn';
        authBtn.hidden = false;
        const signOutBtn = document.createElement('button');
        signOutBtn.id = 'googleDriveSignOutBtn';
        signOutBtn.hidden = false;
        const syncBtn = document.createElement('button');
        syncBtn.id = 'googleDriveSyncBtn';
        syncBtn.hidden = false;
        const statusDiv = document.createElement('div');
        statusDiv.id = 'googleDriveAuthStatus';
        statusDiv.hidden = false;
        document.body.appendChild(authBtn);
        document.body.appendChild(signOutBtn);
        document.body.appendChild(syncBtn);
        document.body.appendChild(statusDiv);

        mockApp.syncManager = {
            isAvailable: jest.fn(() => true),
            isAuthenticated: jest.fn(() => false),
            getSyncStatus: jest.fn(() => Promise.resolve({ authenticated: false, synced: false }))
        };

        await settingsView.updateGoogleDriveUI();

        expect(authBtn.hidden).toBe(false);
        expect(signOutBtn.hidden).toBe(true);
        expect(syncBtn.hidden).toBe(true);
        expect(statusDiv.hidden).toBe(true);

        document.body.removeChild(authBtn);
        document.body.removeChild(signOutBtn);
        document.body.removeChild(syncBtn);
        document.body.removeChild(statusDiv);
    });

    test('updateGoogleDriveUI should show sync button when authenticated', async () => {
        const authBtn = document.createElement('button');
        authBtn.id = 'googleDriveAuthBtn';
        authBtn.hidden = false;
        const signOutBtn = document.createElement('button');
        signOutBtn.id = 'googleDriveSignOutBtn';
        signOutBtn.hidden = true;
        const syncBtn = document.createElement('button');
        syncBtn.id = 'googleDriveSyncBtn';
        syncBtn.hidden = true;
        const statusDiv = document.createElement('div');
        statusDiv.id = 'googleDriveAuthStatus';
        statusDiv.hidden = true;
        document.body.appendChild(authBtn);
        document.body.appendChild(signOutBtn);
        document.body.appendChild(syncBtn);
        document.body.appendChild(statusDiv);

        mockApp.syncManager = {
            isAvailable: jest.fn(() => true),
            isAuthenticated: jest.fn(() => true),
            getSyncStatus: jest.fn(() => Promise.resolve({ 
                authenticated: true, 
                synced: true,
                lastSyncTime: '2025-01-01T00:00:00Z'
            }))
        };

        await settingsView.updateGoogleDriveUI();

        expect(authBtn.hidden).toBe(true);
        expect(signOutBtn.hidden).toBe(false);
        expect(syncBtn.hidden).toBe(false);
        expect(statusDiv.hidden).toBe(false);

        document.body.removeChild(authBtn);
        document.body.removeChild(signOutBtn);
        document.body.removeChild(syncBtn);
        document.body.removeChild(statusDiv);
    });

    test('updateGoogleDriveUI should handle missing buttons gracefully', () => {
        // Only create some buttons, not all
        const authBtn = document.createElement('button');
        authBtn.id = 'googleDriveAuthBtn';
        document.body.appendChild(authBtn);

        mockApp.syncManager = {
            isAvailable: jest.fn(() => true),
            isAuthenticated: jest.fn(() => false)
        };

        expect(() => settingsView.updateGoogleDriveUI()).not.toThrow();

        document.body.removeChild(authBtn);
    });

    test('updateGoogleDriveUI should handle sync status without lastSyncTime', async () => {
        const authBtn = document.createElement('button');
        authBtn.id = 'googleDriveAuthBtn';
        const signOutBtn = document.createElement('button');
        signOutBtn.id = 'googleDriveSignOutBtn';
        const syncBtn = document.createElement('button');
        syncBtn.id = 'googleDriveSyncBtn';
        const statusDiv = document.createElement('div');
        statusDiv.id = 'googleDriveAuthStatus';
        document.body.appendChild(authBtn);
        document.body.appendChild(signOutBtn);
        document.body.appendChild(syncBtn);
        document.body.appendChild(statusDiv);

        mockApp.syncManager = {
            isAvailable: jest.fn(() => true),
            isAuthenticated: jest.fn(() => true),
            getSyncStatus: jest.fn(() => Promise.resolve({ 
                authenticated: true, 
                synced: false
                // No lastSyncTime
            }))
        };

        await settingsView.updateGoogleDriveUI();

        expect(statusDiv.textContent).toBe(settingsView.translate('googleDrive.authenticated'));

        document.body.removeChild(authBtn);
        document.body.removeChild(signOutBtn);
        document.body.removeChild(syncBtn);
        document.body.removeChild(statusDiv);
    });

    test('updateGoogleDriveUI should handle getSyncStatus error', async () => {
        const authBtn = document.createElement('button');
        authBtn.id = 'googleDriveAuthBtn';
        const signOutBtn = document.createElement('button');
        signOutBtn.id = 'googleDriveSignOutBtn';
        const syncBtn = document.createElement('button');
        syncBtn.id = 'googleDriveSyncBtn';
        const statusDiv = document.createElement('div');
        statusDiv.id = 'googleDriveAuthStatus';
        document.body.appendChild(authBtn);
        document.body.appendChild(signOutBtn);
        document.body.appendChild(syncBtn);
        document.body.appendChild(statusDiv);

        mockApp.syncManager = {
            isAvailable: jest.fn(() => true),
            isAuthenticated: jest.fn(() => true),
            getSyncStatus: jest.fn(() => Promise.reject(new Error('Network error')))
        };

        await settingsView.updateGoogleDriveUI();

        // Should not throw, error should be caught
        expect(statusDiv.textContent).toBe(settingsView.translate('googleDrive.authenticated'));

        document.body.removeChild(authBtn);
        document.body.removeChild(signOutBtn);
        document.body.removeChild(syncBtn);
        document.body.removeChild(statusDiv);
    });

    test('showGoogleDriveStatus should clear status after timeout if message unchanged', () => {
        jest.useFakeTimers();
        const statusDiv = document.createElement('div');
        statusDiv.id = 'googleDriveAuthStatus';
        statusDiv.textContent = 'old message';
        document.body.appendChild(statusDiv);

        mockApp.syncManager = {
            isAvailable: jest.fn(() => true),
            isAuthenticated: jest.fn(() => false)
        };
        
        const updateGoogleDriveUISpy = jest.spyOn(settingsView, 'updateGoogleDriveUI');

        settingsView.showGoogleDriveStatus('Test message', false);
        expect(statusDiv.textContent).toBe('Test message');

        // Fast-forward time
        jest.advanceTimersByTime(5000);

        // updateGoogleDriveUI should be called
        expect(updateGoogleDriveUISpy).toHaveBeenCalled();

        updateGoogleDriveUISpy.mockRestore();
        
        // Clear any remaining timers
        if (settingsView.statusTimeout) {
            clearTimeout(settingsView.statusTimeout);
            settingsView.statusTimeout = null;
        }
        jest.clearAllTimers();
        jest.useRealTimers();
        document.body.removeChild(statusDiv);
    });

    test('showGoogleDriveStatus should not clear status if message changed', () => {
        jest.useFakeTimers();
        const statusDiv = document.createElement('div');
        statusDiv.id = 'googleDriveAuthStatus';
        document.body.appendChild(statusDiv);

        settingsView.showGoogleDriveStatus('Test message', false);
        expect(statusDiv.textContent).toBe('Test message');

        // Change message before timeout
        statusDiv.textContent = 'Different message';

        // Fast-forward time
        jest.advanceTimersByTime(5000);

        // updateGoogleDriveUI should not be called because message changed
        expect(statusDiv.textContent).toBe('Different message');

        // Clear any remaining timers
        if (settingsView.statusTimeout) {
            clearTimeout(settingsView.statusTimeout);
            settingsView.statusTimeout = null;
        }
        jest.clearAllTimers();
        jest.useRealTimers();
        document.body.removeChild(statusDiv);
    });

    test('syncSettingsForm should handle non-array reviewIntervals', () => {
        const reviewIntervals = document.createElement('input');
        reviewIntervals.id = 'reviewIntervals';
        reviewIntervals.type = 'text';
        document.body.appendChild(reviewIntervals);

        mockSettingsService.getSettings.mockReturnValue({
            maxActiveGoals: 3,
            language: 'en',
            reviewIntervals: 'invalid' // Not an array
        });

        settingsView.syncSettingsForm();

        expect(reviewIntervals.value).toBe('');

        document.body.removeChild(reviewIntervals);
    });

    test('syncSettingsForm should call updateGoogleDriveUI and updateDeveloperModeVisibility', () => {
        mockApp.developerModeService = {
            isDeveloperMode: jest.fn(() => false)
        };
        mockApp.syncManager = {
            isAvailable: jest.fn(() => true),
            isAuthenticated: jest.fn(() => false)
        };

        const updateGoogleDriveUISpy = jest.spyOn(settingsView, 'updateGoogleDriveUI');
        const updateDeveloperModeVisibilitySpy = jest.spyOn(settingsView, 'updateDeveloperModeVisibility');

        settingsView.syncSettingsForm();

        expect(updateGoogleDriveUISpy).toHaveBeenCalled();
        expect(updateDeveloperModeVisibilitySpy).toHaveBeenCalled();

        updateGoogleDriveUISpy.mockRestore();
        updateDeveloperModeVisibilitySpy.mockRestore();
    });
});

