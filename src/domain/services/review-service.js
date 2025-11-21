// src/domain/services/review-service.js

import { MAX_RATING_VALUE } from '../utils/constants.js';
import { DEFAULT_REVIEW_INTERVALS } from './settings-service.js';
import { normalizeDate } from '../utils/date-utils.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function getMostRecentReview(goal) {
    if (!goal || !Array.isArray(goal.reviewDates) || goal.reviewDates.length === 0) {
        return null;
    }
    const timestamps = goal.reviewDates
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
        // Include active, inactive, and paused goals for reviews (exclude completed and abandoned)
        if (!goal || (goal.status !== 'active' && goal.status !== 'inactive' && goal.status !== 'paused')) {
            return null;
        }

        const intervals = this.getReviewIntervals();
        const shortestIndex = 0;
        const longestIndex = intervals.length - 1;

        if (!Number.isInteger(goal.reviewIntervalIndex) || goal.reviewIntervalIndex < 0 || goal.reviewIntervalIndex > longestIndex) {
            goal.reviewIntervalIndex = shortestIndex;
        }

        goal.lastReviewAt = normalizeDate(
            goal.lastReviewAt,
            getMostRecentReview(goal) ?? normalizeDate(goal.createdAt, new Date())
        );

        const intervalDays = intervals[goal.reviewIntervalIndex] ?? intervals[shortestIndex];
        const fallbackBase = goal.lastReviewAt ?? new Date();

        const existingNextReview = normalizeDate(goal.nextReviewAt);
        if (!existingNextReview) {
            // No review scheduled yet - set it based on lastReviewAt (or creation date)
            goal.nextReviewAt = this.calculateNextReviewDate(fallbackBase, intervalDays);
        } else {
            // If nextReviewAt exists, check if it's unreasonably far in the future
            // This can happen if intervals were changed and goal had a schedule based on old intervals
            const now = new Date();
            const maxInterval = Math.max(...intervals);
            // Convert maxInterval to milliseconds (it's in days, but can be fractional for seconds/minutes)
            const maxIntervalMs = maxInterval * DAY_IN_MS;
            // Add a small buffer (1 day) to account for reasonable future dates
            const maxReasonableDate = new Date(now.getTime() + maxIntervalMs + DAY_IN_MS);
            
            // If nextReviewAt is way too far in the future, recalculate it
            // This ensures goals get updated when intervals change to shorter values
            if (existingNextReview > maxReasonableDate) {
                goal.nextReviewAt = this.calculateNextReviewDate(fallbackBase, intervalDays);
            } else {
                goal.nextReviewAt = existingNextReview;
            }
        }

        return goal;
    }

    calculateNextReviewDate(baseDate, intervalDays) {
        const base = normalizeDate(baseDate, new Date());
        const days = Number.isFinite(intervalDays) && intervalDays > 0 ? intervalDays : this.getReviewIntervals()[0];
        return new Date(base.getTime() + days * DAY_IN_MS);
    }

    shouldReview(goal) {
        const ensuredGoal = this.ensureGoalSchedule(goal);
        if (!ensuredGoal) {
            return false;
        }
        const now = new Date();
        return ensuredGoal.nextReviewAt && ensuredGoal.nextReviewAt <= now;
    }

    getReviews() {
        const goals = this.goalService?.goals ?? [];
        const now = new Date();
        // Include active and paused goals for reviews (exclude completed and abandoned)
        return goals
            .filter((goal) => goal.status === 'active' || goal.status === 'inactive' || goal.status === 'paused')
            .map((goal) => this.ensureGoalSchedule(goal))
            .filter((goal) => goal && goal.nextReviewAt && goal.nextReviewAt <= now)
            .sort((a, b) => (a.nextReviewAt || 0) - (b.nextReviewAt || 0))
            .map((goal) => ({
                goal,
                dueAt: goal.nextReviewAt,
                isOverdue: goal.nextReviewAt < now,
                messageKey: 'reviews.prompt',
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
        return Math.min(MAX_RATING_VALUE, Math.max(1, parsed));
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
        goal.lastReviewAt = now;
        if (!Array.isArray(goal.reviewDates)) {
            goal.reviewDates = [];
        }
        goal.reviewDates.push(now.toISOString());

        const intervalDays = intervals[nextIndex] ?? intervals[longestIndex];
        goal.nextReviewAt = this.calculateNextReviewDate(now, intervalDays);
        goal.lastUpdated = now;

        if (this.goalService && typeof this.goalService.saveGoals === 'function') {
            this.goalService.saveGoals();
        }

        return {
            goal,
            ratingsMatch
        };
    }

    performReview(goalId, ratings) {
        return this.recordReview(goalId, ratings);
    }
}

export default ReviewService;

