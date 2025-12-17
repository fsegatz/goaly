const { JSDOM } = require('jsdom');
const { PauseModal } = require('../src/ui/modal/pause-modal.js');
const LanguageService = require('../src/domain/services/language-service').default;

let dom;
let document;
let window;
let mockApp;
let mockGoalService;
let mockSettingsService;
let pauseModal;

beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div id="pauseModal" class="modal">
            <div class="modal-content pause-modal">
                <span id="pauseCloseBtn" class="close">&times;</span>
                <h2>Pause goal</h2>
                <div class="pause-options">
                    <div class="pause-option">
                        <input type="radio" id="pauseUntilDate" name="pauseUntil" value="date" checked />
                        <label for="pauseUntilDate">Until date</label>
                        <input type="date" id="pauseUntilDateInput" />
                    </div>
                    <div class="pause-option">
                        <input type="radio" id="pauseUntilGoal" name="pauseUntil" value="goal" />
                        <label for="pauseUntilGoal">Until goal completed</label>
                        <select id="pauseUntilGoalSelect" disabled></select>
                    </div>
                </div>
                <div class="pause-actions">
                    <button id="pauseConfirmBtn" class="btn btn-primary">Pause</button>
                    <button id="pauseCancelBtn" class="btn btn-secondary">Cancel</button>
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

    pauseModal = new PauseModal(mockApp);
});

