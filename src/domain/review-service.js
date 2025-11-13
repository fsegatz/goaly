// src/domain/review-service.js

const DEFAULT_REVIEW_INTERVALS = [7, 14, 30];
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function ensureDate(value, fallback = null) {
    if (!value) {
        return fallback;
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function getMostRecentCheckIn(goal) {
    if (!goal || !Array.isArray(goal.checkInDates) || goal.checkInDates.length === 0) {
        return null;
    }
    const timestamps = goal.checkInDates
        .map((dateString) => {
            const parsed = new Date(dateString);
            return parsed.getTime();
        })
        .filter((time) => Number.isFinite(time));

    if (timestamps.length === 0) {
        return null;
    }

    return new Date(Math.max(...timestamps));
}

class ReviewService {
    constructor(goalService, settingsService) {
        this.goalService = goalService;
        this.settingsService = settingsService;
    }

    getReviewIntervals() {
        if (this.settingsService && typeof this.settingsService.getReviewIntervals === 'function') {
            const intervals = this.settingsService.getReviewIntervals();
            if (Array.isArray(intervals) && intervals.length > 0) {
                return intervals;
            }
        }
        return [...DEFAULT_REVIEW_INTERVALS];
    }

    ensureGoalSchedule(goal) {
        if (!goal || goal.status !== 'active') {
            return null;
        }

        const intervals = this.getReviewIntervals();
        const shortestIndex = 0;
        const longestIndex = intervals.length - 1;

        if (!Number.isInteger(goal.reviewIntervalIndex) || goal.reviewIntervalIndex < 0 || goal.reviewIntervalIndex > longestIndex) {
            goal.reviewIntervalIndex = shortestIndex;
        }

        goal.lastCheckInAt = ensureDate(
            goal.lastCheckInAt,
            getMostRecentCheckIn(goal) ?? ensureDate(goal.createdAt, new Date())
        );

        const intervalDays = intervals[goal.reviewIntervalIndex] ?? intervals[shortestIndex];
        const fallbackBase = goal.lastCheckInAt ?? new Date();

        goal.nextCheckInAt = ensureDate(goal.nextCheckInAt);
        if (!goal.nextCheckInAt) {
            goal.nextCheckInAt = this.calculateNextCheckInDate(fallbackBase, intervalDays);
        }

        return goal;
    }

    calculateNextCheckInDate(baseDate, intervalDays) {
        const base = ensureDate(baseDate, new Date());
        const days = Number.isFinite(intervalDays) && intervalDays > 0 ? intervalDays : this.getReviewIntervals()[0];
        return new Date(base.getTime() + days * DAY_IN_MS);
    }

    shouldCheckIn(goal) {
        const ensuredGoal = this.ensureGoalSchedule(goal);
        if (!ensuredGoal) {
            return false;
        }
        const now = new Date();
        return ensuredGoal.nextCheckInAt && ensuredGoal.nextCheckInAt <= now;
    }

    getCheckIns() {
        const goals = this.goalService?.goals ?? [];
        const now = new Date();
        return goals
            .filter((goal) => goal.status === 'active')
            .map((goal) => this.ensureGoalSchedule(goal))
            .filter((goal) => goal && goal.nextCheckInAt && goal.nextCheckInAt <= now)
            .sort((a, b) => (a.nextCheckInAt || 0) - (b.nextCheckInAt || 0))
            .map((goal) => ({
                goal,
                dueAt: goal.nextCheckInAt,
                isOverdue: goal.nextCheckInAt < now,
                messageKey: 'checkIns.prompt',
                messageArgs: {
                    title: goal.title
                }
            }));
    }

    parseRating(value, fallback) {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed)) {
            return fallback;
        }
        return Math.min(5, Math.max(1, parsed));
    }

    recordReview(goalId, ratings = {}) {
        const goal = this.goalService?.goals?.find((g) => g.id === goalId);
        if (!goal) {
            return null;
        }

        this.ensureGoalSchedule(goal);

        const intervals = this.getReviewIntervals();
        const shortestIndex = 0;
        const longestIndex = intervals.length - 1;

        const newMotivation = this.parseRating(ratings.motivation, goal.motivation);
        const newUrgency = this.parseRating(ratings.urgency, goal.urgency);
        const ratingsMatch = goal.motivation === newMotivation && goal.urgency === newUrgency;

        const settings = this.settingsService?.getSettings?.() || {};
        if (!ratingsMatch && this.goalService && typeof this.goalService.updateGoal === 'function') {
            this.goalService.updateGoal(
                goalId,
                { motivation: newMotivation, urgency: newUrgency },
                settings.maxActiveGoals
            );
        }

        const now = new Date();
        const currentIndex = Number.isInteger(goal.reviewIntervalIndex) ? goal.reviewIntervalIndex : shortestIndex;
        let nextIndex = currentIndex;

        if (ratingsMatch) {
            nextIndex = Math.min(currentIndex + 1, longestIndex);
        } else {
            nextIndex = shortestIndex;
        }

        goal.reviewIntervalIndex = nextIndex;
        goal.lastCheckInAt = now;
        if (!Array.isArray(goal.checkInDates)) {
            goal.checkInDates = [];
        }
        goal.checkInDates.push(now.toISOString());

        const intervalDays = intervals[nextIndex] ?? intervals[longestIndex];
        goal.nextCheckInAt = this.calculateNextCheckInDate(now, intervalDays);
        goal.lastUpdated = now;

        if (this.goalService && typeof this.goalService.saveGoals === 'function') {
            this.goalService.saveGoals();
        }

        return {
            goal,
            ratingsMatch
        };
    }

    performCheckIn(goalId, ratings) {
        return this.recordReview(goalId, ratings);
    }
}

export default ReviewService;

