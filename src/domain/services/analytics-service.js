// src/domain/services/analytics-service.js

/**
 * @module AnalyticsService
 * @description Service for aggregating and analyzing goal data.
 * Used primarily by the Overview view to calculate statistics and charts.
 */

/**
 * Service for aggregating and analyzing goal data for the Overview view.
 * @class
 */
class AnalyticsService {
    constructor(goalService) {
        this.goalService = goalService;
    }

    /**
     * Get all goals grouped by period (week, month, or year).
     * @param {string} period - 'week', 'month', or 'year'
     * @returns {Object} Object with period labels as keys and arrays of goals as values
     */
    getGoalsByPeriod(period = 'month') {
        const goals = this.goalService.goals;
        const grouped = {};

        goals.forEach(goal => {
            const createdAt = new Date(goal.createdAt);
            const key = this._getPeriodKey(createdAt, period);

            if (!grouped[key]) {
                grouped[key] = { created: [], completed: [], notCompleted: [] };
            }
            grouped[key].created.push(goal);

            // Track completion status if goal ended
            if (goal.status === 'completed' || goal.status === 'notCompleted') {
                const key = this._getPeriodKey(new Date(goal.lastUpdated), period);
                if (!grouped[key]) {
                    grouped[key] = { created: [], completed: [], notCompleted: [] };
                }
                grouped[key][goal.status].push(goal);
            }
        });

        return this._fillMissingPeriods(grouped, period);
    }

    /**
     * Get the period key for a date.
     * @private
     */
    _getPeriodKey(date, period) {
        const year = date.getFullYear();
        const month = date.getMonth();
        const week = this._getWeekNumber(date);

        switch (period) {
            case 'week':
                return `${year}-W${String(week).padStart(2, '0')}`;
            case 'month':
                return `${year}-${String(month + 1).padStart(2, '0')}`;
            case 'year':
                return `${year}`;
            default:
                return `${year}-${String(month + 1).padStart(2, '0')}`;
        }
    }

    /**
     * Get ISO week number for a date.
     * @private
     */
    _getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    /**
     * Fill in missing periods between the earliest and latest dates.
     * @private
     */
    _fillMissingPeriods(grouped, period) {
        const keys = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
        if (keys.length === 0) return grouped;

        const result = {};
        const startKey = keys[0];
        const endKey = keys.at(-1);

        // Generate all periods between start and end
        const periods = this._generatePeriodRange(startKey, endKey, period);

        periods.forEach(key => {
            result[key] = grouped[key] || { created: [], completed: [], notCompleted: [] };
        });

        return result;
    }

    /**
     * Generate a range of period keys.
     * @private
     */
    _generatePeriodRange(start, end, period) {
        const periods = [];
        let current = this._parsePeriodKey(start, period);
        const endDate = this._parsePeriodKey(end, period);

        while (current <= endDate) {
            periods.push(this._getPeriodKey(current, period));
            current = this._incrementPeriod(current, period);
        }

        return periods;
    }

    /**
     * Parse a period key back to a date.
     * @private
     */
    _parsePeriodKey(key, period) {
        switch (period) {
            case 'week': {
                const [year, week] = key.split('-W').map(Number);
                const jan1 = new Date(year, 0, 1);
                const daysToAdd = (week - 1) * 7 - jan1.getDay() + 1;
                return new Date(year, 0, 1 + daysToAdd);
            }
            case 'month': {
                const [year, month] = key.split('-').map(Number);
                return new Date(year, month - 1, 1);
            }
            case 'year': {
                return new Date(Number.parseInt(key), 0, 1);
            }
            default:
                throw new Error(`Unknown period type: ${period}`);
        }
    }

    /**
     * Increment a date by the given period.
     * @private
     */
    _incrementPeriod(date, period) {
        const result = new Date(date);
        switch (period) {
            case 'week':
                result.setDate(result.getDate() + 7);
                break;
            case 'month':
                result.setMonth(result.getMonth() + 1);
                break;
            case 'year':
                result.setFullYear(result.getFullYear() + 1);
                break;
        }
        return result;
    }

    /**
     * Get the distribution of goals by status.
     * @returns {Object} Object with status as key and count as value
     */
    getStatusDistribution() {
        const goals = this.goalService.goals;
        const distribution = {
            active: 0,
            inactive: 0,
            paused: 0,
            completed: 0,
            notCompleted: 0
        };

        goals.forEach(goal => {
            const status = goal.status;
            if (distribution.hasOwnProperty(status)) {
                distribution[status]++;
            }
        });

        return distribution;
    }

    /**
     * Get completion statistics.
     * @returns {Object} Object with completed, notCompleted, and total counts
     */
    getCompletionStats() {
        const goals = this.goalService.goals;
        const completed = goals.filter(g => g.status === 'completed').length;
        const notCompleted = goals.filter(g => g.status === 'notCompleted').length;
        const total = goals.length;
        const totalFinished = completed + notCompleted;
        const completionRate = totalFinished > 0 ? Math.round((completed / totalFinished) * 100) : 0;

        return {
            completed,
            notCompleted,
            total,
            completionRate
        };
    }

    /**
     * Get summary statistics for the overview.
     * @param {string} period - 'week', 'month', or 'year'
     * @returns {Object} Summary statistics
     */
    getSummaryStats(period = 'month') {
        const goals = this.goalService.goals;
        const completionStats = this.getCompletionStats();
        const goalsByPeriod = this.getGoalsByPeriod(period);

        const periodKeys = Object.keys(goalsByPeriod);
        const totalPeriods = periodKeys.length || 1;
        const avgPerPeriod = totalPeriods > 0
            ? (goals.length / totalPeriods).toFixed(1)
            : 0;

        return {
            totalGoals: goals.length,
            completed: completionStats.completed,
            notCompleted: completionStats.notCompleted,
            completionRate: completionStats.completionRate,
            avgPerPeriod: Number.parseFloat(avgPerPeriod),
            period
        };
    }

}

export default AnalyticsService;
