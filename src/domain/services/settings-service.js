// src/domain/settings-service.js

/**
 * @module SettingsService
 * @description Service for managing application settings including language preferences,
 * maximum active goals, and review intervals. Persists settings to localStorage.
 */

import { STORAGE_KEY_SETTINGS } from '../utils/constants.js';

/** @constant {number[]} Default review intervals in days */
export const DEFAULT_REVIEW_INTERVALS = [7, 14, 30];

/** @constant {number[]} Fallback intervals when parsing fails */
const FALLBACK_REVIEW_INTERVALS = DEFAULT_REVIEW_INTERVALS;

/** @constant {number} Precision for interval deduplication */
const INTERVAL_PRECISION = 6;

/**
 * Parse a single interval token into days.
 * Supports formats like "7", "7d", "24h", "30m", "60s".
 * @param {string|number|null|undefined} rawValue - Raw interval value
 * @returns {number|null} Interval in days, or null if invalid
 * @private
 */
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

    const regex = /^(\d+(?:\.\d+)?)([dhms]?)$/i;
    const match = regex.exec(trimmed);
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

/**
 * Normalize review intervals from various input formats.
 * Accepts arrays, comma/semicolon/space-separated strings, or single values.
 * @param {Array|string|number|null|undefined} value - Input value to normalize
 * @returns {number[]} Sorted array of unique interval values in days
 * @private
 */
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

/**
 * Service for managing application settings.
 * Handles persistence to localStorage and provides observer pattern for change notifications.
 * @class
 */
class SettingsService {
    /**
     * Create a new SettingsService instance.
     * @param {Object} [settings] - Initial settings object
     * @param {number} [settings.maxActiveGoals=3] - Maximum number of active goals
     * @param {string} [settings.language='en'] - Application language code
     * @param {number[]} [settings.reviewIntervals] - Review intervals in days
     */
    constructor(settings) {
        this.settings = settings || {
            maxActiveGoals: 3,
            language: 'en',
            reviewIntervals: [...FALLBACK_REVIEW_INTERVALS]
        };
        this._listeners = {
            afterSave: []
        };
        this._cleanupDeprecatedSettings();
        this.settings.reviewIntervals = normalizeReviewIntervals(this.settings.reviewIntervals);
    }

    /**
     * Remove deprecated settings from the settings object.
     * @private
     */
    _cleanupDeprecatedSettings() {
        delete this.settings.checkInInterval;
        delete this.settings.reviewsEnabled;
        delete this.settings.checkInsEnabled;
    }

    /**
     * Load settings from localStorage.
     * Merges saved settings with current settings and normalizes values.
     */
    loadSettings() {
        const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
        this._cleanupDeprecatedSettings();
        if (!this.settings.language) {
            this.settings.language = 'en';
        }
        this.settings.reviewIntervals = normalizeReviewIntervals(this.settings.reviewIntervals);
    }

    /**
     * Save current settings to localStorage.
     */
    saveSettings() {
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(this.settings));
    }

    /**
     * Get the current settings object.
     * @returns {Object} Current settings
     */
    getSettings() {
        return this.settings;
    }

    /**
     * Update settings with new values.
     * Merges new settings, normalizes values, saves, and notifies listeners.
     * @param {Object} newSettings - New settings to merge
     */
    updateSettings(newSettings) {
        const merged = { ...this.settings, ...newSettings };
        merged.reviewIntervals = normalizeReviewIntervals(newSettings?.reviewIntervals ?? merged.reviewIntervals);
        this.settings = merged;
        this._cleanupDeprecatedSettings();
        if (!this.settings.language) {
            this.settings.language = 'en';
        }
        this.saveSettings();
        this._notifyAfterSave();
    }

    /**
     * Register a listener to be called after settings are saved.
     * @param {Function} listener - Callback function
     * @returns {Function} Unsubscribe function
     */
    onAfterSave(listener) {
        if (typeof listener !== 'function') {
            return () => { }; // Return a no-op for invalid listeners
        }
        this._listeners.afterSave.push(listener);

        // Return a function to unsubscribe the listener
        return () => {
            this._listeners.afterSave = this._listeners.afterSave.filter(
                (registeredListener) => registeredListener !== listener
            );
        };
    }

    /**
     * Notify all afterSave listeners.
     * @private
     */
    _notifyAfterSave() {
        // Iterate over a copy of the listeners array to prevent issues if a listener unsubscribes during execution.
        const listeners = [...(this._listeners?.afterSave || [])];
        for (const fn of listeners) {
            try {
                fn();
            } catch (error) {
                // Log and continue so one faulty listener does not break others
                console.error('SettingsService afterSave listener error', error);
            }
        }
    }

    /**
     * Get the review intervals.
     * @returns {number[]} Copy of the review intervals array
     */
    getReviewIntervals() {
        return [...this.settings.reviewIntervals];
    }
}

export default SettingsService;
