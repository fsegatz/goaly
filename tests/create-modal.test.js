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
});

afterEach(() => {
    delete globalThis.document;
    delete globalThis.window;
    jest.restoreAllMocks();
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
});
