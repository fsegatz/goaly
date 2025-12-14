// tests/review-service.test.js

const ReviewService = require('../src/domain/services/review-service').default;
const GoalService = require('../src/domain/services/goal-service').default;
const Goal = require('../src/domain/models/goal').default;
const SettingsService = require('../src/domain/services/settings-service').default;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

describe('Review Service', () => {
    let reviewService;
    let goalService;
    let settingsService;
    let goal;

    beforeEach(() => {
        global.localStorage = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            clear: jest.fn()
        };

        goalService = new GoalService([]);
        settingsService = new SettingsService({
            reviewIntervals: [7, 14, 30],
            maxActiveGoals: 3,
            language: 'en'
        });
        reviewService = new ReviewService(goalService, settingsService);
    });

    function createActiveGoal(overrides = {}) {
        return new Goal({
            id: overrides.id || 'goal-1',
            title: overrides.title || 'Test Goal',
            status: overrides.status || 'active',
            motivation: overrides.motivation ?? 3,
            urgency: overrides.urgency ?? 4,
            createdAt: overrides.createdAt || new Date(Date.now() - 40 * DAY_IN_MS),
            ...overrides
        });
    }

    it('should identify an active goal with past nextReviewAt as due', () => {
        goal = createActiveGoal();
        goal.reviewIntervalIndex = 0;
        goal.lastReviewAt = new Date(Date.now() - 31 * DAY_IN_MS);
        goal.nextReviewAt = new Date(Date.now() - 1 * DAY_IN_MS);
        goalService.goals = [goal];

        const reviews = reviewService.getReviews();

        expect(reviews).toHaveLength(1);
        expect(reviews[0].goal.id).toBe(goal.id);
    });

    it('should ignore completed and notCompleted goals even if nextReviewAt is in the past', () => {
        // Paused goals should be included for reviews
        const pausedGoal = createActiveGoal({ status: 'paused' });
        pausedGoal.reviewIntervalIndex = 0;
        pausedGoal.nextReviewAt = new Date(Date.now() - DAY_IN_MS);

        // Completed goals should be excluded
        const completedGoal = createActiveGoal({ status: 'completed' });
        completedGoal.reviewIntervalIndex = 0;
        completedGoal.nextReviewAt = new Date(Date.now() - DAY_IN_MS);

        // Not completed goals should be excluded
        const notCompletedGoal = createActiveGoal({ status: 'notCompleted' });
        notCompletedGoal.reviewIntervalIndex = 0;
        notCompletedGoal.nextReviewAt = new Date(Date.now() - DAY_IN_MS);

        goalService.goals = [pausedGoal, completedGoal, notCompletedGoal];

        const reviews = reviewService.getReviews();
        // Should only include paused goal, not completed or notCompleted
        expect(reviews).toHaveLength(1);
        expect(reviews[0].goal.status).toBe('paused');
    });

    it('should calculate a default next review when none is scheduled', () => {
        goal = createActiveGoal({ createdAt: new Date(Date.now() - 2 * DAY_IN_MS) });
        goal.reviewIntervalIndex = undefined;
        goal.lastReviewAt = null;
        goal.nextReviewAt = null;
        goal.reviewDates = [];
        goalService.goals = [goal];

        reviewService.ensureGoalSchedule(goal);

        expect(goal.reviewIntervalIndex).toBe(0);
        expect(goal.nextReviewAt).toBeInstanceOf(Date);
        expect(goal.lastReviewAt).toBeInstanceOf(Date);
    });

    it('should derive last review from latest valid review dates', () => {
        const earlier = new Date(Date.now() - 5 * DAY_IN_MS).toISOString();
        const latest = new Date(Date.now() - 2 * DAY_IN_MS).toISOString();

        goal = createActiveGoal({
            reviewIntervalIndex: 5, // invalid index
            reviewDates: ['not-a-date', earlier, latest],
            lastReviewAt: 'bad-date',
            createdAt: 'invalid'
        });
        goal.nextReviewAt = null;
        goalService.goals = [goal];

        reviewService.ensureGoalSchedule(goal);

        expect(goal.reviewIntervalIndex).toBe(0);
        expect(goal.lastReviewAt).toBeInstanceOf(Date);
        expect(goal.lastReviewAt.toISOString()).toBe(latest);
        expect(goal.nextReviewAt).toBeInstanceOf(Date);
    });

    it('should shorten the interval when ratings stay the same', () => {
        goal = createActiveGoal();
        goal.reviewIntervalIndex = 0;
        goal.lastReviewAt = new Date(Date.now() - 31 * DAY_IN_MS);
        goal.nextReviewAt = new Date(Date.now() - DAY_IN_MS);
        goal.reviewDates = [];
        goalService.goals = [goal];

        const result = reviewService.recordReview(goal.id, {
            motivation: goal.motivation,
            urgency: goal.urgency
        });

        expect(result).toBeTruthy();
        expect(result.ratingsMatch).toBe(true);
        expect(goal.reviewIntervalIndex).toBe(1);
        expect(goal.reviewDates).toHaveLength(1);
        expect(goal.nextReviewAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should reset to the longest interval when ratings change', () => {
        goal = createActiveGoal({ motivation: 3, urgency: 3 });
        goal.reviewIntervalIndex = 2;
        goal.lastReviewAt = new Date(Date.now() - 10 * DAY_IN_MS);
        goal.nextReviewAt = new Date(Date.now() - DAY_IN_MS);
        goal.reviewDates = [];
        goalService.goals = [goal];

        const result = reviewService.recordReview(goal.id, {
            motivation: 5,
            urgency: 5
        });

        expect(result).toBeTruthy();
        expect(result.ratingsMatch).toBe(false);
        expect(goal.reviewIntervalIndex).toBe(0);
        expect(goal.motivation).toBe(5);
        expect(goal.urgency).toBe(5);
        expect(goal.reviewDates).toHaveLength(1);
        expect(goal.nextReviewAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return null when recording a review for a missing goal', () => {
        const result = reviewService.recordReview('missing', {
            motivation: 3,
            urgency: 3
        });

        expect(result).toBeNull();
    });

    it('should return null when scheduling completed or notCompleted goals', () => {
        // Paused goals should be schedulable
        const pausedGoal = createActiveGoal({ status: 'paused' });
        expect(reviewService.ensureGoalSchedule(pausedGoal)).not.toBeNull();

        // Completed goals should not be schedulable
        const completedGoal = createActiveGoal({ status: 'completed' });
        expect(reviewService.ensureGoalSchedule(completedGoal)).toBeNull();

        // Not completed goals should not be schedulable
        const notCompletedGoal = createActiveGoal({ status: 'notCompleted' });
        expect(reviewService.ensureGoalSchedule(notCompletedGoal)).toBeNull();
    });

    it('should fallback to default intervals when settings provide none', () => {
        const customSettings = {
            getReviewIntervals: jest.fn(() => []),
            getSettings: jest.fn(() => ({ maxActiveGoals: 3 }))
        };
        const customService = new ReviewService(goalService, customSettings);
        expect(customService.getReviewIntervals()).toEqual([7, 14, 30]);
    });

    it('should tolerate invalid rating inputs and keep previous values', () => {
        goal = createActiveGoal({ reviewIntervalIndex: 0 });
        goal.reviewDates = [];
        goal.lastReviewAt = new Date(Date.now() - 2 * DAY_IN_MS);
        goal.nextReviewAt = new Date(Date.now() - DAY_IN_MS);
        goalService.goals = [goal];

        const result = reviewService.recordReview(goal.id, {
            motivation: 'abc',
            urgency: null
        });

        expect(result).toBeTruthy();
        expect(goal.motivation).toBe(3);
        expect(goal.urgency).toBe(4);
    });

    it('should calculate next review using fallback interval when invalid days provided', () => {
        const base = new Date();
        const next = reviewService.calculateNextReviewDate(base, NaN);
        const diffDays = Math.round((next - base) / DAY_IN_MS);
        expect(diffDays).toBe(7);
    });

    it('should fallback to current time when base date is invalid', () => {
        const next = reviewService.calculateNextReviewDate('not-a-date', 1);
        const now = Date.now();
        expect(next.getTime()).toBeGreaterThanOrEqual(now);
    });

    it('should fall back to createdAt when no valid review dates exist', () => {
        const createdAt = new Date(Date.now() - 3 * DAY_IN_MS);
        goal = createActiveGoal({ createdAt, reviewDates: ['bad-date'], lastReviewAt: null, reviewIntervalIndex: null });
        goal.nextReviewAt = null;
        reviewService.ensureGoalSchedule(goal);
        expect(goal.reviewIntervalIndex).toBe(0);
        expect(goal.lastReviewAt.toISOString()).toBe(createdAt.toISOString());
        expect(goal.nextReviewAt).toBeInstanceOf(Date);
    });

    it('should initialise reviewDates when undefined during recordReview', () => {
        goal = createActiveGoal({ reviewIntervalIndex: 0 });
        goal.reviewDates = undefined;
        goal.lastReviewAt = new Date(Date.now() - 2 * DAY_IN_MS);
        goal.nextReviewAt = new Date(Date.now() - DAY_IN_MS);
        goalService.goals = [goal];

        const result = reviewService.recordReview(goal.id, { motivation: goal.motivation, urgency: goal.urgency });
        expect(result).toBeTruthy();
        expect(Array.isArray(goal.reviewDates)).toBe(true);
        expect(goal.reviewDates).toHaveLength(1);
    });

    it('should return goal due when next review has passed', () => {
        goal = createActiveGoal();
        goal.nextReviewAt = new Date(Date.now() - 1000);
        expect(reviewService.shouldReview(goal)).toBe(true);
    });

    it('should return false when next review is in the future', () => {
        goal = createActiveGoal();
        goal.nextReviewAt = new Date(Date.now() + 1000);
        expect(reviewService.shouldReview(goal)).toBe(false);
    });

    it('should return empty reviews when next review is in the future', () => {
        goal = createActiveGoal();
        goal.nextReviewAt = new Date(Date.now() + 60 * 1000);
        goalService.goals = [goal];
        const reviews = reviewService.getReviews();
        expect(reviews).toHaveLength(0);
    });

    it('should sort reviews by nearest due date', () => {
        const now = Date.now();
        const goalA = createActiveGoal({ id: 'A' });
        const goalB = createActiveGoal({ id: 'B' });
        goalA.nextReviewAt = new Date(now - 5 * 60 * 1000);
        goalB.nextReviewAt = new Date(now - 60 * 1000);
        goalService.goals = [goalB, goalA];

        const result = reviewService.getReviews();
        expect(result.map(entry => entry.goal.id)).toEqual(['A', 'B']);
        expect(result[0].isOverdue).toBe(true);
    });

    it('should recalculate nextReviewAt when it is unreasonably far in the future', () => {
        goal = createActiveGoal();
        goal.reviewIntervalIndex = 0;
        goal.lastReviewAt = new Date(Date.now() - 10 * DAY_IN_MS);
        // Set nextReviewAt to be way too far in the future (more than max interval + buffer)
        const farFuture = new Date(Date.now() + 100 * DAY_IN_MS);
        goal.nextReviewAt = farFuture;
        goalService.goals = [goal];

        reviewService.ensureGoalSchedule(goal);

        // Should have recalculated nextReviewAt to be reasonable (based on lastReviewAt + interval)
        expect(goal.nextReviewAt).toBeInstanceOf(Date);
        expect(goal.nextReviewAt.getTime()).toBeLessThan(farFuture.getTime());
        // The recalculated date should be based on lastReviewAt + interval, which may be in the past
        // but should be much closer to now than the far future date
        const maxInterval = Math.max(...reviewService.getReviewIntervals());
        const maxReasonableTime = Date.now() + (maxInterval * DAY_IN_MS) + DAY_IN_MS;
        expect(goal.nextReviewAt.getTime()).toBeLessThan(maxReasonableTime);
    });

    it('should return false when shouldReview is called with a goal that cannot be scheduled', () => {
        const completedGoal = createActiveGoal({ status: 'completed' });
        expect(reviewService.shouldReview(completedGoal)).toBe(false);
    });

    it('should call recordReview when performReview is called', () => {
        goal = createActiveGoal();
        goal.reviewIntervalIndex = 0;
        goal.lastReviewAt = new Date(Date.now() - 2 * DAY_IN_MS);
        goal.nextReviewAt = new Date(Date.now() - DAY_IN_MS);
        goal.reviewDates = [];
        goalService.goals = [goal];

        const result = reviewService.performReview(goal.id, {
            motivation: goal.motivation,
            urgency: goal.urgency
        });

        expect(result).toBeTruthy();
        expect(result.goal.id).toBe(goal.id);
        expect(goal.reviewDates).toHaveLength(1);
    });

    it('should handle recordReview when goalService lacks updateGoal method', () => {
        goal = createActiveGoal();
        goal.reviewIntervalIndex = 0;
        goal.lastReviewAt = new Date(Date.now() - 2 * DAY_IN_MS);
        goal.nextReviewAt = new Date(Date.now() - DAY_IN_MS);
        goal.reviewDates = [];
        goalService.goals = [goal];
        // Remove updateGoal method to test the branch
        const originalUpdateGoal = goalService.updateGoal;
        delete goalService.updateGoal;

        const result = reviewService.recordReview(goal.id, {
            motivation: 5,
            urgency: 5
        });

        expect(result).toBeTruthy();
        expect(goal.motivation).toBe(5);
        expect(goal.urgency).toBe(5);

        // Restore method
        goalService.updateGoal = originalUpdateGoal;
    });

    it('should handle recordReview when goalService lacks saveGoals method', () => {
        goal = createActiveGoal();
        goal.reviewIntervalIndex = 0;
        goal.lastReviewAt = new Date(Date.now() - 2 * DAY_IN_MS);
        goal.nextReviewAt = new Date(Date.now() - DAY_IN_MS);
        goal.reviewDates = [];
        goalService.goals = [goal];
        // Remove saveGoals method to test the branch
        const originalSaveGoals = goalService.saveGoals;
        delete goalService.saveGoals;

        const result = reviewService.recordReview(goal.id, {
            motivation: goal.motivation,
            urgency: goal.urgency
        });

        expect(result).toBeTruthy();
        expect(goal.reviewDates).toHaveLength(1);

        // Restore method
        goalService.saveGoals = originalSaveGoals;
    });

    it('should handle recordReview when reviewIntervalIndex is at longest index and ratings match', () => {
        goal = createActiveGoal();
        const intervals = reviewService.getReviewIntervals();
        const longestIndex = intervals.length - 1;
        goal.reviewIntervalIndex = longestIndex;
        goal.lastReviewAt = new Date(Date.now() - 2 * DAY_IN_MS);
        goal.nextReviewAt = new Date(Date.now() - DAY_IN_MS);
        goal.reviewDates = [];
        goalService.goals = [goal];

        const result = reviewService.recordReview(goal.id, {
            motivation: goal.motivation,
            urgency: goal.urgency
        });

        expect(result).toBeTruthy();
        expect(result.ratingsMatch).toBe(true);
        // Should stay at longest index when ratings match
        expect(goal.reviewIntervalIndex).toBe(longestIndex);
        expect(goal.reviewDates).toHaveLength(1);
    });

    it('should handle calculateNextReviewDate with invalid intervalDays using fallback', () => {
        const base = new Date();
        const next = reviewService.calculateNextReviewDate(base, -5);
        const diffDays = Math.round((next - base) / DAY_IN_MS);
        // Should use fallback interval (first interval = 7 days)
        expect(diffDays).toBe(7);
    });
});

