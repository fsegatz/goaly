// tests/timer-service.test.js

const TimerService = require('../src/domain/services/timer-service').default;

describe('TimerService', () => {
    let mockApp;
    let service;

    beforeEach(() => {
        jest.useFakeTimers();
        mockApp = {
            refreshReviews: jest.fn()
        };
        service = new TimerService(mockApp);
    });

    afterEach(() => {
        if (service.reviewTimer) {
            service.stopReviewTimer();
        }
        // Clear all fake timers before switching to real timers
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    test('startReviewTimer should call refreshReviews immediately', () => {
        service.startReviewTimer();

        expect(mockApp.refreshReviews).toHaveBeenCalledTimes(1);
    });

    test('startReviewTimer should set up interval to call refreshReviews', () => {
        service.startReviewTimer();

        expect(mockApp.refreshReviews).toHaveBeenCalledTimes(1);

        // Fast-forward 1 minute (with 5-second interval, this should trigger 12 more calls)
        jest.advanceTimersByTime(60000);

        // 1 initial call + 12 interval calls (60 seconds / 5 seconds = 12)
        expect(mockApp.refreshReviews).toHaveBeenCalledTimes(13);
    });

    test('startReviewTimer should clear existing timer before starting new one', () => {
        service.startReviewTimer();
        const firstTimer = service.reviewTimer;

        service.startReviewTimer();
        const secondTimer = service.reviewTimer;

        expect(firstTimer).not.toBe(secondTimer);
    });

    test('startReviewTimer should call unref if available', () => {
        const unrefSpy = jest.fn();
        const originalSetInterval = global.setInterval;
        global.setInterval = jest.fn((callback, delay) => {
            const timer = originalSetInterval(callback, delay);
            timer.unref = unrefSpy;
            return timer;
        });

        service.startReviewTimer();

        expect(unrefSpy).toHaveBeenCalled();

        // Clean up before restoring
        if (service.reviewTimer) {
            service.stopReviewTimer();
        }
        global.setInterval = originalSetInterval;
    });

    test('stopReviewTimer should clear timer', () => {
        service.startReviewTimer();
        expect(service.reviewTimer).not.toBeNull();

        service.stopReviewTimer();

        expect(service.reviewTimer).toBeNull();
    });

    test('stopReviewTimer should handle null timer', () => {
        service.reviewTimer = null;

        expect(() => service.stopReviewTimer()).not.toThrow();
        expect(service.reviewTimer).toBeNull();
    });

    test('stopReviewTimer should prevent further refreshReviews calls', () => {
        service.startReviewTimer();
        const callCount = mockApp.refreshReviews.mock.calls.length;

        service.stopReviewTimer();

        jest.advanceTimersByTime(60000);

        expect(mockApp.refreshReviews).toHaveBeenCalledTimes(callCount);
    });

    test('startReviewTimer should handle timer without unref method', () => {
        const originalSetInterval = global.setInterval;
        global.setInterval = jest.fn((callback, delay) => {
            const timer = originalSetInterval(callback, delay);
            // Remove unref method to test the branch where it doesn't exist
            delete timer.unref;
            return timer;
        });

        expect(() => service.startReviewTimer()).not.toThrow();
        expect(mockApp.refreshReviews).toHaveBeenCalledTimes(1);

        // Clean up before restoring
        if (service.reviewTimer) {
            service.stopReviewTimer();
        }
        global.setInterval = originalSetInterval;
    });
});