afterEach(() => {
    delete globalThis.document;
    delete globalThis.window;
    delete globalThis.alert;
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('PauseModal', () => {
    test('setup should setup event listeners', () => {
        const handlePauseChoice = jest.fn();
        pauseModal.setup(handlePauseChoice);
        expect(pauseModal.pauseModalInitialized).toBe(true);
    });

    test('setup should not setup twice', () => {
        const handlePauseChoice = jest.fn();
        pauseModal.setup(handlePauseChoice);
        const initialRefs = { ...pauseModal.pauseModalRefs };
        pauseModal.setup(handlePauseChoice);
        expect(pauseModal.pauseModalRefs).toEqual(initialRefs);
    });

    test('open should open modal and set pending goal id', () => {
        const handlePauseChoice = jest.fn();
        pauseModal.setup(handlePauseChoice);
        mockGoalService.goals = [
            { id: 'goal-1', title: 'Goal 1', status: 'active' },
            { id: 'goal-2', title: 'Goal 2', status: 'active' }
        ];

        pauseModal.open('goal-1');

        const modal = document.getElementById('pauseModal');
        expect(modal.classList.contains('is-visible')).toBe(true);
        expect(pauseModal.getPendingGoalId()).toBe('goal-1');
    });

    test('open should populate goal select with other goals', () => {
        const handlePauseChoice = jest.fn();
        pauseModal.setup(handlePauseChoice);
        mockGoalService.goals = [
            { id: 'goal-1', title: 'Goal 1', status: 'active' },
            { id: 'goal-2', title: 'Goal 2', status: 'active' },
            { id: 'goal-3', title: 'Goal 3', status: 'completed' }
        ];

        pauseModal.open('goal-1');

        const goalSelect = document.getElementById('pauseUntilGoalSelect');
        expect(goalSelect.options.length).toBe(2); // Select option + Goal 2
        expect(goalSelect.options[1].value).toBe('goal-2');
        expect(goalSelect.options[1].textContent).toBe('Goal 2');
    });

    test('open should show no goals available message when no other goals', () => {
        const handlePauseChoice = jest.fn();
        pauseModal.setup(handlePauseChoice);
        mockGoalService.goals = [
            { id: 'goal-1', title: 'Goal 1', status: 'active' }
        ];

        pauseModal.open('goal-1');

        const goalSelect = document.getElementById('pauseUntilGoalSelect');
        expect(goalSelect.options.length).toBe(2);
        expect(goalSelect.options[1].disabled).toBe(true);
    });

    test('open should set minimum date to today', () => {
        const handlePauseChoice = jest.fn();
        pauseModal.setup(handlePauseChoice);
        mockGoalService.goals = [];

        pauseModal.open('goal-1');

        const dateInput = document.getElementById('pauseUntilDateInput');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expect(dateInput.min).toBe(today.toISOString().split('T')[0]);
    });

    test('open should reset to date option by default', () => {
        const handlePauseChoice = jest.fn();
        pauseModal.setup(handlePauseChoice);
        mockGoalService.goals = [];

        pauseModal.open('goal-1');

        const dateRadio = document.getElementById('pauseUntilDate');
        const goalRadio = document.getElementById('pauseUntilGoal');
        const dateInput = document.getElementById('pauseUntilDateInput');
        const goalSelect = document.getElementById('pauseUntilGoalSelect');

        expect(dateRadio.checked).toBe(true);
        expect(goalRadio.checked).toBe(false);
        expect(dateInput.disabled).toBe(false);
        expect(goalSelect.disabled).toBe(true);
    });

    test('open ignores empty goal id', () => {
        const modal = document.getElementById('pauseModal');
        modal.classList.remove('is-visible');
        const handlePauseChoice = jest.fn();
        pauseModal.setup(handlePauseChoice);

        pauseModal.open('');
        expect(modal.classList.contains('is-visible')).toBe(false);
    });

    test('open no-ops when modal missing', () => {
        const modal = document.getElementById('pauseModal');
        modal.remove();
        const handlePauseChoice = jest.fn();
        pauseModal.setup(handlePauseChoice);
        expect(() => pauseModal.open('goal-1')).not.toThrow();
    });

    test('close should close modal and clear pending goal id', () => {
        const handlePauseChoice = jest.fn();
        pauseModal.setup(handlePauseChoice);
        pauseModal.open('goal-1');
        expect(pauseModal.getPendingGoalId()).toBe('goal-1');

        pauseModal.close();

        const modal = document.getElementById('pauseModal');
        expect(modal.classList.contains('is-visible')).toBe(false);
        expect(pauseModal.getPendingGoalId()).toBeNull();
    });

    test('confirm button should call handlePauseChoice with date', () => {
        const handlePauseChoice = jest.fn();
        pauseModal.setup(handlePauseChoice);
        mockGoalService.goals = [];
        pauseModal.open('goal-1');

        const dateInput = document.getElementById('pauseUntilDateInput');
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        dateInput.value = futureDate.toISOString().split('T')[0];

        const confirmBtn = document.getElementById('pauseConfirmBtn');
        confirmBtn.click();

        expect(handlePauseChoice).toHaveBeenCalledWith({
            pauseUntil: expect.any(Date),
            pauseUntilGoalId: null
        });
    });

    test('confirm button should call handlePauseChoice with goal id', () => {
        const handlePauseChoice = jest.fn();
        pauseModal.setup(handlePauseChoice);
        mockGoalService.goals = [
            { id: 'goal-2', title: 'Goal 2', status: 'active' }
        ];
        pauseModal.open('goal-1');

        const goalRadio = document.getElementById('pauseUntilGoal');
        goalRadio.checked = true;
        goalRadio.dispatchEvent(new window.Event('change', { bubbles: true }));

        const goalSelect = document.getElementById('pauseUntilGoalSelect');
        goalSelect.value = 'goal-2';

        const confirmBtn = document.getElementById('pauseConfirmBtn');
        confirmBtn.click();

        expect(handlePauseChoice).toHaveBeenCalledWith({
            pauseUntil: null,
            pauseUntilGoalId: 'goal-2'
        });
    });

    test('confirm button should not call handlePauseChoice without date', () => {
        const handlePauseChoice = jest.fn();
        pauseModal.setup(handlePauseChoice);
        mockGoalService.goals = [];
        pauseModal.open('goal-1');

        const confirmBtn = document.getElementById('pauseConfirmBtn');
        confirmBtn.click();

        expect(handlePauseChoice).not.toHaveBeenCalled();
    });

    test('confirm button should not call handlePauseChoice without goal', () => {
        const handlePauseChoice = jest.fn();
        pauseModal.setup(handlePauseChoice);
        mockGoalService.goals = [
            { id: 'goal-2', title: 'Goal 2', status: 'active' }
        ];
        pauseModal.open('goal-1');

        const goalRadio = document.getElementById('pauseUntilGoal');
        goalRadio.checked = true;
        goalRadio.dispatchEvent(new window.Event('change', { bubbles: true }));

        const confirmBtn = document.getElementById('pauseConfirmBtn');
        confirmBtn.click();

        expect(handlePauseChoice).not.toHaveBeenCalled();
    });

    test('cancel button should close modal', () => {
        const handlePauseChoice = jest.fn();
        pauseModal.setup(handlePauseChoice);
        pauseModal.open('goal-1');

        const cancelBtn = document.getElementById('pauseCancelBtn');
        cancelBtn.click();

        const modal = document.getElementById('pauseModal');
        expect(modal.classList.contains('is-visible')).toBe(false);
        expect(handlePauseChoice).not.toHaveBeenCalled();
    });

    test('close button should close modal', () => {
        const handlePauseChoice = jest.fn();
        pauseModal.setup(handlePauseChoice);
        pauseModal.open('goal-1');

        const closeBtn = document.getElementById('pauseCloseBtn');
        closeBtn.click();

        const modal = document.getElementById('pauseModal');
        expect(modal.classList.contains('is-visible')).toBe(false);
    });

    test('clicking outside modal should close it', () => {
        const handlePauseChoice = jest.fn();
        pauseModal.setup(handlePauseChoice);
        pauseModal.open('goal-1');

        const modal = document.getElementById('pauseModal');
        const clickEvent = new window.MouseEvent('click', { bubbles: true, cancelable: true });
        Object.defineProperty(clickEvent, 'target', { value: modal, enumerable: true });
        modal.dispatchEvent(clickEvent);

        expect(modal.classList.contains('is-visible')).toBe(false);
    });

    test('Escape key should close modal', () => {
        const handlePauseChoice = jest.fn();
        pauseModal.setup(handlePauseChoice);
        pauseModal.open('goal-1');

        document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        const modal = document.getElementById('pauseModal');
        expect(modal.classList.contains('is-visible')).toBe(false);
    });

    test('radio button change should toggle input disabled state', () => {
        const handlePauseChoice = jest.fn();
        pauseModal.setup(handlePauseChoice);
        mockGoalService.goals = [];
        pauseModal.open('goal-1');

        const dateRadio = document.getElementById('pauseUntilDate');
        const goalRadio = document.getElementById('pauseUntilGoal');
        const dateInput = document.getElementById('pauseUntilDateInput');
        const goalSelect = document.getElementById('pauseUntilGoalSelect');

        goalRadio.checked = true;
        goalRadio.dispatchEvent(new window.Event('change', { bubbles: true }));

        expect(dateInput.disabled).toBe(true);
        expect(goalSelect.disabled).toBe(false);

        dateRadio.checked = true;
        dateRadio.dispatchEvent(new window.Event('change', { bubbles: true }));

        expect(dateInput.disabled).toBe(false);
        expect(goalSelect.disabled).toBe(true);
    });

    test('getElement should initialize pauseModalRefs if it does not exist', () => {
        pauseModal.pauseModalRefs = undefined;
        const element = pauseModal.getElement('pauseModal');
        expect(pauseModal.pauseModalRefs).toBeDefined();
        expect(typeof pauseModal.pauseModalRefs).toBe('object');
    });
});
