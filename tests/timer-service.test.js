// tests/timer-service.test.js

const TimerService = require('../src/domain/services/timer-service').default;

describe('TimerService', () => {
    let mockApp;
    let service;

    beforeEach(() => {
        jest.useFakeTimers();
        mockApp = {
            refreshCheckIns: jest.fn()
        };
        service = new TimerService(mockApp);
    });

    afterEach(() => {
        jest.useRealTimers();
        if (service.checkInTimer) {
            clearInterval(service.checkInTimer);
        }
    });

    test('startCheckInTimer should call refreshCheckIns immediately', () => {
        service.startCheckInTimer();

        expect(mockApp.refreshCheckIns).toHaveBeenCalledTimes(1);
    });

    test('startCheckInTimer should set up interval to call refreshCheckIns', () => {
        service.startCheckInTimer();

        expect(mockApp.refreshCheckIns).toHaveBeenCalledTimes(1);

        // Fast-forward 1 minute
        jest.advanceTimersByTime(60000);

        expect(mockApp.refreshCheckIns).toHaveBeenCalledTimes(2);
    });

    test('startCheckInTimer should clear existing timer before starting new one', () => {
        service.startCheckInTimer();
        const firstTimer = service.checkInTimer;

        service.startCheckInTimer();
        const secondTimer = service.checkInTimer;

        expect(firstTimer).not.toBe(secondTimer);
    });

    test('startCheckInTimer should call unref if available', () => {
        const unrefSpy = jest.fn();
        const originalSetInterval = global.setInterval;
        global.setInterval = jest.fn((callback, delay) => {
            const timer = originalSetInterval(callback, delay);
            timer.unref = unrefSpy;
            return timer;
        });

        service.startCheckInTimer();

        expect(unrefSpy).toHaveBeenCalled();

        global.setInterval = originalSetInterval;
    });

    test('stopCheckInTimer should clear timer', () => {
        service.startCheckInTimer();
        expect(service.checkInTimer).not.toBeNull();

        service.stopCheckInTimer();

        expect(service.checkInTimer).toBeNull();
    });

    test('stopCheckInTimer should handle null timer', () => {
        service.checkInTimer = null;

        expect(() => service.stopCheckInTimer()).not.toThrow();
        expect(service.checkInTimer).toBeNull();
    });

    test('stopCheckInTimer should prevent further refreshCheckIns calls', () => {
        service.startCheckInTimer();
        const callCount = mockApp.refreshCheckIns.mock.calls.length;

        service.stopCheckInTimer();

        jest.advanceTimersByTime(60000);

        expect(mockApp.refreshCheckIns).toHaveBeenCalledTimes(callCount);
    });
});

