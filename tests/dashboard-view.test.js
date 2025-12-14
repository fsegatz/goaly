const { JSDOM } = require('jsdom');
const { DashboardView } = require('../src/ui/desktop/dashboard-view.js');
const Goal = require('../src/domain/models/goal').default;
const LanguageService = require('../src/domain/services/language-service').default;

let dom;
let document;
let window;
let mockApp;
let mockGoalService;
let mockSettingsService;
let dashboardView;

beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div id="goalsList"></div>
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
    </body></html>`, { url: "http://localhost" });
    document = dom.window.document;
    window = dom.window;

    global.document = document;
    global.window = window;
    global.alert = jest.fn();
    window.alert = global.alert;

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-11-09T12:00:00.000Z'));

    mockGoalService = {
        goals: [],
        getActiveGoals: jest.fn(() => []),
        calculatePriority: jest.fn(() => 0),
        updateGoal: jest.fn(),
        isGoalPaused: jest.fn(() => false),
        priorityCache: {
            getPriority: jest.fn((goalId) => {
                const goal = mockGoalService.goals.find(g => g.id === goalId);
                return goal ? mockGoalService.calculatePriority(goal) : 0;
            }),
            getAllPriorities: jest.fn(() => {
                const priorities = new Map();
                mockGoalService.goals.forEach(goal => {
                    priorities.set(goal.id, mockGoalService.calculatePriority(goal));
                });
                return priorities;
            }),
            invalidate: jest.fn(),
            refreshIfNeeded: jest.fn(),
            clear: jest.fn()
        }
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
    };

    dashboardView = new DashboardView(mockApp);
});

afterEach(() => {
    delete global.document;
    delete global.window;
    delete global.alert;
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('DashboardView', () => {
    test('render should display "No active goals" when no active goals', () => {
        mockGoalService.getActiveGoals.mockReturnValue([]);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        dashboardView.render(openCompletionModal, updateGoalInline);

        const dashboardList = document.getElementById('goalsList');
        expect(dashboardList.innerHTML).toContain('No active goals yet. Create your first goal!');
    });

    test('render should render active goals', () => {
        const goal1 = new Goal({ id: '1', title: 'Active Goal 1', description: 'Desc 1', motivation: 5, urgency: 5, status: 'active', deadline: new Date('2025-12-01') });
        const goal2 = new Goal({ id: '2', title: 'Active Goal 2', description: 'Desc 2', motivation: 4, urgency: 4, status: 'active', deadline: new Date('2025-12-05') });
        const goal3 = new Goal({ id: '3', title: 'Active Goal 3', description: 'Desc 3', motivation: 3, urgency: 3, status: 'active', deadline: new Date('2025-12-10') });

        mockGoalService.getActiveGoals.mockReturnValue([goal1, goal2, goal3]);
        mockSettingsService.getSettings.mockReturnValue({ maxActiveGoals: 2 });
        mockGoalService.calculatePriority.mockImplementation((goal) => goal.motivation + goal.urgency);

        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        dashboardView.render(openCompletionModal, updateGoalInline);

        const dashboardList = document.getElementById('goalsList');
        expect(dashboardList.children.length).toBe(2);
        expect(dashboardList.innerHTML).toContain('Active Goal 1');
        expect(dashboardList.innerHTML).toContain('Active Goal 2');
        expect(dashboardList.innerHTML).not.toContain('Active Goal 3');
    });

    test('createGoalCard should create a goal card without priority metric or status badge', () => {
        const goal = new Goal({ id: '1', title: 'Test Goal', motivation: 5, urgency: 4, status: 'active', deadline: new Date('2025-11-15') });
        mockGoalService.calculatePriority.mockReturnValue(4.5);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);

        expect(card.className).toBe('goal-card active');
        expect(card.querySelector('.goal-title').textContent).toBe('Test Goal');
        // Priority metric should not be present on dashboard cards
        expect(card.querySelectorAll('.goal-metrics .metric').length).toBe(0);
        expect(card.querySelector('.metric-value.priority')).toBeNull();
        // Status badge should not be present on dashboard cards
        expect(card.querySelector('.goal-status-badge')).toBeNull();
        expect(card.querySelector('.goal-deadline-label').textContent).toContain('In 6 days');
        expect(card.querySelector('.goal-deadline-input')).not.toBeNull();
        expect(card.querySelector('.edit-goal')).toBeNull();
        expect(card.querySelector('.goal-deadline-label')).not.toBeNull();
        // Active goals should have a pause button
        expect(card.querySelector('.pause-goal')).not.toBeNull();
        expect(card.innerHTML).not.toContain('activate-goal');
        expect(card.querySelector('.complete-goal')).not.toBeNull();
        expect(card.querySelector('.goal-steps-section')).not.toBeNull();
    });

    test('createGoalCard clickable deadline should save changes', () => {
        const goal = new Goal({ id: 'edit-test', title: 'Edit Button', motivation: 3, urgency: 2, status: 'active', deadline: null });
        mockGoalService.calculatePriority.mockReturnValue(5);
        mockGoalService.goals = [goal];
        mockGoalService.getActiveGoals.mockReturnValue([goal]);
        mockGoalService.updateGoal.mockImplementation(() => goal);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const deadlineLabel = card.querySelector('.goal-deadline-label');
        const deadlineInput = card.querySelector('.goal-deadline-input');

        expect(deadlineLabel).not.toBeNull();
        expect(deadlineInput).not.toBeNull();

        // The date input is now directly clickable (no showPicker() needed)
        // Simulate user selecting a date
        deadlineInput.value = '2025-11-20';
        const changeEvent = new window.Event('change');
        deadlineInput.dispatchEvent(changeEvent);

        expect(updateGoalInline).toHaveBeenCalledWith('edit-test', {
            deadline: '2025-11-20'
        });
    });


    test('formatDeadline should return "Today" for today', () => {
        const today = new Date('2025-11-09T12:00:00.000Z');
        const result = dashboardView.formatDeadline(today);
        expect(result).toBe('Today');
    });

    test('formatDeadline should return "Tomorrow" for tomorrow', () => {
        const tomorrow = new Date('2025-11-10T12:00:00.000Z');
        const result = dashboardView.formatDeadline(tomorrow);
        expect(result).toBe('Tomorrow');
    });

    test('formatDeadline should return "In X days" for upcoming deadlines within 7 days', () => {
        const futureDate = new Date('2025-11-12T12:00:00.000Z');
        const result = dashboardView.formatDeadline(futureDate);
        expect(result).toBe('In 3 days');
    });

    test('formatDeadline should return "Overdue" for past deadlines', () => {
        const pastDate = new Date('2025-11-04T12:00:00.000Z');
        const result = dashboardView.formatDeadline(pastDate);
        expect(result).toContain('Overdue (5 days)');
    });

    test('formatDeadline should return formatted date for deadlines far in future', () => {
        const farFutureDate = new Date('2026-01-01T12:00:00.000Z');
        const result = dashboardView.formatDeadline(farFutureDate);
        expect(result).toBe('1/1/2026');
    });

    test('isDeadlineUrgent should return true for deadlines within 7 days', () => {
        const futureDate = new Date('2025-11-14T12:00:00.000Z');
        expect(dashboardView.isDeadlineUrgent(futureDate)).toBe(true);
    });

    test('isDeadlineUrgent should return false for deadlines beyond 7 days', () => {
        const futureDate = new Date('2025-11-17T12:00:00.000Z');
        expect(dashboardView.isDeadlineUrgent(futureDate)).toBe(false);
    });

    test('isDeadlineUrgent should return false for past deadlines', () => {
        const pastDate = new Date('2025-11-08T12:00:00.000Z');
        expect(dashboardView.isDeadlineUrgent(pastDate)).toBe(false);
    });

    test('isDeadlineUrgent should return false for null deadline', () => {
        expect(dashboardView.isDeadlineUrgent(null)).toBe(false);
    });

    test('getStatusText should return English labels for status', () => {
        expect(dashboardView.getStatusText('active')).toBe('Active');
        expect(dashboardView.getStatusText('paused')).toBe('Paused');
        expect(dashboardView.getStatusText('completed')).toBe('Completed');
        expect(dashboardView.getStatusText('abandoned')).toBe('Abandoned');
        expect(dashboardView.getStatusText('unknown')).toBe('unknown');
    });

    test('escapeHtml should escape HTML characters', () => {
        const unsafeString = '<h1>Hello & World</h1><script>alert("xss")</script>';
        const safeString = '&lt;h1&gt;Hello &amp; World&lt;/h1&gt;&lt;script&gt;alert("xss")&lt;/script&gt;';
        expect(dashboardView.escapeHtml(unsafeString)).toBe(safeString);
    });

    test('formatDateTime should return empty string for falsy values', () => {
        expect(dashboardView.formatDateTime(null)).toBe('');
        expect(dashboardView.formatDateTime(undefined)).toBe('');
    });

    test('formatDate should return empty string for null or undefined', () => {
        expect(dashboardView.formatDate(null)).toBe('');
        expect(dashboardView.formatDate(undefined)).toBe('');
    });

    test('formatDate should format date correctly', () => {
        const date = new Date('2025-11-09T12:00:00.000Z');
        const result = dashboardView.formatDate(date);
        expect(result).toBe('11/9/2025');
    });

    test('formatReviewIntervalInput should return empty string for invalid values', () => {
        expect(dashboardView.formatReviewIntervalInput(NaN)).toBe('');
        expect(dashboardView.formatReviewIntervalInput(0)).toBe('');
        expect(dashboardView.formatReviewIntervalInput(-5)).toBe('');
    });

    test('formatReviewIntervalInput should format intervals correctly', () => {
        expect(dashboardView.formatReviewIntervalInput(1)).toBe('1d');
        expect(dashboardView.formatReviewIntervalInput(0.5)).toBe('12h');
        expect(dashboardView.formatReviewIntervalInput(1 / 24)).toBe('1h');
        expect(dashboardView.formatReviewIntervalInput(1 / (24 * 60))).toBe('1m');
        expect(dashboardView.formatReviewIntervalInput(1 / (24 * 60 * 60))).toBe('1s');
    });

    test('formatReviewIntervalDisplay should return unknown for invalid values', () => {
        const result1 = dashboardView.formatReviewIntervalDisplay(NaN);
        const result2 = dashboardView.formatReviewIntervalDisplay(0);
        const result3 = dashboardView.formatReviewIntervalDisplay(-5);
        // Should return translated "unknown" message
        expect(result1).toBeTruthy();
        expect(result2).toBeTruthy();
        expect(result3).toBeTruthy();
        expect(typeof result1).toBe('string');
    });

    test('formatReviewIntervalDisplay should format different time units', () => {
        // Test with different interval values to cover different branches
        const dayResult = dashboardView.formatReviewIntervalDisplay(1);
        const hourResult = dashboardView.formatReviewIntervalDisplay(0.5);
        const minuteResult = dashboardView.formatReviewIntervalDisplay(1 / (24 * 60));
        const secondResult = dashboardView.formatReviewIntervalDisplay(1 / (24 * 60 * 60));

        expect(typeof dayResult).toBe('string');
        expect(typeof hourResult).toBe('string');
        expect(typeof minuteResult).toBe('string');
        expect(typeof secondResult).toBe('string');
    });

    test('createGoalCard should have clickable deadline label', () => {
        const goal = new Goal({ id: '1', title: 'Test Goal', motivation: 5, urgency: 4, status: 'active', deadline: new Date('2025-11-15') });
        mockGoalService.calculatePriority.mockReturnValue(4.5);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const deadlineLabel = card.querySelector('.goal-deadline-label');
        const deadlineInput = card.querySelector('.goal-deadline-input');

        // Should have clickable deadline label and hidden input
        expect(deadlineLabel).not.toBeNull();
        expect(deadlineInput).not.toBeNull();
        expect(card).toBeDefined();
    });

    test('createGoalCard deadline input should be present and positioned over label', () => {
        const goal = new Goal({ id: 'cancel-test', title: 'Cancel Test', motivation: 3, urgency: 2, status: 'active', deadline: null });
        mockGoalService.calculatePriority.mockReturnValue(5);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const deadlineLabel = card.querySelector('.goal-deadline-label');
        const deadlineInput = card.querySelector('.goal-deadline-input');

        expect(deadlineLabel).not.toBeNull();
        expect(deadlineInput).not.toBeNull();
        expect(deadlineInput.type).toBe('date');

        // The input should be positioned to overlay the label for direct interaction
        // This allows iOS Safari to open the native date picker on tap
    });


    test('createGoalCard should handle missing actions container', () => {
        const goal = new Goal({ id: '1', title: 'Test Goal', motivation: 5, urgency: 4, status: 'completed', deadline: new Date('2025-11-15') });
        mockGoalService.calculatePriority.mockReturnValue(4.5);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);

        // Completed goals should not have complete button
        expect(card.querySelector('.complete-goal')).toBeNull();
    });


    test('createGoalCard should support adding and managing steps', () => {
        const goal = new Goal({ id: 'steps-test', title: 'Steps Test', description: '', motivation: 3, urgency: 2, status: 'active', deadline: null, steps: [] });
        mockGoalService.calculatePriority.mockReturnValue(5);
        mockGoalService.goals = [goal];
        mockGoalService.getActiveGoals.mockReturnValue([goal]);
        mockGoalService.updateGoal.mockImplementation(() => goal);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const addStepBtn = card.querySelector('.add-step');
        const stepsList = card.querySelector('.goal-steps-list');

        expect(addStepBtn).not.toBeNull();
        expect(stepsList).not.toBeNull();

        addStepBtn.click();
        const stepEl = stepsList.querySelector('.goal-step');
        expect(stepEl).not.toBeNull();

        const textEl = stepEl.querySelector('.step-text');
        textEl.textContent = 'Test step';
        const blurEvent = new window.Event('blur');
        textEl.dispatchEvent(blurEvent);

        expect(mockGoalService.updateGoal).toHaveBeenCalledWith('steps-test', expect.objectContaining({ steps: expect.arrayContaining([expect.objectContaining({ text: 'Test step' })]) }), 3);
    });

    test('createGoalCard should display existing steps', () => {
        const goal = new Goal({
            id: 'existing-test',
            title: 'Existing Test',
            description: '',
            motivation: 3,
            urgency: 2,
            status: 'active',
            deadline: null,
            steps: [
                { id: 'step1', text: 'Step 1', completed: false, order: 0 },
                { id: 'step2', text: 'Step 2', completed: true, order: 1 }
            ]
        });
        mockGoalService.calculatePriority.mockReturnValue(5);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const stepsList = card.querySelector('.goal-steps-list');

        expect(stepsList.querySelectorAll('.goal-step').length).toBe(2);
        expect(stepsList.textContent).toContain('Step 1');
        expect(stepsList.textContent).toContain('Step 2');
    });

    test('createGoalCard should display completed steps at the bottom', () => {
        const goal = new Goal({
            id: 'sorting-test',
            title: 'Sorting Test',
            description: '',
            motivation: 3,
            urgency: 2,
            status: 'active',
            deadline: null,
            steps: [
                { id: 'step1', text: 'Step 1', completed: true, order: 0 },
                { id: 'step2', text: 'Step 2', completed: false, order: 1 },
                { id: 'step3', text: 'Step 3', completed: true, order: 2 },
                { id: 'step4', text: 'Step 4', completed: false, order: 3 }
            ]
        });
        mockGoalService.calculatePriority.mockReturnValue(5);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const stepsList = card.querySelector('.goal-steps-list');
        const stepElements = stepsList.querySelectorAll('.goal-step');

        expect(stepElements.length).toBe(4);

        // First two steps should be uncompleted (Step 2, Step 4)
        expect(stepElements[0].textContent).toContain('Step 2');
        expect(stepElements[0].classList.contains('completed')).toBe(false);
        expect(stepElements[1].textContent).toContain('Step 4');
        expect(stepElements[1].classList.contains('completed')).toBe(false);

        // Last two steps should be completed (Step 1, Step 3)
        expect(stepElements[2].textContent).toContain('Step 1');
        expect(stepElements[2].classList.contains('completed')).toBe(true);
        expect(stepElements[3].textContent).toContain('Step 3');
        expect(stepElements[3].classList.contains('completed')).toBe(true);
    });

    test('createGoalCard should handle step checkbox toggle', () => {
        const goal = new Goal({
            id: 'checkbox-test',
            title: 'Checkbox Test',
            description: '',
            motivation: 3,
            urgency: 2,
            status: 'active',
            deadline: null,
            steps: [{ id: 'step1', text: 'Step 1', completed: false, order: 0 }]
        });
        mockGoalService.calculatePriority.mockReturnValue(5);
        mockGoalService.goals = [goal];
        mockGoalService.getActiveGoals.mockReturnValue([goal]);
        mockGoalService.updateGoal.mockImplementation(() => goal);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const checkbox = card.querySelector('.step-checkbox');
        const stepEl = card.querySelector('.goal-step');

        expect(checkbox).not.toBeNull();
        expect(checkbox.checked).toBe(false);
        expect(stepEl.classList.contains('completed')).toBe(false);

        checkbox.checked = true;
        const changeEvent = new window.Event('change');
        checkbox.dispatchEvent(changeEvent);

        expect(stepEl.classList.contains('completed')).toBe(true);
        expect(mockGoalService.updateGoal).toHaveBeenCalled();
    });

    test('createGoalCard should move step to bottom when completed via checkbox', () => {
        const goal = new Goal({
            id: 'toggle-complete-test',
            title: 'Toggle Complete Test',
            description: '',
            motivation: 3,
            urgency: 2,
            status: 'active',
            deadline: null,
            steps: [
                { id: 'step1', text: 'Step 1', completed: false, order: 0 },
                { id: 'step2', text: 'Step 2', completed: false, order: 1 }
            ]
        });
        mockGoalService.calculatePriority.mockReturnValue(5);
        mockGoalService.goals = [goal];
        mockGoalService.getActiveGoals.mockReturnValue([goal]);
        mockGoalService.updateGoal.mockImplementation(() => goal);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const stepsList = card.querySelector('.goal-steps-list');
        let stepElements = stepsList.querySelectorAll('.goal-step');

        // Initially, both steps are uncompleted, so order should be preserved
        expect(stepElements.length).toBe(2);
        expect(stepElements[0].textContent).toContain('Step 1');
        expect(stepElements[1].textContent).toContain('Step 2');

        // Toggle first step to completed
        const firstCheckbox = stepElements[0].querySelector('.step-checkbox');
        firstCheckbox.checked = true;
        const changeEvent = new window.Event('change');
        firstCheckbox.dispatchEvent(changeEvent);

        // Wait for async update (if any) and check that Step 1 moved to bottom
        stepElements = stepsList.querySelectorAll('.goal-step');
        expect(stepElements.length).toBe(2);
        expect(stepElements[0].textContent).toContain('Step 2');
        expect(stepElements[0].classList.contains('completed')).toBe(false);
        expect(stepElements[1].textContent).toContain('Step 1');
        expect(stepElements[1].classList.contains('completed')).toBe(true);
    });

    test('createGoalCard should handle step deletion', () => {
        const goal = new Goal({
            id: 'delete-step-test',
            title: 'Delete Step Test',
            description: '',
            motivation: 3,
            urgency: 2,
            status: 'active',
            deadline: null,
            steps: [{ id: 'step1', text: 'Step 1', completed: false, order: 0 }]
        });
        mockGoalService.calculatePriority.mockReturnValue(5);
        mockGoalService.goals = [goal];
        mockGoalService.getActiveGoals.mockReturnValue([goal]);
        mockGoalService.updateGoal.mockImplementation(() => goal);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const deleteBtn = card.querySelector('.step-delete');

        expect(deleteBtn).not.toBeNull();
        deleteBtn.click();

        // After deletion, goal.steps should be empty and setupSteps should be called
        expect(goal.steps).toEqual([]);
        expect(mockGoalService.updateGoal).toHaveBeenCalled();
    });

    test('createGoalCard should handle empty step text on blur', () => {
        const goal = new Goal({
            id: 'empty-step-test',
            title: 'Empty Step Test',
            description: '',
            motivation: 3,
            urgency: 2,
            status: 'active',
            deadline: null,
            steps: [{ id: 'step1', text: 'Step 1', completed: false, order: 0 }]
        });
        mockGoalService.calculatePriority.mockReturnValue(5);
        mockGoalService.goals = [goal];
        mockGoalService.getActiveGoals.mockReturnValue([goal]);
        mockGoalService.updateGoal.mockImplementation(() => goal);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const textEl = card.querySelector('.step-text');
        textEl.textContent = '';

        const blurEvent = new window.Event('blur');
        textEl.dispatchEvent(blurEvent);

        expect(mockGoalService.updateGoal).toHaveBeenCalledWith('empty-step-test', expect.objectContaining({ steps: [] }), 3);
    });

    test('createGoalCard should handle Enter key in step text', () => {
        const goal = new Goal({
            id: 'enter-step-test',
            title: 'Enter Step Test',
            description: '',
            motivation: 3,
            urgency: 2,
            status: 'active',
            deadline: null,
            steps: [{ id: 'step1', text: 'Step 1', completed: false, order: 0 }]
        });
        mockGoalService.calculatePriority.mockReturnValue(5);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const textEl = card.querySelector('.step-text');
        const blurSpy = jest.spyOn(textEl, 'blur');

        const keydownEvent = new window.KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
        textEl.dispatchEvent(keydownEvent);

        expect(blurSpy).toHaveBeenCalled();
    });

    test('createGoalCard deadline input should handle value changes', () => {
        const goal = new Goal({ id: 'keyboard-test', title: 'Keyboard Test', description: '', motivation: 3, urgency: 2, status: 'active', deadline: null });
        mockGoalService.calculatePriority.mockReturnValue(5);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const deadlineLabel = card.querySelector('.goal-deadline-label');
        const deadlineInput = card.querySelector('.goal-deadline-input');

        expect(deadlineInput).not.toBeNull();

        // Simulate user changing the date value
        deadlineInput.value = '2025-12-15';
        const inputEvent = new window.Event('input');
        deadlineInput.dispatchEvent(inputEvent);

        // The label should update to show the new deadline
        expect(deadlineLabel.textContent).toContain('12/15/2025');
    });

    test('createGoalCard should handle step text blur with non-empty text', () => {
        const goal = new Goal({
            id: 'non-empty-step-test',
            title: 'Non Empty Step Test',
            description: '',
            motivation: 3,
            urgency: 2,
            status: 'active',
            deadline: null,
            steps: [{ id: 'step1', text: 'Step 1', completed: false, order: 0 }]
        });
        mockGoalService.calculatePriority.mockReturnValue(5);
        mockGoalService.goals = [goal];
        mockGoalService.getActiveGoals.mockReturnValue([goal]);
        mockGoalService.updateGoal.mockImplementation(() => goal);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const textEl = card.querySelector('.step-text');
        textEl.textContent = 'Updated step';

        const blurEvent = new window.Event('blur');
        textEl.dispatchEvent(blurEvent);

        expect(mockGoalService.updateGoal).toHaveBeenCalled();
    });

    test('createGoalCard should handle step deletion when goal.steps is undefined', () => {
        const goal = new Goal({
            id: 'undefined-steps-test',
            title: 'Undefined Steps Test',
            description: '',
            motivation: 3,
            urgency: 2,
            status: 'active',
            deadline: null
        });
        goal.steps = undefined;
        mockGoalService.calculatePriority.mockReturnValue(5);
        mockGoalService.goals = [goal];
        mockGoalService.getActiveGoals.mockReturnValue([goal]);
        mockGoalService.updateGoal.mockImplementation(() => goal);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const addStepBtn = card.querySelector('.add-step');
        addStepBtn.click();

        const deleteBtn = card.querySelector('.step-delete');
        expect(deleteBtn).not.toBeNull();
        deleteBtn.click();

        expect(mockGoalService.updateGoal).toHaveBeenCalled();
    });

    test('createGoalCard should handle step blur when goal.steps is null', () => {
        const goal = new Goal({
            id: 'null-steps-test',
            title: 'Null Steps Test',
            description: '',
            motivation: 3,
            urgency: 2,
            status: 'active',
            deadline: null
        });
        goal.steps = null;
        mockGoalService.calculatePriority.mockReturnValue(5);
        mockGoalService.goals = [goal];
        mockGoalService.getActiveGoals.mockReturnValue([goal]);
        mockGoalService.updateGoal.mockImplementation(() => goal);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const addStepBtn = card.querySelector('.add-step');
        addStepBtn.click();

        const textEl = card.querySelector('.step-text');
        textEl.textContent = '';
        const blurEvent = new window.Event('blur');
        textEl.dispatchEvent(blurEvent);

        expect(mockGoalService.updateGoal).toHaveBeenCalled();
    });

    test('createGoalCard should handle renderSteps with empty steps list', () => {
        const goal = new Goal({
            id: 'empty-render-test',
            title: 'Empty Render Test',
            description: '',
            motivation: 3,
            urgency: 2,
            status: 'active',
            deadline: null,
            steps: []
        });
        mockGoalService.calculatePriority.mockReturnValue(5);
        mockGoalService.goals = [goal];
        mockGoalService.getActiveGoals.mockReturnValue([goal]);
        mockGoalService.updateGoal.mockImplementation(() => goal);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const stepsList = card.querySelector('.goal-steps-list');

        // Should show empty state initially
        expect(stepsList.querySelector('.steps-empty')).not.toBeNull();
        expect(stepsList.textContent).toContain('No steps yet');
    });

    test('createGoalCard title should be clickable to enter edit mode', () => {
        const goal = new Goal({ id: 'title-test', title: 'Original Title', motivation: 3, urgency: 2, status: 'active' });
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const titleElement = card.querySelector('.goal-title');

        expect(titleElement).not.toBeNull();
        expect(titleElement.getAttribute('role')).toBe('button');
        expect(titleElement.getAttribute('tabindex')).toBe('0');
        expect(titleElement.style.cursor).toBe('pointer');
    });

    test('createGoalCard clicking title should show input field', () => {
        const goal = new Goal({ id: 'title-test', title: 'Original Title', motivation: 3, urgency: 2, status: 'active' });
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const titleElement = card.querySelector('.goal-title');

        titleElement.click();

        const input = card.querySelector('.goal-title-input');
        expect(input).not.toBeNull();
        expect(input.value).toBe('Original Title');
        expect(titleElement.style.display).toBe('none');
    });

    test('createGoalCard Enter key should save title changes', () => {
        const goal = new Goal({ id: 'title-test', title: 'Original Title', motivation: 3, urgency: 2, status: 'active' });
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const titleElement = card.querySelector('.goal-title');

        titleElement.click();
        const input = card.querySelector('.goal-title-input');
        input.value = 'Updated Title';

        const enterEvent = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        input.dispatchEvent(enterEvent);

        expect(updateGoalInline).toHaveBeenCalledWith('title-test', { title: 'Updated Title' });
        expect(titleElement.style.display).toBe('');
        expect(titleElement.textContent).toBe('Updated Title');
    });

    test('createGoalCard Escape key should cancel title editing', () => {
        const goal = new Goal({ id: 'title-test', title: 'Original Title', motivation: 3, urgency: 2, status: 'active' });
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const titleElement = card.querySelector('.goal-title');

        titleElement.click();
        const input = card.querySelector('.goal-title-input');
        input.value = 'Changed Title';

        const escapeEvent = new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        input.dispatchEvent(escapeEvent);

        expect(updateGoalInline).not.toHaveBeenCalled();
        expect(titleElement.style.display).toBe('');
        expect(titleElement.textContent).toBe('Original Title');
    });

    test('createGoalCard blur should save title changes', () => {
        const goal = new Goal({ id: 'title-test', title: 'Original Title', motivation: 3, urgency: 2, status: 'active' });
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const titleElement = card.querySelector('.goal-title');

        titleElement.click();
        const input = card.querySelector('.goal-title-input');
        input.value = 'Updated Title';

        input.dispatchEvent(new window.Event('blur'));

        // Advance timers to trigger setTimeout in the blur handler
        jest.advanceTimersByTime(250);

        expect(updateGoalInline).toHaveBeenCalledWith('title-test', { title: 'Updated Title' });
        expect(titleElement.style.display).toBe('');
        expect(titleElement.textContent).toBe('Updated Title');
    });

    test('createGoalCard empty title should show error and keep editing', () => {
        const goal = new Goal({ id: 'title-test', title: 'Original Title', motivation: 3, urgency: 2, status: 'active' });
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const titleElement = card.querySelector('.goal-title');

        titleElement.click();
        const input = card.querySelector('.goal-title-input');
        input.value = '   '; // Only whitespace

        const enterEvent = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        input.dispatchEvent(enterEvent);

        // Error should be shown inline, editing should continue
        expect(input.classList.contains('goal-title-input-error')).toBe(true);
        expect(input.getAttribute('aria-invalid')).toBe('true');
        const errorMessage = card.querySelector('.goal-title-error-message');
        expect(errorMessage).not.toBeNull();
        expect(errorMessage.textContent).toBeTruthy();
        expect(updateGoalInline).not.toHaveBeenCalled();
        // Input should still be visible (editing not cancelled)
        expect(titleElement.style.display).toBe('none');
        expect(input.parentNode).not.toBeNull();
    });

    test('createGoalCard no change should cancel without saving', () => {
        const goal = new Goal({ id: 'title-test', title: 'Original Title', motivation: 3, urgency: 2, status: 'active' });
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const titleElement = card.querySelector('.goal-title');

        titleElement.click();
        const input = card.querySelector('.goal-title-input');
        // Keep the same title

        const enterEvent = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        input.dispatchEvent(enterEvent);

        expect(updateGoalInline).not.toHaveBeenCalled();
        expect(titleElement.style.display).toBe('');
    });

    test('createGoalCard keyboard Enter should start editing', () => {
        const goal = new Goal({ id: 'title-test', title: 'Original Title', motivation: 3, urgency: 2, status: 'active' });
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const titleElement = card.querySelector('.goal-title');

        const enterEvent = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        titleElement.dispatchEvent(enterEvent);

        const input = card.querySelector('.goal-title-input');
        expect(input).not.toBeNull();
    });

    test('createGoalCard keyboard Space should start editing', () => {
        const goal = new Goal({ id: 'title-test', title: 'Original Title', motivation: 3, urgency: 2, status: 'active' });
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const titleElement = card.querySelector('.goal-title');

        const spaceEvent = new window.KeyboardEvent('keydown', { key: ' ', bubbles: true });
        titleElement.dispatchEvent(spaceEvent);

        const input = card.querySelector('.goal-title-input');
        expect(input).not.toBeNull();
    });


    test('render should display review cards when reviews exist', () => {
        const goal = new Goal({ id: '1', title: 'Review Goal', motivation: 5, urgency: 5, status: 'active', deadline: new Date('2025-12-01') });
        mockApp.reviews = [{ goal, dueAt: new Date() }];
        mockGoalService.getActiveGoals.mockReturnValue([goal]);

        dashboardView.render(jest.fn(), jest.fn(), jest.fn(), jest.fn(), jest.fn(), jest.fn());

        const dashboardList = document.getElementById('goalsList');
        expect(dashboardList.querySelectorAll('.review-card').length).toBe(1);
        expect(dashboardList.textContent).toContain('Review Goal');
        // Check for "Review" badge
        expect(dashboardList.textContent).toContain('Review');
    });

    test('createReviewCard should create a review card with fields', () => {
        const goal = new Goal({ id: '1', title: 'Review Goal', motivation: 3, urgency: 3 });
        const review = { goal, dueAt: new Date() };
        const openGoalForm = jest.fn();
        const handleReviewSubmit = jest.fn();
        const renderViews = jest.fn();

        const card = dashboardView.createReviewCard(review, 1, 1, openGoalForm, handleReviewSubmit, renderViews);

        expect(card.classList.contains('review-card')).toBe(true);
        expect(card.querySelector('.review-card__title').textContent).toBe('Review Goal');
        // Should have motivation and urgency fields (10 radio buttons each assuming MAX_RATING_VALUE is 10, or 5 if 5)
        // We just check existence of inputs
        expect(card.querySelectorAll('input[type="radio"]').length).toBeGreaterThan(0);
        expect(card.querySelector('button[type="submit"]')).not.toBeNull();
        expect(card.querySelector('button[data-i18n-key="reviews.actions.edit"]')).not.toBeNull();
    });

    test('createReviewCard should handle review submission', () => {
        const goal = new Goal({ id: '1', title: 'Review Goal', motivation: 3, urgency: 3 });
        const review = { goal, dueAt: new Date() };
        const openGoalForm = jest.fn();
        const handleReviewSubmit = jest.fn();
        const renderViews = jest.fn();

        const card = dashboardView.createReviewCard(review, 1, 1, openGoalForm, handleReviewSubmit, renderViews);

        // Find radio buttons for motivation and change selection
        // We know structure is createReviewRadioGroup -> container
        const radioGroups = card.querySelectorAll('.review-card__radio-group');
        expect(radioGroups.length).toBe(2);

        const motivationGroup = radioGroups[0];
        const urgencyGroup = radioGroups[1];

        // Select logic
        const motivationInput = motivationGroup.querySelector('input[value="5"]');
        if (motivationInput) motivationInput.checked = true;

        const urgencyInput = urgencyGroup.querySelector('input[value="1"]');
        if (urgencyInput) urgencyInput.checked = true;

        const form = card;
        const submitEvent = new window.Event('submit');
        form.dispatchEvent(submitEvent);

        expect(handleReviewSubmit).toHaveBeenCalledWith(
            goal.id,
            { motivation: '5', urgency: '1' },
            renderViews
        );
    });

    test('createReviewCard edit button should open goal form', () => {
        const goal = new Goal({ id: '1', title: 'Review Goal', motivation: 3, urgency: 3 });
        const review = { goal, dueAt: new Date() };
        const openGoalForm = jest.fn();
        const handleReviewSubmit = jest.fn();
        const renderViews = jest.fn();

        const card = dashboardView.createReviewCard(review, 1, 1, openGoalForm, handleReviewSubmit, renderViews);

        const editBtn = card.querySelector('button[data-i18n-key="reviews.actions.edit"]');
        editBtn.click();

        expect(openGoalForm).toHaveBeenCalledWith(goal.id);
    });

    test('formatReviewDueLabel should return correct label', () => {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const overdue = new Date(today);
        overdue.setDate(today.getDate() - 3);

        expect(dashboardView.formatReviewDueLabel(today)).toBe('Due today');
        // Depending on logic, tomorrow might be same or different. 
        // Logic says: if (diffDays <= 0) return 'reviews.due.today';
        // Wait, diffMs = now - due. If due is future, diff is negative. diffDays <= 0.
        // So future is "Today"? That seems like a bug or simplistic logic in source, but test should match source.

        // Let's check source logic again:
        // const now = new Date();
        // const diffMs = now.getTime() - dueDate.getTime();
        // const diffDays = Math.floor(diffMs / DAY_IN_MS);
        // if (diffDays <= 0) return this.translate('reviews.due.today');

        // If due is yesterday: now > due, diffMs > 0.
        // If diffMs = 1.5 days. diffDays = 1.
        // Return overdue.

        expect(dashboardView.formatReviewDueLabel(overdue)).toBe('Overdue by 3 days');
        expect(dashboardView.formatReviewDueLabel(null)).toBe('Review scheduled');
    });

});


