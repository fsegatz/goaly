// src/domain/settings-service.js

const FALLBACK_REVIEW_INTERVALS = [7, 14, 30];
const INTERVAL_PRECISION = 6;

function parseIntervalToken(rawValue) {
    if (rawValue === null || rawValue === undefined) {
        return null;
    }

    if (typeof rawValue === 'number' && Number.isFinite(rawValue) && rawValue > 0) {
        return rawValue;
    }

    if (typeof rawValue !== 'string') {
        return null;
    }

    const trimmed = rawValue.trim();
    if (!trimmed) {
        return null;
    }

    const match = trimmed.match(/^(\d+(?:\.\d+)?)([dhms]?)$/i);
    if (!match) {
        return null;
    }

    const numericValue = Number.parseFloat(match[1]);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return null;
    }

    const unit = match[2]?.toLowerCase() || 'd';
    const unitFactors = {
        d: 1,
        h: 1 / 24,
        m: 1 / (24 * 60),
        s: 1 / (24 * 60 * 60)
    };

    const factor = unitFactors[unit];
    if (!factor) {
        return null;
    }

    const days = numericValue * factor;
    return Number.isFinite(days) && days > 0 ? days : null;
}

function normalizeReviewIntervals(value) {
    let tokens = [];
    if (Array.isArray(value)) {
        tokens = value;
    } else if (typeof value === 'string' && value.trim().length > 0) {
        tokens = value.split(/[,;\s]+/);
    } else if (value !== undefined && value !== null) {
        tokens = [value];
    }

    const normalized = [];
    const seen = new Set();

    tokens.forEach((token) => {
        const days = parseIntervalToken(token);
        if (!Number.isFinite(days)) {
            return;
        }
        const key = days.toFixed(INTERVAL_PRECISION);
        if (!seen.has(key)) {
            seen.add(key);
            normalized.push(days);
        }
    });

    if (normalized.length === 0) {
        return [...FALLBACK_REVIEW_INTERVALS];
    }

    return normalized.sort((a, b) => a - b);
}

class SettingsService {
    constructor(settings) {
        this.settings = settings || {
            maxActiveGoals: 3,
            language: 'en',
            reviewIntervals: [...FALLBACK_REVIEW_INTERVALS]
        };
        delete this.settings.checkInInterval;
        delete this.settings.checkInsEnabled;
        this.settings.reviewIntervals = normalizeReviewIntervals(this.settings.reviewIntervals);
    }

    loadSettings() {
        const saved = localStorage.getItem('goaly_settings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
        delete this.settings.checkInInterval;
        delete this.settings.checkInsEnabled;
        if (!this.settings.language) {
            this.settings.language = 'en';
        }
        this.settings.reviewIntervals = normalizeReviewIntervals(this.settings.reviewIntervals);
    }

    saveSettings() {
        localStorage.setItem('goaly_settings', JSON.stringify(this.settings));
    }

    getSettings() {
        return this.settings;
    }

    updateSettings(newSettings) {
        const merged = { ...this.settings, ...newSettings };
        merged.reviewIntervals = normalizeReviewIntervals(newSettings?.reviewIntervals ?? merged.reviewIntervals);
        this.settings = merged;
        delete this.settings.checkInInterval;
        delete this.settings.checkInsEnabled;
        if (!this.settings.language) {
            this.settings.language = 'en';
        }
        this.saveSettings();
    }

    getReviewIntervals() {
        return [...this.settings.reviewIntervals];
    }
}

export default SettingsService;
