// src/ui/base-view.js

import { URGENT_DEADLINE_DAYS } from '../domain/utils/constants.js';

export class BaseView {
    constructor(app) {
        this.app = app;
        this.languageService = app.languageService;
        this.translate = (key, replacements) => this.languageService.translate(key, replacements);
        this.latestReviewFeedback = null;

        this.languageChangeUnsubscribe = this.languageService.onChange(() => {
            this.applyLanguageUpdates();
        });
    }

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

    isDeadlineUrgent(deadline) {
        if (!deadline) return false;
        const now = new Date();
        const days = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
        return days <= URGENT_DEADLINE_DAYS && days >= 0;
    }

    getStatusText(status) {
        if (status === 'inactive') {
            return this.translate('status.inactive');
        }
        const key = `status.${status}`;
        const translated = this.translate(key);
        return translated === key ? status : translated;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

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

    formatDate(date) {
        if (!date) {
            return '';
        }
        const dateObj = date instanceof Date ? date : new Date(date);
        const locale = this.languageService.getLocale();
        return dateObj.toLocaleDateString(locale);
    }

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
