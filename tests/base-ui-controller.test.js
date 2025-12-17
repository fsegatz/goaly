
import { BaseUIController } from '../src/ui/base-view';
import { createBasicDOM, setupGlobalDOM, cleanupGlobalDOM, createMockApp, setupBrowserMocks, cleanupBrowserMocks } from './mocks';

describe('BaseUIController', () => {
    let baseUIController;
    let mockApp;
    let dom;

    beforeEach(() => {
        dom = createBasicDOM();
        setupGlobalDOM(dom);
        setupBrowserMocks();

        mockApp = createMockApp({
            languageService: {
                translate: jest.fn((key, replacements) => {
                    if (key === 'deadline.overdue') return `Overdue by ${replacements.count}`;
                    if (key === 'deadline.today') return 'Today';
                    if (key === 'deadline.tomorrow') return 'Tomorrow';
                    if (key === 'deadline.inDays') return `In ${replacements.count} days`;
                    if (key === 'reviews.interval.unknown') return 'Unknown';
                    if (key === 'reviews.interval.days') return `${replacements.count} days`;
                    if (key === 'reviews.interval.hours') return `${replacements.count} hours`;
                    if (key === 'reviews.interval.minutes') return `${replacements.count} minutes`;
                    if (key === 'reviews.interval.seconds') return `${replacements.count} seconds`;
                    if (key === 'status.inactive') return 'Inactive';
                    if (key === 'status.active') return 'Active';
                    return key;
                }),
                onChange: jest.fn(() => jest.fn()),
                applyTranslations: jest.fn(),
                getLocale: jest.fn(() => 'en-US')
            },
            goalService: {
                priorityCache: {
                    getPriority: jest.fn(),
                    getAllPriorities: jest.fn()
                }
            }
        });

        // Mock renderViews generically as it's abstract/not defined in BaseUIController but called
        BaseUIController.prototype.renderViews = jest.fn();

        baseUIController = new BaseUIController(mockApp);
    });

    afterEach(() => {
        cleanupGlobalDOM(dom);
        cleanupBrowserMocks();
    });

    test('constructor should subscribe to language changes', () => {
        expect(mockApp.languageService.onChange).toHaveBeenCalled();
    });

    test('applyLanguageUpdates should apply translations and render views', () => {
        baseUIController.applyLanguageUpdates();
        expect(mockApp.languageService.applyTranslations).toHaveBeenCalled();
        expect(baseUIController.renderViews).toHaveBeenCalled();
    });

    test('getPriority should delegate to cache', () => {
        mockApp.goalService.priorityCache.getPriority.mockReturnValue(5);
        expect(baseUIController.getPriority('1')).toBe(5);
        expect(mockApp.goalService.priorityCache.getPriority).toHaveBeenCalledWith('1');
    });

    test('getAllPriorities should delegate to cache', () => {
        const map = new Map();
        mockApp.goalService.priorityCache.getAllPriorities.mockReturnValue(map);
        expect(baseUIController.getAllPriorities()).toBe(map);
    });

    test('formatDeadline should handle overdue', () => {
        const today = new Date();
        const overdue = new Date(today);
        overdue.setDate(today.getDate() - 2);
        expect(baseUIController.formatDeadline(overdue)).toBe('Overdue by 2');
    });

    test('formatDeadline should handle today', () => {
        const today = new Date();
        expect(baseUIController.formatDeadline(today)).toBe('Today');
    });

    test('formatDeadline should handle tomorrow', () => {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        expect(baseUIController.formatDeadline(tomorrow)).toBe('Tomorrow');
    });

    test('formatDeadline should handle urgent (in 2 days)', () => {
        const today = new Date();
        const urgent = new Date(today);
        urgent.setDate(today.getDate() + 2);
        expect(baseUIController.formatDeadline(urgent)).toBe('In 2 days');
    });

    test('formatDeadline should handle non-urgent (far future)', () => {
        const today = new Date();
        const future = new Date(today);
        future.setDate(today.getDate() + 10);
        // Should use locale string
        const localeString = future.toLocaleDateString('en-US');
        expect(baseUIController.formatDeadline(future)).toBe(localeString);
    });

    test('isDeadlineUrgent should return false for null', () => {
        expect(baseUIController.isDeadlineUrgent(null)).toBe(false);
    });

    test('isDeadlineUrgent should return true for urgent deadline', () => {
        const today = new Date();
        const urgent = new Date(today);
        urgent.setDate(today.getDate() + 2);
        expect(baseUIController.isDeadlineUrgent(urgent)).toBe(true);
    });

    test('isDeadlineUrgent should return false for far future deadline', () => {
        const today = new Date();
        const future = new Date(today);
        future.setDate(today.getDate() + 10);
        expect(baseUIController.isDeadlineUrgent(future)).toBe(false);
    });

    test('getStatusText should translate specific statuses', () => {
        expect(baseUIController.getStatusText('inactive')).toBe('Inactive');
        expect(baseUIController.getStatusText('active')).toBe('Active');
    });

    test('getStatusText should fallback to key if no translation', () => {
        expect(baseUIController.getStatusText('unknown')).toBe('unknown');
    });

    test('escapeHtml should escape special characters', () => {
        expect(baseUIController.escapeHtml('<div>')).toBe('&lt;div&gt;');
        expect(baseUIController.escapeHtml('&')).toBe('&amp;');
    });

    test('formatDateTime should handle dates', () => {
        const date = new Date('2025-01-01T12:00:00');
        const formatted = baseUIController.formatDateTime(date);
        expect(formatted).toContain('01/01/2025');
        expect(formatted).toContain('12:00'); // Depends on mock locale but 'en-US' usually like this
    });

    test('formatDateTime should handle null', () => {
        expect(baseUIController.formatDateTime(null)).toBe('');
    });

    test('formatDate should handle dates', () => {
        const date = new Date('2025-01-01T12:00:00');
        expect(baseUIController.formatDate(date)).toBe('1/1/2025');
    });

    test('formatDate should handle null', () => {
        expect(baseUIController.formatDate(null)).toBe('');
    });

    test('formatReviewIntervalInput should handle invalid inputs', () => {
        expect(baseUIController.formatReviewIntervalInput(0)).toBe('');
        expect(baseUIController.formatReviewIntervalInput(-1)).toBe('');
        expect(baseUIController.formatReviewIntervalInput(null)).toBe('');
    });

    test('formatReviewIntervalInput should format days', () => {
        expect(baseUIController.formatReviewIntervalInput(1)).toBe('1d');
        // 2.5 days = 60 hours, which is not divisible by 24 hours, so it returns hours
        expect(baseUIController.formatReviewIntervalInput(2.5)).toBe('60h');
    });

    test('formatReviewIntervalInput should format hours', () => {
        expect(baseUIController.formatReviewIntervalInput(0.5)).toBe('12h'); // 12 hours
    });

    test('formatReviewIntervalInput should format minutes', () => {
        expect(baseUIController.formatReviewIntervalInput(1 / 24 / 60 * 30)).toBe('30m'); // 30 mins
    });

    test('formatReviewIntervalInput should format seconds', () => {
        expect(baseUIController.formatReviewIntervalInput(1 / 24 / 60 / 60 * 30)).toBe('30s'); // 30 seconds
    });

    test('formatReviewIntervalDisplay should handle invalid inputs', () => {
        expect(baseUIController.formatReviewIntervalDisplay(0)).toBe('Unknown');
    });

    test('formatReviewIntervalDisplay should format days', () => {
        expect(baseUIController.formatReviewIntervalDisplay(1)).toBe('1 days');
    });

    test('formatReviewIntervalDisplay should format hours', () => {
        expect(baseUIController.formatReviewIntervalDisplay(0.5)).toBe('12 hours');
    });

    test('formatReviewIntervalDisplay should format minutes', () => {
        expect(baseUIController.formatReviewIntervalDisplay(1 / 24 / 60 * 30)).toBe('30 minutes');
    });

    test('formatReviewIntervalDisplay should format seconds', () => {
        expect(baseUIController.formatReviewIntervalDisplay(1 / 24 / 60 / 60 * 30)).toBe('30 seconds');
    });
});
