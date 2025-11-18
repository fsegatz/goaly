const {
    GOAL_FILE_VERSION,
    isValidVersion,
    compareVersions,
    isOlderVersion,
    isSameVersion,
    isNewerVersion
} = require('../src/domain/utils/versioning');

describe('versioning utilities', () => {
    test('validates semantic version strings', () => {
        expect(isValidVersion('1.0.0')).toBe(true);
        expect(isValidVersion('10.2.3')).toBe(true);
        expect(isValidVersion('1.0')).toBe(false);
        expect(isValidVersion('v1.0.0')).toBe(false);
        expect(isValidVersion('1.0.0-beta')).toBe(false);
        expect(isValidVersion(null)).toBe(false);
    });

    test('compares versions correctly', () => {
        expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
        expect(compareVersions('1.2.4', '1.2.3')).toBe(1);
        expect(compareVersions('1.2.3', '1.3.0')).toBe(-1);
        expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    });

    test('throws when comparing invalid versions', () => {
        expect(() => compareVersions('1.0', '1.0.0')).toThrow('Invalid semantic version provided.');
    });

    test('detects relative version order against current version', () => {
        expect(isSameVersion(GOAL_FILE_VERSION, GOAL_FILE_VERSION)).toBe(true);
        expect(isOlderVersion('0.9.0', GOAL_FILE_VERSION)).toBe(true);
        expect(isNewerVersion('9.9.9', GOAL_FILE_VERSION)).toBe(true);
    });

    test('treats invalid candidates conservatively', () => {
        expect(isOlderVersion('invalid', GOAL_FILE_VERSION)).toBe(true);
        expect(isSameVersion('invalid', GOAL_FILE_VERSION)).toBe(false);
        expect(isNewerVersion('invalid', GOAL_FILE_VERSION)).toBe(false);
    });

    test('compares versions with different minor versions', () => {
        expect(compareVersions('1.3.0', '1.2.0')).toBe(1);
        expect(compareVersions('1.2.0', '1.3.0')).toBe(-1);
    });

    test('compares versions with different patch versions', () => {
        expect(compareVersions('1.2.4', '1.2.3')).toBe(1);
        expect(compareVersions('1.2.3', '1.2.4')).toBe(-1);
    });

    test('isValidVersion handles non-string types', () => {
        expect(isValidVersion(123)).toBe(false);
        expect(isValidVersion(null)).toBe(false);
        expect(isValidVersion(undefined)).toBe(false);
        expect(isValidVersion({})).toBe(false);
    });
});

