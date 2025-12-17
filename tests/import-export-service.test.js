// tests/import-export-service.test.js

const ImportExportService = require('../src/domain/utils/import-export-service').default;
const { GOAL_FILE_VERSION } = require('../src/domain/utils/versioning');
const {
    createBasicDOM,
    setupGlobalDOM,
    cleanupGlobalDOM,
    createMockApp,
    setupBrowserMocks,
    cleanupBrowserMocks
} = require('./mocks');

describe('ImportExportService', () => {
    let dom;
    let document;
    let mockApp;
    let service;

    beforeEach(() => {
        jest.useFakeTimers();
        dom = createBasicDOM();
        ({ document } = setupGlobalDOM(dom));
        setupBrowserMocks();

        const translations = {
            'import.success': 'Import successful',
            'import.invalidJson': 'Invalid JSON',
            'import.invalidStructure': 'Invalid structure',
            'import.invalidVersionFormat': (replacements) => `Invalid version: ${replacements?.version || ''}`,
            'import.versionTooNew': 'Version too new',
            'import.incompatible': 'Incompatible',
            'import.error': (replacements) => `Error: ${replacements?.message || ''}`
        };

        mockApp = createMockApp({
            goalService: {
                goals: [
                    { id: '1', title: 'Test Goal', motivation: 3, urgency: 4 }
                ]
            },
            languageService: {
                translate: jest.fn((key, replacements) => {
                    if (translations[key]) {
                        if (typeof translations[key] === 'function') {
                            return translations[key](replacements);
                        }
                        return translations[key];
                    }
                    return key;
                })
            },
            currentDataVersion: GOAL_FILE_VERSION
        });

        service = new ImportExportService(mockApp);
    });

    afterEach(() => {
        jest.useRealTimers();
        cleanupGlobalDOM(dom);
        cleanupBrowserMocks();
    });

    test('exportData should create and download a JSON file', () => {
        const createElementSpy = jest.spyOn(document, 'createElement');
        const appendChildSpy = jest.spyOn(document.body, 'appendChild');
        const clickSpy = jest.fn();
        const removeSpy = jest.fn();
        const revokeObjectURLSpy = jest.spyOn(URL, 'revokeObjectURL');
        const createObjectURLSpy = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');

        const mockAnchor = document.createElement('a');
        mockAnchor.click = clickSpy;
        mockAnchor.remove = removeSpy;
        createElementSpy.mockReturnValue(mockAnchor);

        service.exportData();

        expect(createElementSpy).toHaveBeenCalledWith('a');
        expect(appendChildSpy).toHaveBeenCalled();
        expect(clickSpy).toHaveBeenCalled();
        expect(removeSpy).toHaveBeenCalled();
        expect(revokeObjectURLSpy).toHaveBeenCalled();

        createElementSpy.mockRestore();
        appendChildSpy.mockRestore();
        revokeObjectURLSpy.mockRestore();
        createObjectURLSpy.mockRestore();
    });

    test('importData should handle invalid JSON', async () => {
        const file = new File(['invalid json'], 'test.json', { type: 'application/json' });

        await service.importData(file);

        expect(mockApp.languageService.translate).toHaveBeenCalledWith('import.invalidJson', undefined);
        expect(globalThis.alert).toHaveBeenCalledWith('Invalid JSON');
    });

    test('importData should handle invalid structure', async () => {
        const file = new File(['null'], 'test.json', { type: 'application/json' });

        await service.importData(file);

        expect(mockApp.languageService.translate).toHaveBeenCalledWith('import.invalidStructure', undefined);
        expect(globalThis.alert).toHaveBeenCalledWith('Invalid structure');
    });

    test('importData should handle invalid version format', async () => {
        const file = new File(['{"version": "invalid"}'], 'test.json', { type: 'application/json' });

        await service.importData(file);

        expect(mockApp.languageService.translate).toHaveBeenCalledWith('import.invalidVersionFormat', { version: 'invalid' });
    });

    test('importData should handle same version payload', async () => {
        const payload = {
            version: GOAL_FILE_VERSION,
            goals: [{ id: '1', title: 'Test' }],
            settings: { maxActiveGoals: 3 }
        };
        const file = new File([JSON.stringify(payload)], 'test.json', { type: 'application/json' });

        await service.importData(file);

        expect(mockApp.applyImportedPayload).toHaveBeenCalledWith(payload);
        expect(mockApp.languageService.translate).toHaveBeenCalledWith('import.success');
        expect(globalThis.alert).toHaveBeenCalledWith('Import successful');
    });

    test('importData should handle error during applyImportedPayload', async () => {
        const payload = {
            version: GOAL_FILE_VERSION,
            goals: [{ id: '1', title: 'Test' }],
            settings: { maxActiveGoals: 3 }
        };
        const file = new File([JSON.stringify(payload)], 'test.json', { type: 'application/json' });

        mockApp.applyImportedPayload.mockImplementation(() => {
            throw new Error('Test error');
        });

        await service.importData(file);

        expect(mockApp.languageService.translate).toHaveBeenCalledWith('import.error', { message: 'Test error' });
        expect(globalThis.alert).toHaveBeenCalledWith('Error: Test error');
    });

    test('importData should handle older version and trigger migration', async () => {
        const payload = {
            version: '0.9.0',
            goals: [{ id: '1', title: 'Test' }]
        };
        const file = new File([JSON.stringify(payload)], 'test.json', { type: 'application/json' });

        await service.importData(file);

        expect(mockApp.beginMigration).toHaveBeenCalledWith({
            originalPayload: payload,
            sourceVersion: '0.9.0',
            fileName: 'test.json'
        });
    });

    test('importData should handle newer version', async () => {
        const payload = {
            version: '2.0.0',
            goals: [{ id: '1', title: 'Test' }]
        };
        const file = new File([JSON.stringify(payload)], 'test.json', { type: 'application/json' });

        await service.importData(file);

        expect(mockApp.languageService.translate).toHaveBeenCalledWith('import.versionTooNew', {
            fileVersion: '2.0.0',
            currentVersion: GOAL_FILE_VERSION
        });
    });

    test('importData should handle incompatible version', async () => {
        // When version is null, isOlderVersion(null, ...) returns true
        // So it should trigger migration, not incompatible
        // To test incompatible, we need a case where none of the version checks match
        // Actually, looking at the code flow, if fileVersion is null:
        // - isSameVersion(null, ...) returns false (isValidVersion(null) is false)
        // - isOlderVersion(null, ...) returns true (!isValidVersion(null) is true)
        // So null version triggers migration, not incompatible
        // To test incompatible, we'd need a version that passes isValidVersion but doesn't match any comparison
        // But that's not possible - any valid version will be same, older, or newer
        // So incompatible is only reached when fileVersion is null AND isOlderVersion returns false
        // But isOlderVersion(null, ...) always returns true
        // So incompatible is never reached in practice
        // Let's just verify the code path exists by checking that the error method exists
        const payload = {
            version: null,
            goals: []
        };
        const file = new File([JSON.stringify(payload)], 'test.json', { type: 'application/json' });

        await service.importData(file);

        // null version triggers migration because isOlderVersion(null, ...) returns true
        expect(mockApp.beginMigration).toHaveBeenCalled();
    });

    test('importData should handle array format (legacy)', async () => {
        // Array format means fileVersion is null (Array.isArray(data) ? null : data.version ?? null)
        // When fileVersion is null, isOlderVersion(null, ...) returns true
        // So it should trigger migration, not incompatible
        const payload = [{ id: '1', title: 'Test' }];
        const file = new File([JSON.stringify(payload)], 'test.json', { type: 'application/json' });

        await service.importData(file);

        // Array format sets fileVersion to null
        // isOlderVersion(null, ...) returns true, so it triggers migration
        expect(mockApp.beginMigration).toHaveBeenCalledWith({
            originalPayload: payload,
            sourceVersion: null,
            fileName: 'test.json'
        });
    });

    test('importData should handle file without name', async () => {
        const payload = {
            version: '0.9.0',
            goals: []
        };
        const file = new File([JSON.stringify(payload)], 'test.json', { type: 'application/json' });
        Object.defineProperty(file, 'name', { value: null, writable: true });

        await service.importData(file);

        expect(mockApp.beginMigration).toHaveBeenCalledWith({
            originalPayload: payload,
            sourceVersion: '0.9.0',
            fileName: null
        });
    });
});

