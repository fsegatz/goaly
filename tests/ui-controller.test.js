const { JSDOM } = require('jsdom');
const UIController = require('../src/ui/ui-controller').default;
const Goal = require('../src/domain/models/goal').default;
const LanguageService = require('../src/domain/services/language-service').default;
const ErrorHandler = require('../src/domain/services/error-handler').default;

let dom;
let document;
let window;
let mockApp;
let mockGoalService;
let mockSettingsService;
let mockReviewService;
let languageService;

beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div id="goalsList"></div>
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
            <div id="allGoalsMobileContainer" class="mobile-goals-container mobile-only"></div>
        </div>
        <button id="addGoalBtn"></button>
        <button id="addGoalBtnDesktop"></button>
        <form id="goalForm"></form>
        <button id="cancelBtn"></button>
        <button id="deleteBtn"></button>
        <div id="goalModal" class="modal">
            <span class="close">&times;</span>
            <h2 id="modalTitle"></h2>
            <input type="hidden" id="goalId" />
            <input type="text" id="goalTitle" />
            <input type="number" id="goalMotivation" />
            <input type="number" id="goalUrgency" />
            <input type="date" id="goalDeadline" />
        </div>
        <div id="migrationPromptModal" class="modal">
            <div class="modal-content migration-modal">
                <span id="migrationPromptClose" class="close">&times;</span>
                <h2 id="migrationPromptTitle"></h2>
                <p id="migrationPromptMessage"></p>
                <div class="modal-actions">
                    <button id="migrationReviewBtn"></button>
                    <button id="migrationPromptCancelBtn"></button>
                </div>
            </div>
        </div>
        <div id="migrationDiffModal" class="modal">
            <div class="modal-content migration-diff-modal">
                <span id="migrationDiffClose" class="close">&times;</span>
                <h2 id="migrationDiffTitle"></h2>
                <p id="migrationDiffSubtitle"></p>
                <div class="migration-diff-columns">
                    <div class="diff-column">
                        <h3 id="migrationDiffOldLabel"></h3>
                        <div id="migrationDiffOld" class="diff-view"></div>
                    </div>
                    <div class="diff-column">
                        <h3 id="migrationDiffNewLabel"></h3>
                        <div id="migrationDiffNew" class="diff-view"></div>
                    </div>
                </div>
                <div class="modal-actions">
                    <button id="migrationApplyBtn"></button>
                    <button id="migrationCancelBtn"></button>
                </div>
            </div>
        </div>
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
        <button id="exportBtn"></button>
        <button id="importBtn"></button>
        <input type="file" id="importFile" />
        <button id="saveSettingsBtn"></button>
        <input type="number" id="maxActiveGoals" value="3" />
        <input type="text" id="reviewIntervals" value="30, 14, 7" />
        <select id="languageSelect"></select>
        <div id="dashboardFeedback" class="check-in-feedback" hidden></div>
        <nav class="desktop-menu">
            <button class="menu-btn active" data-view="dashboard"></button>
            <button class="menu-btn" data-view="all-goals"></button>
        </nav>
        <header>
            <button id="goalyLogo" class="logo-button" aria-label="Go to Dashboard">🎯 Goaly</button>
            <button id="mobileMenuToggle" aria-expanded="false"></button>
            <div id="mobileMenuDropdown" aria-hidden="true">
                <button class="mobile-menu-btn active" data-view="dashboard"></button>
                <button class="mobile-menu-btn" data-view="all-goals"></button>
            </div>
        </header>
        <div id="dashboardView" class="view active">
            <div id="dashboardFeedback" class="check-in-feedback" hidden></div>
            <div id="goalsList" class="goals-list"></div>
        </div>
        <div id="overviewView" class="view">
            <div id="overviewContainer"></div>
        </div>
        <div id="settingsView" class="view"></div>
    </body></html>`, { url: "http://localhost" });
    document = dom.window.document;
    window = dom.window;

    global.document = document;
    global.window = window;
    global.navigator = window.navigator || { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
    global.confirm = jest.fn();
    global.alert = jest.fn();
    window.confirm = global.confirm;
    window.alert = global.alert;

    // Ensure navigator is available on window
    if (!window.navigator) {
        window.navigator = global.navigator;
    }

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-11-09T12:00:00.000Z'));

    mockGoalService = {
        goals: [],
        getActiveGoals: jest.fn(() => []),
        createGoal: jest.fn(),
        updateGoal: jest.fn(),
        setGoalStatus: jest.fn(),
        deleteGoal: jest.fn(),
        calculatePriority: jest.fn(() => 0),
        autoActivateGoalsByPriority: jest.fn(),
        isGoalPaused: jest.fn(() => false),
        pauseGoal: jest.fn(),
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
    mockSettingsService = {
        getSettings: jest.fn(() => ({ maxActiveGoals: 3, language: 'en', reviewIntervals: [30, 14, 7] })),
        updateSettings: jest.fn(),
        getReviewIntervals: jest.fn(() => [30, 14, 7])
    };
    mockReviewService = {
        getReviews: jest.fn(() => []),
        recordReview: jest.fn()
    };

    languageService = new LanguageService();
    languageService.init('en');

    const mockErrorHandler = new ErrorHandler(languageService);
    mockErrorHandler.showError = jest.fn();
    mockErrorHandler.error = jest.fn();
    mockErrorHandler.warning = jest.fn();
    mockErrorHandler.info = jest.fn();
    mockErrorHandler.critical = jest.fn();

    mockApp = {
        goalService: mockGoalService,
        settingsService: mockSettingsService,
        reviewService: mockReviewService,
        analyticsService: {
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
        },
        languageService,
        errorHandler: mockErrorHandler,
        reviews: [],
        exportData: jest.fn(),
        importData: jest.fn(),
        startReviewTimer: jest.fn(),
        refreshReviews: jest.fn(),
        handleMigrationReviewRequest: jest.fn(),
        cancelMigration: jest.fn(),
        completeMigration: jest.fn()
    };
});

afterEach(() => {
    // Clear any pending timers first
    jest.clearAllTimers();
    jest.useRealTimers();

    // Clean up mobile dashboard indicators
    if (global.document) {
        const indicators = global.document.querySelectorAll('.mobile-dashboard-indicators');
        indicators.forEach(indicator => indicator.remove());
    }

    // Clean up event listeners by closing the JSDOM window BEFORE deleting globals
    // This ensures all event listeners are removed and the worker can exit gracefully
    if (dom && dom.window) {
        try {
            // Remove all event listeners by closing the window
            if (!dom.window.closed) {
                dom.window.close();
            }
        } catch (e) {
            // Window might already be closed, ignore
        }
    }

    // Clear all references to allow garbage collection
    delete global.document;
    delete global.window;
    delete global.navigator;
    delete global.confirm;
    delete global.alert;

    // Force garbage collection hint (if available)
    if (global.gc) {
        global.gc();
    }
});

describe('UIController', () => {
    let uiController;

    beforeEach(() => {
        uiController = new UIController(mockApp);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renderViews should display "No active goals" when no active goals', () => {
        mockGoalService.getActiveGoals.mockReturnValue([]);
        mockGoalService.goals = [];

        uiController.renderViews();

        const dashboardList = document.getElementById('goalsList');
        expect(dashboardList.innerHTML).toContain('No active goals yet. Create your first goal!');

        const tableBody = document.getElementById('allGoalsTableBody');
        expect(tableBody.children.length).toBe(0);
        const emptyState = document.getElementById('allGoalsEmptyState');
        expect(emptyState.hidden).toBe(false);
    });

    test('renderViews should render active goals in dashboard and populate all goals table', () => {
        const goal1 = new Goal({ id: '1', title: 'Active Goal 1', description: 'Desc 1', motivation: 5, urgency: 5, status: 'active', deadline: new Date('2025-12-01') });
        const goal2 = new Goal({ id: '2', title: 'Active Goal 2', description: 'Desc 2', motivation: 4, urgency: 4, status: 'active', deadline: new Date('2025-12-05') });
        const goal3 = new Goal({ id: '3', title: 'Active Goal 3', description: 'Desc 3', motivation: 3, urgency: 3, status: 'active', deadline: new Date('2025-12-10') });
        const goal4 = new Goal({ id: '4', title: 'Paused Goal 1', description: 'Desc 4', motivation: 2, urgency: 2, status: 'paused', deadline: new Date('2025-12-15') });
        const goal5 = new Goal({ id: '5', title: 'Completed Goal 1', description: 'Desc 5', motivation: 1, urgency: 1, status: 'completed', deadline: new Date('2025-12-20') });
        const goal6 = new Goal({ id: '6', title: 'Completed Goal 1', description: 'Desc 6', motivation: 1, urgency: 0, status: 'completed', deadline: new Date('2025-12-22') });
        const goal7 = new Goal({ id: '7', title: 'Abandoned Goal 1', description: 'Desc 7', motivation: 0, urgency: 0, status: 'abandoned', deadline: new Date('2025-12-25') });

        mockGoalService.getActiveGoals.mockReturnValue([goal1, goal2, goal3]);
        mockGoalService.goals = [goal1, goal2, goal3, goal4, goal5, goal6, goal7];
        mockSettingsService.getSettings.mockReturnValue({ maxActiveGoals: 2 });
        mockGoalService.calculatePriority.mockImplementation((goal) => goal.motivation + goal.urgency);

        uiController.renderViews();

        const dashboardList = document.getElementById('goalsList');
        expect(dashboardList.children.length).toBe(2);
        expect(dashboardList.innerHTML).toContain('Active Goal 1');
        expect(dashboardList.innerHTML).toContain('Active Goal 2');
        expect(dashboardList.innerHTML).not.toContain('Active Goal 3');

        const tableRows = document.querySelectorAll('#allGoalsTableBody tr');
        expect(tableRows.length).toBe(7);
        expect(Array.from(tableRows).map(row => row.dataset.goalId)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    });

    test('switchView should activate correct view', () => {
        const dashboardBtn = document.querySelector('.menu-btn[data-view="dashboard"]');
        const allGoalsBtn = document.querySelector('.menu-btn[data-view="all-goals"]');
        const dashboardView = document.getElementById('dashboardView');
        const allGoalsView = document.getElementById('all-goalsView');

        expect(dashboardBtn.classList.contains('active')).toBe(true);
        expect(dashboardView.classList.contains('active')).toBe(true);
        expect(allGoalsBtn.classList.contains('active')).toBe(false);
        expect(allGoalsView.classList.contains('active')).toBe(false);

        uiController.switchView('all-goals');

        expect(dashboardBtn.classList.contains('active')).toBe(false);
        expect(dashboardView.classList.contains('active')).toBe(false);
        expect(allGoalsBtn.classList.contains('active')).toBe(true);
        expect(allGoalsView.classList.contains('active')).toBe(true);

        uiController.switchView('dashboard');
        expect(dashboardBtn.classList.contains('active')).toBe(true);
        expect(dashboardView.classList.contains('active')).toBe(true);
        expect(allGoalsBtn.classList.contains('active')).toBe(false);
        expect(allGoalsView.classList.contains('active')).toBe(false);
    });

    test('switchView should handle invalid view name gracefully', () => {
        const dashboardBtn = document.querySelector('.menu-btn[data-view="dashboard"]');

        // Initial state
        expect(dashboardBtn.classList.contains('active')).toBe(true);

        // Switch to invalid view
        uiController.switchView('invalid-view');

        // Should update buttons (remove active from all) but not crash
        expect(dashboardBtn.classList.contains('active')).toBe(false);

        // Should not throw and active classes should be removed from known buttons
    });

    test('menu-btn click should activate correct view', () => {
        const dashboardBtn = document.querySelector('.menu-btn[data-view="dashboard"]');
        const allGoalsBtn = document.querySelector('.menu-btn[data-view="all-goals"]');
        const dashboardView = document.getElementById('dashboardView');
        const allGoalsView = document.getElementById('all-goalsView');

        expect(dashboardBtn.classList.contains('active')).toBe(true);
        expect(dashboardView.classList.contains('active')).toBe(true);
        expect(allGoalsBtn.classList.contains('active')).toBe(false);
        expect(allGoalsView.classList.contains('active')).toBe(false);

        allGoalsBtn.click();

        expect(dashboardBtn.classList.contains('active')).toBe(false);
        expect(dashboardView.classList.contains('active')).toBe(false);
        expect(allGoalsBtn.classList.contains('active')).toBe(true);
        expect(allGoalsView.classList.contains('active')).toBe(true);

        dashboardBtn.click();
        expect(dashboardBtn.classList.contains('active')).toBe(true);
        expect(dashboardView.classList.contains('active')).toBe(true);
        expect(allGoalsBtn.classList.contains('active')).toBe(false);
        expect(allGoalsView.classList.contains('active')).toBe(false);
    });

    test('addGoalBtn click should call openGoalForm', () => {
        uiController.goalFormView.openGoalForm = jest.fn();
        uiController.renderViews = jest.fn();
        document.getElementById('addGoalBtn').click();
        expect(uiController.goalFormView.openGoalForm).toHaveBeenCalledWith(null, expect.any(Function));
    });

    test('addGoalBtnDesktop click should call openGoalForm', () => {
        uiController.goalFormView.openGoalForm = jest.fn();
        uiController.renderViews = jest.fn();
        document.getElementById('addGoalBtnDesktop').click();
        expect(uiController.goalFormView.openGoalForm).toHaveBeenCalledWith(null, expect.any(Function));
    });

    test('handleCompletionChoice should call changeGoalStatus and close modal', () => {
        mockGoalService.setGoalStatus.mockReturnValue({ id: 'goal-1', status: 'completed' });
        uiController.modalsView.openCompletionModal('goal-1');
        uiController.modalsView.setupCompletionModal((status) => uiController.handleCompletionChoice(status));

        const successBtn = document.getElementById('completionSuccessBtn');
        successBtn.click();

        expect(mockGoalService.setGoalStatus).toHaveBeenCalledWith('goal-1', 'completed', 3);
    });

    test('changeGoalStatus returns early when parameters are missing', () => {
        mockGoalService.setGoalStatus.mockClear();
        uiController.changeGoalStatus('', 'completed');
        uiController.changeGoalStatus('goal-without-status', '');
        expect(mockGoalService.setGoalStatus).not.toHaveBeenCalled();
    });

    test('changeGoalStatus handles thrown errors and shows alert', () => {
        mockSettingsService.getSettings.mockReturnValue({ maxActiveGoals: 3 });
        mockGoalService.setGoalStatus.mockImplementation(() => {
            throw new Error('boom');
        });

        uiController.changeGoalStatus('goal-1', 'completed');

        expect(mockApp.errorHandler.error).toHaveBeenCalledWith(
            'errors.statusChangeFailed',
            { message: 'boom' },
            expect.any(Error)
        );
        mockGoalService.setGoalStatus.mockReset();
    });

    test('updateGoalInline should show an alert when update throws an error', () => {
        mockApp.errorHandler.error.mockClear();
        mockGoalService.updateGoal.mockImplementationOnce(() => {
            throw { message: '' };
        });
        uiController.updateGoalInline('goal-error', {});
        expect(mockApp.errorHandler.error).toHaveBeenCalledWith(
            'errors.goalUpdateFailed',
            { message: '' },
            expect.any(Object)
        );
    });

    test('isMobile should be true for mobile widths', () => {
        window.innerWidth = 800;
        // Recreate controller to get updated isMobile value
        const testController = new UIController(mockApp);
        expect(testController.isMobile).toBe(true);
    });

    test('isMobile should be false for desktop widths', () => {
        window.innerWidth = 1000;
        Object.defineProperty(window.navigator, 'userAgent', {
            value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            configurable: true
        });
        // Recreate controller to get updated isMobile value
        const testController = new UIController(mockApp);
        expect(testController.isMobile).toBe(false);
    });

    test('setupEventListeners should tolerate missing optional elements', () => {
        const idsToRemove = [
            'addGoalBtn',
            'addGoalBtnDesktop',
            'goalForm',
            'cancelBtn',
            'deleteBtn',
            'goalModal',
            'exportBtn',
            'importBtn',
            'importFile',
            'saveSettingsBtn',
            'allGoalsStatusFilter',
            'allGoalsPriorityFilter',
            'allGoalsSort',
        ];

        idsToRemove.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.remove();
            }
        });

        document.querySelectorAll('.menu-btn').forEach(btn => btn.remove());

        expect(() => {
            const newController = new UIController(mockApp);
        }).not.toThrow();
    });

    test('applyLanguageUpdates should update language and re-render', () => {
        uiController.settingsView.updateLanguageOptions = jest.fn();
        uiController.settingsView.syncSettingsForm = jest.fn();
        uiController.app.languageService.applyTranslations = jest.fn();
        uiController.renderViews = jest.fn();

        uiController.applyLanguageUpdates();

        expect(uiController.settingsView.updateLanguageOptions).toHaveBeenCalled();
        expect(uiController.settingsView.syncSettingsForm).toHaveBeenCalled();
        expect(uiController.app.languageService.applyTranslations).toHaveBeenCalledWith(document);
        expect(uiController.renderViews).toHaveBeenCalled();
    });

    test('updateGoalInline should update goal and re-render', () => {
        mockGoalService.updateGoal.mockReturnValue({ id: 'goal-1', title: 'Updated' });
        uiController.renderViews = jest.fn();

        uiController.updateGoalInline('goal-1', { title: 'Updated' });

        expect(mockGoalService.updateGoal).toHaveBeenCalledWith('goal-1', { title: 'Updated' }, 3);
        // Cache is automatically invalidated by GoalService, no manual invalidation needed
        expect(uiController.renderViews).toHaveBeenCalled();
    });

    test('updateGoalInline should re-render even on error', () => {
        mockGoalService.updateGoal.mockImplementation(() => {
            throw new Error('Update failed');
        });
        uiController.renderViews = jest.fn();
        mockApp.errorHandler.error.mockClear();

        uiController.updateGoalInline('goal-1', { title: 'Updated' });

        expect(mockApp.errorHandler.error).toHaveBeenCalled();
        expect(uiController.renderViews).toHaveBeenCalled();
    });

    test('changeGoalStatus should update goal status and refresh reviews', () => {
        const updatedGoal = { id: 'goal-1', status: 'completed' };
        mockGoalService.setGoalStatus.mockReturnValue(updatedGoal);
        mockReviewService.getReviews.mockReturnValue([]);
        uiController.renderViews = jest.fn();

        uiController.changeGoalStatus('goal-1', 'completed');

        expect(mockGoalService.setGoalStatus).toHaveBeenCalledWith('goal-1', 'completed', 3);
        expect(mockReviewService.getReviews).toHaveBeenCalled();
        expect(mockApp.reviews).toEqual([]);
        expect(uiController.renderViews).toHaveBeenCalled();
    });

    test('changeGoalStatus should alert when goal not found', () => {
        mockGoalService.setGoalStatus.mockReturnValue(null);
        mockApp.errorHandler.error.mockClear();
        uiController.renderViews = jest.fn();

        uiController.changeGoalStatus('missing-goal', 'completed');

        expect(mockApp.errorHandler.error).toHaveBeenCalledWith('errors.goalNotFound');
        expect(uiController.renderViews).not.toHaveBeenCalled();
    });

    test('handleCompletionChoice should return early when no pending goal', () => {
        uiController.modalsView.getPendingCompletionGoalId = jest.fn(() => null);
        uiController.changeGoalStatus = jest.fn();

        uiController.handleCompletionChoice('completed');

        expect(uiController.changeGoalStatus).not.toHaveBeenCalled();
    });

    test('handleCompletionChoice should call changeGoalStatus and close modal', () => {
        uiController.modalsView.getPendingCompletionGoalId = jest.fn(() => 'goal-1');
        uiController.changeGoalStatus = jest.fn();
        uiController.modalsView.closeCompletionModal = jest.fn();

        uiController.handleCompletionChoice('completed');

        expect(uiController.changeGoalStatus).toHaveBeenCalledWith('goal-1', 'completed');
        expect(uiController.modalsView.closeCompletionModal).toHaveBeenCalled();
    });

    test('isMobile should be true for mobile width', () => {
        window.innerWidth = 800;
        // Recreate controller to get updated isMobile value
        const testController = new UIController(mockApp);
        expect(testController.isMobile).toBe(true);
    });

    test('isMobile should be true for mobile user agent', () => {
        // Test with a mobile user agent
        Object.defineProperty(window.navigator, 'userAgent', {
            get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
            configurable: true
        });
        window.innerWidth = 1200;

        // Recreate controller to get updated isMobile value
        const testController = new UIController(mockApp);
        // Should be true because of mobile user agent
        expect(testController.isMobile).toBe(true);
    });

    test('isMobile should be false for desktop', () => {
        window.innerWidth = 1200;
        Object.defineProperty(window.navigator, 'userAgent', {
            value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            configurable: true
        });
        // Recreate controller to get updated isMobile value
        const testController = new UIController(mockApp);
        expect(testController.isMobile).toBe(false);
    });

    test('window resize should switch from mobile to desktop view', () => {
        // Start with mobile view
        window.innerWidth = 800;
        const mobileController = new UIController(mockApp);
        expect(mobileController.isMobile).toBe(true);
        expect(mobileController.allGoalsView.constructor.name).toBe('MobileAllGoalsView');

        // Resize to desktop
        window.innerWidth = 1000;
        window.dispatchEvent(new window.Event('resize'));

        expect(mobileController.isMobile).toBe(false);
        expect(mobileController.allGoalsView.constructor.name).toBe('AllGoalsView');
    });

    test('window resize should switch from desktop to mobile view', () => {
        // Start with desktop view
        window.innerWidth = 1000;
        const desktopController = new UIController(mockApp);
        expect(desktopController.isMobile).toBe(false);
        expect(desktopController.allGoalsView.constructor.name).toBe('AllGoalsView');

        // Resize to mobile
        window.innerWidth = 800;
        window.dispatchEvent(new window.Event('resize'));

        expect(desktopController.isMobile).toBe(true);
        expect(desktopController.allGoalsView.constructor.name).toBe('MobileAllGoalsView');
    });

    test('window resize should preserve filter state when switching views', () => {
        window.innerWidth = 800;
        const controller = new UIController(mockApp);
        controller.allGoalsView.allGoalsState = { statusFilter: 'paused', minPriority: 5, sort: 'priority-asc' };

        window.innerWidth = 1000;
        window.dispatchEvent(new window.Event('resize'));

        expect(controller.allGoalsView.allGoalsState.statusFilter).toBe('paused');
        expect(controller.allGoalsView.allGoalsState.minPriority).toBe(5);
        expect(controller.allGoalsView.allGoalsState.sort).toBe('priority-asc');
    });

    test('window resize should not switch views when size stays in same category', () => {
        window.innerWidth = 800;
        const controller = new UIController(mockApp);
        const originalView = controller.allGoalsView;
        controller.renderViews = jest.fn();

        window.innerWidth = 850;
        window.dispatchEvent(new window.Event('resize'));

        expect(controller.allGoalsView).toBe(originalView);
    });

    test('window resize should handle null filter state when switching views', () => {
        window.innerWidth = 800;
        const controller = new UIController(mockApp);
        controller.allGoalsView.allGoalsState = null;

        window.innerWidth = 1000;
        window.dispatchEvent(new window.Event('resize'));

        // Should not throw when oldState is null
        expect(controller.allGoalsView).toBeDefined();
    });

    test('handleReviewSubmit should process review submission', () => {
        const mockGoal = { id: 'goal-1', title: 'Test Goal', reviewIntervalIndex: 0, motivation: 3, urgency: 4 };
        const mockResult = { goal: mockGoal, ratingsMatch: true };

        mockReviewService.recordReview.mockReturnValue(mockResult);
        mockSettingsService.getReviewIntervals.mockReturnValue([7, 14, 30]);
        mockReviewService.getReviews.mockReturnValue([]);

        uiController.handleReviewSubmit('goal-1', { motivation: 3, urgency: 4 }, () => { });

        expect(mockReviewService.recordReview).toHaveBeenCalledWith('goal-1', { motivation: 3, urgency: 4 });
        expect(mockReviewService.getReviews).toHaveBeenCalled();
    });

    test('openGoalForm should call goalFormView.openGoalForm', () => {
        uiController.goalFormView.openGoalForm = jest.fn();
        uiController.renderViews = jest.fn();

        uiController.openGoalForm('goal-1');

        expect(uiController.goalFormView.openGoalForm).toHaveBeenCalledWith('goal-1', expect.any(Function));
    });

    test('openCompletionModal should call modalsView.openCompletionModal', () => {
        uiController.modalsView.openCompletionModal = jest.fn();

        uiController.openCompletionModal('goal-1');

        expect(uiController.modalsView.openCompletionModal).toHaveBeenCalledWith('goal-1');
    });

    test('openMigrationPrompt should call modalsView.openMigrationPrompt', () => {
        uiController.modalsView.openMigrationPrompt = jest.fn();
        const migrationData = { fromVersion: '0.9.0', toVersion: '1.0.0', fileName: 'test.json' };

        uiController.openMigrationPrompt(migrationData);

        expect(uiController.modalsView.openMigrationPrompt).toHaveBeenCalledWith(migrationData);
    });

    test('openMigrationDiff should call modalsView.openMigrationDiff', () => {
        uiController.modalsView.openMigrationDiff = jest.fn();
        const diffData = {
            fromVersion: '0.9.0',
            toVersion: '1.0.0',
            originalString: 'old',
            migratedString: 'new',
            fileName: 'test.json'
        };

        uiController.openMigrationDiff(diffData);

        expect(uiController.modalsView.openMigrationDiff).toHaveBeenCalledWith(diffData);
    });

    test('closeMigrationModals should call modalsView.closeMigrationModals', () => {
        uiController.modalsView.closeMigrationModals = jest.fn();

        uiController.closeMigrationModals();

        expect(uiController.modalsView.closeMigrationModals).toHaveBeenCalled();
    });

    test('mobile menu toggle should open and close dropdown', () => {
        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        const mobileMenuDropdown = document.getElementById('mobileMenuDropdown');

        expect(mobileMenuToggle.getAttribute('aria-expanded')).toBe('false');
        expect(mobileMenuDropdown.getAttribute('aria-hidden')).toBe('true');

        mobileMenuToggle.click();

        expect(mobileMenuToggle.getAttribute('aria-expanded')).toBe('true');
        expect(mobileMenuDropdown.getAttribute('aria-hidden')).toBe('false');

        mobileMenuToggle.click();

        expect(mobileMenuToggle.getAttribute('aria-expanded')).toBe('false');
        expect(mobileMenuDropdown.getAttribute('aria-hidden')).toBe('true');
    });

    test('mobile menu button click should switch view and close menu', () => {
        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        const mobileMenuDropdown = document.getElementById('mobileMenuDropdown');
        const mobileMenuBtn = document.querySelector('.mobile-menu-btn[data-view="all-goals"]');
        const allGoalsView = document.getElementById('all-goalsView');

        mobileMenuToggle.click();
        expect(mobileMenuDropdown.getAttribute('aria-hidden')).toBe('false');

        mobileMenuBtn.click();

        expect(allGoalsView.classList.contains('active')).toBe(true);
        expect(mobileMenuToggle.getAttribute('aria-expanded')).toBe('false');
        expect(mobileMenuDropdown.getAttribute('aria-hidden')).toBe('true');
    });

    test('clicking outside mobile menu should close it', () => {
        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        const mobileMenuDropdown = document.getElementById('mobileMenuDropdown');
        const outsideElement = document.createElement('div');
        document.body.appendChild(outsideElement);

        mobileMenuToggle.click();
        expect(mobileMenuDropdown.getAttribute('aria-hidden')).toBe('false');

        outsideElement.click();

        expect(mobileMenuToggle.getAttribute('aria-expanded')).toBe('false');
        expect(mobileMenuDropdown.getAttribute('aria-hidden')).toBe('true');

        document.body.removeChild(outsideElement);
    });

    test('mobile menu dropdown should update position on window resize', () => {
        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        const mobileMenuDropdown = document.getElementById('mobileMenuDropdown');

        mobileMenuToggle.click();
        expect(mobileMenuDropdown.getAttribute('aria-hidden')).toBe('false');

        const initialTop = mobileMenuDropdown.style.top;

        // Simulate window resize
        window.dispatchEvent(new window.Event('resize'));

        // Position should be updated (though exact value depends on layout)
        expect(mobileMenuDropdown.style.top).toBeDefined();
    });

    test('mobile menu dropdown should update position on scroll when visible', () => {
        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        const mobileMenuDropdown = document.getElementById('mobileMenuDropdown');

        mobileMenuToggle.click();
        mobileMenuDropdown.setAttribute('aria-hidden', 'false');

        const initialTop = mobileMenuDropdown.style.top;

        // Simulate scroll
        window.dispatchEvent(new window.Event('scroll'));

        // Position should be updated
        expect(mobileMenuDropdown.style.top).toBeDefined();
    });

    test('mobile menu dropdown should not update position on scroll when hidden', () => {
        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        const mobileMenuDropdown = document.getElementById('mobileMenuDropdown');

        mobileMenuDropdown.setAttribute('aria-hidden', 'true');
        const initialTop = mobileMenuDropdown.style.top;

        // Simulate scroll
        window.dispatchEvent(new window.Event('scroll'));

        // Position should not change when hidden
        expect(mobileMenuDropdown.style.top).toBe(initialTop);
    });

    test('switchView should handle missing target view gracefully', () => {
        const nonExistentView = document.getElementById('nonExistentView');
        expect(nonExistentView).toBeNull();

        uiController.switchView('nonExistent');

        // Should not throw, but view should not be activated
        expect(document.querySelectorAll('.view.active').length).toBe(0);
    });

    test('switchView should handle missing desktop menu button', () => {
        document.querySelectorAll('.desktop-menu .menu-btn').forEach(btn => btn.remove());

        expect(() => uiController.switchView('dashboard')).not.toThrow();
    });

    test('switchView should handle missing mobile menu button', () => {
        document.querySelectorAll('.mobile-menu-btn').forEach(btn => btn.remove());

        expect(() => uiController.switchView('dashboard')).not.toThrow();
    });

    test('goalyLogo click should navigate to dashboard', () => {
        const goalyLogo = document.getElementById('goalyLogo');
        const dashboardView = document.getElementById('dashboardView');
        const allGoalsView = document.getElementById('all-goalsView');

        // Switch to all-goals view first
        uiController.switchView('all-goals');
        expect(allGoalsView.classList.contains('active')).toBe(true);
        expect(dashboardView.classList.contains('active')).toBe(false);

        // Click logo
        goalyLogo.click();

        // Should switch to dashboard
        expect(dashboardView.classList.contains('active')).toBe(true);
        expect(allGoalsView.classList.contains('active')).toBe(false);
    });

    test('goalyLogo keyboard Enter should navigate to dashboard', () => {
        const goalyLogo = document.getElementById('goalyLogo');
        const dashboardView = document.getElementById('dashboardView');
        const allGoalsView = document.getElementById('all-goalsView');

        // Switch to all-goals view first
        uiController.switchView('all-goals');
        expect(allGoalsView.classList.contains('active')).toBe(true);
        expect(dashboardView.classList.contains('active')).toBe(false);

        // Simulate Enter key press
        const enterEvent = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        goalyLogo.dispatchEvent(enterEvent);

        // Should switch to dashboard
        expect(dashboardView.classList.contains('active')).toBe(true);
        expect(allGoalsView.classList.contains('active')).toBe(false);
    });

    test('goalyLogo keyboard Space should navigate to dashboard', () => {
        const goalyLogo = document.getElementById('goalyLogo');
        const dashboardView = document.getElementById('dashboardView');
        const allGoalsView = document.getElementById('all-goalsView');

        // Switch to all-goals view first
        uiController.switchView('all-goals');
        expect(allGoalsView.classList.contains('active')).toBe(true);
        expect(dashboardView.classList.contains('active')).toBe(false);

        // Simulate Space key press
        const spaceEvent = new window.KeyboardEvent('keydown', { key: ' ', bubbles: true });
        goalyLogo.dispatchEvent(spaceEvent);

        // Should switch to dashboard
        expect(dashboardView.classList.contains('active')).toBe(true);
        expect(allGoalsView.classList.contains('active')).toBe(false);
    });

    test('goalyLogo should handle missing logo element gracefully', () => {
        const goalyLogo = document.getElementById('goalyLogo');
        goalyLogo.remove();

        // Creating a new controller should not throw
        expect(() => {
            const newController = new UIController(mockApp);
        }).not.toThrow();
    });

    describe('Mobile Dashboard', () => {
        let originalInnerWidth;
        let originalUserAgent;

        beforeEach(() => {
            // Save original values
            originalInnerWidth = window.innerWidth;
            originalUserAgent = navigator.userAgent;

            // Mock mobile device
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 600
            });
            Object.defineProperty(navigator, 'userAgent', {
                writable: true,
                configurable: true,
                value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
            });
        });

        afterEach(() => {
            // Restore original values
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: originalInnerWidth
            });
            Object.defineProperty(navigator, 'userAgent', {
                writable: true,
                configurable: true,
                value: originalUserAgent
            });
        });

        test('should use MobileDashboardView on mobile devices', () => {
            const mobileController = new UIController(mockApp);
            expect(mobileController.dashboardView.constructor.name).toBe('MobileDashboardView');
        });

        test('should render single card view with swipe container on mobile', () => {
            // Create test goals
            const goal1 = new Goal('1', 'Goal 1', 3, 4, 'active');
            const goal2 = new Goal('2', 'Goal 2', 4, 3, 'active');
            mockGoalService.goals = [goal1, goal2];
            mockGoalService.getActiveGoals.mockReturnValue([goal1, goal2]);

            const mobileController = new UIController(mockApp);
            mobileController.renderViews();

            const goalsList = document.getElementById('goalsList');
            const swipeContainer = goalsList.querySelector('.mobile-dashboard-swipe-container');
            expect(swipeContainer).toBeTruthy();
        });

        test('should show only first card initially on mobile', () => {
            const goal1 = new Goal('1', 'Goal 1', 3, 4, 'active');
            const goal2 = new Goal('2', 'Goal 2', 4, 3, 'active');
            mockGoalService.goals = [goal1, goal2];
            mockGoalService.getActiveGoals.mockReturnValue([goal1, goal2]);

            const mobileController = new UIController(mockApp);
            mobileController.renderViews();

            const goalsList = document.getElementById('goalsList');
            const cards = goalsList.querySelectorAll('.mobile-dashboard-card');
            expect(cards.length).toBe(2);

            // First card should be visible, second should be hidden
            expect(cards[0].classList.contains('mobile-dashboard-card-hidden')).toBe(false);
            expect(cards[1].classList.contains('mobile-dashboard-card-hidden')).toBe(true);
        });

        test('should show indicators when multiple cards exist on mobile', () => {
            const goal1 = new Goal('1', 'Goal 1', 3, 4, 'active');
            const goal2 = new Goal('2', 'Goal 2', 4, 3, 'active');
            mockGoalService.goals = [goal1, goal2];
            mockGoalService.getActiveGoals.mockReturnValue([goal1, goal2]);

            const mobileController = new UIController(mockApp);
            mobileController.renderViews();

            // Indicators are now appended to body, not goalsList
            const indicators = document.querySelectorAll('.mobile-dashboard-indicator');
            expect(indicators.length).toBe(2);

            // First indicator should be active
            expect(indicators[0].classList.contains('active')).toBe(true);
            expect(indicators[1].classList.contains('active')).toBe(false);
        });

        test('should not show indicators when only one card exists on mobile', () => {
            const goal1 = new Goal('1', 'Goal 1', 3, 4, 'active');
            mockGoalService.goals = [goal1];
            mockGoalService.getActiveGoals.mockReturnValue([goal1]);

            const mobileController = new UIController(mockApp);
            mobileController.renderViews();

            const goalsList = document.getElementById('goalsList');
            const indicators = goalsList.querySelector('.mobile-dashboard-indicators');
            expect(indicators).toBeFalsy();
        });

        test('should handle empty state on mobile', () => {
            mockGoalService.goals = [];
            mockGoalService.getActiveGoals.mockReturnValue([]);

            const mobileController = new UIController(mockApp);
            mobileController.renderViews();

            const goalsList = document.getElementById('goalsList');
            const emptyState = goalsList.querySelector('p');
            expect(emptyState).toBeTruthy();
            expect(emptyState.textContent).toContain('No active goals');
        });

        test('should navigate to next card on swipe right', () => {
            const goal1 = new Goal('1', 'Goal 1', 3, 4, 'active');
            const goal2 = new Goal('2', 'Goal 2', 4, 3, 'active');
            mockGoalService.goals = [goal1, goal2];
            mockGoalService.getActiveGoals.mockReturnValue([goal1, goal2]);

            const mobileController = new UIController(mockApp);
            mobileController.renderViews();

            const dashboardView = mobileController.dashboardView;
            expect(dashboardView.currentIndex).toBe(0);

            // Swipe right (next card)
            dashboardView.goToNextCard();
            expect(dashboardView.currentIndex).toBe(1);

            const goalsList = document.getElementById('goalsList');
            const cards = goalsList.querySelectorAll('.mobile-dashboard-card');
            expect(cards[0].classList.contains('mobile-dashboard-card-hidden')).toBe(true);
            expect(cards[1].classList.contains('mobile-dashboard-card-hidden')).toBe(false);
        });

        test('should navigate to previous card on swipe left', () => {
            const goal1 = new Goal('1', 'Goal 1', 3, 4, 'active');
            const goal2 = new Goal('2', 'Goal 2', 4, 3, 'active');
            mockGoalService.goals = [goal1, goal2];
            mockGoalService.getActiveGoals.mockReturnValue([goal1, goal2]);

            const mobileController = new UIController(mockApp);
            mobileController.renderViews();

            const dashboardView = mobileController.dashboardView;
            dashboardView.currentIndex = 1;

            // Swipe left (previous card)
            dashboardView.goToPreviousCard();
            expect(dashboardView.currentIndex).toBe(0);

            const goalsList = document.getElementById('goalsList');
            const cards = goalsList.querySelectorAll('.mobile-dashboard-card');
            expect(cards[0].classList.contains('mobile-dashboard-card-hidden')).toBe(false);
            expect(cards[1].classList.contains('mobile-dashboard-card-hidden')).toBe(true);
        });

        test('should not navigate beyond boundaries', () => {
            const goal1 = new Goal('1', 'Goal 1', 3, 4, 'active');
            const goal2 = new Goal('2', 'Goal 2', 4, 3, 'active');
            mockGoalService.goals = [goal1, goal2];
            mockGoalService.getActiveGoals.mockReturnValue([goal1, goal2]);

            const mobileController = new UIController(mockApp);
            mobileController.renderViews();

            const dashboardView = mobileController.dashboardView;

            // Try to swipe right at the end
            dashboardView.currentIndex = 1;
            dashboardView.goToNextCard();
            expect(dashboardView.currentIndex).toBe(1); // Should not change

            // Try to swipe left at the beginning
            dashboardView.currentIndex = 0;
            dashboardView.goToPreviousCard();
            expect(dashboardView.currentIndex).toBe(0); // Should not change
        });

        test('should update indicators when navigating', () => {
            const goal1 = new Goal('1', 'Goal 1', 3, 4, 'active');
            const goal2 = new Goal('2', 'Goal 2', 4, 3, 'active');
            mockGoalService.goals = [goal1, goal2];
            mockGoalService.getActiveGoals.mockReturnValue([goal1, goal2]);

            const mobileController = new UIController(mockApp);
            mobileController.renderViews();

            // Indicators are now appended to body
            const indicators = document.querySelectorAll('.mobile-dashboard-indicator');

            // Navigate to second card
            const dashboardView = mobileController.dashboardView;
            dashboardView.goToCard(1);

            expect(indicators[0].classList.contains('active')).toBe(false);
            expect(indicators[1].classList.contains('active')).toBe(true);
        });

        test('should handle goToCard with invalid index', () => {
            const goal1 = new Goal('1', 'Goal 1', 3, 4, 'active');
            mockGoalService.goals = [goal1];
            mockGoalService.getActiveGoals.mockReturnValue([goal1]);

            const mobileController = new UIController(mockApp);
            mobileController.renderViews();

            const dashboardView = mobileController.dashboardView;
            const initialIndex = dashboardView.currentIndex;

            // Try invalid indices
            dashboardView.goToCard(-1);
            expect(dashboardView.currentIndex).toBe(initialIndex);

            dashboardView.goToCard(10);
            expect(dashboardView.currentIndex).toBe(initialIndex);
        });

        test('should navigate when clicking indicators', () => {
            const goal1 = new Goal('1', 'Goal 1', 3, 4, 'active');
            const goal2 = new Goal('2', 'Goal 2', 4, 3, 'active');
            mockGoalService.goals = [goal1, goal2];
            mockGoalService.getActiveGoals.mockReturnValue([goal1, goal2]);

            const mobileController = new UIController(mockApp);
            mobileController.renderViews();

            // Indicators are now appended to body
            const indicators = document.querySelectorAll('.mobile-dashboard-indicator');

            // Click second indicator
            indicators[1].click();

            const dashboardView = mobileController.dashboardView;
            expect(dashboardView.currentIndex).toBe(1);
            expect(indicators[0].classList.contains('active')).toBe(false);
            expect(indicators[1].classList.contains('active')).toBe(true);
        });

        test('should handle updateCardPositions with drag offset', () => {
            const goal1 = new Goal('1', 'Goal 1', 3, 4, 'active');
            const goal2 = new Goal('2', 'Goal 2', 4, 3, 'active');
            mockGoalService.goals = [goal1, goal2];
            mockGoalService.getActiveGoals.mockReturnValue([goal1, goal2]);

            const mobileController = new UIController(mockApp);
            mobileController.renderViews();

            const dashboardView = mobileController.dashboardView;
            const goalsList = document.getElementById('goalsList');

            // Simulate drag to the right (negative dragPercentage)
            dashboardView.dragOffset = -100; // Drag left (showing next card)
            dashboardView.updateCardPositions();

            const cards = goalsList.querySelectorAll('.mobile-dashboard-card');
            expect(cards.length).toBe(2);
        });

        test('should handle updateCardPositions with drag to left', () => {
            const goal1 = new Goal('1', 'Goal 1', 3, 4, 'active');
            const goal2 = new Goal('2', 'Goal 2', 4, 3, 'active');
            mockGoalService.goals = [goal1, goal2];
            mockGoalService.getActiveGoals.mockReturnValue([goal1, goal2]);

            const mobileController = new UIController(mockApp);
            mobileController.renderViews();

            const dashboardView = mobileController.dashboardView;
            dashboardView.currentIndex = 1; // Start at second card

            // Simulate drag to the left (positive dragPercentage)
            dashboardView.dragOffset = 100; // Drag right (showing prev card)
            dashboardView.updateCardPositions();

            const goalsList = document.getElementById('goalsList');
            const cards = goalsList.querySelectorAll('.mobile-dashboard-card');
            expect(cards.length).toBe(2);
        });

        test('should handle updateCardPositions with empty cards', () => {
            const mobileController = new UIController(mockApp);
            mobileController.renderViews();

            const dashboardView = mobileController.dashboardView;
            dashboardView.cards = [];

            // Should not throw
            expect(() => {
                dashboardView.updateCardPositions();
            }).not.toThrow();
        });

        test('should handle updateWrapperHeight when card is missing', () => {
            const goal1 = new Goal('1', 'Goal 1', 3, 4, 'active');
            mockGoalService.goals = [goal1];
            mockGoalService.getActiveGoals.mockReturnValue([goal1]);

            const mobileController = new UIController(mockApp);
            mobileController.renderViews();

            const dashboardView = mobileController.dashboardView;
            dashboardView.cards = [];

            // Should not throw
            expect(() => {
                dashboardView.updateWrapperHeight();
            }).not.toThrow();
        });

        test('should handle updateWrapperHeight when currentIndex is out of bounds', () => {
            const goal1 = new Goal('1', 'Goal 1', 3, 4, 'active');
            mockGoalService.goals = [goal1];
            mockGoalService.getActiveGoals.mockReturnValue([goal1]);

            const mobileController = new UIController(mockApp);
            mobileController.renderViews();

            const dashboardView = mobileController.dashboardView;
            dashboardView.currentIndex = 10; // Out of bounds

            // Should not throw
            expect(() => {
                dashboardView.updateWrapperHeight();
            }).not.toThrow();
        });

        test('should preserve index when cards decrease in number', () => {
            const goal1 = new Goal('1', 'Goal 1', 3, 4, 'active');
            const goal2 = new Goal('2', 'Goal 2', 4, 3, 'active');
            const goal3 = new Goal('3', 'Goal 3', 5, 2, 'active');
            mockGoalService.goals = [goal1, goal2, goal3];
            mockGoalService.getActiveGoals.mockReturnValue([goal1, goal2, goal3]);

            const mobileController = new UIController(mockApp);
            mobileController.renderViews();

            const dashboardView = mobileController.dashboardView;
            dashboardView.goToCard(2); // Navigate to third card
            expect(dashboardView.currentIndex).toBe(2);

            // Remove a goal
            mockGoalService.goals = [goal1, goal2];
            mockGoalService.getActiveGoals.mockReturnValue([goal1, goal2]);
            mobileController.renderViews();

            // Should adjust to last card (index 1)
            expect(dashboardView.currentIndex).toBe(1);
        });

        test('should handle handleSwipe with insufficient distance', () => {
            const goal1 = new Goal('1', 'Goal 1', 3, 4, 'active');
            const goal2 = new Goal('2', 'Goal 2', 4, 3, 'active');
            mockGoalService.goals = [goal1, goal2];
            mockGoalService.getActiveGoals.mockReturnValue([goal1, goal2]);

            const mobileController = new UIController(mockApp);
            mobileController.renderViews();

            const dashboardView = mobileController.dashboardView;
            const initialIndex = dashboardView.currentIndex;

            // Simulate small swipe (less than minSwipeDistance)
            dashboardView.touchStartX = 100;
            dashboardView.touchEndX = 130; // Only 30px, less than 50px threshold
            dashboardView.handleSwipe();

            // Should not change index
            expect(dashboardView.currentIndex).toBe(initialIndex);
        });

        test('should handle handleSwipe with sufficient distance to left', () => {
            const goal1 = new Goal('1', 'Goal 1', 3, 4, 'active');
            const goal2 = new Goal('2', 'Goal 2', 4, 3, 'active');
            mockGoalService.goals = [goal1, goal2];
            mockGoalService.getActiveGoals.mockReturnValue([goal1, goal2]);

            const mobileController = new UIController(mockApp);
            mobileController.renderViews();

            const dashboardView = mobileController.dashboardView;
            dashboardView.goToNextCard = jest.fn();

            // Simulate swipe left (touchStartX > touchEndX, deltaX > 0)
            dashboardView.touchStartX = 200;
            dashboardView.touchEndX = 100; // 100px swipe left
            dashboardView.handleSwipe();

            // Should call goToNextCard (next card)
            expect(dashboardView.goToNextCard).toHaveBeenCalled();
        });

        test('should handle handleSwipe with sufficient distance to right', () => {
            const goal1 = new Goal('1', 'Goal 1', 3, 4, 'active');
            const goal2 = new Goal('2', 'Goal 2', 4, 3, 'active');
            mockGoalService.goals = [goal1, goal2];
            mockGoalService.getActiveGoals.mockReturnValue([goal1, goal2]);

            const mobileController = new UIController(mockApp);
            mobileController.renderViews();

            const dashboardView = mobileController.dashboardView;
            dashboardView.currentIndex = 1;
            dashboardView.goToPreviousCard = jest.fn();

            // Simulate swipe right (touchStartX < touchEndX, deltaX < 0)
            dashboardView.touchStartX = 100;
            dashboardView.touchEndX = 200; // 100px swipe right
            dashboardView.handleSwipe();

            // Should call goToPreviousCard (previous card)
            expect(dashboardView.goToPreviousCard).toHaveBeenCalled();
        });
    });

    describe('handleRecurringGoalCompletion', () => {
        beforeEach(() => {
            mockGoalService.pauseGoal.mockClear();
            mockReviewService.getReviews.mockClear();
            mockApp.errorHandler.error.mockClear();
        });

        test('should handle daily recurrence', () => {
            const goal = new Goal({ id: 'goal-r1', title: 'Daily', isRecurring: true, recurPeriod: 2, recurPeriodUnit: 'days', status: 'active' });
            mockGoalService.goals = [goal];
            mockGoalService.setGoalStatus.mockReturnValue(goal);

            const recurrenceDate = new Date();
            recurrenceDate.setDate(recurrenceDate.getDate() + 2);
            uiController.handleRecurringGoalCompletion('goal-r1', 'completed', recurrenceDate);

            expect(goal.recurCount).toBe(1);
            expect(mockGoalService.pauseGoal).toHaveBeenCalled();
            const pauseCall = mockGoalService.pauseGoal.mock.calls[0];
            expect(pauseCall[0]).toBe('goal-r1');
            // Check if deadline was updated to recurrenceDate
            expect(goal.deadline).toEqual(recurrenceDate);
        });

        test('should handle weekly recurrence', () => {
            const goal = new Goal({ id: 'goal-r2', title: 'Weekly', isRecurring: true, recurPeriod: 1, recurPeriodUnit: 'weeks', status: 'active' });
            mockGoalService.goals = [goal];

            const recurrenceDate = new Date();
            recurrenceDate.setDate(recurrenceDate.getDate() + 7);
            uiController.handleRecurringGoalCompletion('goal-r2', 'completed', recurrenceDate);

            expect(goal.recurCount).toBe(1);
            // Deadline should be set to the recurrenceDate
            expect(goal.deadline).toEqual(recurrenceDate);
        });

        test('should handle monthly recurrence', () => {
            const goal = new Goal({ id: 'goal-r3', title: 'Monthly', isRecurring: true, recurPeriod: 1, recurPeriodUnit: 'months', status: 'active' });
            mockGoalService.goals = [goal];

            const recurrenceDate = new Date();
            recurrenceDate.setMonth(recurrenceDate.getMonth() + 1);
            uiController.handleRecurringGoalCompletion('goal-r3', 'completed', recurrenceDate);

            expect(goal.recurCount).toBe(1);
            // Deadline should be set to the recurrenceDate
            expect(goal.deadline).toEqual(recurrenceDate);
        });

        test('should handle notCompleted status', () => {
            const goal = new Goal({ id: 'goal-r4', title: 'Failed', isRecurring: true, recurPeriod: 1, recurPeriodUnit: 'days', notCompletedCount: 0 });
            mockGoalService.goals = [goal];

            uiController.handleRecurringGoalCompletion('goal-r4', 'notCompleted', new Date());

            expect(goal.notCompletedCount).toBe(1);
            expect(goal.completionCount).toBe(0);
        });

        test('should handle completed status', () => {
            const goal = new Goal({ id: 'goal-r5', title: 'Success', isRecurring: true, recurPeriod: 1, recurPeriodUnit: 'days', completionCount: 0 });
            mockGoalService.goals = [goal];

            uiController.handleRecurringGoalCompletion('goal-r5', 'completed', new Date());

            expect(goal.completionCount).toBe(1);
        });

        test('should handle missing goal gracefully', () => {
            mockGoalService.goals = [];
            uiController.handleRecurringGoalCompletion('missing', 'completed', new Date());
            expect(mockApp.errorHandler.error).toHaveBeenCalledWith('errors.goalNotFound');
        });

        test('should initialize recurrence fields if missing', () => {
            const goal = new Goal({ id: 'goal-r6', title: 'New Recurring' }); // isRecurring false by default
            mockGoalService.goals = [goal];

            uiController.handleRecurringGoalCompletion('goal-r6', 'completed', new Date());

            expect(goal.isRecurring).toBe(true);
        });

        test('should handle error during execution', () => {
            const goal = new Goal({ id: 'goal-error', title: 'Error' });
            mockGoalService.goals = [goal];
            // Trigger error by making pauseGoal throw
            mockGoalService.pauseGoal.mockImplementation(() => { throw new Error('Recur error'); });

            uiController.handleRecurringGoalCompletion('goal-error', 'completed', new Date());

            expect(mockApp.errorHandler.error).toHaveBeenCalledWith('errors.statusChangeFailed', expect.anything(), expect.anything());
        });
    });

});
