// tests/developer-mode-service.test.js
const DeveloperModeService = require('../src/domain/developer-mode-service.js').default;

describe('DeveloperModeService', () => {
    test('initial state is disabled', () => {
        const svc = new DeveloperModeService();
        expect(svc.isDeveloperMode()).toBe(false);
    });

    test('enable and disable flip the flag', () => {
        const svc = new DeveloperModeService();
        svc.enable();
        expect(svc.isDeveloperMode()).toBe(true);
        svc.disable();
        expect(svc.isDeveloperMode()).toBe(false);
    });

    test('toggle returns new state', () => {
        const svc = new DeveloperModeService();
        const afterFirst = svc.toggle();
        expect(afterFirst).toBe(true);
        expect(svc.isDeveloperMode()).toBe(true);
        const afterSecond = svc.toggle();
        expect(afterSecond).toBe(false);
        expect(svc.isDeveloperMode()).toBe(false);
    });
});


