const { JSDOM } = require('jsdom');
const { CreateModal } = require('../src/ui/modal/create-modal.js');
const LanguageService = require('../src/domain/services/language-service').default;

let dom;
let document;
let window;
let mockApp;
let mockGoalService;
let createModal;

beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div id="goalModal" class="modal">
            <span class="close">&times;</span>
            <h2 id="modalTitle"></h2>
            <form id="goalForm">
                <input type="hidden" id="goalId" />
                <input type="text" id="goalTitle" />
                <input type="number" id="goalMotivation" />
                <input type="number" id="goalUrgency" />
                <input type="date" id="goalDeadline" />
                <input type="checkbox" id="goalIsRecurring" />
                <div id="recurringPeriodContainer" style="display: none;">
                    <input type="number" id="goalRecurPeriod" />
                    <select id="goalRecurPeriodUnit">
                        <option value="days">Days</option>
                    </select>
                </div>
                <div class="form-actions">
                     <button type="submit" id="saveGoalBtn">Save</button>
                     <button type="button" id="cancelBtn">Cancel</button>
                     <button type="button" id="deleteBtn" style="display: none;">Delete</button>
                </div>
                <div id="goalStateManagementSection" style="display: none;">
                    <button id="completeGoalBtn"></button>
                    <button id="unpauseGoalBtn"></button>
                    <button id="reactivateGoalBtn"></button>
                    <button id="forceActivateGoalBtn"></button>
                </div>
            </form>
        </div>
    </body></html>`, { url: "http://localhost" });
    document = dom.window.document;
    window = dom.window;

    globalThis.document = document;
    globalThis.window = window;
    globalThis.confirm = jest.fn();
    globalThis.alert = jest.fn();

    mockGoalService = {
        createGoal: jest.fn(),
    };

    const languageService = new LanguageService();
    languageService.init('en');

    mockApp = {
        goalService: mockGoalService,
        settingsService: {
            getSettings: jest.fn(() => ({ maxActiveGoals: 3 })),
        },
        languageService,
    };

    createModal = new CreateModal(mockApp);

    // Silence console logs during tests
    jest.spyOn(console, 'log').mockImplementation(() => { });
});

afterEach(() => {
    delete globalThis.document;
    delete globalThis.window;
    jest.restoreAllMocks(); // This will also restore console.log
});

describe('CreateModal', () => {
    test('open should reset form and show modal', () => {
        const form = document.getElementById('goalForm');
        form.reset = jest.fn();

        createModal.open(jest.fn());

        expect(form.reset).toHaveBeenCalled();
        expect(document.getElementById('goalModal').classList.contains('is-visible')).toBe(true);
        expect(document.getElementById('modalTitle').textContent).toBe('New goal');
        expect(document.getElementById('deleteBtn').style.display).toBe('none');
    });

    test('close should hide modal', () => {
        document.getElementById('goalModal').classList.add('is-visible');
        createModal.close();
        expect(document.getElementById('goalModal').classList.contains('is-visible')).toBe(false);
    });

    test('handleGoalSubmit should call createGoal', () => {
        document.getElementById('goalTitle').value = 'New Goal';
        document.getElementById('goalMotivation').value = '5';
        document.getElementById('goalUrgency').value = '5';

        createModal.handleGoalSubmit();

        expect(mockGoalService.createGoal).toHaveBeenCalledWith(expect.objectContaining({
            title: 'New Goal'
        }), 3);
    });

    test('checking regular checkbox toggles recurrence group', () => {
        const checkbox = document.getElementById('goalIsRecurring');
        const recurGroup = document.getElementById('recurringPeriodContainer');

        createModal.setupEventListeners(); // Re-attach for JSDOM env check

        // Simulate check
        checkbox.checked = true;
        checkbox.dispatchEvent(new window.Event('change'));
        expect(recurGroup.style.display).toBe('block');

        // Simulate uncheck
        checkbox.checked = false;
        checkbox.dispatchEvent(new window.Event('change'));
        expect(recurGroup.style.display).toBe('none');
    });
    test('handleOutsideClick logic verification (branch coverage)', () => {
        const modal = document.getElementById('goalModal');
        modal.classList.add('is-visible');

        // Case 1: Click outside (e.g., body)
        const originalContains = modal.contains;
        modal.contains = jest.fn((target) => false);
        createModal.close = jest.fn();

        createModal._handleOutsideClick({ target: document.body, nodeType: 1 });
        expect(createModal.close).toHaveBeenCalled();

        // Case 2: Click inside
        createModal.close.mockClear();
        modal.contains = jest.fn((target) => true);
        createModal._handleOutsideClick({ target: modal, nodeType: 1 });
        expect(createModal.close).not.toHaveBeenCalled();

        // Case 3: modal not visible
        modal.classList.remove('is-visible');
        createModal.close.mockClear();
        createModal._handleOutsideClick({ target: document.body, nodeType: 1 });
        expect(createModal.close).not.toHaveBeenCalled();

        modal.contains = originalContains;
    });

    test('_getFormUIElements should handle missing elements', () => {
        document.body.innerHTML = ''; // Clear DOM
        const ui = createModal._getFormUIElements();
        expect(ui.modalTitle).toBeNull();
    });

    test('getFormData handles missing recurrence inputs', () => {
        document.getElementById('goalIsRecurring').checked = true;
        document.getElementById('goalRecurPeriod').remove();
        document.getElementById('goalRecurPeriodUnit').remove();

        const data = createModal.getFormData();

        // These fallback to default values in the code
        expect(data.recurPeriod).toBe(7);
        expect(data.recurPeriodUnit).toBe('days');
    });

    test('open should handle missing title input', () => {
        document.getElementById('goalTitle').remove();
        // Should not throw
        expect(() => createModal.open(jest.fn())).not.toThrow();
    });
    test('handleOutsideClick should close modal when click is not contained in modal', () => {
        document.getElementById('goalModal').classList.add('is-visible');
        const modal = document.getElementById('goalModal');

        // Mock contains to return false (as if clicked outside the relevant area)
        const originalContains = modal.contains;
        modal.contains = jest.fn(() => false);
        createModal.close = jest.fn();

        createModal._handleOutsideClick({ target: document.body, nodeType: 1 });

        expect(createModal.close).toHaveBeenCalled();
        modal.contains = originalContains;
    });

    test('handleOutsideClick should NOT close when clicking specific buttons', () => {
        document.getElementById('goalModal').classList.add('is-visible');
        const modal = document.getElementById('goalModal');
        createModal.close = jest.fn();

        // 1. Click on Add Goal Button
        const addBtn = document.createElement('button');
        addBtn.id = 'addGoalBtn';
        const eventAdd = { target: addBtn, nodeType: 1 };
        // We need to ensure modal.contains returns false for this element to reach the check
        const originalContains = modal.contains;
        modal.contains = jest.fn(() => false);

        createModal._handleOutsideClick(eventAdd);
        expect(createModal.close).not.toHaveBeenCalled();

        // 2. Click on Edit Goal Button (class check)
        createModal.close.mockClear();
        const editBtn = document.createElement('button');
        editBtn.classList.add('edit-goal');
        const eventEdit = { target: editBtn, nodeType: 1 };

        createModal._handleOutsideClick(eventEdit);
        expect(createModal.close).not.toHaveBeenCalled();

        modal.contains = originalContains;
    });

    test('handleGoalSubmit should handle errors securely', () => {
        // Setup error
        mockGoalService.createGoal.mockImplementation(() => {
            throw new Error('Test Error');
        });

        // Suppress console.error for this test
        const originalError = console.error;
        console.error = jest.fn();

        document.getElementById('goalTitle').value = 'Test';
        createModal.handleGoalSubmit();

        expect(console.error).toHaveBeenCalled();
        expect(globalThis.alert).toHaveBeenCalledWith('Test Error');

        console.error = originalError;
    });

    test('open should populate form with provided values (branch check)', () => {
        // Test open when elements missing (console.error path)
        const originalError = console.error;
        console.error = jest.fn();
        document.getElementById('goalModal').remove(); // Remove modal to trigger error

        createModal.open(jest.fn());
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('not found'));

        console.error = originalError;
    });

    test('getFormData handles null/undefined values gracefully', () => {
        // Setup form to have missing optional elements
        document.getElementById('goalIsRecurring').remove();
        document.getElementById('goalRecurPeriod').remove();
        document.getElementById('goalRecurPeriodUnit').remove();

        const data = createModal.getFormData();

        expect(data.isRecurring).toBe(false);
        // data.recurPeriod won't be set if isRecurring is false/missing logic
    });

    test('setupEventListeners Escape key should close modal', () => {
        createModal.setupEventListeners();
        const modal = document.getElementById('goalModal');
        modal.classList.add('is-visible');
        createModal.close = jest.fn();

        // Simulate Escape
        const event = new window.KeyboardEvent('keydown', { key: 'Escape' });
        document.dispatchEvent(event);

        expect(createModal.close).toHaveBeenCalled();
    });

    test('setupEventListeners Escape key should NOT close if completion modal is open', () => {
        createModal.setupEventListeners();
        const modal = document.getElementById('goalModal');
        modal.classList.add('is-visible');

        // Add completion modal to DOM for this test
        const completionModalDiv = document.createElement('div');
        completionModalDiv.id = 'completionModal';
        completionModalDiv.classList.add('is-visible');
        document.body.appendChild(completionModalDiv);

        createModal.close = jest.fn();

        const event = new window.KeyboardEvent('keydown', { key: 'Escape' });
        document.dispatchEvent(event);

        expect(createModal.close).not.toHaveBeenCalled();

        // Cleanup
        completionModalDiv.remove();
    });
});
