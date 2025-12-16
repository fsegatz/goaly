/**
 * Shared test utilities for AllGoalsView test suites.
 * Contains common setup, mock factories, and DOM helpers.
 */

const { JSDOM } = require('jsdom');
const Goal = require('../../src/domain/models/goal').default;
const LanguageService = require('../../src/domain/services/language-service').default;

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

/**
 * Shared test suite for BaseAllGoalsView functionality.
 * Can be run against any view that extends BaseAllGoalsView.
 * 
 * @param {Object} options - Configuration options
 * @param {Function} options.createView - Factory function to create the view
 * @param {Function} options.getRenderedItems - Function to get rendered items from DOM
 * @param {Function} options.getItemId - Function to get goal ID from a rendered item
 */
function runBaseAllGoalsViewTests({ createView, getRenderedItems, getItemId }) {
    let mockGoalService;
    let mockApp;
    let view;

    beforeEach(() => {
        mockGoalService = createMockGoalService();
        mockApp = createMockApp(mockGoalService);
        view = createView(mockApp);
    });

    describe('Status filter dropdown', () => {
        test('should toggle dropdown on button click', () => {
            const openGoalForm = jest.fn();
            view.setupControls(openGoalForm);

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
            view.setupControls(openGoalForm);

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
            view.render = jest.fn();
            view.setupControls(openGoalForm);

            const dropdown = document.getElementById('allGoalsStatusFilter');
            const clearButton = document.getElementById('allGoalsStatusFilterClear');
            const allCheckbox = dropdown.querySelector('input[value="all"]');
            const activeCheckbox = dropdown.querySelector('input[value="active"]');

            allCheckbox.checked = false;
            activeCheckbox.checked = true;
            view.allGoalsState.statusFilter = ['active'];

            clearButton.click();

            expect(view.allGoalsState.statusFilter).toEqual(['all']);
            expect(allCheckbox.checked).toBe(true);
            expect(activeCheckbox.checked).toBe(false);
        });

        test('should update button text to "All statuses" when all individual statuses are selected', () => {
            const openGoalForm = jest.fn();
            view.setupControls(openGoalForm);

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

            expect(() => view.setupStatusFilterDropdown(openGoalForm)).not.toThrow();
        });
    });

    describe('handleStatusFilterChange', () => {
        test('should set filter to all when "all" is checked', () => {
            const openGoalForm = jest.fn();
            view.setupControls(openGoalForm);

            const dropdown = document.getElementById('allGoalsStatusFilter');
            const allCheckbox = dropdown.querySelector('input[value="all"]');

            allCheckbox.checked = false;
            allCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));

            allCheckbox.checked = true;
            allCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));

            expect(view.allGoalsState.statusFilter).toEqual(['all']);
        });

        test('should select "all" when nothing is selected', () => {
            const openGoalForm = jest.fn();
            view.setupControls(openGoalForm);

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
            expect(view.allGoalsState.statusFilter).toEqual(['all']);
        });
    });

    describe('setupControls', () => {
        test('should update state on priority filter change', () => {
            const openGoalForm = jest.fn();
            view.render = jest.fn();
            view.setupControls(openGoalForm);

            const priorityFilter = document.getElementById('allGoalsPriorityFilter');
            priorityFilter.value = '42';
            priorityFilter.dispatchEvent(new window.Event('input', { bubbles: true }));

            expect(view.allGoalsState.minPriority).toBe(42);
        });

        test('should handle invalid priority filter value', () => {
            const openGoalForm = jest.fn();
            view.render = jest.fn();
            view.setupControls(openGoalForm);

            const priorityFilter = document.getElementById('allGoalsPriorityFilter');
            priorityFilter.value = 'invalid';
            priorityFilter.dispatchEvent(new window.Event('input', { bubbles: true }));

            expect(view.allGoalsState.minPriority).toBe(0);
        });

        test('should update sort on change', () => {
            const openGoalForm = jest.fn();
            view.render = jest.fn();
            view.setupControls(openGoalForm);

            const sortSelect = document.getElementById('allGoalsSort');
            sortSelect.value = 'updated-asc';
            sortSelect.dispatchEvent(new window.Event('change', { bubbles: true }));

            expect(view.allGoalsState.sort).toBe('updated-asc');
        });

        test('should handle missing control elements', () => {
            document.getElementById('allGoalsStatusFilter')?.remove();
            document.getElementById('allGoalsPriorityFilter')?.remove();
            document.getElementById('allGoalsSort')?.remove();

            const openGoalForm = jest.fn();
            expect(() => view.setupControls(openGoalForm)).not.toThrow();
        });
    });

    describe('updateStatusFilterButtonText', () => {
        test('should handle missing button text element', () => {
            const button = document.createElement('button');
            expect(() => view.updateStatusFilterButtonText(button)).not.toThrow();
        });

        test('should show count when multiple statuses selected', () => {
            const openGoalForm = jest.fn();
            view.setupControls(openGoalForm);

            const button = document.getElementById('allGoalsStatusFilterButton');
            const buttonText = button.querySelector('.status-filter-button-text');

            view.allGoalsState.statusFilter = ['active', 'paused'];
            view.updateStatusFilterButtonText(button);

            expect(buttonText.textContent).toContain('2');
            expect(buttonText.textContent.toLowerCase()).toContain('status');
        });

        test('should show single status name when one status selected', () => {
            const openGoalForm = jest.fn();
            view.setupControls(openGoalForm);

            const button = document.getElementById('allGoalsStatusFilterButton');
            const buttonText = button.querySelector('.status-filter-button-text');

            view.allGoalsState.statusFilter = ['active'];
            view.updateStatusFilterButtonText(button);

            // Should show the status name, not "All statuses"
            expect(buttonText.textContent).not.toMatch(/All statuses|filters.statusOptions.all/);
        });
    });

    describe('syncFilterControls', () => {
        test('should sync checkboxes when status filter is not "all"', () => {
            const openGoalForm = jest.fn();
            view.setupControls(openGoalForm);

            const dropdown = document.getElementById('allGoalsStatusFilter');
            const activeCheckbox = dropdown.querySelector('input[value="active"]');
            const pausedCheckbox = dropdown.querySelector('input[value="paused"]');
            const allCheckbox = dropdown.querySelector('input[value="all"]');

            // Set specific status filter
            view.allGoalsState.statusFilter = ['active', 'paused'];
            view.syncFilterControls();

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
            view.allGoalsState.includeCompleted = false;
            const openGoalForm = jest.fn();
            view.render(openGoalForm);

            const items = getRenderedItems();
            const ids = Array.from(items).map(getItemId);
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
            view.allGoalsState.includeNotCompleted = false;

            const openGoalForm = jest.fn();
            view.render(openGoalForm);

            const items = getRenderedItems();
            const ids = Array.from(items).map(getItemId);
            expect(ids).not.toContain('nc');
        });

        test('should filter by minimum priority', () => {
            view.allGoalsState.minPriority = 40;
            const openGoalForm = jest.fn();
            view.render(openGoalForm);

            const items = getRenderedItems();
            expect(items.length).toBe(1);
            expect(getItemId(items[0])).toBe('a'); // activeGoal with highest priority
        });

        test('should filter by specific status when not "all"', () => {
            view.allGoalsState.statusFilter = ['active'];
            const openGoalForm = jest.fn();
            view.render(openGoalForm);

            const items = getRenderedItems();
            const ids = Array.from(items).map(getItemId);
            expect(ids).toContain('a');
            expect(ids).not.toContain('p');
            expect(ids).not.toContain('c');
        });

        test('should handle status filter change when allCheckbox exists but is not checked', () => {
            const openGoalForm = jest.fn();
            view.setupControls(openGoalForm);

            const dropdown = document.getElementById('allGoalsStatusFilter');
            const allCheckbox = dropdown.querySelector('input[value="all"]');
            const activeCheckbox = dropdown.querySelector('input[value="active"]');

            // First uncheck "all" which checks all others
            allCheckbox.checked = false;
            allCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));

            // Now allCheckbox exists but is not checked
            // Check one specific status - this tests line 132-133
            activeCheckbox.checked = true;
            activeCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));

            expect(view.allGoalsState.statusFilter).toContain('active');
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
            view.allGoalsState.sort = 'priority-asc';
            const openGoalForm = jest.fn();
            view.render(openGoalForm);

            const items = getRenderedItems();
            const ids = Array.from(items).map(getItemId);
            expect(ids[0]).toBe('c'); // completedGoal has lowest priority
        });

        test('should sort by updated descending', () => {
            view.allGoalsState.sort = 'updated-desc';
            const openGoalForm = jest.fn();
            view.render(openGoalForm);

            const items = getRenderedItems();
            const ids = Array.from(items).map(getItemId);
            expect(ids[0]).toBe('c'); // completedGoal has newest lastUpdated
        });

        test('should sort by updated ascending', () => {
            view.allGoalsState.sort = 'updated-asc';
            const openGoalForm = jest.fn();
            view.render(openGoalForm);

            const items = getRenderedItems();
            const ids = Array.from(items).map(getItemId);
            expect(ids[0]).toBe('p'); // pausedGoal has oldest lastUpdated
        });

        test('should handle default/unknown sort value', () => {
            view.allGoalsState.sort = 'unknown-sort';
            const openGoalForm = jest.fn();
            view.render(openGoalForm);

            const items = getRenderedItems();
            expect(items.length).toBe(3); // Should still render all goals
        });
    });
}

module.exports = {
    STATUS_FILTER_HTML,
    createMockGoalService,
    createMockApp,
    createTestGoals,
    runBaseAllGoalsViewTests
};
