// tests/migration-manager.test.js

const MigrationManager = require('../src/domain/migration/migration-manager').default;
const { GOAL_FILE_VERSION } = require('../src/domain/utils/versioning');

describe('MigrationManager', () => {
    let mockApp;
    let manager;

    beforeEach(() => {
        global.alert = jest.fn();

        mockApp = {
            currentDataVersion: GOAL_FILE_VERSION,
            languageService: {
                translate: jest.fn((key, replacements) => {
                    if (key === 'import.success') return 'Migration successful';
                    if (key === 'import.migrationCancelled') return 'Migration cancelled';
                    if (key === 'import.incompatible') return 'Incompatible';
                    if (key === 'import.error') return `Error: ${replacements?.message || ''}`;
                    return key;
                })
            },
            uiController: {
                openMigrationPrompt: jest.fn(),
                openMigrationDiff: jest.fn(),
                closeMigrationModals: jest.fn()
            },
            applyImportedPayload: jest.fn()
        };

        manager = new MigrationManager(mockApp);
    });

    afterEach(() => {
        delete global.alert;
    });

    test('beginMigration should create pending migration and open prompt', () => {
        const originalPayload = {
            version: '0.9.0',
            goals: [{ id: '1', title: 'Test' }]
        };

        manager.beginMigration({
            originalPayload,
            sourceVersion: '0.9.0',
            fileName: 'test.json'
        });

        expect(manager.pendingMigration).toBeDefined();
        expect(manager.pendingMigration.sourceVersion).toBe('0.9.0');
        expect(manager.pendingMigration.fileName).toBe('test.json');
        expect(mockApp.uiController.openMigrationPrompt).toHaveBeenCalledWith({
            fromVersion: '0.9.0',
            toVersion: GOAL_FILE_VERSION,
            fileName: 'test.json'
        });
    });

    test('beginMigration should handle null fileName', () => {
        const originalPayload = {
            version: '0.9.0',
            goals: []
        };

        manager.beginMigration({
            originalPayload,
            sourceVersion: '0.9.0',
            fileName: null
        });

        expect(manager.pendingMigration.fileName).toBeNull();
        expect(mockApp.uiController.openMigrationPrompt).toHaveBeenCalledWith({
            fromVersion: '0.9.0',
            toVersion: GOAL_FILE_VERSION,
            fileName: null
        });
    });

    test('handleMigrationReviewRequest should open diff when pending migration exists', () => {
        manager.pendingMigration = {
            sourceVersion: '0.9.0',
            originalString: 'original',
            migratedString: 'migrated',
            fileName: 'test.json'
        };

        manager.handleMigrationReviewRequest();

        expect(mockApp.uiController.openMigrationDiff).toHaveBeenCalledWith({
            fromVersion: '0.9.0',
            toVersion: GOAL_FILE_VERSION,
            originalString: 'original',
            migratedString: 'migrated',
            fileName: 'test.json'
        });
    });

    test('handleMigrationReviewRequest should do nothing when no pending migration', () => {
        manager.pendingMigration = null;

        manager.handleMigrationReviewRequest();

        expect(mockApp.uiController.openMigrationDiff).not.toHaveBeenCalled();
    });

    test('cancelMigration should clear pending migration and show alert', () => {
        manager.pendingMigration = {
            sourceVersion: '0.9.0',
            originalString: 'original',
            migratedString: 'migrated'
        };

        manager.cancelMigration();

        expect(manager.pendingMigration).toBeNull();
        expect(mockApp.uiController.closeMigrationModals).toHaveBeenCalled();
        expect(mockApp.languageService.translate).toHaveBeenCalledWith('import.migrationCancelled', undefined);
        expect(global.alert).toHaveBeenCalledWith('Migration cancelled');
    });

    test('cancelMigration should handle missing uiController', () => {
        mockApp.uiController = null;
        manager.pendingMigration = {
            sourceVersion: '0.9.0'
        };

        expect(() => manager.cancelMigration()).not.toThrow();
        expect(manager.pendingMigration).toBeNull();
    });

    test('completeMigration should apply payload and show success', () => {
        const migratedPayload = {
            version: GOAL_FILE_VERSION,
            goals: [{ id: '1', title: 'Test' }],
            settings: { maxActiveGoals: 3 }
        };

        manager.pendingMigration = {
            migratedPayload,
            sourceVersion: '0.9.0'
        };

        manager.completeMigration();

        expect(mockApp.applyImportedPayload).toHaveBeenCalledWith(migratedPayload);
        expect(manager.pendingMigration).toBeNull();
        expect(mockApp.uiController.closeMigrationModals).toHaveBeenCalled();
        expect(mockApp.languageService.translate).toHaveBeenCalledWith('import.success');
        expect(global.alert).toHaveBeenCalledWith('Migration successful');
    });

    test('completeMigration should handle missing pending migration', () => {
        manager.pendingMigration = null;

        manager.completeMigration();

        expect(mockApp.languageService.translate).toHaveBeenCalledWith('import.incompatible', undefined);
        expect(global.alert).toHaveBeenCalledWith('Incompatible');
        expect(mockApp.applyImportedPayload).not.toHaveBeenCalled();
    });

    test('completeMigration should handle incompatible payload version', () => {
        manager.pendingMigration = {
            migratedPayload: {
                version: '0.9.0',
                goals: []
            },
            sourceVersion: '0.9.0'
        };

        manager.completeMigration();

        expect(mockApp.languageService.translate).toHaveBeenCalledWith('import.error', {
            message: 'Migrated payload is incompatible with this version.'
        });
        expect(mockApp.applyImportedPayload).not.toHaveBeenCalled();
    });

    test('completeMigration should handle missing payload', () => {
        manager.pendingMigration = {
            migratedPayload: null,
            sourceVersion: '0.9.0'
        };

        manager.completeMigration();

        expect(mockApp.languageService.translate).toHaveBeenCalledWith('import.error', {
            message: 'Migrated payload is incompatible with this version.'
        });
    });

    test('completeMigration should handle applyImportedPayload error', () => {
        const migratedPayload = {
            version: GOAL_FILE_VERSION,
            goals: []
        };

        manager.pendingMigration = {
            migratedPayload,
            sourceVersion: '0.9.0'
        };

        mockApp.applyImportedPayload.mockImplementation(() => {
            throw new Error('Apply error');
        });

        manager.completeMigration();

        expect(mockApp.languageService.translate).toHaveBeenCalledWith('import.error', {
            message: 'Apply error'
        });
        expect(global.alert).toHaveBeenCalledWith('Error: Apply error');
    });

    test('getPendingMigration should return pending migration', () => {
        const migration = {
            sourceVersion: '0.9.0',
            migratedPayload: { version: GOAL_FILE_VERSION, goals: [] }
        };

        manager.pendingMigration = migration;

        expect(manager.getPendingMigration()).toBe(migration);
    });

    test('getPendingMigration should return null when no pending migration', () => {
        manager.pendingMigration = null;

        expect(manager.getPendingMigration()).toBeNull();
    });
});

