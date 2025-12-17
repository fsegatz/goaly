const { JSDOM } = require('jsdom');
const { CompletionModal } = require('../src/ui/modal/completion-modal.js');
const Goal = require('../src/domain/models/goal').default;
const LanguageService = require('../src/domain/services/language-service').default;

let dom;
let document;
let window;
let mockApp;
let mockGoalService;
let mockSettingsService;
let completionModal;

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
                </div>
                <div class="completion-recurrence">
                    <input type="checkbox" id="completionRecurringCheckbox" />
                    <div id="completionRecurDateContainer" style="display: none;">
                        <input type="date" id="completionRecurDate" />
                    </div>
                </div>
            </div>
        </div>
    </body></html>`, { url: "http://localhost" });
    document = dom.window.document;
    window = dom.window;

    globalThis.document = document;
    globalThis.window = window;
    globalThis.alert = jest.fn();

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-11-09T12:00:00.000Z'));

    mockGoalService = {
        goals: [],
        calculatePriority: jest.fn(() => 0),
    };

    mockSettingsService = {
        getSettings: jest.fn(() => ({ maxActiveGoals: 3, language: 'en' })),
    };

    const languageService = new LanguageService();
    languageService.init('en');

    mockApp = {
        goalService: mockGoalService,
        settingsService: mockSettingsService,
        languageService,
    };

    completionModal = new CompletionModal(mockApp);
});

afterEach(() => {
    delete globalThis.document;
    delete globalThis.window;
    delete globalThis.alert;
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('CompletionModal', () => {
    test('open should open modal and set pending goal id', () => {
        const handleCompletionChoice = jest.fn();
        completionModal.setup(handleCompletionChoice);

        completionModal.open('goal-1');

        const modal = document.getElementById('completionModal');
        expect(modal.classList.contains('is-visible')).toBe(true);
        expect(completionModal.getPendingGoalId()).toBe('goal-1');
    });

    test('open ignores empty goal id', () => {
        const modal = document.getElementById('completionModal');
        modal.classList.remove('is-visible');
        const handleCompletionChoice = jest.fn();
        completionModal.setup(handleCompletionChoice);

        completionModal.open('');
        expect(modal.classList.contains('is-visible')).toBe(false);
    });

    test('open no-ops when modal missing', () => {
        const modal = document.getElementById('completionModal');
        modal.remove();
        const handleCompletionChoice = jest.fn();
        completionModal.setup(handleCompletionChoice);
        expect(() => completionModal.open('goal-1')).not.toThrow();
    });

    test('setup exits when already initialized or modal missing', () => {
        const handleCompletionChoice = jest.fn();
        completionModal.setup(handleCompletionChoice);
        expect(completionModal.completionModalInitialized).toBe(true);
        completionModal.setup(handleCompletionChoice); // should return early

        const modal = document.getElementById('completionModal');
        modal.remove();
        completionModal.completionModalInitialized = false;
        completionModal.completionModalRefs.completionModal = null;

        expect(() => completionModal.setup(handleCompletionChoice)).not.toThrow();
        expect(completionModal.completionModalInitialized).toBe(false);
    });

    test('success button should call handleCompletionChoice', () => {
        const handleCompletionChoice = jest.fn();
        completionModal.setup(handleCompletionChoice);
        completionModal.open('goal-1');

        const successBtn = document.getElementById('completionSuccessBtn');
        successBtn.click();

        expect(handleCompletionChoice).toHaveBeenCalledWith('completed', null);
    });

    test('failure button should call handleCompletionChoice', () => {
        const handleCompletionChoice = jest.fn();
        completionModal.setup(handleCompletionChoice);
        completionModal.open('goal-1');

        const failureBtn = document.getElementById('completionFailureBtn');
        failureBtn.click();

        expect(handleCompletionChoice).toHaveBeenCalledWith('notCompleted', null);
    });

    test('close button should close modal', () => {
        const handleCompletionChoice = jest.fn();
        completionModal.setup(handleCompletionChoice);
        completionModal.open('goal-1');

        const modal = document.getElementById('completionModal');
        const closeBtn = document.getElementById('completionCloseBtn');

        closeBtn.click();
        expect(modal.classList.contains('is-visible')).toBe(false);
        expect(handleCompletionChoice).not.toHaveBeenCalled();
    });

    test('overlay click and escape key close modal', () => {
        const handleCompletionChoice = jest.fn();
        completionModal.setup(handleCompletionChoice);
        const modal = document.getElementById('completionModal');

        completionModal.open('goal-1');
        expect(modal.classList.contains('is-visible')).toBe(true);

        modal.dispatchEvent(new window.MouseEvent('click', { bubbles: true, target: modal }));
        expect(modal.classList.contains('is-visible')).toBe(false);

        completionModal.open('goal-1');
        document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
        expect(modal.classList.contains('is-visible')).toBe(false);
    });

    test('success button should handle recurrence', () => {
        const handleCompletionChoice = jest.fn();
        completionModal.setup(handleCompletionChoice);
        completionModal.open('goal-1');

        const checkbox = document.getElementById('completionRecurringCheckbox');
        checkbox.checked = true;

        const dateInput = document.getElementById('completionRecurDate');
        dateInput.value = '2025-12-31';

        const successBtn = document.getElementById('completionSuccessBtn');
        successBtn.click();

        expect(handleCompletionChoice).toHaveBeenCalledWith('completed', {
            isRecurring: true,
            recurrenceDate: expect.any(Date)
        });
    });

    test('should require date if recurring', () => {
        const handleCompletionChoice = jest.fn();
        completionModal.setup(handleCompletionChoice);
        completionModal.open('goal-1');

        const checkbox = document.getElementById('completionRecurringCheckbox');
        checkbox.checked = true;

        const successBtn = document.getElementById('completionSuccessBtn');
        successBtn.click();

        expect(globalThis.alert).toHaveBeenCalled();
        expect(handleCompletionChoice).not.toHaveBeenCalled();
    });

    test('getElement should initialize completionModalRefs if it does not exist', () => {
        completionModal.completionModalRefs = undefined;
        completionModal.getElement('goal-1');
        expect(completionModal.completionModalRefs).toBeDefined();
        expect(typeof completionModal.completionModalRefs).toBe('object');
    });
    test('_calculateNextRecurrenceDate should calculate correctly for days', () => {
        const goal = new Goal({ id: '1', recurPeriod: 5, recurPeriodUnit: 'days' });
        const nextDate = completionModal._calculateNextRecurrenceDate(goal);

        const expected = new Date();
        expected.setHours(0, 0, 0, 0);
        expected.setDate(expected.getDate() + 5);

        expect(nextDate.toISOString().split('T')[0]).toBe(expected.toISOString().split('T')[0]);
    });

    test('_calculateNextRecurrenceDate should calculate correctly for weeks', () => {
        const goal = new Goal({ id: '1', recurPeriod: 2, recurPeriodUnit: 'weeks' });
        const nextDate = completionModal._calculateNextRecurrenceDate(goal);

        const expected = new Date();
        expected.setHours(0, 0, 0, 0);
        expected.setDate(expected.getDate() + 14);

        expect(nextDate.toISOString().split('T')[0]).toBe(expected.toISOString().split('T')[0]);
    });

    test('_calculateNextRecurrenceDate should calculate correctly for months', () => {
        const goal = new Goal({ id: '1', recurPeriod: 1, recurPeriodUnit: 'months' });
        const nextDate = completionModal._calculateNextRecurrenceDate(goal);

        const expected = new Date();
        expected.setHours(0, 0, 0, 0);
        expected.setMonth(expected.getMonth() + 1);

        expect(nextDate.toISOString().split('T')[0]).toBe(expected.toISOString().split('T')[0]);
    });

    test('_setupRecurringFields should pre-fill date input', () => {
        const goal = new Goal({ id: '1', isRecurring: true, recurPeriod: 1, recurPeriodUnit: 'days' });

        completionModal._setupRecurringFields(goal);

        const dateInput = document.getElementById('completionRecurDate');
        const checkbox = document.getElementById('completionRecurringCheckbox');

        expect(checkbox.checked).toBe(true);
        expect(dateInput.value).toBeTruthy();
        expect(document.getElementById('completionRecurDateContainer').style.display).toBe('block');
    });

    test('_resetRecurringFields should clear inputs', () => {
        const checkbox = document.getElementById('completionRecurringCheckbox');
        checkbox.checked = true;
        document.getElementById('completionRecurDateContainer').style.display = 'block';
        document.getElementById('completionRecurDate').value = '2025-12-31';

        completionModal._resetRecurringFields();

        expect(checkbox.checked).toBe(false);
        expect(document.getElementById('completionRecurDateContainer').style.display).toBe('none');
        expect(document.getElementById('completionRecurDate').value).toBe('');
    });
    test('recurring checkbox toggle should control date container visibility', () => {
        completionModal.setup(jest.fn()); // Attach listeners

        const checkbox = document.getElementById('completionRecurringCheckbox');
        const container = document.getElementById('completionRecurDateContainer');
        const dateInput = document.getElementById('completionRecurDate');

        // Check (show)
        checkbox.checked = true;
        checkbox.dispatchEvent(new window.Event('change'));
        expect(container.style.display).toBe('block');

        // Uncheck (hide and clear)
        dateInput.value = '2025-01-01';
        checkbox.checked = false;
        checkbox.dispatchEvent(new window.Event('change'));
        expect(container.style.display).toBe('none');
        expect(dateInput.value).toBe('');
    });

    test('getRecurrenceData should return valid null if checkbox unchecked', () => {
        document.getElementById('completionRecurringCheckbox').checked = false;

        const result = completionModal.getRecurrenceData();

        expect(result.isValid).toBe(true);
        expect(result.data).toBeNull();
    });

    test('open should reset recurring fields if goal is not recurring', () => {
        // Setup initial dirty state
        document.getElementById('completionRecurringCheckbox').checked = true;

        // Mock non-recurring goal
        const goal = new Goal({ id: 'nr1', isRecurring: false });
        mockGoalService.goals = [goal];

        completionModal.open('nr1');

        expect(document.getElementById('completionRecurringCheckbox').checked).toBe(false);
        expect(document.getElementById('completionRecurDateContainer').style.display).toBe('none');
    });
});
