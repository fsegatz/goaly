const {
    prepareExportPayload,
    migratePayloadToCurrent,
    prepareGoalsStoragePayload
} = require('../src/domain/migration/migration-service');
const { GOAL_FILE_VERSION } = require('../src/domain/utils/versioning');

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

    test('migratePayloadToCurrent migrates goal description to first step', () => {
        const goalWithDescription = {
            id: '1',
            title: 'Goal with description',
            description: 'This is a description',
            motivation: 3,
            urgency: 4
        };
        const migrated = migratePayloadToCurrent({ goals: [goalWithDescription] });
        expect(migrated.goals[0].description).toBeUndefined();
        expect(migrated.goals[0].steps).toBeDefined();
        expect(Array.isArray(migrated.goals[0].steps)).toBe(true);
        expect(migrated.goals[0].steps[0].text).toBe('This is a description');
        expect(migrated.goals[0].steps[0].completed).toBe(false);
        expect(migrated.goals[0].steps[0].order).toBe(0);
    });

    test('migratePayloadToCurrent does not create step from empty description', () => {
        const goalWithEmptyDescription = {
            id: '1',
            title: 'Goal',
            description: '',
            motivation: 3
        };
        const migrated = migratePayloadToCurrent({ goals: [goalWithEmptyDescription] });
        expect(migrated.goals[0].description).toBeUndefined();
        expect(migrated.goals[0].steps).toBeDefined();
        expect(Array.isArray(migrated.goals[0].steps)).toBe(true);
        expect(migrated.goals[0].steps).toHaveLength(0);
    });

    test('migratePayloadToCurrent does not create step from whitespace-only description', () => {
        const goalWithWhitespaceDescription = {
            id: '1',
            title: 'Goal',
            description: '   \n\t  ',
            motivation: 3
        };
        const migrated = migratePayloadToCurrent({ goals: [goalWithWhitespaceDescription] });
        expect(migrated.goals[0].description).toBeUndefined();
        expect(migrated.goals[0].steps).toBeDefined();
        expect(Array.isArray(migrated.goals[0].steps)).toBe(true);
        expect(migrated.goals[0].steps).toHaveLength(0);
    });

    test('migratePayloadToCurrent does not create step from non-string description', () => {
        const goalWithNonStringDescription = {
            id: '1',
            title: 'Goal',
            description: 123,
            motivation: 3
        };
        const migrated = migratePayloadToCurrent({ goals: [goalWithNonStringDescription] });
        expect(migrated.goals[0].description).toBeUndefined();
        expect(migrated.goals[0].steps).toBeDefined();
        expect(Array.isArray(migrated.goals[0].steps)).toBe(true);
        expect(migrated.goals[0].steps).toHaveLength(0);
    });

    test('migratePayloadToCurrent shifts existing steps when description is migrated', () => {
        const goalWithDescriptionAndSteps = {
            id: '1',
            title: 'Goal',
            description: 'First step from description',
            steps: [
                { id: 'step1', text: 'Existing step 1', completed: false, order: 0 },
                { id: 'step2', text: 'Existing step 2', completed: true, order: 1 }
            ],
            motivation: 3
        };
        const migrated = migratePayloadToCurrent({ goals: [goalWithDescriptionAndSteps] });
        expect(migrated.goals[0].steps).toHaveLength(3);
        expect(migrated.goals[0].steps[0].text).toBe('First step from description');
        expect(migrated.goals[0].steps[0].order).toBe(0);
        expect(migrated.goals[0].steps[1].text).toBe('Existing step 1');
        expect(migrated.goals[0].steps[1].order).toBe(1);
        expect(migrated.goals[0].steps[2].text).toBe('Existing step 2');
        expect(migrated.goals[0].steps[2].order).toBe(2);
    });

    test('migratePayloadToCurrent ensures steps array exists even without description', () => {
        const goalWithoutDescription = {
            id: '1',
            title: 'Goal',
            motivation: 3
        };
        const migrated = migratePayloadToCurrent({ goals: [goalWithoutDescription] });
        expect(migrated.goals[0].steps).toBeDefined();
        expect(Array.isArray(migrated.goals[0].steps)).toBe(true);
    });

    test('migratePayloadToCurrent migrates checkInDates to reviewDates', () => {
        const goalWithCheckIn = {
            id: '1',
            title: 'Goal',
            checkInDates: ['2025-01-01', '2025-01-15'],
            motivation: 3
        };
        const migrated = migratePayloadToCurrent({ goals: [goalWithCheckIn] });
        expect(migrated.goals[0].checkInDates).toBeUndefined();
        expect(migrated.goals[0].reviewDates).toEqual(['2025-01-01', '2025-01-15']);
    });

    test('migratePayloadToCurrent migrates lastCheckInAt to lastReviewAt', () => {
        const goalWithCheckIn = {
            id: '1',
            title: 'Goal',
            lastCheckInAt: '2025-01-01T00:00:00.000Z',
            motivation: 3
        };
        const migrated = migratePayloadToCurrent({ goals: [goalWithCheckIn] });
        expect(migrated.goals[0].lastCheckInAt).toBeUndefined();
        expect(migrated.goals[0].lastReviewAt).toBe('2025-01-01T00:00:00.000Z');
    });


    test('migratePayloadToCurrent handles goal with null value', () => {
        const migrated = migratePayloadToCurrent({ goals: [null] });
        expect(migrated.goals).toHaveLength(1);
        expect(migrated.goals[0]).toBeNull();
    });

    test('migratePayloadToCurrent handles goal that is not an object', () => {
        const migrated = migratePayloadToCurrent({ goals: ['not an object', 123] });
        expect(migrated.goals).toHaveLength(2);
        expect(migrated.goals[0]).toBe('not an object');
        expect(migrated.goals[1]).toBe(123);
    });

});

