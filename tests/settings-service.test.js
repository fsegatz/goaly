// tests/settings-service.test.js

const SettingsService = require('../src/domain/services/settings-service').default;

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
        expect(settings.reviewIntervals).toEqual([7, 14, 30]);
        expect(settings.checkInInterval).toBeUndefined();
        expect(settings.checkInsEnabled).toBeUndefined();
    });

    it('should load settings from localStorage', () => {
        const savedSettings = { maxActiveGoals: 5, checkInInterval: 10, checkInsEnabled: false, language: 'de', reviewIntervals: [21, 14, 7] };
        localStorage.getItem.mockReturnValue(JSON.stringify(savedSettings));
        settingsService.loadSettings();
        const settings = settingsService.getSettings();
        expect(settings.maxActiveGoals).toBe(5);
        expect(settings.language).toBe('de');
        expect(settings.reviewIntervals).toEqual([7, 14, 21]);
        expect(settings.checkInInterval).toBeUndefined();
        expect(settings.checkInsEnabled).toBeUndefined();
    });

    it('should not change settings when localStorage is empty', () => {
        localStorage.getItem.mockReturnValue(null);
        const initialSettings = { ...settingsService.getSettings() };
        
        settingsService.loadSettings();
        
        // Settings should remain at defaults
        const currentSettings = settingsService.getSettings();
        expect(currentSettings.maxActiveGoals).toBe(initialSettings.maxActiveGoals);
        expect(currentSettings.reviewIntervals).toEqual(initialSettings.reviewIntervals);
    });

    it('should parse review intervals with time suffixes', () => {
        settingsService.updateSettings({ reviewIntervals: '2d, 12h, 45m, 30s' });
        const intervals = settingsService.getSettings().reviewIntervals;

        expect(intervals).toHaveLength(4);
        expect(intervals[0]).toBeCloseTo(30 / (24 * 60 * 60)); // 30 seconds
        expect(intervals[1]).toBeCloseTo(45 / (24 * 60)); // 45 minutes
        expect(intervals[2]).toBeCloseTo(0.5); // 12 hours
        expect(intervals[3]).toBeCloseTo(2); // 2 days
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

    it('should normalise review intervals on update', () => {
        settingsService.updateSettings({ reviewIntervals: '45, 10, 30, 10' });
        expect(settingsService.getSettings().reviewIntervals).toEqual([10, 30, 45]);
    });

    it('should fallback to defaults when no valid intervals provided', () => {
        settingsService.updateSettings({ reviewIntervals: 'invalid, xyz' });
        expect(settingsService.getSettings().reviewIntervals).toEqual([7, 14, 30]);
    });

    it('should fallback to defaults when intervals string only contains whitespace', () => {
        settingsService.updateSettings({ reviewIntervals: '    ' });
        expect(settingsService.getSettings().reviewIntervals).toEqual([7, 14, 30]);
    });

    it('should ignore non-positive interval values', () => {
        settingsService.updateSettings({ reviewIntervals: '0d, -3, 5' });
        expect(settingsService.getSettings().reviewIntervals).toEqual([5]);
    });

    it('should ignore intervals with unsupported units', () => {
        settingsService.updateSettings({ reviewIntervals: '5w, 10d' });
        expect(settingsService.getSettings().reviewIntervals).toEqual([10]);
    });

    it('should accept direct numeric interval inputs', () => {
        settingsService.updateSettings({ reviewIntervals: 21 });
        expect(settingsService.getSettings().reviewIntervals).toEqual([21]);
    });

    it('should handle numeric inputs and uppercase suffixes', () => {
        settingsService.updateSettings({ reviewIntervals: '1H, 0.5d, 90M, 45s' });
        const intervals = settingsService.getSettings().reviewIntervals;
        expect(intervals[0]).toBeCloseTo(45 / (24 * 60 * 60)); // 45 seconds
        expect(intervals[1]).toBeCloseTo(1 / 24); // 1 hour
        expect(intervals[2]).toBeCloseTo(90 / (24 * 60)); // 90 minutes
        expect(intervals[3]).toBeCloseTo(0.5); // half a day
    });

    it('should deduplicate equivalent intervals', () => {
        settingsService.updateSettings({ reviewIntervals: '60m, 1h, 3600s' });
        const intervals = settingsService.getSettings().reviewIntervals;
        expect(intervals).toHaveLength(1);
        expect(intervals[0]).toBeCloseTo(1 / 24);
    });

    it('should default language to en on load when missing', () => {
        const savedSettings = { language: '' };
        localStorage.getItem.mockReturnValue(JSON.stringify(savedSettings));

        settingsService.loadSettings();

        expect(settingsService.getSettings().language).toBe('en');
    });

    it('should default language to en on update when missing', () => {
        settingsService.updateSettings({ language: '' });
        expect(settingsService.getSettings().language).toBe('en');
    });
});
