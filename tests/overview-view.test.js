const { JSDOM } = require('jsdom');
const { OverviewView } = require('../src/ui/desktop/overview-view.js');
const LanguageService = require('../src/domain/services/language-service').default;

let dom;
let document;
let window;
let mockApp;
let mockGoalService;
let mockAnalyticsService;
let overviewView;

beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div id="overviewContainer"></div>
    </body></html>`);
    document = dom.window.document;
    window = dom.window;

    global.document = document;
    global.window = window;

    mockGoalService = {
        goals: [],
        calculatePriority: jest.fn(() => 0)
    };

    mockAnalyticsService = {
        getGoalsByPeriod: jest.fn(() => ({})),
        getStatusDistribution: jest.fn(() => ({
            active: 0,
            inactive: 0,
            paused: 0,
            completed: 0,
            notCompleted: 0
        })),
        getCompletionStats: jest.fn(() => ({
            completed: 0,
            notCompleted: 0,
            total: 0,
            completionRate: 0
        })),
        getSummaryStats: jest.fn(() => ({
            totalGoals: 0,
            completed: 0,
            notCompleted: 0,
            completionRate: 0,
            avgPerPeriod: 0,
            period: 'month'
        })),
        formatPeriodLabel: jest.fn((key) => key)
    };

    const languageService = new LanguageService();
    languageService.init('en');

    mockApp = {
        goalService: mockGoalService,
        analyticsService: mockAnalyticsService,
        languageService
    };

    overviewView = new OverviewView(mockApp);
});

afterEach(() => {
    delete global.document;
    delete global.window;
    jest.restoreAllMocks();
});

describe('OverviewView', () => {
    test('should render empty state when no goals exist', () => {
        mockGoalService.goals = [];

        overviewView.render();

        const container = document.getElementById('overviewContainer');
        expect(container.innerHTML).toContain('overview-empty-state');
    });

    test('should render stats and charts when goals exist', () => {
        mockGoalService.goals = [
            { id: '1', status: 'active', createdAt: new Date() }
        ];
        mockAnalyticsService.getSummaryStats.mockReturnValue({
            totalGoals: 1,
            completed: 0,
            notCompleted: 0,
            completionRate: 0,
            avgPerPeriod: 1,
            period: 'month'
        });
        mockAnalyticsService.getStatusDistribution.mockReturnValue({
            active: 1,
            inactive: 0,
            paused: 0,
            completed: 0,
            notCompleted: 0
        });

        overviewView.render();

        const container = document.getElementById('overviewContainer');
        expect(container.innerHTML).toContain('period-selector');
        expect(container.innerHTML).toContain('overview-stats');
        expect(container.innerHTML).toContain('overview-charts');
    });

    test('should display correct period buttons', () => {
        mockGoalService.goals = [{ id: '1', status: 'active', createdAt: new Date() }];
        mockAnalyticsService.getSummaryStats.mockReturnValue({
            totalGoals: 1,
            completed: 0,
            completionRate: 0,
            avgPerPeriod: 1,
            period: 'month'
        });

        overviewView.render();

        const container = document.getElementById('overviewContainer');
        const weekBtn = container.querySelector('[data-period="week"]');
        const monthBtn = container.querySelector('[data-period="month"]');
        const yearBtn = container.querySelector('[data-period="year"]');

        expect(weekBtn).not.toBeNull();
        expect(monthBtn).not.toBeNull();
        expect(yearBtn).not.toBeNull();
    });

    test('should have month selected by default', () => {
        mockGoalService.goals = [{ id: '1', status: 'active', createdAt: new Date() }];
        mockAnalyticsService.getSummaryStats.mockReturnValue({
            totalGoals: 1,
            completed: 0,
            completionRate: 0,
            avgPerPeriod: 1,
            period: 'month'
        });

        overviewView.render();

        const container = document.getElementById('overviewContainer');
        const monthBtn = container.querySelector('[data-period="month"]');

        expect(monthBtn.classList.contains('active')).toBe(true);
    });

    test('should render stat cards', () => {
        mockGoalService.goals = [{ id: '1', status: 'completed', createdAt: new Date() }];
        mockAnalyticsService.getSummaryStats.mockReturnValue({
            totalGoals: 5,
            completed: 3,
            notCompleted: 1,
            completionRate: 60,
            avgPerPeriod: 2.5,
            period: 'month'
        });

        overviewView.render();

        const container = document.getElementById('overviewContainer');
        expect(container.innerHTML).toContain('stat-card');
        expect(container.innerHTML).toContain('5'); // total goals
        expect(container.innerHTML).toContain('60%'); // completion rate
    });

    test('should render bar chart section', () => {
        mockGoalService.goals = [{ id: '1', status: 'active', createdAt: new Date() }];
        mockAnalyticsService.getGoalsByPeriod.mockReturnValue({
            '2024-01': { created: [{ id: '1' }], completed: [], notCompleted: [] }
        });
        mockAnalyticsService.getSummaryStats.mockReturnValue({
            totalGoals: 1,
            completed: 0,
            completionRate: 0,
            avgPerPeriod: 1,
            period: 'month'
        });

        overviewView.render();

        const container = document.getElementById('overviewContainer');
        expect(container.innerHTML).toContain('bar-chart');
    });

    test('should render pie chart section', () => {
        mockGoalService.goals = [{ id: '1', status: 'active', createdAt: new Date() }];
        mockAnalyticsService.getStatusDistribution.mockReturnValue({
            active: 1,
            inactive: 0,
            paused: 0,
            completed: 0,
            notCompleted: 0
        });
        mockAnalyticsService.getSummaryStats.mockReturnValue({
            totalGoals: 1,
            completed: 0,
            completionRate: 0,
            avgPerPeriod: 1,
            period: 'month'
        });

        overviewView.render();

        const container = document.getElementById('overviewContainer');
        expect(container.innerHTML).toContain('pie-chart');
    });

    test('should update when period button is clicked', () => {
        mockGoalService.goals = [{ id: '1', status: 'active', createdAt: new Date() }];
        mockAnalyticsService.getSummaryStats.mockReturnValue({
            totalGoals: 1,
            completed: 0,
            completionRate: 0,
            avgPerPeriod: 1,
            period: 'month'
        });

        overviewView.render();

        const container = document.getElementById('overviewContainer');
        const weekBtn = container.querySelector('[data-period="week"]');

        weekBtn.click();

        expect(overviewView.currentPeriod).toBe('week');
    });

    test('renderStatCards should format period label correctly', () => {
        const stats = {
            totalGoals: 10,
            completed: 5,
            completionRate: 50,
            avgPerPeriod: 2.5,
            period: 'month'
        };

        const html = overviewView.renderStatCards(stats);

        expect(html).toContain('10');
        expect(html).toContain('50%');
        expect(html).toContain('2.5');
    });

    test('renderBarChart should handle empty data', () => {
        const html = overviewView.renderBarChart({}, mockAnalyticsService);
        expect(html).toContain('chart-empty');
    });

    test('renderPieChart should handle zero total', () => {
        const distribution = {
            active: 0,
            inactive: 0,
            paused: 0,
            completed: 0,
            notCompleted: 0
        };

        const html = overviewView.renderPieChart(distribution);
        expect(html).toContain('chart-empty');
    });

    test('renderPieChart should show legend items for non-zero statuses', () => {
        const distribution = {
            active: 3,
            inactive: 0,
            paused: 1,
            completed: 2,
            notCompleted: 0
        };

        const html = overviewView.renderPieChart(distribution);

        expect(html).toContain('pie-legend-item');
        expect(html).toContain('3'); // active count
        expect(html).toContain('2'); // completed count
    });
});
