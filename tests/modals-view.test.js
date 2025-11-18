const { JSDOM } = require('jsdom');
const { ModalsView } = require('../src/ui/desktop/modals-view.js');
const Goal = require('../src/domain/models/goal').default;
const LanguageService = require('../src/domain/services/language-service').default;

let dom;
let document;
let window;
let mockApp;
let mockGoalService;
let mockSettingsService;
let modalsView;

beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div id="completionModal" class="modal">
            <div class="modal-content completion-modal">
                <span id="completionCloseBtn" class="close">&times;</span>
                <h2>Complete goal</h2>
                <p>Did you achieve your goal?</p>
                <div class="completion-actions">
                    <button id="completionSuccessBtn" class="btn btn-primary">Goal completed</button>
                    <button id="completionFailureBtn" class="btn btn-danger">Not completed</button>
                    <button id="completionCancelBtn" class="btn btn-secondary">Cancel</button>
                </div>
            </div>
        </div>
        <div id="migrationPromptModal" class="modal">
            <div class="modal-content migration-modal">
                <span id="migrationPromptClose" class="close">&times;</span>
                <h2 id="migrationPromptTitle"></h2>
                <p id="migrationPromptMessage"></p>
                <div class="modal-actions">
                    <button id="migrationReviewBtn"></button>
                    <button id="migrationPromptCancelBtn"></button>
                </div>
            </div>
        </div>
        <div id="migrationDiffModal" class="modal">
            <div class="modal-content migration-diff-modal">
                <span id="migrationDiffClose" class="close">&times;</span>
                <h2 id="migrationDiffTitle"></h2>
                <p id="migrationDiffSubtitle"></p>
                <div class="migration-diff-columns">
                    <div class="diff-column">
                        <h3 id="migrationDiffOldLabel"></h3>
                        <div id="migrationDiffOld" class="diff-view"></div>
                    </div>
                    <div class="diff-column">
                        <h3 id="migrationDiffNewLabel"></h3>
                        <div id="migrationDiffNew" class="diff-view"></div>
                    </div>
                </div>
                <div class="modal-actions">
                    <button id="migrationApplyBtn"></button>
                    <button id="migrationCancelBtn"></button>
                </div>
            </div>
        </div>
    </body></html>`, { url: "http://localhost" });
    document = dom.window.document;
    window = dom.window;

    global.document = document;
    global.window = window;
    global.alert = jest.fn();
    global.requestAnimationFrame = (callback) => {
        callback();
        return 0;
    };
    window.alert = global.alert;

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-11-09T12:00:00.000Z'));

    mockGoalService = {
        goals: [],
        setGoalStatus: jest.fn(),
    };
    mockSettingsService = {
        getSettings: jest.fn(() => ({ maxActiveGoals: 3, language: 'en', reviewIntervals: [30, 14, 7] })),
    };

    const languageService = new LanguageService();
    languageService.init('en');

    mockApp = {
        goalService: mockGoalService,
        settingsService: mockSettingsService,
        languageService,
        cancelMigration: jest.fn(),
        handleMigrationReviewRequest: jest.fn(),
        completeMigration: jest.fn(),
    };

    modalsView = new ModalsView(mockApp);
});

afterEach(() => {
    delete global.document;
    delete global.window;
    delete global.alert;
    delete global.requestAnimationFrame;
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('ModalsView', () => {
    test('openCompletionModal should open modal and set pending goal id', () => {
        const handleCompletionChoice = jest.fn();
        modalsView.setupCompletionModal(handleCompletionChoice);

        modalsView.openCompletionModal('goal-1');

        const modal = document.getElementById('completionModal');
        expect(modal.classList.contains('is-visible')).toBe(true);
        expect(modalsView.getPendingCompletionGoalId()).toBe('goal-1');
    });

    test('openCompletionModal ignores empty goal id', () => {
        const modal = document.getElementById('completionModal');
        modal.classList.remove('is-visible');
        const handleCompletionChoice = jest.fn();
        modalsView.setupCompletionModal(handleCompletionChoice);

        modalsView.openCompletionModal('');
        expect(modal.classList.contains('is-visible')).toBe(false);
    });

    test('openCompletionModal no-ops when modal missing', () => {
        const completionModal = document.getElementById('completionModal');
        completionModal.remove();
        const handleCompletionChoice = jest.fn();
        modalsView.setupCompletionModal(handleCompletionChoice);
        expect(() => modalsView.openCompletionModal('goal-1')).not.toThrow();
    });

    test('setupCompletionModal exits when already initialized or modal missing', () => {
        const handleCompletionChoice = jest.fn();
        modalsView.setupCompletionModal(handleCompletionChoice);
        expect(modalsView.completionModalInitialized).toBe(true);
        modalsView.setupCompletionModal(handleCompletionChoice); // should return early

        const modal = document.getElementById('completionModal');
        modal.remove();
        modalsView.completionModalInitialized = false;
        modalsView.completionModalRefs.completionModal = null;

        expect(() => modalsView.setupCompletionModal(handleCompletionChoice)).not.toThrow();
        expect(modalsView.completionModalInitialized).toBe(false);
    });

    test('completion modal success button should call handleCompletionChoice', () => {
        const handleCompletionChoice = jest.fn();
        modalsView.setupCompletionModal(handleCompletionChoice);
        modalsView.openCompletionModal('goal-1');

        const successBtn = document.getElementById('completionSuccessBtn');
        successBtn.click();

        expect(handleCompletionChoice).toHaveBeenCalledWith('completed');
    });

    test('completion modal failure button should call handleCompletionChoice', () => {
        const handleCompletionChoice = jest.fn();
        modalsView.setupCompletionModal(handleCompletionChoice);
        modalsView.openCompletionModal('goal-1');

        const failureBtn = document.getElementById('completionFailureBtn');
        failureBtn.click();

        expect(handleCompletionChoice).toHaveBeenCalledWith('abandoned');
    });

    test('completion modal cancel and close should close modal', () => {
        const handleCompletionChoice = jest.fn();
        modalsView.setupCompletionModal(handleCompletionChoice);
        modalsView.openCompletionModal('goal-1');

        const modal = document.getElementById('completionModal');
        const cancelBtn = document.getElementById('completionCancelBtn');
        const closeBtn = document.getElementById('completionCloseBtn');

        cancelBtn.click();
        expect(modal.classList.contains('is-visible')).toBe(false);
        expect(handleCompletionChoice).not.toHaveBeenCalled();

        modalsView.openCompletionModal('goal-1');
        closeBtn.click();
        expect(modal.classList.contains('is-visible')).toBe(false);
        expect(handleCompletionChoice).not.toHaveBeenCalled();
    });

    test('completion modal overlay click and escape key close modal', () => {
        const handleCompletionChoice = jest.fn();
        modalsView.setupCompletionModal(handleCompletionChoice);
        const modal = document.getElementById('completionModal');

        modalsView.openCompletionModal('goal-1');
        expect(modal.classList.contains('is-visible')).toBe(true);

        modal.dispatchEvent(new window.MouseEvent('click', { bubbles: true, target: modal }));
        expect(modal.classList.contains('is-visible')).toBe(false);

        modalsView.openCompletionModal('goal-1');
        document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
        expect(modal.classList.contains('is-visible')).toBe(false);
    });

    test('openMigrationPrompt displays prompt modal with translated content', () => {
        modalsView.setupMigrationModals(
            () => mockApp.cancelMigration(),
            () => mockApp.handleMigrationReviewRequest(),
            () => mockApp.completeMigration()
        );

        modalsView.openMigrationPrompt({
            fromVersion: null,
            toVersion: '1.0.0',
            fileName: 'legacy.json'
        });

        const promptModal = document.getElementById('migrationPromptModal');
        expect(promptModal.classList.contains('is-visible')).toBe(true);
        const promptMessage = document.getElementById('migrationPromptMessage').textContent;
        expect(promptMessage).toContain('legacy');
        modalsView.closeMigrationModals();

        modalsView.openMigrationPrompt({
            fromVersion: '0.9.0',
            toVersion: '1.0.0',
            fileName: 'current.json'
        });
        const promptMessageNew = document.getElementById('migrationPromptMessage').textContent;
        expect(promptMessageNew).toContain('0.9.0');
        modalsView.closeMigrationModals();
    });

    test('openMigrationDiff renders diff columns and synchronises scroll', () => {
        modalsView.setupMigrationModals(
            () => mockApp.cancelMigration(),
            () => mockApp.handleMigrationReviewRequest(),
            () => mockApp.completeMigration()
        );

        modalsView.openMigrationDiff({
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
        expect(newView.scrollTop).toBe(45);
        expect(newView.scrollLeft).toBe(10);

        newView.scrollTop = 12;
        newView.scrollLeft = 5;
        newView.dispatchEvent(new dom.window.Event('scroll'));
        expect(oldView.scrollTop).toBe(12);
        expect(oldView.scrollLeft).toBe(5);

        modalsView.closeMigrationModals();
        expect(modalsView.migrationDiffData).toBeNull();
    });

    test('migration prompt actions trigger app handlers', () => {
        modalsView.setupMigrationModals(
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

    test('migration diff actions trigger app handlers', () => {
        modalsView.setupMigrationModals(
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

    test('getMigrationElement caches connected nodes', () => {
        const firstCall = modalsView.getMigrationElement('migrationDiffModal');
        expect(firstCall).not.toBeNull();
        const secondCall = modalsView.getMigrationElement('migrationDiffModal');
        expect(secondCall).toBe(firstCall);
    });

    test('openMigrationPrompt should return early when modal is missing', () => {
        const modal = document.getElementById('migrationPromptModal');
        modal.remove();
        modalsView.migrationPromptRefs = { migrationPromptModal: null };

        expect(() => modalsView.openMigrationPrompt({ fromVersion: null, toVersion: '1.0.0', fileName: 'test.json' })).not.toThrow();
    });

    test('openMigrationDiff should handle missing old or new view elements', () => {
        modalsView.setupMigrationModals(
            () => mockApp.cancelMigration(),
            () => mockApp.handleMigrationReviewRequest(),
            () => mockApp.completeMigration()
        );
        const oldView = document.getElementById('migrationDiffOld');
        oldView.remove();

        expect(() => modalsView.openMigrationDiff({
            fromVersion: '0.9.0',
            toVersion: '1.0.0',
            originalString: 'old',
            migratedString: 'new',
            fileName: 'test.json'
        })).not.toThrow();
    });

    test('openMigrationDiff should return early when modal is missing', () => {
        const modal = document.getElementById('migrationDiffModal');
        modal.remove();
        modalsView.migrationModalRefs = { migrationDiffModal: null };

        expect(() => modalsView.openMigrationDiff({
            fromVersion: '0.9.0',
            toVersion: '1.0.0',
            originalString: 'old',
            migratedString: 'new',
            fileName: 'test.json'
        })).not.toThrow();
    });

    test('openMigrationDiff scroll sync should guard against recursive sync', () => {
        modalsView.setupMigrationModals(
            () => mockApp.cancelMigration(),
            () => mockApp.handleMigrationReviewRequest(),
            () => mockApp.completeMigration()
        );

        modalsView.openMigrationDiff({
            fromVersion: '0.9.0',
            toVersion: '1.0.0',
            originalString: 'old',
            migratedString: 'new',
            fileName: 'test.json'
        });

        const oldView = document.getElementById('migrationDiffOld');
        const newView = document.getElementById('migrationDiffNew');
        
        // Manually set the flag to simulate an ongoing sync
        modalsView.isSyncingMigrationScroll = true;
        
        // Trigger scroll - should return early due to guard
        oldView.scrollTop = 50;
        oldView.dispatchEvent(new dom.window.Event('scroll'));
        
        // The newView should not have been updated because of the guard
        expect(newView.scrollTop).not.toBe(50);
        
        modalsView.closeMigrationModals();
    });

    test('getCompletionElement should initialize completionModalRefs if it does not exist', () => {
        modalsView.completionModalRefs = undefined;
        const element = modalsView.getCompletionElement('goal-1');
        expect(modalsView.completionModalRefs).toBeDefined();
        expect(typeof modalsView.completionModalRefs).toBe('object');
    });
});

