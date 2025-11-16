const {
    prepareExportPayload,
    migratePayloadToCurrent,
    prepareGoalsStoragePayload
} = require('../src/domain/migration-service');
const { GOAL_FILE_VERSION } = require('../src/domain/versioning');

describe('migration service', () => {
    const sampleGoals = [
        {
            id: '1',
            title: 'Goal',
            motivation: 3,
            urgency: 4,
            createdAt: new Date('2025-01-01T00:00:00.000Z'),
            lastUpdated: new Date('2025-01-02T00:00:00.000Z')
        }
    ];

    const sampleSettings = {
        maxActiveGoals: 3,
        language: 'en'
    };

    test('prepareExportPayload includes version and clones data', () => {
        const payload = prepareExportPayload(sampleGoals, sampleSettings);
        expect(payload.version).toBe(GOAL_FILE_VERSION);
        expect(payload.goals).not.toBe(sampleGoals);
        expect(payload.settings).not.toBe(sampleSettings);
        expect(payload.goals[0].createdAt).toBe('2025-01-01T00:00:00.000Z');
        expect(payload.exportDate).toBeDefined();
    });

    test('migratePayloadToCurrent upgrades legacy array format', () => {
        const migrated = migratePayloadToCurrent(sampleGoals);
        expect(migrated.version).toBe(GOAL_FILE_VERSION);
        expect(Array.isArray(migrated.goals)).toBe(true);
        expect(migrated.goals[0].title).toBe('Goal');
    });

    test('migratePayloadToCurrent preserves settings when present', () => {
        const legacyPayload = {
            goals: sampleGoals,
            settings: sampleSettings,
            exportDate: '2025-01-05T00:00:00.000Z'
        };

        const migrated = migratePayloadToCurrent(legacyPayload);
        expect(migrated.version).toBe(GOAL_FILE_VERSION);
        expect(migrated.settings).toEqual(sampleSettings);
        expect(migrated.exportDate).toBe('2025-01-05T00:00:00.000Z');
    });

    test('prepareGoalsStoragePayload wraps goals with version metadata', () => {
        const payload = prepareGoalsStoragePayload(sampleGoals);
        expect(payload.version).toBe(GOAL_FILE_VERSION);
        expect(payload.goals).toHaveLength(1);
        expect(payload.goals[0]).toHaveProperty('title', 'Goal');
    });

    test('migratePayloadToCurrent handles missing goals by setting empty array', () => {
        const migrated = migratePayloadToCurrent({ settings: sampleSettings });
        expect(Array.isArray(migrated.goals)).toBe(true);
        expect(migrated.goals).toHaveLength(0);
    });

    test('migratePayloadToCurrent handles non-array goals by resetting to empty array', () => {
        const migrated = migratePayloadToCurrent({ goals: {}, settings: sampleSettings });
        expect(Array.isArray(migrated.goals)).toBe(true);
        expect(migrated.goals).toHaveLength(0);
    });

    test('prepareExportPayload handles non-array goals input by producing empty goals', () => {
        const payload = prepareExportPayload({}, sampleSettings);
        expect(Array.isArray(payload.goals)).toBe(true);
        expect(payload.goals).toHaveLength(0);
        expect(payload.version).toBe(GOAL_FILE_VERSION);
    });

    test('prepareExportPayload handles undefined goals input by producing empty goals', () => {
        const payload = prepareExportPayload(undefined, sampleSettings);
        expect(Array.isArray(payload.goals)).toBe(true);
        expect(payload.goals).toHaveLength(0);
        expect(payload.version).toBe(GOAL_FILE_VERSION);
    });
});

