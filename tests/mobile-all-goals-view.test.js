const { JSDOM } = require('jsdom');
const { MobileAllGoalsView } = require('../src/ui/mobile/all-goals-view.js');
const Goal = require('../src/domain/models/goal').default;
const {
    STATUS_FILTER_HTML,
    createMockGoalService,
    createMockApp,
    createTestGoals,
    runBaseAllGoalsViewTests
} = require('./shared/all-goals-view-test-utils.js');

/**
 * Mobile-specific HTML for MobileAllGoalsView tests.
 */
const MOBILE_CONTAINER_HTML = `<div id="allGoalsMobileContainer"></div>`;

let dom;
let document;
let window;
let mockGoalService;
let mockApp;
let mobileAllGoalsView;

beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
        ${MOBILE_CONTAINER_HTML}
        ${STATUS_FILTER_HTML}
    </body></html>`, { url: "http://localhost" });
    document = dom.window.document;
    window = dom.window;

    global.document = document;
    global.window = window;

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-11-09T12:00:00.000Z'));

    mockGoalService = createMockGoalService();
    mockApp = createMockApp(mockGoalService);
    mobileAllGoalsView = new MobileAllGoalsView(mockApp);
});

afterEach(() => {
    delete global.document;
    delete global.window;
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('MobileAllGoalsView', () => {
    // Run shared tests from base class
    runBaseAllGoalsViewTests({
        createView: (app) => new MobileAllGoalsView(app),
        getRenderedItems: () => document.querySelectorAll('.mobile-goal-card'),
        getItemId: (card) => {
            // Extract goal ID from card's click handler by checking aria-label
            const ariaLabel = card.getAttribute('aria-label') || '';
            // Find goal by title match from test data
            const title = card.querySelector('.mobile-goal-card__title')?.textContent;
            const testGoals = createTestGoals();
            for (const [, goal] of Object.entries(testGoals)) {
                if (goal.title === title) {
                    return goal.id;
                }
            }
            return null;
        }
    });

    // Mobile-specific tests
    describe('Mobile-specific rendering', () => {
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

        test('render should sort by updated with string dates', () => {
            const goal1 = new Goal({ id: '1', title: 'Old String Goal', status: 'active' });
            goal1.lastUpdated = '2025-11-08T10:00:00.000Z';

            const goal2 = new Goal({ id: '2', title: 'New String Goal', status: 'active' });
            goal2.lastUpdated = '2025-11-10T10:00:00.000Z';

            mockGoalService.goals = [goal1, goal2];
            mobileAllGoalsView.allGoalsState.sort = 'updated-desc';
            const openGoalForm = jest.fn();

            mobileAllGoalsView.render(openGoalForm);

            const container = document.getElementById('allGoalsMobileContainer');
            const cards = container.querySelectorAll('.mobile-goal-card');
            expect(cards[0].textContent).toContain('New String Goal');
            expect(cards[1].textContent).toContain('Old String Goal');
        });
    });

    describe('createGoalCard', () => {
        test('should create card with correct structure', () => {
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

        test('should show "No deadline" when goal has null deadline', () => {
            const goal = new Goal({ id: '1', title: 'Test Goal', motivation: 5, urgency: 4, status: 'active', deadline: null, lastUpdated: new Date('2025-11-10T10:00:00.000Z') });
            const openGoalForm = jest.fn();

            const card = mobileAllGoalsView.createGoalCard(goal, 9.0, openGoalForm);

            expect(card.textContent).toMatch(/No deadline|goalCard.noDeadline/);
        });

        test('should show dash when goal has null lastUpdated', () => {
            const goal = new Goal({ id: '1', title: 'Test Goal', motivation: 5, urgency: 4, status: 'active', deadline: new Date('2025-12-01') });
            Object.defineProperty(goal, 'lastUpdated', { value: null, writable: true, configurable: true });
            const openGoalForm = jest.fn();

            const card = mobileAllGoalsView.createGoalCard(goal, 9.0, openGoalForm);

            expect(card.textContent).toContain('—');
        });

        test('should call openGoalForm on click', () => {
            const goal = new Goal({ id: '1', title: 'Test Goal', motivation: 5, urgency: 4, status: 'active', deadline: null, lastUpdated: new Date('2025-11-10T10:00:00.000Z') });
            const openGoalForm = jest.fn();

            const card = mobileAllGoalsView.createGoalCard(goal, 9.0, openGoalForm);
            card.click();

            expect(openGoalForm).toHaveBeenCalledWith('1');
        });

        test('should call openGoalForm on Enter key', () => {
            const goal = new Goal({ id: '1', title: 'Test Goal', motivation: 5, urgency: 4, status: 'active', deadline: null, lastUpdated: new Date('2025-11-10T10:00:00.000Z') });
            const openGoalForm = jest.fn();

            const card = mobileAllGoalsView.createGoalCard(goal, 9.0, openGoalForm);
            const keydownEvent = new window.KeyboardEvent('keydown', { key: 'Enter' });
            card.dispatchEvent(keydownEvent);

            expect(openGoalForm).toHaveBeenCalledWith('1');
        });

        test('should call openGoalForm on Space key', () => {
            const goal = new Goal({ id: '1', title: 'Test Goal', motivation: 5, urgency: 4, status: 'active', deadline: null, lastUpdated: new Date('2025-11-10T10:00:00.000Z') });
            const openGoalForm = jest.fn();

            const card = mobileAllGoalsView.createGoalCard(goal, 9.0, openGoalForm);
            const keydownEvent = new window.KeyboardEvent('keydown', { key: ' ' });
            card.dispatchEvent(keydownEvent);

            expect(openGoalForm).toHaveBeenCalledWith('1');
        });
    });
});
