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
});

