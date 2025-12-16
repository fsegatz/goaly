const {
    normalizeDate,
    daysBetween,
    setToMidnight,
    isDateValid,
    getDaysUntilDeadline
} = require('../src/domain/utils/date-utils.js');

describe('date-utils', () => {
    describe('normalizeDate', () => {
        test('should return fallback for null value', () => {
            expect(normalizeDate(null)).toBeNull();
            expect(normalizeDate(null, new Date('2025-01-01'))).toEqual(new Date('2025-01-01'));
        });

        test('should return fallback for undefined value', () => {
            expect(normalizeDate(undefined)).toBeNull();
        });

        test('should return fallback for empty string', () => {
            expect(normalizeDate('')).toBeNull();
        });

        test('should return the same Date object if valid', () => {
            const date = new Date('2025-06-15');
            expect(normalizeDate(date)).toBe(date);
        });

        test('should return fallback for invalid Date object', () => {
            const invalidDate = new Date('invalid');
            expect(normalizeDate(invalidDate)).toBeNull();
            expect(normalizeDate(invalidDate, new Date('2025-01-01'))).toEqual(new Date('2025-01-01'));
        });

        test('should parse valid string dates', () => {
            const result = normalizeDate('2025-06-15');
            expect(result).toBeInstanceOf(Date);
            expect(result.getFullYear()).toBe(2025);
        });

        test('should parse valid timestamps', () => {
            const timestamp = new Date('2025-06-15').getTime();
            const result = normalizeDate(timestamp);
            expect(result).toBeInstanceOf(Date);
        });

        test('should return fallback for invalid string', () => {
            expect(normalizeDate('not-a-date')).toBeNull();
        });
    });

    describe('daysBetween', () => {
        test('should calculate days between two valid dates', () => {
            const date1 = new Date('2025-01-01');
            const date2 = new Date('2025-01-10');
            expect(daysBetween(date1, date2)).toBe(9);
        });

        test('should return negative for dates in reverse order', () => {
            const date1 = new Date('2025-01-10');
            const date2 = new Date('2025-01-01');
            expect(daysBetween(date1, date2)).toBe(-9);
        });

        test('should return 0 for the same date', () => {
            const date = new Date('2025-01-15');
            expect(daysBetween(date, date)).toBe(0);
        });

        test('should return NaN if first date is invalid', () => {
            expect(daysBetween(null, new Date())).toBeNaN();
        });

        test('should return NaN if second date is invalid', () => {
            expect(daysBetween(new Date(), null)).toBeNaN();
        });

        test('should work with string dates', () => {
            expect(daysBetween('2025-01-01', '2025-01-05')).toBe(4);
        });
    });

    describe('setToMidnight', () => {
        test('should set time to midnight', () => {
            const date = new Date('2025-06-15T14:30:45.123');
            const result = setToMidnight(date);
            expect(result.getHours()).toBe(0);
            expect(result.getMinutes()).toBe(0);
            expect(result.getSeconds()).toBe(0);
            expect(result.getMilliseconds()).toBe(0);
        });

        test('should preserve the date', () => {
            const date = new Date('2025-06-15T14:30:45.123');
            const result = setToMidnight(date);
            expect(result.getFullYear()).toBe(2025);
            expect(result.getMonth()).toBe(5); // June is month 5
            expect(result.getDate()).toBe(15);
        });

        test('should return a new Date object', () => {
            const date = new Date('2025-06-15T14:30:45.123');
            const result = setToMidnight(date);
            expect(result).not.toBe(date);
        });

        test('should use current date as fallback for invalid input', () => {
            const before = setToMidnight(new Date());
            const result = setToMidnight(null);
            const after = setToMidnight(new Date());
            // Result should be today at midnight
            expect(result.getHours()).toBe(0);
            expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
        });

        test('should work with string dates', () => {
            const result = setToMidnight('2025-06-15T14:30:45.123');
            expect(result.getHours()).toBe(0);
        });
    });

    describe('isDateValid', () => {
        test('should return false for null', () => {
            expect(isDateValid(null)).toBe(false);
        });

        test('should return false for undefined', () => {
            expect(isDateValid(undefined)).toBe(false);
        });

        test('should return false for empty string', () => {
            expect(isDateValid('')).toBe(false);
        });

        test('should return true for valid Date object', () => {
            expect(isDateValid(new Date('2025-06-15'))).toBe(true);
        });

        test('should return false for invalid Date object', () => {
            expect(isDateValid(new Date('invalid'))).toBe(false);
        });

        test('should return true for valid date string', () => {
            expect(isDateValid('2025-06-15')).toBe(true);
        });

        test('should return false for invalid date string', () => {
            expect(isDateValid('not-a-date')).toBe(false);
        });

        test('should return true for valid timestamp', () => {
            expect(isDateValid(Date.now())).toBe(true);
        });
    });

    describe('getDaysUntilDeadline', () => {
        test('should return positive days for future deadline', () => {
            const now = new Date('2025-01-01');
            const deadline = new Date('2025-01-10');
            expect(getDaysUntilDeadline(deadline, now)).toBe(9);
        });

        test('should return negative days for past deadline', () => {
            const now = new Date('2025-01-10');
            const deadline = new Date('2025-01-01');
            expect(getDaysUntilDeadline(deadline, now)).toBe(-9);
        });

        test('should return 1 for same-day deadline later in the day', () => {
            const now = new Date('2025-01-15T12:00:00');
            const deadline = new Date('2025-01-15T18:00:00');
            // Math.ceil rounds up any positive fraction - 6 hours is 0.25 days, rounds to 1
            expect(getDaysUntilDeadline(deadline, now)).toBe(1);
        });

        test('should return NaN for invalid deadline', () => {
            expect(getDaysUntilDeadline(null)).toBeNaN();
        });

        test('should use current date as default for now parameter', () => {
            const futureDeadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
            const result = getDaysUntilDeadline(futureDeadline);
            expect(result).toBeGreaterThanOrEqual(4);
            expect(result).toBeLessThanOrEqual(6);
        });

        test('should work with string dates', () => {
            expect(getDaysUntilDeadline('2025-01-10', new Date('2025-01-01'))).toBe(9);
        });
    });
});
