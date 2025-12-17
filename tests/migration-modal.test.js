const { JSDOM } = require('jsdom');
const { MigrationModal } = require('../src/ui/modal/migration-modal.js');
const LanguageService = require('../src/domain/services/language-service').default;

let dom;
let document;
let window;
let mockApp;
let migrationModal;

beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div id="migrationPromptModal" class="modal">
            <div class="modal-content">
                <span id="migrationPromptClose" class="close">&times;</span>
                <h2 id="migrationPromptTitle">Migration Required</h2>
                <p id="migrationPromptMessage"></p>
                <div class="migration-actions">
                    <button id="migrationReviewBtn" class="btn btn-primary">Review</button>
                    <button id="migrationPromptCancelBtn" class="btn btn-secondary">Cancel</button>
                </div>
            </div>
        </div>
        <div id="migrationDiffModal" class="modal">
            <div class="modal-content migration-diff-modal">
                <span id="migrationDiffClose" class="close">&times;</span>
                <h2 id="migrationDiffTitle">Review Changes</h2>
                <div class="migration-diff-container">
                    <div class="migration-diff-pane">
                        <h3>Original</h3>
                        <div id="migrationDiffOld" class="migration-diff-content"></div>
                    </div>
                    <div class="migration-diff-pane">
                        <h3>Updated</h3>
                        <div id="migrationDiffNew" class="migration-diff-content"></div>
                    </div>
                </div>
                <div class="migration-actions">
                    <button id="migrationApplyBtn" class="btn btn-primary">Apply</button>
                    <button id="migrationCancelBtn" class="btn btn-danger">Cancel</button>
                </div>
            </div>
        </div>
    </body></html>`, { url: "http://localhost" });
    document = dom.window.document;
    window = dom.window;

    globalThis.document = document;
    globalThis.window = window;
    globalThis.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 0));

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-11-09T12:00:00.000Z'));

    const languageService = new LanguageService();
    languageService.init('en');

    mockApp = {
        languageService,
        cancelMigration: jest.fn(),
        handleMigrationReviewRequest: jest.fn(),
        completeMigration: jest.fn(),
    };

    migrationModal = new MigrationModal(mockApp);
});

afterEach(() => {
    delete globalThis.document;
    delete globalThis.window;
    delete globalThis.requestAnimationFrame;
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('MigrationModal', () => {
    test('openPrompt displays prompt modal with translated content (legacy file)', () => {
        migrationModal.setup(
            () => mockApp.cancelMigration(),
            () => mockApp.handleMigrationReviewRequest(),
            () => mockApp.completeMigration()
        );

        migrationModal.openPrompt({
            fromVersion: null,
            toVersion: '1.0.0',
            fileName: 'legacy.json'
        });

        const promptModal = document.getElementById('migrationPromptModal');
        expect(promptModal.classList.contains('is-visible')).toBe(true);
        const promptMessage = document.getElementById('migrationPromptMessage').textContent;
        expect(promptMessage).toContain('legacy');
        migrationModal.closeAll();
    });

    test('openPrompt displays prompt modal with version info', () => {
        migrationModal.setup(
            () => mockApp.cancelMigration(),
            () => mockApp.handleMigrationReviewRequest(),
            () => mockApp.completeMigration()
        );

        migrationModal.openPrompt({
            fromVersion: '0.9.0',
            toVersion: '1.0.0',
            fileName: 'current.json'
        });

        const promptMessage = document.getElementById('migrationPromptMessage').textContent;
        expect(promptMessage).toContain('0.9.0');
        migrationModal.closeAll();
    });

    test('openDiff renders diff columns and synchronises scroll', () => {
        migrationModal.setup(
            () => mockApp.cancelMigration(),
            () => mockApp.handleMigrationReviewRequest(),
            () => mockApp.completeMigration()
        );

        migrationModal.openDiff({
            fromVersion: '0.9.0',
            toVersion: '1.0.0',
            originalString: 'line-a\nremove-me\ncommon',
            migratedString: 'line-a\nadd-me\ncommon',
            fileName: 'export.json'
        });

        const diffModal = document.getElementById('migrationDiffModal');
        expect(diffModal.classList.contains('is-visible')).toBe(true);

        const oldLines = Array.from(document.querySelectorAll('#migrationDiffOld .diff-line'));
        const newLines = Array.from(document.querySelectorAll('#migrationDiffNew .diff-line'));
        expect(oldLines.some((line) => line.classList.contains('diff-line--removed'))).toBe(true);
        expect(newLines.some((line) => line.classList.contains('diff-line--added'))).toBe(true);

        const oldView = document.getElementById('migrationDiffOld');
        const newView = document.getElementById('migrationDiffNew');
        oldView.scrollTop = 45;
        oldView.scrollLeft = 10;
        oldView.dispatchEvent(new dom.window.Event('scroll'));
        jest.runAllTimers(); // Flush requestAnimationFrame
        expect(newView.scrollTop).toBe(45);
        expect(newView.scrollLeft).toBe(10);

        newView.scrollTop = 12;
        newView.scrollLeft = 5;
        newView.dispatchEvent(new dom.window.Event('scroll'));
        jest.runAllTimers(); // Flush requestAnimationFrame
        expect(oldView.scrollTop).toBe(12);
        expect(oldView.scrollLeft).toBe(5);

        migrationModal.closeAll();
        expect(migrationModal.migrationDiffData).toBeNull();
    });

    test('prompt actions trigger app handlers', () => {
        migrationModal.setup(
            () => mockApp.cancelMigration(),
            () => mockApp.handleMigrationReviewRequest(),
            () => mockApp.completeMigration()
        );
        mockApp.handleMigrationReviewRequest.mockClear();
        mockApp.cancelMigration.mockClear();

        const promptModal = document.getElementById('migrationPromptModal');
        promptModal.classList.add('is-visible');
        document.getElementById('migrationReviewBtn').click();
        expect(mockApp.handleMigrationReviewRequest).toHaveBeenCalled();

        promptModal.classList.add('is-visible');
        document.getElementById('migrationPromptCancelBtn').click();
        expect(mockApp.cancelMigration).toHaveBeenCalled();

        promptModal.classList.add('is-visible');
        document.getElementById('migrationPromptClose').click();
        expect(mockApp.cancelMigration).toHaveBeenCalledTimes(2);
    });

    test('diff actions trigger app handlers', () => {
        migrationModal.setup(
            () => mockApp.cancelMigration(),
            () => mockApp.handleMigrationReviewRequest(),
            () => mockApp.completeMigration()
        );
        mockApp.cancelMigration.mockClear();
        mockApp.completeMigration.mockClear();

        const diffModal = document.getElementById('migrationDiffModal');
        diffModal.classList.add('is-visible');
        document.getElementById('migrationCancelBtn').click();
        expect(mockApp.cancelMigration).toHaveBeenCalledTimes(1);

        diffModal.classList.add('is-visible');
        document.getElementById('migrationDiffClose').click();
        expect(mockApp.cancelMigration).toHaveBeenCalledTimes(2);

        diffModal.classList.add('is-visible');
        document.getElementById('migrationApplyBtn').click();
        expect(mockApp.completeMigration).toHaveBeenCalled();
    });

    test('getElement caches connected nodes', () => {
        const firstCall = migrationModal.getElement('migrationDiffModal');
        expect(firstCall).not.toBeNull();
        const secondCall = migrationModal.getElement('migrationDiffModal');
        expect(secondCall).toBe(firstCall);
    });

    test('openPrompt should return early when modal is missing', () => {
        const modal = document.getElementById('migrationPromptModal');
        modal.remove();
        migrationModal.migrationPromptRefs = { migrationPromptModal: null };

        expect(() => migrationModal.openPrompt({ fromVersion: null, toVersion: '1.0.0', fileName: 'test.json' })).not.toThrow();
    });

    test('openDiff should handle missing old or new view elements', () => {
        migrationModal.setup(
            () => mockApp.cancelMigration(),
            () => mockApp.handleMigrationReviewRequest(),
            () => mockApp.completeMigration()
        );
        const oldView = document.getElementById('migrationDiffOld');
        oldView.remove();

        expect(() => migrationModal.openDiff({
            fromVersion: '0.9.0',
            toVersion: '1.0.0',
            originalString: 'old',
            migratedString: 'new',
            fileName: 'test.json'
        })).not.toThrow();
    });

    test('openDiff should return early when modal is missing', () => {
        const modal = document.getElementById('migrationDiffModal');
        modal.remove();
        migrationModal.migrationModalRefs = { migrationDiffModal: null };

        expect(() => migrationModal.openDiff({
            fromVersion: '0.9.0',
            toVersion: '1.0.0',
            originalString: 'old',
            migratedString: 'new',
            fileName: 'test.json'
        })).not.toThrow();
    });

    test('openDiff scroll sync should guard against recursive sync', () => {
        migrationModal.setup(
            () => mockApp.cancelMigration(),
            () => mockApp.handleMigrationReviewRequest(),
            () => mockApp.completeMigration()
        );

        migrationModal.openDiff({
            fromVersion: '0.9.0',
            toVersion: '1.0.0',
            originalString: 'old',
            migratedString: 'new',
            fileName: 'test.json'
        });

        const oldView = document.getElementById('migrationDiffOld');
        const newView = document.getElementById('migrationDiffNew');

        // Manually set the flag to simulate an ongoing sync
        migrationModal.isSyncingMigrationScroll = true;

        // Trigger scroll - should return early due to guard
        oldView.scrollTop = 50;
        oldView.dispatchEvent(new dom.window.Event('scroll'));

        // The newView should not have been updated because of the guard
        expect(newView.scrollTop).not.toBe(50);

        migrationModal.closeAll();
    });
});
