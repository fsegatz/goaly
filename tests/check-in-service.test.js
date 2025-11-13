// tests/check-in-service.test.js

const CheckInService = require('../src/domain/check-in-service').default;
const GoalService = require('../src/domain/goal-service').default;
const Goal = require('../src/domain/goal').default;
const SettingsService = require('../src/domain/settings-service').default;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

describe('CheckIn Service', () => {
    let checkInService;
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
            reviewIntervals: [30, 14, 7],
            maxActiveGoals: 3,
            language: 'en'
        });
        checkInService = new CheckInService(goalService, settingsService);
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

    it('should identify an active goal with past nextCheckInAt as due', () => {
        goal = createActiveGoal();
        goal.reviewIntervalIndex = 0;
        goal.lastCheckInAt = new Date(Date.now() - 31 * DAY_IN_MS);
        goal.nextCheckInAt = new Date(Date.now() - 1 * DAY_IN_MS);
        goalService.goals = [goal];

        const checkIns = checkInService.getCheckIns();

        expect(checkIns).toHaveLength(1);
        expect(checkIns[0].goal.id).toBe(goal.id);
    });

    it('should ignore non-active goals even if nextCheckInAt is in the past', () => {
        goal = createActiveGoal({ status: 'paused' });
        goal.reviewIntervalIndex = 0;
        goal.nextCheckInAt = new Date(Date.now() - DAY_IN_MS);
        goalService.goals = [goal];

        const checkIns = checkInService.getCheckIns();
        expect(checkIns).toHaveLength(0);
    });

    it('should calculate a default next review when none is scheduled', () => {
        goal = createActiveGoal({ createdAt: new Date(Date.now() - 2 * DAY_IN_MS) });
        goal.reviewIntervalIndex = undefined;
        goal.lastCheckInAt = null;
        goal.nextCheckInAt = null;
        goal.checkInDates = [];
        goalService.goals = [goal];

        checkInService.ensureGoalSchedule(goal);

        expect(goal.reviewIntervalIndex).toBe(0);
        expect(goal.nextCheckInAt).toBeInstanceOf(Date);
        expect(goal.lastCheckInAt).toBeInstanceOf(Date);
    });

    it('should derive last check-in from latest valid history entry', () => {
        const earlier = new Date(Date.now() - 5 * DAY_IN_MS).toISOString();
        const latest = new Date(Date.now() - 2 * DAY_IN_MS).toISOString();

        goal = createActiveGoal({
            reviewIntervalIndex: 5, // invalid index
            checkInDates: ['not-a-date', earlier, latest],
            lastCheckInAt: 'bad-date',
            createdAt: 'invalid'
        });
        goal.nextCheckInAt = null;
        goalService.goals = [goal];

        checkInService.ensureGoalSchedule(goal);

        expect(goal.reviewIntervalIndex).toBe(0);
        expect(goal.lastCheckInAt).toBeInstanceOf(Date);
        expect(goal.lastCheckInAt.toISOString()).toBe(latest);
        expect(goal.nextCheckInAt).toBeInstanceOf(Date);
    });

    it('should shorten the interval when ratings stay the same', () => {
        goal = createActiveGoal();
        goal.reviewIntervalIndex = 0;
        goal.lastCheckInAt = new Date(Date.now() - 31 * DAY_IN_MS);
        goal.nextCheckInAt = new Date(Date.now() - DAY_IN_MS);
        goal.checkInDates = [];
        goalService.goals = [goal];

        const result = checkInService.recordReview(goal.id, {
            motivation: goal.motivation,
            urgency: goal.urgency
        });

        expect(result).toBeTruthy();
        expect(result.ratingsMatch).toBe(true);
        expect(goal.reviewIntervalIndex).toBe(1);
        expect(goal.checkInDates).toHaveLength(1);
        expect(goal.nextCheckInAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should reset to the longest interval when ratings change', () => {
        goal = createActiveGoal({ motivation: 3, urgency: 3 });
        goal.reviewIntervalIndex = 2;
        goal.lastCheckInAt = new Date(Date.now() - 10 * DAY_IN_MS);
        goal.nextCheckInAt = new Date(Date.now() - DAY_IN_MS);
        goal.checkInDates = [];
        goalService.goals = [goal];

        const result = checkInService.recordReview(goal.id, {
            motivation: 5,
            urgency: 5
        });

        expect(result).toBeTruthy();
        expect(result.ratingsMatch).toBe(false);
        expect(goal.reviewIntervalIndex).toBe(0);
        expect(goal.motivation).toBe(5);
        expect(goal.urgency).toBe(5);
        expect(goal.checkInDates).toHaveLength(1);
        expect(goal.nextCheckInAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return null when recording a review for a missing goal', () => {
        const result = checkInService.recordReview('missing', {
            motivation: 3,
            urgency: 3
        });

        expect(result).toBeNull();
    });

    it('should return null when scheduling non-active goals', () => {
        goal = createActiveGoal({ status: 'paused' });
        expect(checkInService.ensureGoalSchedule(goal)).toBeNull();
    });

    it('should fallback to default intervals when settings provide none', () => {
        const customSettings = {
            getReviewIntervals: jest.fn(() => []),
            getSettings: jest.fn(() => ({ maxActiveGoals: 3 }))
        };
        const customService = new CheckInService(goalService, customSettings);
        expect(customService.getReviewIntervals()).toEqual([7, 14, 30]);
    });

    it('should return empty check-ins when next review is in the future', () => {
        goal = createActiveGoal();
        goal.nextCheckInAt = new Date(Date.now() + 60 * 1000);
        goalService.goals = [goal];
        const checkIns = checkInService.getCheckIns();
        expect(checkIns).toHaveLength(0);
    });

    it('should sort check-ins by nearest due date', () => {
        const now = Date.now();
        const goalA = createActiveGoal({ id: 'A' });
        const goalB = createActiveGoal({ id: 'B' });
        goalA.nextCheckInAt = new Date(now - 5 * 60 * 1000);
        goalB.nextCheckInAt = new Date(now - 60 * 1000);
        goalService.goals = [goalB, goalA];

        const result = checkInService.getCheckIns();
        expect(result.map(entry => entry.goal.id)).toEqual(['A', 'B']);
        expect(result[0].isOverdue).toBe(true);
    });

    it('should tolerate invalid rating inputs and keep previous values', () => {
        goal = createActiveGoal({ reviewIntervalIndex: 0 });
        goal.checkInDates = [];
        goal.lastCheckInAt = new Date(Date.now() - 2 * DAY_IN_MS);
        goal.nextCheckInAt = new Date(Date.now() - DAY_IN_MS);
        goalService.goals = [goal];

        const result = checkInService.recordReview(goal.id, {
            motivation: 'abc',
            urgency: null
        });

        expect(result).toBeTruthy();
        expect(goal.motivation).toBe(3);
        expect(goal.urgency).toBe(4);
    });

    it('should calculate next review using fallback interval when invalid days provided', () => {
        const base = new Date();
        const next = checkInService.calculateNextCheckInDate(base, NaN);
        const diffDays = Math.round((next - base) / DAY_IN_MS);
        expect(diffDays).toBe(7);
    });

    it('should fallback to current time when base date is invalid', () => {
        const next = checkInService.calculateNextCheckInDate('not-a-date', 1);
        const now = Date.now();
        expect(next.getTime()).toBeGreaterThanOrEqual(now);
    });

    it('should fall back to createdAt when no valid check-in dates exist', () => {
        const createdAt = new Date(Date.now() - 3 * DAY_IN_MS);
        goal = createActiveGoal({ createdAt, checkInDates: ['bad-date'], lastCheckInAt: null, reviewIntervalIndex: null });
        goal.nextCheckInAt = null;
        checkInService.ensureGoalSchedule(goal);
        expect(goal.reviewIntervalIndex).toBe(0);
        expect(goal.lastCheckInAt.toISOString()).toBe(createdAt.toISOString());
        expect(goal.nextCheckInAt).toBeInstanceOf(Date);
    });

    it('should initialise checkInDates when undefined during recordReview', () => {
        goal = createActiveGoal({ reviewIntervalIndex: 0 });
        goal.checkInDates = undefined;
        goal.lastCheckInAt = new Date(Date.now() - 2 * DAY_IN_MS);
        goal.nextCheckInAt = new Date(Date.now() - DAY_IN_MS);
        goalService.goals = [goal];

        const result = checkInService.recordReview(goal.id, { motivation: goal.motivation, urgency: goal.urgency });
        expect(result).toBeTruthy();
        expect(Array.isArray(goal.checkInDates)).toBe(true);
        expect(goal.checkInDates).toHaveLength(1);
    });

    it('should report goal due when next review has passed', () => {
        goal = createActiveGoal();
        goal.nextCheckInAt = new Date(Date.now() - 1000);
        expect(checkInService.shouldCheckIn(goal)).toBe(true);
    });

    it('should return false when next review is in the future', () => {
        goal = createActiveGoal();
        goal.nextCheckInAt = new Date(Date.now() + 1000);
        expect(checkInService.shouldCheckIn(goal)).toBe(false);
    });
});
