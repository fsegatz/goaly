// tests/settings-service.test.js

const SettingsService = require('../src/domain/settings-service').default;

describe('Settings Service', () => {
    let settingsService;

    beforeEach(() => {
        // Mock localStorage
        global.localStorage = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            clear: jest.fn()
        };
        settingsService = new SettingsService();
    });

    it('should load default settings', () => {
        const settings = settingsService.getSettings();
        expect(settings.maxActiveGoals).toBe(3);
        expect(settings.checkInInterval).toBe(1);
        expect(settings.checkInsEnabled).toBe(true);
    });

    it('should load settings from localStorage', () => {
        const savedSettings = { maxActiveGoals: 5, checkInInterval: 10, checkInsEnabled: false };
        localStorage.getItem.mockReturnValue(JSON.stringify(savedSettings));
        settingsService.loadSettings();
        const settings = settingsService.getSettings();
        expect(settings.maxActiveGoals).toBe(5);
        expect(settings.checkInInterval).toBe(10);
        expect(settings.checkInsEnabled).toBe(false);
    });

    it('should not change settings when localStorage is empty', () => {
        localStorage.getItem.mockReturnValue(null);
        const initialSettings = { ...settingsService.getSettings() };
        
        settingsService.loadSettings();
        
        // Settings should remain at defaults
        expect(settingsService.getSettings().maxActiveGoals).toBe(initialSettings.maxActiveGoals);
        expect(settingsService.getSettings().checkInInterval).toBe(initialSettings.checkInInterval);
    });

    it('should save settings to localStorage', () => {
        const newSettings = { maxActiveGoals: 10 };
        settingsService.updateSettings(newSettings);
        expect(localStorage.setItem).toHaveBeenCalledWith('goaly_settings', JSON.stringify(settingsService.getSettings()));
    });

    it('should update settings', () => {
        settingsService.updateSettings({ maxActiveGoals: 5 });
        const settings = settingsService.getSettings();
        expect(settings.maxActiveGoals).toBe(5);
    });
});
