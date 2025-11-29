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

    it('onAfterSave should register listener', () => {
        const listener = jest.fn();
        settingsService.onAfterSave(listener);
        
        settingsService.updateSettings({ maxActiveGoals: 5 });
        
        expect(listener).toHaveBeenCalled();
    });

    it('onAfterSave should ignore non-function listeners', () => {
        settingsService.onAfterSave('not a function');
        settingsService.onAfterSave(null);
        settingsService.onAfterSave(undefined);
        settingsService.onAfterSave({});
        
        // Should not throw
        expect(() => settingsService.updateSettings({ maxActiveGoals: 5 })).not.toThrow();
    });

    it('onAfterSave should call all registered listeners', () => {
        const listener1 = jest.fn();
        const listener2 = jest.fn();
        
        settingsService.onAfterSave(listener1);
        settingsService.onAfterSave(listener2);
        
        settingsService.updateSettings({ maxActiveGoals: 5 });
        
        expect(listener1).toHaveBeenCalled();
        expect(listener2).toHaveBeenCalled();
    });

    it('onAfterSave should handle listener errors gracefully', () => {
        const goodListener = jest.fn();
        const badListener = jest.fn(() => {
            throw new Error('Listener error');
        });
        const anotherGoodListener = jest.fn();
        
        global.console.error = jest.fn();
        
        settingsService.onAfterSave(goodListener);
        settingsService.onAfterSave(badListener);
        settingsService.onAfterSave(anotherGoodListener);
        
        settingsService.updateSettings({ maxActiveGoals: 5 });
        
        expect(goodListener).toHaveBeenCalled();
        expect(badListener).toHaveBeenCalled();
        expect(anotherGoodListener).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalled();
    });

    it('onAfterSave should return unsubscribe function', () => {
        const listener = jest.fn();
        const unsubscribe = settingsService.onAfterSave(listener);
        
        expect(typeof unsubscribe).toBe('function');
    });

    it('onAfterSave unsubscribe function should remove listener', () => {
        const listener = jest.fn();
        const unsubscribe = settingsService.onAfterSave(listener);
        
        settingsService.updateSettings({ maxActiveGoals: 5 });
        expect(listener).toHaveBeenCalledTimes(1);
        
        unsubscribe();
        
        settingsService.updateSettings({ maxActiveGoals: 3 });
        expect(listener).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('onAfterSave should handle unsubscribe during notification', () => {
        const listener1 = jest.fn();
        const listener2 = jest.fn(() => {
            unsubscribe1(); // Unsubscribe listener1 during notification
        });
        const listener3 = jest.fn();
        
        const unsubscribe1 = settingsService.onAfterSave(listener1);
        settingsService.onAfterSave(listener2);
        settingsService.onAfterSave(listener3);
        
        settingsService.updateSettings({ maxActiveGoals: 5 });
        
        // All listeners should be called, even if one unsubscribes another
        expect(listener1).toHaveBeenCalled();
        expect(listener2).toHaveBeenCalled();
        expect(listener3).toHaveBeenCalled();
        
        // listener1 should not be called on next update since it was unsubscribed
        settingsService.updateSettings({ maxActiveGoals: 7 });
        expect(listener1).toHaveBeenCalledTimes(1); // Still only called once
        expect(listener2).toHaveBeenCalledTimes(2);
        expect(listener3).toHaveBeenCalledTimes(2);
    });

    it('onAfterSave should return no-op for invalid listeners', () => {
        const unsubscribe1 = settingsService.onAfterSave('not a function');
        const unsubscribe2 = settingsService.onAfterSave(null);
        const unsubscribe3 = settingsService.onAfterSave(undefined);
        const unsubscribe4 = settingsService.onAfterSave({});
        
        expect(typeof unsubscribe1).toBe('function');
        expect(typeof unsubscribe2).toBe('function');
        expect(typeof unsubscribe3).toBe('function');
        expect(typeof unsubscribe4).toBe('function');
        
        // Calling unsubscribe should not throw
        expect(() => unsubscribe1()).not.toThrow();
        expect(() => unsubscribe2()).not.toThrow();
        expect(() => unsubscribe3()).not.toThrow();
        expect(() => unsubscribe4()).not.toThrow();
    });
});
