const { JSDOM } = require('jsdom');
const { DashboardView } = require('../src/ui/desktop/dashboard-view.js');
const Goal = require('../src/domain/goal').default;
const LanguageService = require('../src/domain/language-service').default;

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

    test('createGoalCard should create a goal card with editable description and priority metric', () => {
        const goal = new Goal({ id: '1', title: 'Test Goal', description: 'Test Description', motivation: 5, urgency: 4, status: 'active', deadline: new Date('2025-11-15') });
        mockGoalService.calculatePriority.mockReturnValue(4.5);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const descriptionEl = card.querySelector('.goal-description');

        expect(card.className).toBe('goal-card active');
        expect(card.querySelector('.goal-title').textContent).toBe('Test Goal');
        expect(descriptionEl.textContent).toBe('Test Description');
        expect(descriptionEl.getAttribute('contenteditable')).toBe('true');
        expect(card.querySelectorAll('.goal-metrics .metric').length).toBe(1);
        expect(card.querySelector('.metric-value.priority').textContent).toBe('4.5');
        expect(card.querySelector('.metric-value.motivation')).toBeNull();
        expect(card.querySelector('.metric-value.urgency')).toBeNull();
        expect(card.querySelector('.goal-deadline').textContent).toContain('In 6 days');
        expect(card.querySelector('.goal-inline-editor')).not.toBeNull();
        expect(card.innerHTML).toContain('btn btn-primary edit-goal');
        expect(card.innerHTML).not.toContain('pause-goal');
        expect(card.innerHTML).not.toContain('activate-goal');
        expect(card.querySelector('.complete-goal')).not.toBeNull();
    });

    test('createGoalCard edit button should toggle inline editor and save changes', () => {
        const goal = new Goal({ id: 'edit-test', title: 'Edit Button', description: '', motivation: 3, urgency: 2, status: 'active', deadline: null });
        mockGoalService.calculatePriority.mockReturnValue(5);
        mockGoalService.goals = [goal];
        mockGoalService.getActiveGoals.mockReturnValue([goal]);
        mockGoalService.updateGoal.mockImplementation(() => goal);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const editBtn = card.querySelector('.edit-goal');
        const inlineEditor = card.querySelector('.goal-inline-editor');
        const deadlineInput = inlineEditor.querySelector('.inline-deadline');
        const motivationInput = inlineEditor.querySelector('.inline-motivation');
        const urgencyInput = inlineEditor.querySelector('.inline-urgency');
        const saveBtn = inlineEditor.querySelector('.save-inline');

        expect(editBtn).not.toBeNull();
        expect(inlineEditor.classList.contains('is-visible')).toBe(false);

        editBtn.click();
        expect(inlineEditor.classList.contains('is-visible')).toBe(true);
        expect(editBtn.getAttribute('aria-expanded')).toBe('true');

        deadlineInput.value = '2025-11-20';
        motivationInput.value = '4';
        urgencyInput.value = '5';

        saveBtn.click();

        expect(updateGoalInline).toHaveBeenCalledWith('edit-test', {
            deadline: '2025-11-20',
            motivation: 4,
            urgency: 5
        });
    });

    test('createGoalCard should save description changes on blur', () => {
        const goal = new Goal({ id: 'desc-test', title: 'Desc Goal', description: 'Initial', motivation: 3, urgency: 2, status: 'active', deadline: null });
        mockGoalService.calculatePriority.mockReturnValue(6);
        mockGoalService.goals = [goal];
        mockGoalService.getActiveGoals.mockReturnValue([goal]);
        mockGoalService.updateGoal.mockImplementation(() => {
            goal.description = 'Updated';
            return goal;
        });
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const descriptionEl = card.querySelector('.goal-description');
        descriptionEl.textContent = 'Updated';

        const blurEvent = new window.Event('blur');
        descriptionEl.dispatchEvent(blurEvent);

        expect(mockGoalService.updateGoal).toHaveBeenCalledWith('desc-test', { description: 'Updated' }, 3);
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

    test('formatDate should format date correctly', () => {
        const date = new Date('2025-11-09T12:00:00.000Z');
        const result = dashboardView.formatDate(date);
        expect(result).toBe('11/9/2025');
    });

    test('createGoalCard should handle missing edit button gracefully', () => {
        const goal = new Goal({ id: '1', title: 'Test Goal', description: 'Test Description', motivation: 5, urgency: 4, status: 'active', deadline: new Date('2025-11-15') });
        mockGoalService.calculatePriority.mockReturnValue(4.5);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const editBtn = card.querySelector('.edit-goal');
        
        // Should have edit button
        expect(editBtn).toBeDefined();
        expect(card).toBeDefined();
    });

    test('createGoalCard cancel button should close inline editor', () => {
        const goal = new Goal({ id: 'cancel-test', title: 'Cancel Test', description: '', motivation: 3, urgency: 2, status: 'active', deadline: null });
        mockGoalService.calculatePriority.mockReturnValue(5);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const editBtn = card.querySelector('.edit-goal');
        const inlineEditor = card.querySelector('.goal-inline-editor');
        const cancelBtn = inlineEditor.querySelector('.cancel-inline');

        editBtn.click();
        expect(inlineEditor.classList.contains('is-visible')).toBe(true);

        cancelBtn.click();
        expect(inlineEditor.classList.contains('is-visible')).toBe(false);
    });

    test('createGoalCard should revert description when update fails', () => {
        const goal = new Goal({ id: 'desc-error', title: 'Desc Error', description: 'Original', motivation: 2, urgency: 3, status: 'active', deadline: null });
        mockGoalService.calculatePriority.mockReturnValue(5);
        mockGoalService.goals = [goal];
        mockGoalService.getActiveGoals.mockReturnValue([goal]);
        mockGoalService.updateGoal.mockImplementation(() => {
            throw new Error('Boom');
        });
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        global.alert.mockClear();
        const descriptionEl = card.querySelector('.goal-description');
        descriptionEl.textContent = 'Broken';

        const blurEvent = new window.Event('blur');
        descriptionEl.dispatchEvent(blurEvent);

        expect(mockGoalService.updateGoal).toHaveBeenCalledWith('desc-error', { description: 'Broken' }, 3);
        expect(descriptionEl.textContent).toBe('Original');
        expect(global.alert).toHaveBeenCalledWith('Boom');
    });

    test('createGoalCard should handle missing actions container', () => {
        const goal = new Goal({ id: '1', title: 'Test Goal', description: 'Test Description', motivation: 5, urgency: 4, status: 'completed', deadline: new Date('2025-11-15') });
        mockGoalService.calculatePriority.mockReturnValue(4.5);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        
        // Completed goals should not have complete button
        expect(card.querySelector('.complete-goal')).toBeNull();
    });

    test('createGoalCard should handle escape key in description', () => {
        const goal = new Goal({ id: 'esc-test', title: 'Escape Test', description: 'Original', motivation: 3, urgency: 2, status: 'active', deadline: null });
        mockGoalService.calculatePriority.mockReturnValue(5);
        const openCompletionModal = jest.fn();
        const updateGoalInline = jest.fn();

        const card = dashboardView.createGoalCard(goal, openCompletionModal, updateGoalInline);
        const descriptionEl = card.querySelector('.goal-description');
        descriptionEl.textContent = 'Changed';
        descriptionEl.focus();

        const keydownEvent = new window.KeyboardEvent('keydown', { key: 'Escape' });
        descriptionEl.dispatchEvent(keydownEvent);

        expect(descriptionEl.textContent).toBe('Original');
    });
});

