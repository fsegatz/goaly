// src/domain/utils/date-utils.js

/**
 * @module DateUtils
 * @description Utility functions for date manipulation and formatting.
 * Handles normalization, comparison, and display formatting of dates.
 */

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Normalize a date value to a Date object or null
 * @param {Date|string|number|null|undefined} value - The date value to normalize
 * @param {Date|null} fallback - Fallback date if value is invalid (default: null)
 * @returns {Date|null} - Normalized Date object or null
 */
export function normalizeDate(value, fallback = null) {
    if (!value) {
        return fallback;
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

/**
 * Calculate the number of days between two dates
 * @param {Date|string|number} date1 - First date
 * @param {Date|string|number} date2 - Second date
 * @returns {number} - Number of days between the dates (can be negative)
 */
export function daysBetween(date1, date2) {
    const d1 = normalizeDate(date1);
    const d2 = normalizeDate(date2);
    if (!d1 || !d2) {
        return Number.NaN;
    }
    const diffMs = d2.getTime() - d1.getTime();
    return Math.ceil(diffMs / DAY_IN_MS);
}

/**
 * Set a date to midnight (00:00:00.000)
 * @param {Date|string|number} date - The date to normalize
 * @returns {Date} - New Date object set to midnight
 */
export function setToMidnight(date) {
    const normalized = normalizeDate(date, new Date());
    const result = new Date(normalized);
    result.setHours(0, 0, 0, 0);
    return result;
}

/**
 * Check if a date value is valid
 * @param {Date|string|number|null|undefined} value - The date value to check
 * @returns {boolean} - True if the date is valid
 */
export function isDateValid(value) {
    if (!value) {
        return false;
    }
    if (value instanceof Date) {
        return !Number.isNaN(value.getTime());
    }
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime());
}

/**
 * Format a deadline date for display
 * @param {Date|string|number} deadline - The deadline date
 * @param {Date} now - Current date (defaults to new Date())
 * @returns {number} - Days until deadline (negative if overdue)
 */
export function getDaysUntilDeadline(deadline, now = new Date()) {
    const deadlineDate = normalizeDate(deadline);
    if (!deadlineDate) {
        return Number.NaN;
    }
    const nowDate = normalizeDate(now, new Date());
    return Math.ceil((deadlineDate.getTime() - nowDate.getTime()) / DAY_IN_MS);
}

