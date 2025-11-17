const { JSDOM } = require('jsdom');
const { CheckInView } = require('../src/ui/desktop/check-in-view.js');
const Goal = require('../src/domain/models/goal').default;
const LanguageService = require('../src/domain/services/language-service').default;

let dom;
let document;
let window;
let mockApp;
let mockGoalService;
let mockReviewService;
let checkInView;

beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div id="checkInsPanel">
            <div id="checkInsFeedback" hidden></div>
            <div id="checkInsList"></div>
            <div id="checkInsEmptyState" hidden></div>
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
        calculatePriority: jest.fn(() => 0),
    };
    mockReviewService = {
        getCheckIns: jest.fn(() => []),
        recordReview: jest.fn()
    };
    mockSettingsService = {
        getSettings: jest.fn(() => ({ maxActiveGoals: 3, language: 'en', reviewIntervals: [30, 14, 7] })),
        getReviewIntervals: jest.fn(() => [30, 14, 7])
    };

    const languageService = new LanguageService();
    languageService.init('en');

    mockApp = {
        goalService: mockGoalService,
        reviewService: mockReviewService,
        settingsService: mockSettingsService,
        languageService,
        checkIns: [],
        refreshCheckIns: jest.fn(),
    };

    checkInView = new CheckInView(mockApp);
});

afterEach(() => {
    // Clear all timers
    jest.clearAllTimers();
    jest.useRealTimers();
    
    delete global.document;
    delete global.window;
    delete global.alert;
    jest.restoreAllMocks();
});

