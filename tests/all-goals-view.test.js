const { JSDOM } = require('jsdom');
const { AllGoalsView } = require('../src/ui/desktop/all-goals-view.js');
const Goal = require('../src/domain/models/goal').default;
const {
    STATUS_FILTER_HTML,
    createMockGoalService,
    createMockApp,
    createTestGoals,
    runBaseAllGoalsViewTests
} = require('./shared/all-goals-view-test-utils.js');

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
    // Run shared tests from base class
    runBaseAllGoalsViewTests({
        createView: (app) => new AllGoalsView(app),
        getRenderedItems: () => document.querySelectorAll('#allGoalsTableBody tr'),
        getItemId: (row) => row.dataset.goalId
    });

    // Desktop-specific tests
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

            // Verify empty state is hidden when there are goals
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
