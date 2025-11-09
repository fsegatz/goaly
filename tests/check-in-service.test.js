// tests/check-in-service.test.js

const CheckInService = require('../src/domain/check-in-service');
const Goal = require('../src/domain/goal');

describe('CheckIn Service', () => {
    let checkInService;
    let goals;
    let settings;

    beforeEach(() => {
        settings = {
            checkInInterval: 1 // 1 minute for testing
        };
    });

    it('should identify a goal that needs a check-in', () => {
        const now = new Date();
        const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);
        goals = [
            new Goal({ title: 'Test Goal', status: 'active', createdAt: threeMinutesAgo })
        ];
        checkInService = new CheckInService(goals, settings);
        const checkIns = checkInService.getCheckIns();
        expect(checkIns.length).toBe(1);
        expect(checkIns[0].goal.title).toBe('Test Goal');
    });

    it('should not identify a goal that does not need a check-in', () => {
        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 1 * 60 * 1000);
        goals = [
            new Goal({ title: 'Test Goal', status: 'active', createdAt: oneMinuteAgo })
        ];
        checkInService = new CheckInService(goals, settings);
        const checkIns = checkInService.getCheckIns();
        expect(checkIns.length).toBe(0);
    });

    it('should not identify a paused goal for check-in', () => {
        const now = new Date();
        const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);
        goals = [
            new Goal({ title: 'Test Goal', status: 'paused', createdAt: threeMinutesAgo })
        ];
        checkInService = new CheckInService(goals, settings);
        const checkIns = checkInService.getCheckIns();
        expect(checkIns.length).toBe(0);
    });

    it('should perform a check-in', () => {
        const goal = new Goal({ title: 'Test Goal', status: 'active' });
        goals = [goal];
        checkInService = new CheckInService(goals, settings);
        checkInService.performCheckIn(goal.id);
        expect(goal.checkInDates.length).toBe(1);
    });
});