describe('CheckInView', () => {
    test('render should display check-ins and submit reviews', () => {
        const goal1 = new Goal({ id: 'g1', title: 'Goal 1', motivation: 3, urgency: 3, status: 'active', deadline: null });
        mockApp.checkIns = [
            { goal: goal1, dueAt: new Date(Date.now() - 24 * 60 * 60 * 1000), isOverdue: true, messageArgs: { title: 'Goal 1' } }
        ];
        mockReviewService.recordReview.mockReturnValue({ goal: goal1, ratingsMatch: true });
        const openGoalForm = jest.fn();
        const handleCheckInSubmit = jest.fn();
        const renderViews = jest.fn();

        checkInView.render(openGoalForm, handleCheckInSubmit, renderViews);

        const checkInsList = document.getElementById('checkInsList');
        expect(checkInsList.children.length).toBe(1);

        const submitBtn = checkInsList.querySelector('button[type="submit"]');
        submitBtn.click();

        expect(handleCheckInSubmit).toHaveBeenCalled();
    });

    test('render should allow editing goal from card', () => {
        const goal1 = new Goal({ id: 'g1', title: 'Goal 1', motivation: 3, urgency: 3, status: 'active', deadline: null });
        mockApp.checkIns = [
            { goal: goal1, dueAt: new Date(), isOverdue: true, messageArgs: { title: 'Goal 1' } }
        ];
        const openGoalForm = jest.fn();
        const handleCheckInSubmit = jest.fn();
        const renderViews = jest.fn();

        checkInView.render(openGoalForm, handleCheckInSubmit, renderViews);

        const editBtn = document.querySelector('.check-in-card__actions .btn.btn-secondary');
        editBtn.click();

        expect(openGoalForm).toHaveBeenCalledWith('g1');
    });

    test('render should show empty state when check-ins are empty', () => {
        mockApp.checkIns = [];
        const openGoalForm = jest.fn();
        const handleCheckInSubmit = jest.fn();
        const renderViews = jest.fn();

        checkInView.render(openGoalForm, handleCheckInSubmit, renderViews);

        const emptyState = document.getElementById('checkInsEmptyState');
        expect(emptyState.hidden).toBe(false);
    });

    test('render should display latest feedback message', () => {
        checkInView.latestCheckInFeedback = {
            messageKey: 'checkIns.feedback.stable',
            messageArgs: { interval: 'soon', title: 'Goal' },
            type: 'success'
        };
        mockApp.checkIns = [];
        const openGoalForm = jest.fn();
        const handleCheckInSubmit = jest.fn();
        const renderViews = jest.fn();

        checkInView.render(openGoalForm, handleCheckInSubmit, renderViews);

        const feedback = document.getElementById('checkInsFeedback');
        expect(feedback.hidden).toBe(false);
        expect(feedback.textContent).toContain('Next review');
        expect(feedback.dataset.state).toBe('success');
    });

    test('formatReviewIntervalDisplay should render correct units', () => {
        expect(checkInView.formatReviewIntervalDisplay(2)).toContain('day');
        expect(checkInView.formatReviewIntervalDisplay(1 / 24)).toContain('hour');
        expect(checkInView.formatReviewIntervalDisplay(1 / (24 * 60))).toContain('minute');
        expect(checkInView.formatReviewIntervalDisplay(1 / (24 * 60 * 60))).toContain('second');
        expect(checkInView.formatReviewIntervalDisplay(NaN)).toBe(checkInView.translate('checkIns.interval.unknown'));
    });

    test('formatCheckInDueLabel should reflect overdue and today cases', () => {
        const today = new Date();
        const overdue = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        expect(checkInView.formatCheckInDueLabel(today)).toBe(checkInView.translate('checkIns.due.today'));
        expect(checkInView.formatCheckInDueLabel(overdue)).toContain('Overdue');
    });

    test('handleCheckInSubmit should alert when review response is null', () => {
        mockReviewService.recordReview.mockReturnValue(null);
        global.alert = jest.fn();
        const renderViews = jest.fn();
        checkInView.handleCheckInSubmit('missing-goal', { motivation: '3', urgency: '3' }, renderViews);
        expect(global.alert).toHaveBeenCalled();
    });

    test('handleCheckInSubmit should invalidate cache when ratings change', () => {
        const spy = jest.spyOn(checkInView, 'invalidatePriorityCache');
        mockReviewService.recordReview.mockReturnValue({
            goal: { title: 'Goal', reviewIntervalIndex: 0 },
            ratingsMatch: false
        });
        const renderViews = jest.fn();
        checkInView.handleCheckInSubmit('goal-id', { motivation: '5', urgency: '5' }, renderViews);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    test('createCheckInCard toggles stability indicator', () => {
        const goal = new Goal({ id: 'stable', title: 'Stable Goal', motivation: 3, urgency: 3, status: 'active' });
        const openGoalForm = jest.fn();
        const handleCheckInSubmit = jest.fn();
        const renderViews = jest.fn();
        const card = checkInView.createCheckInCard({ goal, dueAt: new Date(), isOverdue: false }, 1, openGoalForm, handleCheckInSubmit, renderViews);
        const motivationInput = card.querySelector('.check-in-card__field-input[name="motivation"]');
        const statusPill = card.querySelector('.check-in-card__status');

        expect(card.classList.contains('is-stable')).toBe(true);
        expect(statusPill.hidden).toBe(false);

        motivationInput.value = '5';
        motivationInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        expect(card.classList.contains('is-stable')).toBe(false);
        expect(statusPill.hidden).toBe(true);
    });

    test('render should return early when panel or list is missing', () => {
        const panel = document.getElementById('checkInsPanel');
        const list = document.getElementById('checkInsList');
        panel.remove();
        const openGoalForm = jest.fn();
        const handleCheckInSubmit = jest.fn();
        const renderViews = jest.fn();

        expect(() => checkInView.render(openGoalForm, handleCheckInSubmit, renderViews)).not.toThrow();
    });

    test('formatCheckInDueLabel should handle null dueAt', () => {
        const result = checkInView.formatCheckInDueLabel(null);
        expect(result).toBe(checkInView.translate('checkIns.due.unknown'));
    });

    test('formatCheckInDueLabel should handle invalid date', () => {
        const result = checkInView.formatCheckInDueLabel('invalid-date');
        expect(result).toBe(checkInView.translate('checkIns.due.unknown'));
    });

    test('handleCheckInSubmit should handle error with message', () => {
        mockReviewService.recordReview = jest.fn(() => {
            throw new Error('Network error');
        });
        
        const renderViews = jest.fn();
        checkInView.handleCheckInSubmit('goal-id', { motivation: '3', urgency: '3' }, renderViews);
        
        expect(global.alert).toHaveBeenCalledWith('Network error');
    });

    test('handleCheckInSubmit should handle error without message', () => {
        mockReviewService.recordReview = jest.fn(() => {
            throw new Error();
        });
        
        const renderViews = jest.fn();
        checkInView.handleCheckInSubmit('goal-id', { motivation: '3', urgency: '3' }, renderViews);
        
        expect(global.alert).toHaveBeenCalled();
    });

    test('handleCheckInSubmit should use getReviewIntervals method when available', () => {
        const goal = new Goal('goal-id', 'Test goal');
        mockGoalService.goals = [goal];
        mockReviewService.recordReview = jest.fn(() => ({
            goal,
            ratingsMatch: true,
            goal: { ...goal, reviewIntervalIndex: 0 }
        }));
        mockSettingsService.getReviewIntervals = jest.fn(() => [30, 14, 7]);
        
        const renderViews = jest.fn();
        checkInView.handleCheckInSubmit('goal-id', { motivation: '3', urgency: '3' }, renderViews);
        
        expect(mockSettingsService.getReviewIntervals).toHaveBeenCalled();
    });

    test('handleCheckInSubmit should handle empty intervals array', () => {
        const goal = new Goal('goal-id', 'Test goal');
        mockGoalService.goals = [goal];
        mockReviewService.recordReview = jest.fn(() => ({
            goal,
            ratingsMatch: true,
            goal: { ...goal, reviewIntervalIndex: 0 }
        }));
        mockSettingsService.getReviewIntervals = jest.fn(() => []);
        mockSettingsService.getSettings = jest.fn(() => ({ reviewIntervals: [] }));
        
        const renderViews = jest.fn();
        checkInView.handleCheckInSubmit('goal-id', { motivation: '3', urgency: '3' }, renderViews);
        
        expect(renderViews).toHaveBeenCalled();
    });

    test('handleCheckInSubmit should handle interval index out of bounds', () => {
        const goal = new Goal('goal-id', 'Test goal');
        mockGoalService.goals = [goal];
        mockReviewService.recordReview = jest.fn(() => ({
            goal,
            ratingsMatch: true,
            goal: { ...goal, reviewIntervalIndex: 10 } // Out of bounds
        }));
        mockSettingsService.getReviewIntervals = jest.fn(() => [30, 14, 7]);
        
        const renderViews = jest.fn();
        checkInView.handleCheckInSubmit('goal-id', { motivation: '3', urgency: '3' }, renderViews);
        
        expect(renderViews).toHaveBeenCalled();
    });
});

