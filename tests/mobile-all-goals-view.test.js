const { JSDOM } = require('jsdom');
const { MobileAllGoalsView } = require('../src/ui/mobile/all-goals-view.js');
const Goal = require('../src/domain/models/goal').default;
const LanguageService = require('../src/domain/services/language-service').default;

let dom;
let document;
let window;
let mockApp;
let mockGoalService;
let mobileAllGoalsView;

beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div id="allGoalsMobileContainer"></div>
        <div class="all-goals-controls">
            <label for="allGoalsStatusFilter">
                <span>Status</span>
                <div class="status-filter-dropdown" id="allGoalsStatusFilter">
                    <button type="button" class="status-filter-button" id="allGoalsStatusFilterButton" aria-haspopup="true" aria-expanded="false">
                        <span class="status-filter-button-text">All statuses</span>
                        <span class="status-filter-button-arrow">▼</span>
                    </button>
                    <div class="status-filter-dropdown-menu" id="allGoalsStatusFilterMenu" role="menu" aria-hidden="true">
                        <label class="status-filter-option" role="menuitem">
                            <input type="checkbox" value="all" class="status-filter-checkbox" checked>
                            <span>All statuses</span>
                        </label>
                        <label class="status-filter-option" role="menuitem">
                            <input type="checkbox" value="active" class="status-filter-checkbox">
                            <span>Active</span>
                        </label>
                        <label class="status-filter-option" role="menuitem">
                            <input type="checkbox" value="paused" class="status-filter-checkbox">
                            <span>Paused</span>
                        </label>
                        <label class="status-filter-option" role="menuitem">
                            <input type="checkbox" value="completed" class="status-filter-checkbox">
                            <span>Completed</span>
                        </label>
                        <label class="status-filter-option" role="menuitem">
                            <input type="checkbox" value="abandoned" class="status-filter-checkbox">
                            <span>Abandoned</span>
                        </label>
                        <button type="button" class="status-filter-clear" id="allGoalsStatusFilterClear">Clear filter</button>
                    </div>
                </div>
            </label>
            <label for="allGoalsPriorityFilter">
                <span>Minimum priority</span>
                <input type="number" id="allGoalsPriorityFilter" value="0" />
            </label>
            <label for="allGoalsSort">
                <span>Sorting</span>
                <select id="allGoalsSort">
                    <option value="priority-desc">Priority (high → low)</option>
                    <option value="priority-asc">Priority (low → high)</option>
                    <option value="updated-desc">Last update (new → old)</option>
                    <option value="updated-asc">Last update (old → new)</option>
                </select>
            </label>
        </div>
    </body></html>`, { url: "http://localhost" });
    document = dom.window.document;
    window = dom.window;

    global.document = document;
    global.window = window;

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-11-09T12:00:00.000Z'));

    mockGoalService = {
        goals: [],
        calculatePriority: jest.fn((goal) => goal.motivation + goal.urgency),
    };

    const languageService = new LanguageService();
    languageService.init('en');

    mockApp = {
        goalService: mockGoalService,
        languageService,
    };

    mobileAllGoalsView = new MobileAllGoalsView(mockApp);
});

afterEach(() => {
    delete global.document;
    delete global.window;
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('MobileAllGoalsView', () => {
    test('render should display empty state when no goals', () => {
        mockGoalService.goals = [];
        const openGoalForm = jest.fn();

        mobileAllGoalsView.render(openGoalForm);

        const container = document.getElementById('allGoalsMobileContainer');
        expect(container.children.length).toBe(1);
        expect(container.querySelector('.mobile-goals-empty')).not.toBeNull();
    });

    test('render should return early when container is missing', () => {
        const container = document.getElementById('allGoalsMobileContainer');
        container.remove();
        const openGoalForm = jest.fn();

        expect(() => mobileAllGoalsView.render(openGoalForm)).not.toThrow();
    });

    test('render should create goal cards', () => {
        const goal1 = new Goal({ id: '1', title: 'Goal 1', motivation: 5, urgency: 4, status: 'active', deadline: new Date('2025-12-01'), lastUpdated: new Date('2025-11-10T10:00:00.000Z') });
        const goal2 = new Goal({ id: '2', title: 'Goal 2', motivation: 3, urgency: 2, status: 'paused', deadline: null, lastUpdated: new Date('2025-11-08T10:00:00.000Z') });
        mockGoalService.goals = [goal1, goal2];
        const openGoalForm = jest.fn();

        mobileAllGoalsView.render(openGoalForm);

        const container = document.getElementById('allGoalsMobileContainer');
        const cards = container.querySelectorAll('.mobile-goal-card');
        expect(cards.length).toBe(2);
        expect(cards[0].textContent).toContain('Goal 1');
        expect(cards[1].textContent).toContain('Goal 2');
    });

    test('render should filter by status', () => {
        const goal1 = new Goal({ id: '1', title: 'Active Goal', motivation: 5, urgency: 4, status: 'active', deadline: null, lastUpdated: new Date('2025-11-10T10:00:00.000Z') });
        const goal2 = new Goal({ id: '2', title: 'Paused Goal', motivation: 3, urgency: 2, status: 'paused', deadline: null, lastUpdated: new Date('2025-11-08T10:00:00.000Z') });
        mockGoalService.goals = [goal1, goal2];
        mobileAllGoalsView.allGoalsState.statusFilter = 'paused';
        const openGoalForm = jest.fn();

        mobileAllGoalsView.render(openGoalForm);

        const container = document.getElementById('allGoalsMobileContainer');
        const cards = container.querySelectorAll('.mobile-goal-card');
        expect(cards.length).toBe(1);
        expect(cards[0].textContent).toContain('Paused Goal');
    });

    test('render should filter by minimum priority', () => {
        const goal1 = new Goal({ id: '1', title: 'High Priority', motivation: 5, urgency: 4, status: 'active', deadline: null, lastUpdated: new Date('2025-11-10T10:00:00.000Z') });
        const goal2 = new Goal({ id: '2', title: 'Low Priority', motivation: 1, urgency: 1, status: 'active', deadline: null, lastUpdated: new Date('2025-11-08T10:00:00.000Z') });
        mockGoalService.goals = [goal1, goal2];
        mobileAllGoalsView.allGoalsState.minPriority = 5;
        const openGoalForm = jest.fn();

        mobileAllGoalsView.render(openGoalForm);

        const container = document.getElementById('allGoalsMobileContainer');
        const cards = container.querySelectorAll('.mobile-goal-card');
        expect(cards.length).toBe(1);
        expect(cards[0].textContent).toContain('High Priority');
    });

    test('render should filter out completed goals when includeCompleted is false', () => {
        const goal1 = new Goal({ id: '1', title: 'Active Goal', motivation: 5, urgency: 4, status: 'active', deadline: null, lastUpdated: new Date('2025-11-10T10:00:00.000Z') });
        const goal2 = new Goal({ id: '2', title: 'Completed Goal', motivation: 3, urgency: 2, status: 'completed', deadline: null, lastUpdated: new Date('2025-11-08T10:00:00.000Z') });
        mockGoalService.goals = [goal1, goal2];
        mobileAllGoalsView.allGoalsState.includeCompleted = false;
        const openGoalForm = jest.fn();

        mobileAllGoalsView.render(openGoalForm);

        const container = document.getElementById('allGoalsMobileContainer');
        const cards = container.querySelectorAll('.mobile-goal-card');
        expect(cards.length).toBe(1);
        expect(cards[0].textContent).toContain('Active Goal');
    });

    test('render should filter out abandoned goals when includeAbandoned is false', () => {
        const goal1 = new Goal({ id: '1', title: 'Active Goal', motivation: 5, urgency: 4, status: 'active', deadline: null, lastUpdated: new Date('2025-11-10T10:00:00.000Z') });
        const goal2 = new Goal({ id: '2', title: 'Abandoned Goal', motivation: 3, urgency: 2, status: 'abandoned', deadline: null, lastUpdated: new Date('2025-11-08T10:00:00.000Z') });
        mockGoalService.goals = [goal1, goal2];
        mobileAllGoalsView.allGoalsState.includeAbandoned = false;
        const openGoalForm = jest.fn();

        mobileAllGoalsView.render(openGoalForm);

        const container = document.getElementById('allGoalsMobileContainer');
        const cards = container.querySelectorAll('.mobile-goal-card');
        expect(cards.length).toBe(1);
        expect(cards[0].textContent).toContain('Active Goal');
    });

    test('render should sort by priority ascending', () => {
        const goal1 = new Goal({ id: '1', title: 'High Priority', motivation: 5, urgency: 4, status: 'active', deadline: null, lastUpdated: new Date('2025-11-10T10:00:00.000Z') });
        const goal2 = new Goal({ id: '2', title: 'Low Priority', motivation: 1, urgency: 1, status: 'active', deadline: null, lastUpdated: new Date('2025-11-08T10:00:00.000Z') });
        mockGoalService.goals = [goal1, goal2];
        mobileAllGoalsView.allGoalsState.sort = 'priority-asc';
        const openGoalForm = jest.fn();

        mobileAllGoalsView.render(openGoalForm);

        const container = document.getElementById('allGoalsMobileContainer');
        const cards = container.querySelectorAll('.mobile-goal-card');
        expect(cards[0].textContent).toContain('Low Priority');
        expect(cards[1].textContent).toContain('High Priority');
    });

    test('render should sort by updated descending', () => {
        const goal1 = new Goal({ id: '1', title: 'Old Goal', motivation: 5, urgency: 4, status: 'active', deadline: null, lastUpdated: new Date('2025-11-08T10:00:00.000Z') });
        const goal2 = new Goal({ id: '2', title: 'New Goal', motivation: 3, urgency: 2, status: 'active', deadline: null, lastUpdated: new Date('2025-11-10T10:00:00.000Z') });
        mockGoalService.goals = [goal1, goal2];
        mobileAllGoalsView.allGoalsState.sort = 'updated-desc';
        const openGoalForm = jest.fn();

        mobileAllGoalsView.render(openGoalForm);

        const container = document.getElementById('allGoalsMobileContainer');
        const cards = container.querySelectorAll('.mobile-goal-card');
        expect(cards[0].textContent).toContain('New Goal');
        expect(cards[1].textContent).toContain('Old Goal');
    });

    test('render should sort by updated ascending', () => {
        const goal1 = new Goal({ id: '1', title: 'Old Goal', motivation: 5, urgency: 4, status: 'active', deadline: null, lastUpdated: new Date('2025-11-08T10:00:00.000Z') });
        const goal2 = new Goal({ id: '2', title: 'New Goal', motivation: 3, urgency: 2, status: 'active', deadline: null, lastUpdated: new Date('2025-11-10T10:00:00.000Z') });
        mockGoalService.goals = [goal1, goal2];
        mobileAllGoalsView.allGoalsState.sort = 'updated-asc';
        const openGoalForm = jest.fn();

        mobileAllGoalsView.render(openGoalForm);

        const container = document.getElementById('allGoalsMobileContainer');
        const cards = container.querySelectorAll('.mobile-goal-card');
        expect(cards[0].textContent).toContain('Old Goal');
        expect(cards[1].textContent).toContain('New Goal');
    });

    test('createGoalCard should create card with correct structure', () => {
        const goal = new Goal({ id: '1', title: 'Test Goal', motivation: 5, urgency: 4, status: 'active', deadline: new Date('2025-12-01'), lastUpdated: new Date('2025-11-10T10:00:00.000Z') });
        const openGoalForm = jest.fn();

        const card = mobileAllGoalsView.createGoalCard(goal, 9.0, openGoalForm);

        expect(card.className).toContain('mobile-goal-card');
        expect(card.className).toContain('status-active');
        expect(card.textContent).toContain('Test Goal');
        expect(card.textContent).toContain('9.0');
        expect(card.textContent).toContain('5/5');
        expect(card.textContent).toContain('4/5');
    });

    test('createGoalCard should call openGoalForm on click', () => {
        const goal = new Goal({ id: '1', title: 'Test Goal', motivation: 5, urgency: 4, status: 'active', deadline: null, lastUpdated: new Date('2025-11-10T10:00:00.000Z') });
        const openGoalForm = jest.fn();

        const card = mobileAllGoalsView.createGoalCard(goal, 9.0, openGoalForm);
        card.click();

        expect(openGoalForm).toHaveBeenCalledWith('1');
    });

    test('createGoalCard should call openGoalForm on Enter key', () => {
        const goal = new Goal({ id: '1', title: 'Test Goal', motivation: 5, urgency: 4, status: 'active', deadline: null, lastUpdated: new Date('2025-11-10T10:00:00.000Z') });
        const openGoalForm = jest.fn();

        const card = mobileAllGoalsView.createGoalCard(goal, 9.0, openGoalForm);
        const keydownEvent = new window.KeyboardEvent('keydown', { key: 'Enter' });
        card.dispatchEvent(keydownEvent);

        expect(openGoalForm).toHaveBeenCalledWith('1');
    });

    test('createGoalCard should call openGoalForm on Space key', () => {
        const goal = new Goal({ id: '1', title: 'Test Goal', motivation: 5, urgency: 4, status: 'active', deadline: null, lastUpdated: new Date('2025-11-10T10:00:00.000Z') });
        const openGoalForm = jest.fn();

        const card = mobileAllGoalsView.createGoalCard(goal, 9.0, openGoalForm);
        const keydownEvent = new window.KeyboardEvent('keydown', { key: ' ' });
        card.dispatchEvent(keydownEvent);

        expect(openGoalForm).toHaveBeenCalledWith('1');
    });

    test('setupControls should update state on filter change', () => {
        const openGoalForm = jest.fn();
        mobileAllGoalsView.render = jest.fn();
        mobileAllGoalsView.setupControls(openGoalForm);

        const dropdown = document.getElementById('allGoalsStatusFilter');
        const activeCheckbox = dropdown.querySelector('input[value="active"]');
        const pausedCheckbox = dropdown.querySelector('input[value="paused"]');
        const completedCheckbox = dropdown.querySelector('input[value="completed"]');
        const abandonedCheckbox = dropdown.querySelector('input[value="abandoned"]');
        const allCheckbox = dropdown.querySelector('input[value="all"]');

        // Uncheck "all" first - this will check all others
        allCheckbox.checked = false;
        allCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));

        // Uncheck all except paused
        activeCheckbox.checked = false;
        completedCheckbox.checked = false;
        abandonedCheckbox.checked = false;
        activeCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));

        expect(mobileAllGoalsView.allGoalsState.statusFilter).toEqual(['paused']);
        expect(mobileAllGoalsView.render).toHaveBeenCalledWith(openGoalForm);
    });

    test('setupControls should handle missing elements', () => {
        const openGoalForm = jest.fn();
        document.getElementById('allGoalsStatusFilter').remove();
        document.getElementById('allGoalsPriorityFilter').remove();
        document.getElementById('allGoalsSort').remove();

        expect(() => mobileAllGoalsView.setupControls(openGoalForm)).not.toThrow();
    });

    test('setupControls should parse priority filter correctly', () => {
        const openGoalForm = jest.fn();
        mobileAllGoalsView.render = jest.fn();
        mobileAllGoalsView.setupControls(openGoalForm);

        const priorityFilter = document.getElementById('allGoalsPriorityFilter');
        priorityFilter.value = '42';
        priorityFilter.dispatchEvent(new window.Event('input', { bubbles: true }));

        expect(mobileAllGoalsView.allGoalsState.minPriority).toBe(42);
    });

    test('setupControls should handle invalid priority filter', () => {
        const openGoalForm = jest.fn();
        mobileAllGoalsView.render = jest.fn();
        mobileAllGoalsView.setupControls(openGoalForm);

        const priorityFilter = document.getElementById('allGoalsPriorityFilter');
        priorityFilter.value = 'invalid';
        priorityFilter.dispatchEvent(new window.Event('input', { bubbles: true }));

        expect(mobileAllGoalsView.allGoalsState.minPriority).toBe(0);
    });

    test('setupControls should update sort on change', () => {
        const openGoalForm = jest.fn();
        mobileAllGoalsView.render = jest.fn();
        mobileAllGoalsView.setupControls(openGoalForm);

        const sortSelect = document.getElementById('allGoalsSort');
        sortSelect.value = 'updated-asc';
        sortSelect.dispatchEvent(new window.Event('change', { bubbles: true }));

        expect(mobileAllGoalsView.allGoalsState.sort).toBe('updated-asc');
        expect(mobileAllGoalsView.render).toHaveBeenCalledWith(openGoalForm);
    });

    test('setupStatusFilterDropdown should toggle dropdown on button click', () => {
        const openGoalForm = jest.fn();
        mobileAllGoalsView.setupControls(openGoalForm);

        const button = document.getElementById('allGoalsStatusFilterButton');
        const menu = document.getElementById('allGoalsStatusFilterMenu');

        expect(button.getAttribute('aria-expanded')).toBe('false');
        expect(menu.getAttribute('aria-hidden')).toBe('true');

        button.click();

        expect(button.getAttribute('aria-expanded')).toBe('true');
        expect(menu.getAttribute('aria-hidden')).toBe('false');

        button.click();

        expect(button.getAttribute('aria-expanded')).toBe('false');
        expect(menu.getAttribute('aria-hidden')).toBe('true');
    });

    test('setupStatusFilterDropdown should close dropdown when clicking outside', () => {
        const openGoalForm = jest.fn();
        mobileAllGoalsView.setupControls(openGoalForm);

        const button = document.getElementById('allGoalsStatusFilterButton');
        const menu = document.getElementById('allGoalsStatusFilterMenu');
        const outsideElement = document.createElement('div');
        document.body.appendChild(outsideElement);

        // Open dropdown
        button.click();
        expect(button.getAttribute('aria-expanded')).toBe('true');

        // Click outside
        outsideElement.click();

        expect(button.getAttribute('aria-expanded')).toBe('false');
        expect(menu.getAttribute('aria-hidden')).toBe('true');

        document.body.removeChild(outsideElement);
    });

    test('setupStatusFilterDropdown should clear filter when clear button is clicked', () => {
        const openGoalForm = jest.fn();
        mobileAllGoalsView.render = jest.fn();
        mobileAllGoalsView.setupControls(openGoalForm);

        const dropdown = document.getElementById('allGoalsStatusFilter');
        const clearButton = document.getElementById('allGoalsStatusFilterClear');
        const allCheckbox = dropdown.querySelector('input[value="all"]');
        const activeCheckbox = dropdown.querySelector('input[value="active"]');
        const pausedCheckbox = dropdown.querySelector('input[value="paused"]');

        // Set some filters
        allCheckbox.checked = false;
        activeCheckbox.checked = true;
        pausedCheckbox.checked = true;
        mobileAllGoalsView.allGoalsState.statusFilter = ['active', 'paused'];

        // Clear filter
        clearButton.click();

        expect(mobileAllGoalsView.allGoalsState.statusFilter).toEqual(['all']);
        expect(allCheckbox.checked).toBe(true);
        expect(activeCheckbox.checked).toBe(false);
        expect(pausedCheckbox.checked).toBe(false);
        expect(mobileAllGoalsView.render).toHaveBeenCalledWith(openGoalForm);
    });

    test('handleStatusFilterChange should check all when "all" is checked', () => {
        const openGoalForm = jest.fn();
        mobileAllGoalsView.setupControls(openGoalForm);

        const dropdown = document.getElementById('allGoalsStatusFilter');
        const allCheckbox = dropdown.querySelector('input[value="all"]');
        const activeCheckbox = dropdown.querySelector('input[value="active"]');
        const pausedCheckbox = dropdown.querySelector('input[value="paused"]');
        const completedCheckbox = dropdown.querySelector('input[value="completed"]');
        const abandonedCheckbox = dropdown.querySelector('input[value="abandoned"]');
        const checkboxes = dropdown.querySelectorAll('.status-filter-checkbox');

        // Uncheck all first
        allCheckbox.checked = false;
        allCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));

        // Now check "all"
        allCheckbox.checked = true;
        allCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));

        expect(mobileAllGoalsView.allGoalsState.statusFilter).toEqual(['all']);
        expect(activeCheckbox.checked).toBe(false);
        expect(pausedCheckbox.checked).toBe(false);
        expect(completedCheckbox.checked).toBe(false);
        expect(abandonedCheckbox.checked).toBe(false);
    });

    test('handleStatusFilterChange should uncheck "all" when specific status is changed', () => {
        const openGoalForm = jest.fn();
        mobileAllGoalsView.setupControls(openGoalForm);

        const dropdown = document.getElementById('allGoalsStatusFilter');
        const allCheckbox = dropdown.querySelector('input[value="all"]');
        const activeCheckbox = dropdown.querySelector('input[value="active"]');
        const checkboxes = dropdown.querySelectorAll('.status-filter-checkbox');

        // "all" is initially checked
        expect(allCheckbox.checked).toBe(true);

        // Uncheck active (but this should uncheck "all" first)
        allCheckbox.checked = false;
        allCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));

        // Now check active
        activeCheckbox.checked = true;
        activeCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));

        expect(allCheckbox.checked).toBe(false);
        expect(mobileAllGoalsView.allGoalsState.statusFilter).toContain('active');
    });

    test('handleStatusFilterChange should select "all" when nothing is selected', () => {
        const openGoalForm = jest.fn();
        mobileAllGoalsView.setupControls(openGoalForm);

        const dropdown = document.getElementById('allGoalsStatusFilter');
        const allCheckbox = dropdown.querySelector('input[value="all"]');
        const activeCheckbox = dropdown.querySelector('input[value="active"]');
        const pausedCheckbox = dropdown.querySelector('input[value="paused"]');
        const completedCheckbox = dropdown.querySelector('input[value="completed"]');
        const abandonedCheckbox = dropdown.querySelector('input[value="abandoned"]');
        const checkboxes = dropdown.querySelectorAll('.status-filter-checkbox');

        // Uncheck all first - this checks all others
        allCheckbox.checked = false;
        allCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));

        // Now uncheck all specific statuses one by one
        activeCheckbox.checked = false;
        activeCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));

        pausedCheckbox.checked = false;
        pausedCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));

        completedCheckbox.checked = false;
        completedCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));

        // Last one should trigger "select all"
        abandonedCheckbox.checked = false;
        abandonedCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));

        expect(allCheckbox.checked).toBe(true);
        expect(mobileAllGoalsView.allGoalsState.statusFilter).toEqual(['all']);
    });

    test('updateStatusFilterButtonText should handle missing button text element', () => {
        const button = document.createElement('button');
        // No buttonText element inside

        expect(() => mobileAllGoalsView.updateStatusFilterButtonText(button)).not.toThrow();
    });

    test('updateStatusFilterButtonText should show count when multiple statuses selected', () => {
        const openGoalForm = jest.fn();
        mobileAllGoalsView.setupControls(openGoalForm);

        const button = document.getElementById('allGoalsStatusFilterButton');
        const buttonText = button.querySelector('.status-filter-button-text');

        mobileAllGoalsView.allGoalsState.statusFilter = ['active', 'paused'];
        mobileAllGoalsView.updateStatusFilterButtonText(button);

        expect(buttonText.textContent).toContain('2');
        expect(buttonText.textContent).toContain('status');
    });

    test('setupStatusFilterDropdown should handle missing dropdown elements', () => {
        const openGoalForm = jest.fn();
        document.getElementById('allGoalsStatusFilter').remove();

        expect(() => mobileAllGoalsView.setupStatusFilterDropdown(openGoalForm)).not.toThrow();
    });
});

