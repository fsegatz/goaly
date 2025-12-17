const { JSDOM } = require('jsdom');
const { AllGoalsView } = require('../src/ui/views/all-goals-view.js');
const Goal = require('../src/domain/models/goal').default;
const LanguageService = require('../src/domain/services/language-service').default;

/**
 * Common HTML structure for status filter dropdown.
 */
const STATUS_FILTER_HTML = `
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
                        <input type="checkbox" value="inactive" class="status-filter-checkbox">
                        <span>Inactive</span>
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
                        <input type="checkbox" value="notCompleted" class="status-filter-checkbox">
                        <span>Not Completed</span>
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
    </div>`;

/**
 * Desktop-specific HTML for AllGoalsView tests.
 */
const DESKTOP_TABLE_HTML = `
    <div class="table-wrapper desktop-only">
        <table id="allGoalsTable">
            <thead>
                <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Motivation</th>
                    <th>Urgency</th>
                    <th>Deadline</th>
                    <th>Last updated</th>
                </tr>
            </thead>
            <tbody id="allGoalsTableBody"></tbody>
        </table>
        <div id="allGoalsEmptyState" hidden>No goals match the current filters.</div>
    </div>`;

/**
 * Creates a mock goal service with common defaults.
 */
function createMockGoalService() {
    const mockGoalService = {
        goals: [],
        calculatePriority: jest.fn((goal) => goal.motivation + goal.urgency),
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
    return mockGoalService;
}

/**
 * Creates a mock app object with all required services.
 */
function createMockApp(mockGoalService) {
    const languageService = new LanguageService();
    languageService.init('en');

    return {
        goalService: mockGoalService,
        languageService,
        settingsService: {
            getSettings: jest.fn(() => ({ maxActiveGoals: 3 }))
        }
    };
}

/**
 * Creates standard test goals for filtering and sorting tests.
 */
function createTestGoals() {
    return {
        activeGoal: new Goal({
            id: 'a',
            title: 'Active',
            motivation: 5,
            urgency: 4,
            status: 'active',
            deadline: null,
            lastUpdated: new Date('2025-11-10T10:00:00.000Z')
        }),
        pausedGoal: new Goal({
            id: 'p',
            title: 'Paused',
            motivation: 3,
            urgency: 2,
            status: 'paused',
            deadline: null,
            lastUpdated: new Date('2025-11-08T10:00:00.000Z')
        }),
        completedGoal: new Goal({
            id: 'c',
            title: 'Completed',
            motivation: 4,
            urgency: 1,
            status: 'completed',
            deadline: null,
            lastUpdated: new Date('2025-11-12T10:00:00.000Z')
        })
    };
}

let dom;
let document;
let window;
let mockGoalService;
let mockApp;
let allGoalsView;

beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div id="all-goalsView" class="view">
            ${STATUS_FILTER_HTML}
            ${DESKTOP_TABLE_HTML}
        </div>
    </body></html>`, { url: "http://localhost" });
    document = dom.window.document;
    window = dom.window;

    globalThis.document = document;
    globalThis.window = window;

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-11-09T12:00:00.000Z'));

    mockGoalService = createMockGoalService();
    mockApp = createMockApp(mockGoalService);
    allGoalsView = new AllGoalsView(mockApp);
});

afterEach(() => {
    delete globalThis.document;
    delete globalThis.window;
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('AllGoalsView', () => {
    describe('Status filter dropdown', () => {
        test('should toggle dropdown on button click', () => {
            const openGoalForm = jest.fn();
            allGoalsView.setupControls(openGoalForm);

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

        test('should close dropdown when clicking outside', () => {
            const openGoalForm = jest.fn();
            allGoalsView.setupControls(openGoalForm);

            const button = document.getElementById('allGoalsStatusFilterButton');
            const menu = document.getElementById('allGoalsStatusFilterMenu');
            const outsideElement = document.createElement('div');
            document.body.appendChild(outsideElement);

            button.click();
            expect(button.getAttribute('aria-expanded')).toBe('true');

            outsideElement.click();

            expect(button.getAttribute('aria-expanded')).toBe('false');
            expect(menu.getAttribute('aria-hidden')).toBe('true');

            outsideElement.remove();
        });

        test('should clear filter when clear button is clicked', () => {
            const openGoalForm = jest.fn();
            allGoalsView.render = jest.fn();
            allGoalsView.setupControls(openGoalForm);

            const dropdown = document.getElementById('allGoalsStatusFilter');
            const clearButton = document.getElementById('allGoalsStatusFilterClear');
            const allCheckbox = dropdown.querySelector('input[value="all"]');
            const activeCheckbox = dropdown.querySelector('input[value="active"]');

            allCheckbox.checked = false;
            activeCheckbox.checked = true;
            allGoalsView.allGoalsState.statusFilter = ['active'];

            clearButton.click();

            expect(allGoalsView.allGoalsState.statusFilter).toEqual(['all']);
            expect(allCheckbox.checked).toBe(true);
            expect(activeCheckbox.checked).toBe(false);
        });

        test('should update button text to "All statuses" when all individual statuses are selected', () => {
            const openGoalForm = jest.fn();
            allGoalsView.setupControls(openGoalForm);

            const dropdown = document.getElementById('allGoalsStatusFilter');
            const checkboxes = dropdown.querySelectorAll('.status-filter-checkbox:not([value="all"])');
            const allCheckbox = dropdown.querySelector('input[value="all"]');

            allCheckbox.checked = false;
            allCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));

            checkboxes.forEach(cb => {
                cb.checked = true;
                cb.dispatchEvent(new window.Event('change', { bubbles: true }));
            });

            const button = document.getElementById('allGoalsStatusFilterButton');
            const buttonText = button.querySelector('.status-filter-button-text');
            expect(buttonText.textContent).toMatch(/All statuses|filters.statusOptions.all/);
        });

        test('should handle missing dropdown elements', () => {
            const openGoalForm = jest.fn();
            document.getElementById('allGoalsStatusFilter').remove();

            expect(() => allGoalsView.setupStatusFilterDropdown(openGoalForm)).not.toThrow();
        });
    });

    describe('handleStatusFilterChange', () => {
        test('should set filter to all when "all" is checked', () => {
            const openGoalForm = jest.fn();
            allGoalsView.setupControls(openGoalForm);

            const dropdown = document.getElementById('allGoalsStatusFilter');
            const allCheckbox = dropdown.querySelector('input[value="all"]');

            allCheckbox.checked = false;
            allCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));

            allCheckbox.checked = true;
            allCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));

            expect(allGoalsView.allGoalsState.statusFilter).toEqual(['all']);
        });

        test('should select "all" when nothing is selected', () => {
            const openGoalForm = jest.fn();
            allGoalsView.setupControls(openGoalForm);

            const dropdown = document.getElementById('allGoalsStatusFilter');
            const allCheckbox = dropdown.querySelector('input[value="all"]');
            const checkboxes = dropdown.querySelectorAll('.status-filter-checkbox:not([value="all"])');

            allCheckbox.checked = false;
            allCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));

            checkboxes.forEach(cb => {
                cb.checked = false;
                cb.dispatchEvent(new window.Event('change', { bubbles: true }));
            });

            expect(allCheckbox.checked).toBe(true);
            expect(allGoalsView.allGoalsState.statusFilter).toEqual(['all']);
        });
    });

    describe('setupControls', () => {
        test('should update state on priority filter change', () => {
            const openGoalForm = jest.fn();
            allGoalsView.render = jest.fn();
            allGoalsView.setupControls(openGoalForm);

            const priorityFilter = document.getElementById('allGoalsPriorityFilter');
            priorityFilter.value = '42';
            priorityFilter.dispatchEvent(new window.Event('input', { bubbles: true }));

            expect(allGoalsView.allGoalsState.minPriority).toBe(42);
        });

        test('should handle invalid priority filter value', () => {
            const openGoalForm = jest.fn();
            allGoalsView.render = jest.fn();
            allGoalsView.setupControls(openGoalForm);

            const priorityFilter = document.getElementById('allGoalsPriorityFilter');
            priorityFilter.value = 'invalid';
            priorityFilter.dispatchEvent(new window.Event('input', { bubbles: true }));

            expect(allGoalsView.allGoalsState.minPriority).toBe(0);
        });

        test('should update sort on change', () => {
            const openGoalForm = jest.fn();
            allGoalsView.render = jest.fn();
            allGoalsView.setupControls(openGoalForm);

            const sortSelect = document.getElementById('allGoalsSort');
            sortSelect.value = 'updated-asc';
            sortSelect.dispatchEvent(new window.Event('change', { bubbles: true }));

            expect(allGoalsView.allGoalsState.sort).toBe('updated-asc');
        });

        test('should handle missing control elements', () => {
            document.getElementById('allGoalsStatusFilter')?.remove();
            document.getElementById('allGoalsPriorityFilter')?.remove();
            document.getElementById('allGoalsSort')?.remove();

            const openGoalForm = jest.fn();
            expect(() => allGoalsView.setupControls(openGoalForm)).not.toThrow();
        });
    });

    describe('updateStatusFilterButtonText', () => {
        test('should handle missing button text element', () => {
            const button = document.createElement('button');
            expect(() => allGoalsView.updateStatusFilterButtonText(button)).not.toThrow();
        });

        test('should show count when multiple statuses selected', () => {
            const openGoalForm = jest.fn();
            allGoalsView.setupControls(openGoalForm);

            const button = document.getElementById('allGoalsStatusFilterButton');
            const buttonText = button.querySelector('.status-filter-button-text');

            allGoalsView.allGoalsState.statusFilter = ['active', 'paused'];
            allGoalsView.updateStatusFilterButtonText(button);

            expect(buttonText.textContent).toContain('2');
            expect(buttonText.textContent.toLowerCase()).toContain('status');
        });

        test('should show single status name when one status selected', () => {
            const openGoalForm = jest.fn();
            allGoalsView.setupControls(openGoalForm);

            const button = document.getElementById('allGoalsStatusFilterButton');
            const buttonText = button.querySelector('.status-filter-button-text');

            allGoalsView.allGoalsState.statusFilter = ['active'];
            allGoalsView.updateStatusFilterButtonText(button);

            expect(buttonText.textContent).not.toMatch(/All statuses|filters.statusOptions.all/);
        });
    });

    describe('syncFilterControls', () => {
        test('should sync checkboxes when status filter is not "all"', () => {
            const openGoalForm = jest.fn();
            allGoalsView.setupControls(openGoalForm);

            const dropdown = document.getElementById('allGoalsStatusFilter');
            const activeCheckbox = dropdown.querySelector('input[value="active"]');
            const pausedCheckbox = dropdown.querySelector('input[value="paused"]');
            const allCheckbox = dropdown.querySelector('input[value="all"]');

            allGoalsView.allGoalsState.statusFilter = ['active', 'paused'];
            allGoalsView.syncFilterControls();

            expect(activeCheckbox.checked).toBe(true);
            expect(pausedCheckbox.checked).toBe(true);
            expect(allCheckbox.checked).toBe(false);
        });
    });

    describe('Filtering', () => {
        let testGoals;

        beforeEach(() => {
            testGoals = createTestGoals();
            mockGoalService.goals = [testGoals.activeGoal, testGoals.pausedGoal, testGoals.completedGoal];
            mockGoalService.calculatePriority.mockImplementation(goal => goal.motivation + goal.urgency * 10);
        });

        test('should filter out completed goals when includeCompleted is false', () => {
            allGoalsView.allGoalsState.includeCompleted = false;
            const openGoalForm = jest.fn();
            allGoalsView.render(openGoalForm);

            const items = document.querySelectorAll('#allGoalsTableBody tr');
            const ids = Array.from(items).map(row => row.dataset.goalId);
            expect(ids).not.toContain('c');
        });

        test('should filter out notCompleted goals when includeNotCompleted is false', () => {
            const notCompletedGoal = new Goal({
                id: 'nc',
                title: 'Not Completed',
                motivation: 3,
                urgency: 2,
                status: 'notCompleted'
            });
            mockGoalService.goals.push(notCompletedGoal);
            allGoalsView.allGoalsState.includeNotCompleted = false;

            const openGoalForm = jest.fn();
            allGoalsView.render(openGoalForm);

            const items = document.querySelectorAll('#allGoalsTableBody tr');
            const ids = Array.from(items).map(row => row.dataset.goalId);
            expect(ids).not.toContain('nc');
        });

        test('should filter by minimum priority', () => {
            allGoalsView.allGoalsState.minPriority = 40;
            const openGoalForm = jest.fn();
            allGoalsView.render(openGoalForm);

            const items = document.querySelectorAll('#allGoalsTableBody tr');
            expect(items.length).toBe(1);
            expect(items[0].dataset.goalId).toBe('a');
        });

        test('should filter by specific status when not "all"', () => {
            allGoalsView.allGoalsState.statusFilter = ['active'];
            const openGoalForm = jest.fn();
            allGoalsView.render(openGoalForm);

            const items = document.querySelectorAll('#allGoalsTableBody tr');
            const ids = Array.from(items).map(row => row.dataset.goalId);
            expect(ids).toContain('a');
            expect(ids).not.toContain('p');
            expect(ids).not.toContain('c');
        });

        test('should handle status filter change when allCheckbox exists but is not checked', () => {
            const openGoalForm = jest.fn();
            allGoalsView.setupControls(openGoalForm);

            const dropdown = document.getElementById('allGoalsStatusFilter');
            const allCheckbox = dropdown.querySelector('input[value="all"]');
            const activeCheckbox = dropdown.querySelector('input[value="active"]');

            allCheckbox.checked = false;
            allCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));

            activeCheckbox.checked = true;
            activeCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));

            expect(allGoalsView.allGoalsState.statusFilter).toContain('active');
        });
    });

    describe('Sorting', () => {
        let testGoals;

        beforeEach(() => {
            testGoals = createTestGoals();
            mockGoalService.goals = [testGoals.activeGoal, testGoals.pausedGoal, testGoals.completedGoal];
            mockGoalService.calculatePriority.mockImplementation(goal => goal.motivation + goal.urgency * 10);
        });

        test('should sort by priority ascending', () => {
            allGoalsView.allGoalsState.sort = 'priority-asc';
            const openGoalForm = jest.fn();
            allGoalsView.render(openGoalForm);

            const items = document.querySelectorAll('#allGoalsTableBody tr');
            const ids = Array.from(items).map(row => row.dataset.goalId);
            expect(ids[0]).toBe('c');
        });

        test('should sort by updated descending', () => {
            allGoalsView.allGoalsState.sort = 'updated-desc';
            const openGoalForm = jest.fn();
            allGoalsView.render(openGoalForm);

            const items = document.querySelectorAll('#allGoalsTableBody tr');
            const ids = Array.from(items).map(row => row.dataset.goalId);
            expect(ids[0]).toBe('c');
        });

        test('should sort by updated ascending', () => {
            allGoalsView.allGoalsState.sort = 'updated-asc';
            const openGoalForm = jest.fn();
            allGoalsView.render(openGoalForm);

            const items = document.querySelectorAll('#allGoalsTableBody tr');
            const ids = Array.from(items).map(row => row.dataset.goalId);
            expect(ids[0]).toBe('p');
        });

        test('should handle default/unknown sort value', () => {
            allGoalsView.allGoalsState.sort = 'unknown-sort';
            const openGoalForm = jest.fn();
            allGoalsView.render(openGoalForm);

            const items = document.querySelectorAll('#allGoalsTableBody tr');
            expect(items.length).toBe(3);
        });
    });

    describe('Desktop-specific rendering', () => {
        test('render should display empty state when no goals', () => {
            mockGoalService.goals = [];
            const openGoalForm = jest.fn();

            allGoalsView.render(openGoalForm);

            const tableBody = document.getElementById('allGoalsTableBody');
            expect(tableBody.children.length).toBe(0);
            const emptyState = document.getElementById('allGoalsEmptyState');
            expect(emptyState.hidden).toBe(false);
        });

        test('render should populate table with all goals', () => {
            const goal1 = new Goal({ id: '1', title: 'Active Goal 1', description: 'Desc 1', motivation: 5, urgency: 5, status: 'active', deadline: new Date('2025-12-01') });
            const goal2 = new Goal({ id: '2', title: 'Paused Goal 1', description: 'Desc 2', motivation: 2, urgency: 2, status: 'paused', deadline: new Date('2025-12-15') });
            const goal3 = new Goal({ id: '3', title: 'Completed Goal 1', description: 'Desc 3', motivation: 1, urgency: 1, status: 'completed', deadline: new Date('2025-12-20') });

            mockGoalService.goals = [goal1, goal2, goal3];
            mockGoalService.calculatePriority.mockImplementation((goal) => goal.motivation + goal.urgency);

            const openGoalForm = jest.fn();
            allGoalsView.render(openGoalForm);

            const tableRows = document.querySelectorAll('#allGoalsTableBody tr');
            expect(tableRows.length).toBe(3);
            expect(Array.from(tableRows).map(row => row.dataset.goalId)).toEqual(['1', '2', '3']);

            const emptyState = document.getElementById('allGoalsEmptyState');
            expect(emptyState.hidden).toBe(true);
        });

        test('clicking a table row should call openGoalForm', () => {
            const goal = new Goal({ id: '1', title: 'Test', motivation: 3, urgency: 4, status: 'active' });
            mockGoalService.goals = [goal];
            mockGoalService.calculatePriority.mockImplementation(() => 10);
            const openGoalForm = jest.fn();

            allGoalsView.render(openGoalForm);

            const firstRow = document.querySelector('#allGoalsTableBody tr');
            firstRow.click();
            expect(openGoalForm).toHaveBeenCalledWith('1');

            const keydownEvent = new window.KeyboardEvent('keydown', { key: 'Enter' });
            firstRow.dispatchEvent(keydownEvent);
            expect(openGoalForm).toHaveBeenCalledTimes(2);
        });

        test('row keydown should handle space key', () => {
            const goal = new Goal({ id: '1', title: 'Test', motivation: 3, urgency: 4, status: 'active' });
            mockGoalService.goals = [goal];
            mockGoalService.calculatePriority.mockImplementation(() => 10);
            const openGoalForm = jest.fn();

            allGoalsView.render(openGoalForm);

            const row = document.querySelector('#allGoalsTableBody tr');
            const spaceEvent = new window.KeyboardEvent('keydown', { key: ' ' });
            row.dispatchEvent(spaceEvent);

            expect(openGoalForm).toHaveBeenCalledWith('1');
        });

        test('row keydown should ignore other keys', () => {
            const goal = new Goal({ id: '1', title: 'Test', motivation: 3, urgency: 4, status: 'active' });
            mockGoalService.goals = [goal];
            mockGoalService.calculatePriority.mockImplementation(() => 10);
            const openGoalForm = jest.fn();

            allGoalsView.render(openGoalForm);

            const row = document.querySelector('#allGoalsTableBody tr');
            const otherKeyEvent = new window.KeyboardEvent('keydown', { key: 'Escape' });
            row.dispatchEvent(otherKeyEvent);

            expect(openGoalForm).not.toHaveBeenCalled();
        });

        test('render should return early when table body is absent', () => {
            const tableBody = document.getElementById('allGoalsTableBody');
            tableBody.remove();

            const openGoalForm = jest.fn();
            expect(() => allGoalsView.render(openGoalForm)).not.toThrow();
        });

        test('render should handle missing emptyState element', () => {
            const emptyState = document.getElementById('allGoalsEmptyState');
            emptyState?.remove();

            const openGoalForm = jest.fn();
            expect(() => allGoalsView.render(openGoalForm)).not.toThrow();
        });

        test('render should handle goals with null lastUpdated', () => {
            const goal = new Goal({ id: '1', title: 'Test', motivation: 3, urgency: 4, status: 'active' });
            Object.defineProperty(goal, 'lastUpdated', { value: null, writable: true, configurable: true });
            mockGoalService.goals = [goal];
            mockGoalService.calculatePriority.mockImplementation(() => 10);

            const openGoalForm = jest.fn();
            allGoalsView.render(openGoalForm);

            const rows = document.querySelectorAll('#allGoalsTableBody tr');
            expect(rows.length).toBe(1);
            const cells = rows[0].querySelectorAll('td');
            const lastUpdatedText = cells[6].textContent.trim();
            expect(lastUpdatedText === '—' || lastUpdatedText === '').toBe(true);
        });

        test('render should handle goals with null deadline', () => {
            const goal = new Goal({ id: '1', title: 'Test', motivation: 3, urgency: 4, status: 'active', deadline: null });
            mockGoalService.goals = [goal];
            mockGoalService.calculatePriority.mockImplementation(() => 10);

            const openGoalForm = jest.fn();
            allGoalsView.render(openGoalForm);

            const rows = document.querySelectorAll('#allGoalsTableBody tr');
            expect(rows.length).toBe(1);
        });
    });

    describe('getControlElement', () => {
        test('should rebuild cache and ignore stale references', () => {
            const tempElement = document.createElement('div');
            tempElement.id = 'tempElement';
            document.body.appendChild(tempElement);

            allGoalsView.allGoalsControlRefs = null;
            expect(allGoalsView.getControlElement('tempElement')).toBe(tempElement);

            allGoalsView.allGoalsControlRefs.tempElement = { isConnected: false };
            expect(allGoalsView.getControlElement('tempElement')).toBe(tempElement);

            tempElement.remove();
        });

        test('should return null when element does not exist', () => {
            const element = allGoalsView.getControlElement('non-existent-id');
            expect(element).toBeNull();
        });
    });
});
