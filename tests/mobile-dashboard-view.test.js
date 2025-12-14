
import { MobileDashboardView } from '../src/ui/mobile/dashboard-view.js';
import { createBasicDOM, setupGlobalDOM, cleanupGlobalDOM, createMockApp, setupBrowserMocks, cleanupBrowserMocks } from './mocks';
import Goal from '../src/domain/models/goal';

describe('MobileDashboardView', () => {
    let mobileDashboardView;
    let mockApp;
    let dom;
    let openCompletionModal;
    let updateGoalInline;
    let openGoalForm;
    let handleReviewSubmit;
    let renderViews;
    let openPauseModal;

    beforeEach(() => {
        dom = createBasicDOM();
        setupGlobalDOM(dom);
        setupBrowserMocks();

        // Add specific elements used by MobileDashboardView
        const goalsList = document.createElement('div');
        goalsList.id = 'goalsList';
        document.body.appendChild(goalsList);

        const dashboardFeedback = document.createElement('div');
        dashboardFeedback.id = 'dashboardFeedback';
        document.body.appendChild(dashboardFeedback);

        mockApp = createMockApp({
            settingsService: {
                getSettings: jest.fn(() => ({ maxActiveGoals: 3 }))
            },
            goalService: {
                goals: [],
                getActiveGoals: jest.fn(function () {
                    // Return goals based on the goals array
                    return this.goals.filter(g => g.status === 'active');
                }),
                calculatePriority: jest.fn(() => 0)
            }
        });

        mobileDashboardView = new MobileDashboardView(mockApp);

        openCompletionModal = jest.fn();
        updateGoalInline = jest.fn();
        openGoalForm = jest.fn();
        handleReviewSubmit = jest.fn();
        renderViews = jest.fn();
        openPauseModal = jest.fn();

        // Mock createGoalCard and createReviewCard to avoid complex DOM creation and dependencies
        mobileDashboardView.createGoalCard = jest.fn((goal) => {
            const el = document.createElement('div');
            el.className = 'goal-card';
            el.dataset.id = goal.id;
            return el;
        });

        mobileDashboardView.createReviewCard = jest.fn((review) => {
            const el = document.createElement('div');
            el.className = 'review-card';
            el.dataset.type = 'review';
            return el;
        });

        mobileDashboardView.translate = jest.fn((key) => key);
    });

    afterEach(() => {
        cleanupGlobalDOM(dom);
        cleanupBrowserMocks();
    });

    test('render should handle empty state', () => {
        mockApp.goalService.goals = [];
        mockApp.reviews = [];

        mobileDashboardView.render(openCompletionModal, updateGoalInline, openGoalForm, handleReviewSubmit, renderViews, openPauseModal);

        const list = document.getElementById('goalsList');
        expect(list.textContent).toContain('dashboard.noActiveGoals');
        expect(mobileDashboardView.cards.length).toBe(0);
    });

    test('render should display goal cards', () => {
        const goal = new Goal({ id: '1', title: 'Test', status: 'active' });
        mockApp.goalService.goals = [goal];

        mobileDashboardView.render(openCompletionModal, updateGoalInline, openGoalForm, handleReviewSubmit, renderViews, openPauseModal);

        const list = document.getElementById('goalsList');
        expect(mobileDashboardView.cards.length).toBe(1);
        expect(mobileDashboardView.createGoalCard).toHaveBeenCalledWith(goal, openCompletionModal, updateGoalInline);

        // Verify indicators
        const indicators = document.querySelector('.mobile-dashboard-indicators');
        // Only 1 card, indicators shouldn't show? 
        // Logic: if (this.cards.length > 1) checks.
        expect(indicators).toBeNull();
    });

    test('render should display review cards and goal cards', () => {
        const goal = new Goal({ id: '1', title: 'Test', status: 'active' });
        const review = { id: 'r1' };
        mockApp.goalService.goals = [goal];
        mockApp.reviews = [review];

        mobileDashboardView.render(openCompletionModal, updateGoalInline, openGoalForm, handleReviewSubmit, renderViews, openPauseModal);

        expect(mobileDashboardView.cards.length).toBe(2);
        expect(mobileDashboardView.createReviewCard).toHaveBeenCalled();
        expect(mobileDashboardView.createGoalCard).toHaveBeenCalled();

        // Verify indicators
        const indicators = document.querySelectorAll('.mobile-dashboard-indicator');
        expect(indicators.length).toBe(2);
    });

    test('render should preserve current index if valid', () => {
        const goal1 = new Goal({ id: '1', status: 'active' });
        const goal2 = new Goal({ id: '2', status: 'active' });
        mockApp.goalService.goals = [goal1, goal2];

        mobileDashboardView.currentIndex = 1;

        mobileDashboardView.render(openCompletionModal, updateGoalInline, openGoalForm, handleReviewSubmit, renderViews, openPauseModal);

        expect(mobileDashboardView.currentIndex).toBe(1);
        const indicators = document.querySelectorAll('.mobile-dashboard-indicator');
        expect(indicators[1].classList.contains('active')).toBe(true);
    });

    test('render should adjust index if out of bounds', () => {
        const goal1 = new Goal({ id: '1', status: 'active' });
        mockApp.goalService.goals = [goal1];

        mobileDashboardView.currentIndex = 5; // Out of bounds

        mobileDashboardView.render(openCompletionModal, updateGoalInline, openGoalForm, handleReviewSubmit, renderViews, openPauseModal);

        expect(mobileDashboardView.currentIndex).toBe(0); // Should reset to last valid (0)
    });

    test('navigation should switch cards', () => {
        const goal1 = new Goal({ id: '1', status: 'active' });
        const goal2 = new Goal({ id: '2', status: 'active' });
        mockApp.goalService.goals = [goal1, goal2];

        mobileDashboardView.render(openCompletionModal, updateGoalInline, openGoalForm, handleReviewSubmit, renderViews, openPauseModal);

        mobileDashboardView.goToNextCard();
        expect(mobileDashboardView.currentIndex).toBe(1);

        mobileDashboardView.goToPreviousCard();
        expect(mobileDashboardView.currentIndex).toBe(0);
    });

    test('navigation should respect bounds', () => {
        const goal1 = new Goal({ id: '1', status: 'active' });
        mockApp.goalService.goals = [goal1];

        mobileDashboardView.render(openCompletionModal, updateGoalInline, openGoalForm, handleReviewSubmit, renderViews, openPauseModal);

        mobileDashboardView.goToNextCard();
        expect(mobileDashboardView.currentIndex).toBe(0); // Can't go next

        mobileDashboardView.goToPreviousCard();
        expect(mobileDashboardView.currentIndex).toBe(0); // Can't go prev
    });

    test('swipe logic should trigger navigation', () => {
        const goal1 = new Goal({ id: '1', status: 'active' });
        const goal2 = new Goal({ id: '2', status: 'active' });
        mockApp.goalService.goals = [goal1, goal2];

        mobileDashboardView.render(openCompletionModal, updateGoalInline, openGoalForm, handleReviewSubmit, renderViews, openPauseModal);

        // Mock swipe left (next)
        mobileDashboardView.touchStartX = 100;
        mobileDashboardView.touchEndX = 20; // Moved left by 80
        mobileDashboardView.handleSwipe();

        expect(mobileDashboardView.currentIndex).toBe(1);

        // Mock swipe right (prev)
        mobileDashboardView.touchStartX = 20;
        mobileDashboardView.touchEndX = 100; // Moved right by 80
        mobileDashboardView.handleSwipe();

        expect(mobileDashboardView.currentIndex).toBe(0);
    });

    test('destroy should remove indicators', () => {
        const indicatorContainer = document.createElement('div');
        indicatorContainer.className = 'mobile-dashboard-indicators';
        document.body.appendChild(indicatorContainer);

        mobileDashboardView.destroy();

        expect(document.querySelector('.mobile-dashboard-indicators')).toBeNull();
    });

    test('feedback should be displayed', () => {
        mobileDashboardView.latestReviewFeedback = {
            messageKey: 'feedback.success',
            type: 'success'
        };

        const goal = new Goal({ id: '1', status: 'active' });
        mockApp.goalService.goals = [goal];

        mobileDashboardView.render(openCompletionModal, updateGoalInline, openGoalForm, handleReviewSubmit, renderViews, openPauseModal);

        const feedback = document.getElementById('dashboardFeedback');
        expect(feedback.hidden).toBe(false);
        expect(feedback.dataset.state).toBe('success');
    });
});
