const { JSDOM } = require('jsdom');
const { AllGoalsView } = require('../src/ui/desktop/all-goals-view.js');
const Goal = require('../src/domain/models/goal').default;
const LanguageService = require('../src/domain/services/language-service').default;

let dom;
let document;
let window;
let mockApp;
let mockGoalService;
let allGoalsView;

beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div id="all-goalsView" class="view">
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
            </div>
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
        calculatePriority: jest.fn(() => 0),
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

    const languageService = new LanguageService();
    languageService.init('en');

    mockApp = {
        goalService: mockGoalService,
        languageService,
    };

    allGoalsView = new AllGoalsView(mockApp);
});

afterEach(() => {
    delete global.document;
    delete global.window;
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('AllGoalsView', () => {
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
    });

    describe('Filtering and sorting', () => {
        let activeGoal;
        let pausedGoal;
        let completedGoal;

        beforeEach(() => {
            activeGoal = new Goal({ id: 'a', title: 'Active', motivation: 5, urgency: 4, status: 'active', deadline: null, lastUpdated: new Date('2025-11-10T10:00:00.000Z') });
            pausedGoal = new Goal({ id: 'p', title: 'Paused', motivation: 3, urgency: 2, status: 'paused', deadline: null, lastUpdated: new Date('2025-11-08T10:00:00.000Z') });
            completedGoal = new Goal({ id: 'c', title: 'Completed', motivation: 4, urgency: 1, status: 'completed', deadline: null, lastUpdated: new Date('2025-11-12T10:00:00.000Z') });

            mockGoalService.goals = [activeGoal, pausedGoal, completedGoal];
            mockGoalService.calculatePriority.mockImplementation(goal => goal.motivation + goal.urgency * 10);
            const openGoalForm = jest.fn();
            allGoalsView.setupControls(openGoalForm);
            allGoalsView.render(openGoalForm);
        });

        test('should filter by status selection', () => {
            const dropdown = document.getElementById('allGoalsStatusFilter');
            const pausedCheckbox = dropdown.querySelector('input[value="paused"]');
            const allCheckbox = dropdown.querySelector('input[value="all"]');

            // Select paused status
            pausedCheckbox.checked = true;
            pausedCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));

            const rows = document.querySelectorAll('#allGoalsTableBody tr');
            expect(rows.length).toBe(1);
            expect(rows[0].dataset.goalId).toBe(pausedGoal.id);

            // Select all statuses
            allCheckbox.checked = true;
            allCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));
            expect(document.querySelectorAll('#allGoalsTableBody tr').length).toBe(3);
        });

        test('should filter by multiple status selections', () => {
            const dropdown = document.getElementById('allGoalsStatusFilter');
            const activeCheckbox = dropdown.querySelector('input[value="active"]');
            const pausedCheckbox = dropdown.querySelector('input[value="paused"]');
            const completedCheckbox = dropdown.querySelector('input[value="completed"]');
            const allCheckbox = dropdown.querySelector('input[value="all"]');

            // Uncheck "all" first - this will check all others
            allCheckbox.checked = false;
            allCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));

            // Now uncheck completed to only have active and paused
            completedCheckbox.checked = false;
            completedCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));

            const rows = document.querySelectorAll('#allGoalsTableBody tr');
            expect(rows.length).toBe(2);
            expect(Array.from(rows).map(r => r.dataset.goalId)).toContain(activeGoal.id);
            expect(Array.from(rows).map(r => r.dataset.goalId)).toContain(pausedGoal.id);
            expect(Array.from(rows).map(r => r.dataset.goalId)).not.toContain(completedGoal.id);
        });

        test('should clear filter and reset to all', () => {
            const dropdown = document.getElementById('allGoalsStatusFilter');
            const clearButton = document.getElementById('allGoalsStatusFilterClear');
            const pausedCheckbox = dropdown.querySelector('input[value="paused"]');
            const allCheckbox = dropdown.querySelector('input[value="all"]');

            // First select paused
            pausedCheckbox.checked = true;
            pausedCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));
            expect(document.querySelectorAll('#allGoalsTableBody tr').length).toBe(1);

            // Clear filter
            clearButton.click();
            expect(allCheckbox.checked).toBe(true);
            expect(document.querySelectorAll('#allGoalsTableBody tr').length).toBe(3);
        });

        test('should filter by minimum priority', () => {
            const priorityFilter = document.getElementById('allGoalsPriorityFilter');
            priorityFilter.value = '40';
            priorityFilter.dispatchEvent(new window.Event('input', { bubbles: true }));

            const rows = document.querySelectorAll('#allGoalsTableBody tr');
            expect(rows.length).toBe(1);
            expect(rows[0].dataset.goalId).toBe(activeGoal.id);

            const emptyState = document.getElementById('allGoalsEmptyState');
            priorityFilter.value = '100';
            priorityFilter.dispatchEvent(new window.Event('input', { bubbles: true }));
            expect(document.querySelectorAll('#allGoalsTableBody tr').length).toBe(0);
            expect(emptyState.hidden).toBe(false);
        });

        test('should sort by selected option', () => {
            const sortSelect = document.getElementById('allGoalsSort');
            sortSelect.value = 'priority-asc';
            sortSelect.dispatchEvent(new window.Event('change', { bubbles: true }));

            const ascOrder = Array.from(document.querySelectorAll('#allGoalsTableBody tr')).map(row => row.dataset.goalId);
            expect(ascOrder[0]).toBe(completedGoal.id);

            sortSelect.value = 'updated-desc';
            sortSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
            const updatedOrder = Array.from(document.querySelectorAll('#allGoalsTableBody tr')).map(row => row.dataset.goalId);
            expect(updatedOrder[0]).toBe(completedGoal.id);

            sortSelect.value = 'updated-asc';
            sortSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
            const updatedAscOrder = Array.from(document.querySelectorAll('#allGoalsTableBody tr')).map(row => row.dataset.goalId);
            expect(updatedAscOrder[0]).toBe(pausedGoal.id);
        });

        test('clicking a table row should call openGoalForm', () => {
            const openGoalForm = jest.fn();
            allGoalsView.render(openGoalForm);

            const firstRow = document.querySelector('#allGoalsTableBody tr');
            firstRow.click();
            expect(openGoalForm).toHaveBeenCalledWith(firstRow.dataset.goalId);

            const keydownEvent = new window.KeyboardEvent('keydown', { key: 'Enter' });
            firstRow.dispatchEvent(keydownEvent);
            expect(openGoalForm).toHaveBeenCalledTimes(2);
        });
    });

    test('getControlElement should rebuild cache and ignore stale references', () => {
        const tempElement = document.createElement('div');
        tempElement.id = 'tempElement';
        document.body.appendChild(tempElement);

        allGoalsView.allGoalsControlRefs = null;
        expect(allGoalsView.getControlElement('tempElement')).toBe(tempElement);

        allGoalsView.allGoalsControlRefs.tempElement = { isConnected: false };
        expect(allGoalsView.getControlElement('tempElement')).toBe(tempElement);

        document.body.removeChild(tempElement);
    });

    test('render should return early when table body is absent', () => {
        const tableBody = document.getElementById('allGoalsTableBody');
        tableBody.remove();

        const openGoalForm = jest.fn();
        expect(() => allGoalsView.render(openGoalForm)).not.toThrow();

        const newBody = document.createElement('tbody');
        newBody.id = 'allGoalsTableBody';
        document.getElementById('allGoalsTable').appendChild(newBody);
        allGoalsView.render(openGoalForm);
    });

    test('render should handle default sort when sort value is not recognized', () => {
        const goal1 = new Goal({ id: '1', title: 'Goal 1', motivation: 5, urgency: 4, status: 'active', deadline: null, lastUpdated: new Date('2025-11-10T10:00:00.000Z') });
        const goal2 = new Goal({ id: '2', title: 'Goal 2', motivation: 3, urgency: 2, status: 'active', deadline: null, lastUpdated: new Date('2025-11-08T10:00:00.000Z') });
        mockGoalService.goals = [goal1, goal2];
        mockGoalService.calculatePriority.mockImplementation(goal => goal.motivation + goal.urgency * 10);
        allGoalsView.allGoalsState.sort = 'unknown-sort';
        const openGoalForm = jest.fn();

        allGoalsView.render(openGoalForm);

        const rows = document.querySelectorAll('#allGoalsTableBody tr');
        expect(rows.length).toBe(2);
    });

    test('render should handle missing control elements gracefully', () => {
        const goal = new Goal({ id: '1', title: 'Test', motivation: 3, urgency: 4, status: 'active' });
        mockGoalService.goals = [goal];
        mockGoalService.calculatePriority.mockImplementation(() => 10);

        // Remove control elements
        const statusFilter = document.getElementById('allGoalsStatusFilter');
        const priorityFilter = document.getElementById('allGoalsPriorityFilter');
        const sortSelect = document.getElementById('allGoalsSort');
        statusFilter?.remove();
        priorityFilter?.remove();
        sortSelect?.remove();

        const openGoalForm = jest.fn();
        expect(() => allGoalsView.render(openGoalForm)).not.toThrow();

        const rows = document.querySelectorAll('#allGoalsTableBody tr');
        expect(rows.length).toBe(1);
    });

    test('render should filter out completed goals when includeCompleted is false', () => {
        const activeGoal = new Goal({ id: '1', title: 'Active', motivation: 3, urgency: 4, status: 'active' });
        const completedGoal = new Goal({ id: '2', title: 'Completed', motivation: 3, urgency: 4, status: 'completed' });
        mockGoalService.goals = [activeGoal, completedGoal];
        mockGoalService.calculatePriority.mockImplementation(() => 10);
        allGoalsView.allGoalsState.includeCompleted = false;

        const openGoalForm = jest.fn();
        allGoalsView.render(openGoalForm);

        const rows = document.querySelectorAll('#allGoalsTableBody tr');
        expect(rows.length).toBe(1);
        expect(rows[0].dataset.goalId).toBe('1');
    });

    test('render should filter out abandoned goals when includeAbandoned is false', () => {
        const activeGoal = new Goal({ id: '1', title: 'Active', motivation: 3, urgency: 4, status: 'active' });
        const abandonedGoal = new Goal({ id: '2', title: 'Abandoned', motivation: 3, urgency: 4, status: 'abandoned' });
        mockGoalService.goals = [activeGoal, abandonedGoal];
        mockGoalService.calculatePriority.mockImplementation(() => 10);
        allGoalsView.allGoalsState.includeAbandoned = false;

        const openGoalForm = jest.fn();
        allGoalsView.render(openGoalForm);

        const rows = document.querySelectorAll('#allGoalsTableBody tr');
        expect(rows.length).toBe(1);
        expect(rows[0].dataset.goalId).toBe('1');
    });

    test('render should handle empty state when no goals match filters', () => {
        const goal = new Goal({ id: '1', title: 'Low Priority', motivation: 1, urgency: 1, status: 'active' });
        mockGoalService.goals = [goal];
        mockGoalService.calculatePriority.mockImplementation(() => 5);
        allGoalsView.allGoalsState.minPriority = 100; // Higher than goal priority

        const openGoalForm = jest.fn();
        allGoalsView.render(openGoalForm);

        const emptyState = document.getElementById('allGoalsEmptyState');
        expect(emptyState.hidden).toBe(false);
        const rows = document.querySelectorAll('#allGoalsTableBody tr');
        expect(rows.length).toBe(0);
    });

    test('render should handle missing emptyState element', () => {
        const emptyState = document.getElementById('allGoalsEmptyState');
        emptyState?.remove();

        const openGoalForm = jest.fn();
        expect(() => allGoalsView.render(openGoalForm)).not.toThrow();
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

    test('setupControls should handle missing control elements', () => {
        const statusFilter = document.getElementById('allGoalsStatusFilter');
        statusFilter?.remove();

        const openGoalForm = jest.fn();
        expect(() => allGoalsView.setupControls(openGoalForm)).not.toThrow();
    });

    test('getControlElement should return null when element does not exist', () => {
        const element = allGoalsView.getControlElement('non-existent-id');
        expect(element).toBeNull();
    });

    test('render should handle goals with null lastUpdated', () => {
        const goal = new Goal({ id: '1', title: 'Test', motivation: 3, urgency: 4, status: 'active' });
        // Explicitly set lastUpdated to null after creation
        Object.defineProperty(goal, 'lastUpdated', { value: null, writable: true, configurable: true });
        mockGoalService.goals = [goal];
        mockGoalService.calculatePriority.mockImplementation(() => 10);

        const openGoalForm = jest.fn();
        allGoalsView.render(openGoalForm);

        const rows = document.querySelectorAll('#allGoalsTableBody tr');
        expect(rows.length).toBe(1);
        const cells = rows[0].querySelectorAll('td');
        // Check that last updated cell shows dash or empty when lastUpdated is null
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

