// src/domain/settings-service.js

class SettingsService {
    constructor(settings) {
        this.settings = settings || {
            maxActiveGoals: 3,
            checkInInterval: 1, // minutes for dev testing
            checkInsEnabled: true
        };
    }

    loadSettings() {
        const saved = localStorage.getItem('goaly_settings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
    }

    saveSettings() {
        localStorage.setItem('goaly_settings', JSON.stringify(this.settings));
    }

    getSettings() {
        return this.settings;
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
    }
}

export default SettingsService;
