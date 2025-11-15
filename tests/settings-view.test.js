const { JSDOM } = require('jsdom');
const { SettingsView } = require('../src/ui/desktop/settings-view.js');
const LanguageService = require('../src/domain/language-service').default;

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
        startCheckInTimer: jest.fn(),
    };

    settingsView = new SettingsView(mockApp);
    settingsView.initializeLanguageControls();
});

afterEach(() => {
    delete global.document;
    delete global.window;
    jest.restoreAllMocks();
});

describe('SettingsView', () => {
    test('exportBtn click should call app.exportData', () => {
        const renderViews = jest.fn();
        const startCheckInTimer = jest.fn();
        settingsView.setupEventListeners(renderViews, startCheckInTimer);

        document.getElementById('exportBtn').click();
        expect(mockApp.exportData).toHaveBeenCalled();
    });

    test('importBtn click should trigger importFile click', () => {
        const importFile = document.getElementById('importFile');
        importFile.click = jest.fn();
        const renderViews = jest.fn();
        const startCheckInTimer = jest.fn();
        settingsView.setupEventListeners(renderViews, startCheckInTimer);

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
        const startCheckInTimer = jest.fn();
        settingsView.setupEventListeners(renderViews, startCheckInTimer);

        importFile.dispatchEvent(new dom.window.Event('change'));
        expect(mockApp.importData).toHaveBeenCalledWith(mockFile);
        expect(importFile.value).toBe('');
    });

    test('saveSettingsBtn click should update settings, start check-in timer, and call renderViews', () => {
        document.getElementById('maxActiveGoals').value = '5';
        document.getElementById('reviewIntervals').value = '45, 15, 7';
        mockSettingsService.getSettings.mockReturnValue({ maxActiveGoals: 3, language: 'en', reviewIntervals: [30, 14, 7] });
        const renderViews = jest.fn();
        const startCheckInTimer = jest.fn();
        settingsView.setupEventListeners(renderViews, startCheckInTimer);

        document.getElementById('saveSettingsBtn').click();

        expect(mockSettingsService.updateSettings).toHaveBeenCalledWith({
            maxActiveGoals: 5,
            language: 'en',
            reviewIntervals: '45, 15, 7'
        });
        expect(mockApp.goalService.autoActivateGoalsByPriority).toHaveBeenCalledWith(5);
        expect(startCheckInTimer).toHaveBeenCalled();
        expect(renderViews).toHaveBeenCalled();
    });

    test('saveSettingsBtn click should not call autoActivateGoalsByPriority when maxActiveGoals unchanged', () => {
        document.getElementById('maxActiveGoals').value = '3';
        document.getElementById('reviewIntervals').value = '30, 14, 7';
        mockSettingsService.getSettings.mockReturnValue({ maxActiveGoals: 3, language: 'en', reviewIntervals: [30, 14, 7] });
        const renderViews = jest.fn();
        const startCheckInTimer = jest.fn();
        settingsView.setupEventListeners(renderViews, startCheckInTimer);

        document.getElementById('saveSettingsBtn').click();

        expect(mockSettingsService.updateSettings).toHaveBeenCalled();
        expect(mockApp.goalService.autoActivateGoalsByPriority).not.toHaveBeenCalled();
        expect(startCheckInTimer).toHaveBeenCalled();
        expect(renderViews).toHaveBeenCalled();
    });

    test('syncSettingsForm should handle missing elements gracefully', () => {
        document.getElementById('maxActiveGoals').remove();
        document.getElementById('reviewIntervals').remove();
        document.getElementById('languageSelect').remove();

        expect(() => settingsView.syncSettingsForm()).not.toThrow();
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

    test('updateGoogleDriveUI should handle when googleDriveSyncService is not available', () => {
        mockApp.googleDriveSyncService = null;
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

        mockApp.googleDriveSyncService = {
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

        mockApp.googleDriveSyncService = {
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
});

