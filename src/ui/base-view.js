// src/ui/base-view.js

/**
 * @module BaseView
 * @description Base class for all UI views, providing common functionality
 * for translation, date formatting, and DOM element caching.
 */

import { URGENT_DEADLINE_DAYS } from '../domain/utils/constants.js';

/**
 * Base class for UI views.
 * Provides common methods for translation, formatting, and caching.
 * @class
 */
export class BaseView {
    /**
     * Create a new BaseView instance.
     * @param {Object} app - The application instance
     * @param {LanguageService} app.languageService - Language service for translations
     * @param {GoalService} app.goalService - Goal service for goal management
     */
    constructor(app) {
        this.app = app;
        this.languageService = app.languageService;
        this.translate = (key, replacements) => this.languageService.translate(key, replacements);
        this.latestReviewFeedback = null;

        this.languageChangeUnsubscribe = this.languageService.onChange(() => {
            this.applyLanguageUpdates();
        });
    }

    /**
     * Apply language updates to the view.
     * Called when the language changes.
     */
    applyLanguageUpdates() {
        this.languageService.applyTranslations(document);
        this.renderViews();
    }

    /**
     * Get priority for a goal from the centralized cache.
     * @param {string} goalId - The goal ID
     * @returns {number} - The priority value
     */
    getPriority(goalId) {
        return this.app.goalService.priorityCache.getPriority(goalId);
    }

    /**
     * Get all priorities as a Map.
     * @returns {Map<string, number>} - Map of goal ID to priority
     */
    getAllPriorities() {
        return this.app.goalService.priorityCache.getAllPriorities();
    }

    /**
     * Format a deadline date for display.
     * Shows relative time for urgent deadlines, full date otherwise.
     * @param {Date} deadline - The deadline date
     * @returns {string} Formatted deadline string
     */
    formatDeadline(deadline) {
        const now = new Date();
        const days = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

        if (days < 0) {
            return this.translate('deadline.overdue', { count: Math.abs(days) });
        } else if (days === 0) {
            return this.translate('deadline.today');
        } else if (days === 1) {
            return this.translate('deadline.tomorrow');
        } else if (days <= URGENT_DEADLINE_DAYS) {
            return this.translate('deadline.inDays', { count: days });
        } else {
            const locale = this.languageService.getLocale();
            return deadline.toLocaleDateString(locale);
        }
    }

    /**
     * Check if a deadline is urgent (within URGENT_DEADLINE_DAYS).
     * @param {Date|null} deadline - The deadline to check
     * @returns {boolean} True if deadline is urgent
     */
    isDeadlineUrgent(deadline) {
        if (!deadline) return false;
        const now = new Date();
        const days = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
        return days <= URGENT_DEADLINE_DAYS && days >= 0;
    }

    /**
     * Get translated text for a status.
     * @param {string} status - The status key
     * @returns {string} Translated status text
     */
    getStatusText(status) {
        if (status === 'inactive') {
            return this.translate('status.inactive');
        }
        const key = `status.${status}`;
        const translated = this.translate(key);
        return translated === key ? status : translated;
    }

    /**
     * Escape HTML special characters in text.
     * @param {string} text - Text to escape
     * @returns {string} HTML-escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Format a date and time for display.
     * @param {Date|string|null} date - Date to format
     * @returns {string} Formatted date and time string
     */
    formatDateTime(date) {
        if (!date) {
            return '';
        }
        const dateObj = date instanceof Date ? date : new Date(date);
        const locale = this.languageService.getLocale();
        return (
            dateObj.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }) +
            ' ' +
            dateObj.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
        );
    }

    /**
     * Format a date for display.
     * @param {Date|string|null} date - Date to format
     * @returns {string} Formatted date string
     */
    formatDate(date) {
        if (!date) {
            return '';
        }
        const dateObj = date instanceof Date ? date : new Date(date);
        const locale = this.languageService.getLocale();
        return dateObj.toLocaleDateString(locale);
    }

    /**
     * Format a review interval for input display (e.g., "7d", "24h").
     * @param {number} intervalDays - Interval in days
     * @returns {string} Formatted interval string
     */
    formatReviewIntervalInput(intervalDays) {
        if (!Number.isFinite(intervalDays) || intervalDays <= 0) {
            return '';
        }

        const totalSeconds = Math.max(1, Math.round(intervalDays * 24 * 60 * 60));

        if (totalSeconds % (24 * 60 * 60) === 0) {
            return `${totalSeconds / (24 * 60 * 60)}d`;
        }
        if (totalSeconds % (60 * 60) === 0) {
            return `${totalSeconds / (60 * 60)}h`;
        }
        if (totalSeconds % 60 === 0) {
            return `${totalSeconds / 60}m`;
        }
        return `${totalSeconds}s`;
    }

    /**
     * Format a review interval for human-readable display.
     * @param {number} intervalDays - Interval in days
     * @returns {string} Translated interval string
     */
    formatReviewIntervalDisplay(intervalDays) {
        if (!Number.isFinite(intervalDays) || intervalDays <= 0) {
            return this.translate('reviews.interval.unknown');
        }

        const totalSeconds = intervalDays * 24 * 60 * 60;
        const formatter = new Intl.NumberFormat(this.languageService.getLocale(), { maximumFractionDigits: 2 });

        if (totalSeconds >= 24 * 60 * 60) {
            return this.translate('reviews.interval.days', { count: formatter.format(totalSeconds / (24 * 60 * 60)) });
        }
        if (totalSeconds >= 60 * 60) {
            return this.translate('reviews.interval.hours', { count: formatter.format(totalSeconds / (60 * 60)) });
        }
        if (totalSeconds >= 60) {
            return this.translate('reviews.interval.minutes', { count: formatter.format(totalSeconds / 60) });
        }
        return this.translate('reviews.interval.seconds', { count: formatter.format(totalSeconds) });
    }

    /**
     * Get a cached DOM element by ID, re-querying if not connected.
     * @param {Object} cache - The cache object to use
     * @param {string} id - The element ID
     * @param {Function} [queryFn] - Optional query function (defaults to getOptionalElement)
     * @returns {HTMLElement|null}
     */
    getCachedElement(cache, id, queryFn) {
        const cached = cache[id];
        if (cached?.isConnected) {
            return cached;
        }
        // Import dynamically to avoid circular deps in subclasses
        const query = queryFn || ((elementId) => document.getElementById(elementId));
        const element = query(id);
        cache[id] = element || null;
        return element || null;
    }
}

// Backward compatibility alias
export { BaseView as BaseUIController };
