// src/ui/desktop/base-ui-controller.js

export class BaseUIController {
    constructor(app) {
        this.app = app;
        this.languageService = app.languageService;
        this.translate = (key, replacements) => this.languageService.translate(key, replacements);
        this.priorityCache = new Map();
        this.priorityCacheDirty = true;
        this.latestReviewFeedback = null;

        this.languageChangeUnsubscribe = this.languageService.onChange(() => {
            this.applyLanguageUpdates();
        });
    }

    applyLanguageUpdates() {
        this.languageService.applyTranslations(document);
        this.renderViews();
    }

    invalidatePriorityCache() {
        this.priorityCacheDirty = true;
    }

    refreshPriorityCache() {
        if (!this.priorityCacheDirty) {
            return;
        }
        this.priorityCache.clear();
        this.app.goalService.goals.forEach(goal => {
            this.priorityCache.set(goal.id, this.app.goalService.calculatePriority(goal));
        });
        this.priorityCacheDirty = false;
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
        } else if (days <= 7) {
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
        return days <= 7 && days >= 0;
    }

    getStatusText(status) {
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
}

