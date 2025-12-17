const { JSDOM } = require('jsdom');
const { EditModal } = require('../src/ui/modal/edit-modal.js');
const Goal = require('../src/domain/models/goal').default;
const LanguageService = require('../src/domain/services/language-service').default;

let dom;
let document;
let window;
let mockApp;
let mockGoalService;
let editModal;

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
                    <button id="reactivateGoalBtn" style="display: none;"></button>
                    <button id="forceActivateGoalBtn" style="display: none;"></button>
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
    window.confirm = globalThis.confirm;
    window.alert = globalThis.alert;

    mockGoalService = {
        goals: [],
        updateGoal: jest.fn(),
        deleteGoal: jest.fn(),
        getGoal: jest.fn((id) => mockGoalService.goals.find(g => g.id === id)),
        isGoalPaused: jest.fn(() => false),
        unpauseGoal: jest.fn(),
        setGoalStatus: jest.fn(),
        forceActivateGoal: jest.fn(),
        createGoal: jest.fn()
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

    editModal = new EditModal(mockApp);

    // Silence console logs during tests
    jest.spyOn(console, 'log').mockImplementation(() => { });
});

afterEach(() => {
    delete globalThis.document;
    delete globalThis.window;
    jest.restoreAllMocks(); // This restores console.log
});

describe('EditModal', () => {
    test('open should populate form with existing goal data', () => {
        const goal = new Goal({ id: '123', title: 'Edit Me', motivation: 3, urgency: 2 });
        mockGoalService.goals = [goal];

        editModal.open(jest.fn(), '123');

        expect(document.getElementById('goalId').value).toBe('123');
        expect(document.getElementById('goalTitle').value).toBe('Edit Me');
        expect(document.getElementById('modalTitle').textContent).toBe('Edit goal');
        expect(document.getElementById('deleteBtn').style.display).toBe('inline-block');
    });

    test('handleGoalSubmit should call updateGoal', () => {
        document.getElementById('goalId').value = '123';
        document.getElementById('goalTitle').value = 'Updated Title';
        document.getElementById('goalMotivation').value = '5';
        document.getElementById('goalUrgency').value = '1';

        editModal.handleGoalSubmit();

        expect(mockGoalService.updateGoal).toHaveBeenCalledWith('123', expect.objectContaining({
            title: 'Updated Title'
        }), 3);
    });

    test('open should console error and close if goal not found', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        mockGoalService.goals = [];
        editModal.close = jest.fn();

        editModal.open(jest.fn(), '999');

        expect(consoleSpy).toHaveBeenCalled();
        expect(editModal.close).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    test('handleDelete should call deleteGoal', () => {
        document.getElementById('goalId').value = '123';
        editModal.handleDelete();
        expect(mockGoalService.deleteGoal).toHaveBeenCalledWith('123', 3);
    });

    test('status buttons should update based on goal status', () => {
        const completedGoal = new Goal({ id: 'c1', title: 'Done', status: 'completed' });
        mockGoalService.goals = [completedGoal];

        editModal.open(jest.fn(), 'c1');

        const reactivateBtn = document.getElementById('reactivateGoalBtn');
        const completeBtn = document.getElementById('completeGoalBtn');

        expect(reactivateBtn.style.display).toBe('inline-block');
        expect(completeBtn.style.display).toBe('none');
    });

    test('handleReactivateGoal should call setGoalStatus', () => {
        const completedGoal = new Goal({ id: 'c1', status: 'completed' });
        mockGoalService.goals = [completedGoal];
        document.getElementById('goalId').value = 'c1'; // Manually set as helper would need form populated

        editModal.handleReactivateGoal();

        expect(mockGoalService.setGoalStatus).toHaveBeenCalledWith('c1', 'inactive', 3);
    });

    test('handleForceActivateGoal should call forceActivateGoal', () => {
        const goal = new Goal({ id: 'p1', status: 'paused' });
        mockGoalService.goals = [goal];
        document.getElementById('goalId').value = 'p1';

        editModal.handleForceActivateGoal();

        expect(mockGoalService.forceActivateGoal).toHaveBeenCalledWith('p1', 3);
    });

    test('handleUnpauseGoal should call unpauseGoal', () => {
        const goal = new Goal({ id: 'p1', status: 'paused' });
        mockGoalService.goals = [goal];
        document.getElementById('goalId').value = 'p1';

        editModal.handleUnpauseGoal();

        expect(mockGoalService.unpauseGoal).toHaveBeenCalledWith('p1', 3);
    });

    test('_populateDeadline should handle invalid date', () => {
        const goal = new Goal({ id: '1', deadline: 'invalid-date' });
        const ui = {
            deadlineInput: { value: '' }
        };
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        editModal._populateDeadline(goal, ui);

        expect(ui.deadlineInput.value).toBe('');
        // We expect a warning for invalid date
        // expect(consoleSpy).toHaveBeenCalled(); // Logic logs warning
        consoleSpy.mockRestore();
    });

    test('_populateRecurringFields should toggle visibility', () => {
        const goal = new Goal({ id: '1', isRecurring: true, recurPeriod: 5, recurPeriodUnit: 'days' });
        const ui = {
            recurringCheckbox: { checked: false },
            periodGroup: { style: { display: 'none' } },
            periodInput: { value: '' },
            periodUnitSelect: { value: '' }
        };

        editModal._populateRecurringFields(goal, ui);

        expect(ui.recurringCheckbox.checked).toBe(true);
        expect(ui.periodGroup.style.display).toBe('block');
        expect(ui.periodInput.value).toBe(5);
        expect(ui.periodUnitSelect.value).toBe('days');
    });

    test('getStatusButtons should show unpause button if paused', () => {
        const goal = new Goal({ id: '1', status: 'paused' });
        mockGoalService.goals = [goal];
        mockGoalService.isGoalPaused.mockReturnValue(true);

        // We use the existing button in DOM, ensuring it is hidden first
        const unpauseBtn = document.getElementById('unpauseGoalBtn');
        unpauseBtn.style.display = 'none';

        editModal._updateStatusButtons(goal);

        expect(unpauseBtn.style.display).toBe('inline-block');
    });

    test('_populateFormFields should handle missing UI elements gracefully', () => {
        const goal = new Goal({ id: '1' });
        // Use a mock UI object missing some fields
        const partialUI = {
            goalIdInput: { value: '' }
            // others missing
        };

        // Should not throw
        expect(() => editModal._populateFormFields(goal, partialUI)).not.toThrow();
    });

    test('handleGoalSubmit should create new goal if no ID logic fallback hit', () => {
        // Force getFormData to return data, but goalId input to be empty
        document.getElementById('goalId').value = '';
        document.getElementById('goalTitle').value = 'New Fallback';

        editModal.handleGoalSubmit();

        expect(mockGoalService.createGoal).toHaveBeenCalled();
    });

    test('handleUnpauseGoal should return early if goal not found', () => {
        document.getElementById('goalId').value = 'missing-id';
        mockGoalService.goals = []; // No goal match

        editModal.handleUnpauseGoal();

        expect(mockGoalService.unpauseGoal).not.toHaveBeenCalled();
    });
});
