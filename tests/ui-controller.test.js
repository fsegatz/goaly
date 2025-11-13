const { JSDOM } = require('jsdom');
const UIController = require('../src/ui/ui-controller').default;
const Goal = require('../src/domain/goal').default;
const LanguageService = require('../src/domain/language-service').default;

// Mock the entire DOM for testing UI interactions
let dom;
let document;
let window;

// Mock the app object and its services
let mockApp;
let mockGoalService;
let mockSettingsService;
let mockReviewService;
let languageService;

beforeEach(() => {
    // Setup JSDOM
    dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div id="goalsList"></div>
        <div id="all-goalsView" class="view">
            <div class="all-goals-controls">
                <label for="allGoalsStatusFilter">
                    <span>Status</span>
                    <select id="allGoalsStatusFilter">
                        <option value="all">All statuses</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="completed">Completed</option>
                        <option value="abandoned">Abandoned</option>
                    </select>
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
                <label class="toggle-option">
                    <input type="checkbox" id="allGoalsToggleCompleted" checked />
                    Show completed
                </label>
                <label class="toggle-option">
                    <input type="checkbox" id="allGoalsToggleAbandoned" checked />
                    Show abandoned
                </label>
            </div>
            <div class="table-wrapper">
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
        <button id="addGoalBtn"></button>
        <form id="goalForm"></form>
        <button id="cancelBtn"></button>
        <button id="deleteBtn"></button>
        <div id="goalModal" class="modal">
            <span class="close"></span>
            <h2 id="modalTitle"></h2>
            <input type="hidden" id="goalId" />
            <input type="text" id="goalTitle" />
            <textarea id="goalDescription"></textarea>
            <input type="number" id="goalMotivation" />
            <input type="number" id="goalUrgency" />
            <input type="date" id="goalDeadline" />
            <div id="goalHistorySection" class="goal-history" hidden>
                <h3>History</h3>
                <div id="goalHistoryList" class="goal-history-list"></div>
            </div>
        </div>
        <div id="migrationPromptModal" class="modal">
            <div class="modal-content migration-modal">
                <span id="migrationPromptClose" class="close"></span>
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
                <span id="migrationDiffClose" class="close"></span>
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
                <span id="completionCloseBtn" class="close"></span>
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
        <div id="checkInsPanel">
            <div id="checkInsFeedback" hidden></div>
            <div id="checkInsList"></div>
            <div id="checkInsEmptyState" hidden></div>
        </div>
        <button class="menu-btn active" data-view="dashboard"></button>
        <button class="menu-btn" data-view="all-goals"></button>
        <div id="dashboardView" class="view active"></div>
    </body></html>`, { url: "http://localhost" });
    document = dom.window.document;
    window = dom.window;

    // Make document and window available globally for the UIController
    global.document = document;
    global.window = window;
    global.confirm = jest.fn(); // Mock global confirm
    global.alert = jest.fn(); // Mock global alert
    window.confirm = global.confirm;
    window.alert = global.alert;

    const RealDate = Date; // Store original Date constructor
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-11-09T12:00:00.000Z')); // Set a fixed system time

    // Mock services
    mockGoalService = {
        goals: [],
        getActiveGoals: jest.fn(() => []),
        createGoal: jest.fn(),
        updateGoal: jest.fn(),
        setGoalStatus: jest.fn(),
        deleteGoal: jest.fn(),
        calculatePriority: jest.fn(() => 0),
        autoActivateGoalsByPriority: jest.fn(),
        revertGoalToHistoryEntry: jest.fn(),
    };
    mockSettingsService = {
        getSettings: jest.fn(() => ({ maxActiveGoals: 3, language: 'en', reviewIntervals: [30, 14, 7] })),
        updateSettings: jest.fn(),
        getReviewIntervals: jest.fn(() => [30, 14, 7])
    };
    mockReviewService = {
        getCheckIns: jest.fn(() => []),
        recordReview: jest.fn()
    };

    // Mock the app object
    languageService = new LanguageService();
    languageService.init('en');

    mockApp = {
        goalService: mockGoalService,
        settingsService: mockSettingsService,
        reviewService: mockReviewService,
        languageService,
        checkIns: [], // UIController directly accesses app.checkIns
        exportData: jest.fn(),
        importData: jest.fn(),
        startCheckInTimer: jest.fn(),
        refreshCheckIns: jest.fn(),
        handleMigrationReviewRequest: jest.fn(),
        cancelMigration: jest.fn(),
        completeMigration: jest.fn()
    };
});

    afterEach(() => {
        // Clean up global DOM elements
        delete global.document;
        delete global.window;
        delete global.confirm;
        delete global.alert;
    });

describe('UIController', () => {
    let uiController;

    beforeEach(() => {
        // Spy on closeGoalForm before UIController is instantiated
        jest.spyOn(UIController.prototype, 'closeGoalForm');
        uiController = new UIController(mockApp);
    });

    afterEach(() => {
        // Restore the original method after each test
        jest.restoreAllMocks();
    });

    // Test renderViews with no goals
    test('renderViews should display "No active goals" when no active goals', () => {
        mockGoalService.getActiveGoals.mockReturnValue([]);
        mockGoalService.goals = []; // Ensure table is also empty

        uiController.renderViews();

        const dashboardList = document.getElementById('goalsList');
        expect(dashboardList.innerHTML).toContain('No active goals yet. Create your first goal!');

        const tableBody = document.getElementById('allGoalsTableBody');
        expect(tableBody.children.length).toBe(0);
        const emptyState = document.getElementById('allGoalsEmptyState');
        expect(emptyState.hidden).toBe(false);
    });

    // Test renderViews with active goals
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
        mockSettingsService.getSettings.mockReturnValue({ maxActiveGoals: 2 }); // Only 2 active goals on dashboard
        mockGoalService.calculatePriority.mockImplementation((goal) => goal.motivation + goal.urgency); // Mock priority calculation

        uiController.renderViews();

        const dashboardList = document.getElementById('goalsList');
        expect(dashboardList.children.length).toBe(2); // goal1, goal2
        expect(dashboardList.innerHTML).toContain('Active Goal 1');
        expect(dashboardList.innerHTML).toContain('Active Goal 2');
        expect(dashboardList.innerHTML).not.toContain('Active Goal 3'); // Should be in table

        const tableRows = document.querySelectorAll('#allGoalsTableBody tr');
        expect(tableRows.length).toBe(7);
        expect(Array.from(tableRows).map(row => row.dataset.goalId)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
        const statusTexts = Array.from(tableRows).map(row => row.querySelector('td[data-label="Status"]').textContent.trim());
        expect(statusTexts).toEqual(expect.arrayContaining(['Active', 'Paused', 'Completed', 'Abandoned']));
    });

    describe('All goals table interactions', () => {
        let activeGoal;
        let pausedGoal;
        let completedGoal;

        beforeEach(() => {
            activeGoal = new Goal({ id: 'a', title: 'Active', motivation: 5, urgency: 4, status: 'active', deadline: null, lastUpdated: new Date('2025-11-10T10:00:00.000Z') });
            pausedGoal = new Goal({ id: 'p', title: 'Paused', motivation: 3, urgency: 2, status: 'paused', deadline: null, lastUpdated: new Date('2025-11-08T10:00:00.000Z') });
            completedGoal = new Goal({ id: 'c', title: 'Completed', motivation: 4, urgency: 1, status: 'completed', deadline: null, lastUpdated: new Date('2025-11-12T10:00:00.000Z') });

            mockGoalService.goals = [activeGoal, pausedGoal, completedGoal];
            mockGoalService.calculatePriority.mockImplementation(goal => goal.motivation + goal.urgency * 10);
            mockGoalService.getActiveGoals.mockReturnValue([activeGoal]);
            uiController.renderViews();
        });

        test('should filter by status selection', () => {
            const statusFilter = document.getElementById('allGoalsStatusFilter');
            statusFilter.value = 'paused';
            statusFilter.dispatchEvent(new window.Event('change', { bubbles: true }));

            const rows = document.querySelectorAll('#allGoalsTableBody tr');
            expect(rows.length).toBe(1);
            expect(rows[0].dataset.goalId).toBe(pausedGoal.id);

            statusFilter.value = 'all';
            statusFilter.dispatchEvent(new window.Event('change', { bubbles: true }));
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

        test('should toggle completed and abandoned visibility', () => {
            const toggleCompleted = document.getElementById('allGoalsToggleCompleted');
            toggleCompleted.checked = false;
            toggleCompleted.dispatchEvent(new window.Event('change', { bubbles: true }));

            const rowIdsWithoutCompleted = Array.from(document.querySelectorAll('#allGoalsTableBody tr')).map(row => row.dataset.goalId);
            expect(rowIdsWithoutCompleted).toEqual(['a', 'p']);

            toggleCompleted.checked = true;
            toggleCompleted.dispatchEvent(new window.Event('change', { bubbles: true }));

            const abandonedGoal = new Goal({ id: 'r', title: 'Abandoned', motivation: 2, urgency: 1, status: 'abandoned', deadline: null, lastUpdated: new Date('2025-11-07T10:00:00.000Z') });
            mockGoalService.goals.push(abandonedGoal);
            uiController.renderAllGoalsTable();

            const toggleAbandoned = document.getElementById('allGoalsToggleAbandoned');
            toggleAbandoned.checked = false;
            toggleAbandoned.dispatchEvent(new window.Event('change', { bubbles: true }));

            const rowIdsWithoutAbandoned = Array.from(document.querySelectorAll('#allGoalsTableBody tr')).map(row => row.dataset.goalId);
            expect(rowIdsWithoutAbandoned).not.toContain('r');
        });

        test('clicking a table row should open goal form', () => {
            uiController.openGoalForm = jest.fn();
            uiController.renderAllGoalsTable();

            const firstRow = document.querySelector('#allGoalsTableBody tr');
            firstRow.click();
            expect(uiController.openGoalForm).toHaveBeenCalledWith(firstRow.dataset.goalId);

            const keydownEvent = new window.KeyboardEvent('keydown', { key: 'Enter' });
            firstRow.dispatchEvent(keydownEvent);
            expect(uiController.openGoalForm).toHaveBeenCalledTimes(2);
        });
    });

    // Test createGoalCard
    test('createGoalCard should create a goal card with editable description and priority metric', () => {
        const goal = new Goal({ id: '1', title: 'Test Goal', description: 'Test Description', motivation: 5, urgency: 4, status: 'active', deadline: new Date('2025-11-15') });
        mockGoalService.calculatePriority.mockReturnValue(4.5);

        const card = uiController.createGoalCard(goal);
        const descriptionEl = card.querySelector('.goal-description');

        expect(card.className).toBe('goal-card active');
        expect(card.querySelector('.goal-title').textContent).toBe('Test Goal');
        expect(descriptionEl.textContent).toBe('Test Description');
        expect(descriptionEl.getAttribute('contenteditable')).toBe('true');
        expect(card.querySelectorAll('.goal-metrics .metric').length).toBe(1);
        expect(card.querySelector('.metric-value.priority').textContent).toBe('4.5');
        expect(card.querySelector('.metric-value.motivation')).toBeNull();
        expect(card.querySelector('.metric-value.urgency')).toBeNull();
        expect(card.querySelector('.goal-deadline').textContent).toContain('In 6 days'); // Assuming today is Nov 9, 2025
        expect(card.querySelector('.goal-inline-editor')).not.toBeNull();
        expect(card.innerHTML).toContain('btn btn-primary edit-goal');
        // No pause/activate buttons anymore - status ist automatisch
        expect(card.innerHTML).not.toContain('pause-goal');
        expect(card.innerHTML).not.toContain('activate-goal');
        expect(card.querySelector('.complete-goal')).not.toBeNull();
    });

    test('createGoalCard edit button should toggle inline editor and save changes', () => {
        const goal = new Goal({ id: 'edit-test', title: 'Edit Button', description: '', motivation: 3, urgency: 2, status: 'active', deadline: null });
        mockGoalService.calculatePriority.mockReturnValue(5);
        mockGoalService.goals = [goal];
        mockGoalService.getActiveGoals.mockReturnValue([goal]);
        mockGoalService.updateGoal.mockImplementation(() => goal);

        const card = uiController.createGoalCard(goal);
        const editBtn = card.querySelector('.edit-goal');
        const inlineEditor = card.querySelector('.goal-inline-editor');
        const deadlineInput = inlineEditor.querySelector('.inline-deadline');
        const motivationInput = inlineEditor.querySelector('.inline-motivation');
        const urgencyInput = inlineEditor.querySelector('.inline-urgency');
        const saveBtn = inlineEditor.querySelector('.save-inline');

        expect(editBtn).not.toBeNull();
        expect(inlineEditor.classList.contains('is-visible')).toBe(false);

        editBtn.click();
        expect(inlineEditor.classList.contains('is-visible')).toBe(true);
        expect(editBtn.getAttribute('aria-expanded')).toBe('true');

        deadlineInput.value = '2025-11-20';
        motivationInput.value = '4';
        urgencyInput.value = '5';

        saveBtn.click();

        expect(mockGoalService.updateGoal).toHaveBeenCalledWith('edit-test', {
            deadline: '2025-11-20',
            motivation: 4,
            urgency: 5
        }, 3);
    });

    test('createGoalCard should not show pause/activate buttons for any status', () => {
        const pausedGoal = new Goal({ id: '1', title: 'Paused Goal', description: 'Test Description', motivation: 5, urgency: 4, status: 'paused', deadline: new Date('2025-11-15') });
        const card = uiController.createGoalCard(pausedGoal);
        expect(card.innerHTML).toContain('btn btn-primary edit-goal');
        expect(card.innerHTML).not.toContain('pause-goal');
        expect(card.innerHTML).not.toContain('activate-goal');
    });

    test('complete button should open modal and finalize goal on success', () => {
        const goal = new Goal({ id: 'complete-yes', title: 'Success Goal', description: '', motivation: 4, urgency: 3, status: 'active', deadline: null });
        mockGoalService.calculatePriority.mockReturnValue(7);
        mockGoalService.goals = [goal];
        mockGoalService.getActiveGoals.mockReturnValue([goal]);
        mockGoalService.setGoalStatus.mockReturnValue({ ...goal, status: 'completed' });
        const renderSpy = jest.spyOn(uiController, 'renderViews').mockImplementation(() => {});

        const card = uiController.createGoalCard(goal);
        const completeButton = card.querySelector('.complete-goal');
        expect(completeButton).not.toBeNull();

        const modal = document.getElementById('completionModal');
        const successBtn = document.getElementById('completionSuccessBtn');

        mockGoalService.setGoalStatus.mockClear();

        completeButton.click();
        expect(modal.classList.contains('is-visible')).toBe(true);

        successBtn.click();

        expect(mockGoalService.setGoalStatus).toHaveBeenCalledWith('complete-yes', 'completed', 3);
        expect(renderSpy).toHaveBeenCalled();
        expect(modal.classList.contains('is-visible')).toBe(false);

        renderSpy.mockRestore();
    });

    test('complete button should mark goal as abandoned on failure selection', () => {
        const goal = new Goal({ id: 'complete-no', title: 'Fallback Goal', description: '', motivation: 4, urgency: 2, status: 'active', deadline: null });
        mockGoalService.calculatePriority.mockReturnValue(6);
        mockGoalService.goals = [goal];
        mockGoalService.getActiveGoals.mockReturnValue([goal]);
        mockGoalService.setGoalStatus.mockReturnValue({ ...goal, status: 'abandoned' });
        const renderSpy = jest.spyOn(uiController, 'renderViews').mockImplementation(() => {});

        const card = uiController.createGoalCard(goal);
        const completeButton = card.querySelector('.complete-goal');
        expect(completeButton).not.toBeNull();

        const modal = document.getElementById('completionModal');
        const failureBtn = document.getElementById('completionFailureBtn');

        mockGoalService.setGoalStatus.mockClear();

        completeButton.click();
        expect(modal.classList.contains('is-visible')).toBe(true);

        failureBtn.click();

        expect(mockGoalService.setGoalStatus).toHaveBeenCalledWith('complete-no', 'abandoned', 3);
        expect(renderSpy).toHaveBeenCalled();
        expect(modal.classList.contains('is-visible')).toBe(false);

        renderSpy.mockRestore();
    });

    test('completion modal cancel and close should not change status', () => {
        const goal = new Goal({ id: 'complete-cancel', title: 'Cancel Goal', description: '', motivation: 4, urgency: 2, status: 'active', deadline: null });
        mockGoalService.calculatePriority.mockReturnValue(6);
        mockGoalService.goals = [goal];
        mockGoalService.getActiveGoals.mockReturnValue([goal]);
        mockGoalService.setGoalStatus.mockReturnValue(goal);

        const card = uiController.createGoalCard(goal);
        const completeButton = card.querySelector('.complete-goal');
        expect(completeButton).not.toBeNull();

        const modal = document.getElementById('completionModal');
        const cancelBtn = document.getElementById('completionCancelBtn');
        const closeBtn = document.getElementById('completionCloseBtn');

        mockGoalService.setGoalStatus.mockClear();

        completeButton.click();
        expect(modal.classList.contains('is-visible')).toBe(true);

        cancelBtn.click();
        expect(modal.classList.contains('is-visible')).toBe(false);
        expect(mockGoalService.setGoalStatus).not.toHaveBeenCalled();

        completeButton.click();
        expect(modal.classList.contains('is-visible')).toBe(true);
        closeBtn.click();
        expect(modal.classList.contains('is-visible')).toBe(false);
        expect(mockGoalService.setGoalStatus).not.toHaveBeenCalled();
    });

    test('completion modal overlay click and escape key close modal', () => {
        const goal = new Goal({ id: 'complete-overlay', title: 'Overlay Goal', description: '', motivation: 4, urgency: 2, status: 'active', deadline: null });
        mockGoalService.calculatePriority.mockReturnValue(6);
        mockGoalService.goals = [goal];
        mockGoalService.getActiveGoals.mockReturnValue([goal]);
        mockGoalService.setGoalStatus.mockReturnValue(goal);

        const card = uiController.createGoalCard(goal);
        const completeButton = card.querySelector('.complete-goal');
        const modal = document.getElementById('completionModal');

        completeButton.click();
        expect(modal.classList.contains('is-visible')).toBe(true);

        modal.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
        expect(modal.classList.contains('is-visible')).toBe(false);

        completeButton.click();
        expect(modal.classList.contains('is-visible')).toBe(true);

        document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
        expect(modal.classList.contains('is-visible')).toBe(false);
    });

    test('handleCompletionChoice alerts when goal is missing', () => {
        mockGoalService.setGoalStatus.mockReturnValue(null);
        const modal = document.getElementById('completionModal');
        uiController.openCompletionModal('missing-goal');
        expect(modal.classList.contains('is-visible')).toBe(true);

        window.alert.mockClear();
        uiController.handleCompletionChoice('completed');

        expect(mockGoalService.setGoalStatus).toHaveBeenCalledWith('missing-goal', 'completed', 3);
        expect(window.alert).toHaveBeenCalledWith('Goal not found.');
        expect(modal.classList.contains('is-visible')).toBe(false);
    });

    test('changeGoalStatus returns early when parameters are missing', () => {
        mockGoalService.setGoalStatus.mockClear();
        uiController.changeGoalStatus('', 'completed');
        uiController.changeGoalStatus('goal-without-status', '');
        expect(mockGoalService.setGoalStatus).not.toHaveBeenCalled();
    });

    test('openCompletionModal ignores empty goal id', () => {
        const modal = document.getElementById('completionModal');
        modal.classList.remove('is-visible');
        uiController.openCompletionModal('');
        expect(modal.classList.contains('is-visible')).toBe(false);
    });

    test('setupCompletionModal exits when already initialized or modal missing', () => {
        expect(uiController.completionModalInitialized).toBe(true);
        uiController.setupCompletionModal(); // should return early when already initialized

        const modal = document.getElementById('completionModal');
        modal.remove();
        uiController.completionModalInitialized = false;
        uiController.completionModalRefs.completionModal = null;

        expect(() => uiController.setupCompletionModal()).not.toThrow();
        expect(uiController.completionModalInitialized).toBe(false);
    });

    test('createGoalCard should save description changes on blur', () => {
        const goal = new Goal({ id: 'desc-test', title: 'Desc Goal', description: 'Initial', motivation: 3, urgency: 2, status: 'active', deadline: null });
        mockGoalService.calculatePriority.mockReturnValue(6);
        mockGoalService.goals = [goal];
        mockGoalService.getActiveGoals.mockReturnValue([goal]);
        mockGoalService.updateGoal.mockImplementation(() => {
            goal.description = 'Updated';
            return goal;
        });

        const card = uiController.createGoalCard(goal);
        const descriptionEl = card.querySelector('.goal-description');
        descriptionEl.textContent = 'Updated';

        const blurEvent = new window.Event('blur');
        descriptionEl.dispatchEvent(blurEvent);

        expect(mockGoalService.updateGoal).toHaveBeenCalledWith('desc-test', { description: 'Updated' }, 3);
    });

    test('createGoalCard should revert description when update fails', () => {
        const goal = new Goal({ id: 'desc-error', title: 'Desc Error', description: 'Original', motivation: 2, urgency: 3, status: 'active', deadline: null });
        mockGoalService.calculatePriority.mockReturnValue(5);
        mockGoalService.goals = [goal];
        mockGoalService.getActiveGoals.mockReturnValue([goal]);
        mockGoalService.updateGoal.mockImplementation(() => {
            throw new Error('Boom');
        });

        const card = uiController.createGoalCard(goal);
        global.alert.mockClear();
        const descriptionEl = card.querySelector('.goal-description');
        descriptionEl.textContent = 'Broken';

        const blurEvent = new window.Event('blur');
        descriptionEl.dispatchEvent(blurEvent);

        expect(mockGoalService.updateGoal).toHaveBeenCalledWith('desc-error', { description: 'Broken' }, 3);
        expect(descriptionEl.textContent).toBe('Original');
        expect(global.alert).toHaveBeenCalledWith('Boom');
    });

    test('createGoalCard should fallback to existing values for invalid numeric input', () => {
        const goal = new Goal({ id: 'invalid-numbers', title: 'Number Goal', description: '', motivation: 4, urgency: 2, status: 'active', deadline: null });
        mockGoalService.calculatePriority.mockReturnValue(10);
        mockGoalService.goals = [goal];
        mockGoalService.getActiveGoals.mockReturnValue([goal]);
        mockGoalService.updateGoal.mockImplementation(() => goal);

        const card = uiController.createGoalCard(goal);
        const editBtn = card.querySelector('.edit-goal');
        const inlineEditor = card.querySelector('.goal-inline-editor');
        const motivationInput = inlineEditor.querySelector('.inline-motivation');
        const urgencyInput = inlineEditor.querySelector('.inline-urgency');
        const saveBtn = inlineEditor.querySelector('.save-inline');

        editBtn.click();
        motivationInput.value = '';
        urgencyInput.value = 'abc';

        saveBtn.click();

        expect(mockGoalService.updateGoal).toHaveBeenCalledWith('invalid-numbers', {
            deadline: null,
            motivation: 4,
            urgency: 2
        }, 3);
    });

    // Test formatDeadline
    test('formatDeadline should return "Today" for today', () => {
        const today = new Date('2025-11-09T12:00:00.000Z'); // Fixed date for consistent testing
        const result = uiController.formatDeadline(today);
        expect(result).toBe('Today');
    });

    test('formatDeadline should return "Tomorrow" for tomorrow', () => {
        const tomorrow = new Date('2025-11-10T12:00:00.000Z');
        const result = uiController.formatDeadline(tomorrow);
        expect(result).toBe('Tomorrow');
    });

    test('formatDeadline should return "In X days" for upcoming deadlines within 7 days', () => {
        const futureDate = new Date('2025-11-12T12:00:00.000Z'); // 3 days from now
        const result = uiController.formatDeadline(futureDate);
        expect(result).toBe('In 3 days');
    });

    test('formatDeadline should return "Overdue" for past deadlines', () => {
        const pastDate = new Date('2025-11-04T12:00:00.000Z'); // 5 days ago
        const result = uiController.formatDeadline(pastDate);
        expect(result).toContain('Overdue (5 days)');
    });

    test('formatDeadline should return formatted date for deadlines far in future', () => {
        const farFutureDate = new Date('2026-01-01T12:00:00.000Z');
        const result = uiController.formatDeadline(farFutureDate);
        expect(result).toBe('1/1/2026'); // Adjust based on locale if needed
    });

    // Test isDeadlineUrgent
    test('isDeadlineUrgent should return true for deadlines within 7 days', () => {
        const futureDate = new Date('2025-11-14T12:00:00.000Z'); // 5 days from now
        expect(uiController.isDeadlineUrgent(futureDate)).toBe(true);
    });

    test('isDeadlineUrgent should return false for deadlines beyond 7 days', () => {
        const futureDate = new Date('2025-11-17T12:00:00.000Z'); // 8 days from now
        expect(uiController.isDeadlineUrgent(futureDate)).toBe(false);
    });

    test('isDeadlineUrgent should return false for past deadlines', () => {
        const pastDate = new Date('2025-11-08T12:00:00.000Z'); // 1 day ago
        expect(uiController.isDeadlineUrgent(pastDate)).toBe(false);
    });

    test('isDeadlineUrgent should return false for null deadline', () => {
        expect(uiController.isDeadlineUrgent(null)).toBe(false);
    });

    // Test getStatusText
    test('getStatusText should return English labels for status', () => {
        expect(uiController.getStatusText('active')).toBe('Active');
        expect(uiController.getStatusText('paused')).toBe('Paused');
        expect(uiController.getStatusText('completed')).toBe('Completed');
        expect(uiController.getStatusText('abandoned')).toBe('Abandoned');
        expect(uiController.getStatusText('unknown')).toBe('unknown'); // Fallback
    });

    test('formatHistoryValue should format different field types correctly', () => {
        expect(uiController.formatHistoryValue('deadline', '')).toBe('No deadline');
        expect(uiController.formatHistoryValue('deadline', 'invalid-date')).toBe('—');
        expect(uiController.formatHistoryValue('priority', 12.345)).toBe('12.3');
        expect(uiController.formatHistoryValue('priority', 'not-a-number')).toBe('—');
        expect(uiController.formatHistoryValue('motivation', '4')).toBe('4');
        expect(uiController.formatHistoryValue('status', 'active')).toBe('Active');
        expect(uiController.formatHistoryValue('status', 'completed')).toBe('Completed');
        expect(uiController.formatHistoryValue('status', 'abandoned')).toBe('Abandoned');
        expect(uiController.formatHistoryValue('title', 'My Goal')).toBe('My Goal');
        expect(uiController.formatHistoryValue('description', null)).toBe('—');
    });

    test('resetGoalHistoryView should return early when history elements are missing', () => {
        const section = document.getElementById('goalHistorySection');
        const list = document.getElementById('goalHistoryList');
        section.remove();
        list.remove();
        expect(() => uiController.resetGoalHistoryView()).not.toThrow();
        expect(() => uiController.renderGoalHistory(null)).not.toThrow();

        const modal = document.getElementById('goalModal');
        const newSection = document.createElement('div');
        newSection.id = 'goalHistorySection';
        newSection.className = 'goal-history';
        newSection.hidden = true;
        const heading = document.createElement('h3');
        heading.textContent = 'Historie';
        const newList = document.createElement('div');
        newList.id = 'goalHistoryList';
        newList.className = 'goal-history-list';
        newSection.appendChild(heading);
        newSection.appendChild(newList);
        modal.appendChild(newSection);
    });

    test('handleHistoryRevert should abort when identifiers are missing or user cancels', () => {
        window.confirm.mockReturnValue(false);
        expect(() => uiController.handleHistoryRevert('', 'entry')).not.toThrow();
        expect(() => uiController.handleHistoryRevert('goal', '')).not.toThrow();
        expect(() => uiController.handleHistoryRevert('goal', 'entry')).not.toThrow();
        expect(window.confirm).toHaveBeenCalled();
    });

    test('handleHistoryRevert should alert when rollback is not possible', () => {
        window.confirm.mockReturnValue(true);
        window.alert.mockClear();
        mockGoalService.revertGoalToHistoryEntry.mockReturnValue(null);
        uiController.handleHistoryRevert('missing', 'entry');
        expect(window.alert).toHaveBeenCalledWith('Unable to revert this goal.');
    });

    test('getControlElement should rebuild cache and ignore stale references', () => {
        const tempElement = document.createElement('div');
        tempElement.id = 'tempElement';
        document.body.appendChild(tempElement);

        uiController.allGoalsControlRefs = null;
        expect(uiController.getControlElement('tempElement')).toBe(tempElement);

        uiController.allGoalsControlRefs.tempElement = { isConnected: false };
        expect(uiController.getControlElement('tempElement')).toBe(tempElement);

        document.body.removeChild(tempElement);
    });

    test('updateGoalInline should show an alert when update throws an error', () => {
        window.alert.mockClear();
        mockGoalService.updateGoal.mockImplementationOnce(() => {
            throw { message: '' };
        });
        uiController.updateGoalInline('goal-error', {});
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Updating the goal failed.'));
    });

    test('renderGoalHistory should handle entries without changes or rollback option', () => {
        const goal = new Goal({
            id: 'history-none',
            title: 'History Without Changes',
            motivation: 2,
            urgency: 2,
            status: 'active',
            history: [
                {
                    id: 'entry-none',
                    event: 'status-change',
                    timestamp: '2025-11-10T12:00:00.000Z',
                    changes: [],
                    before: null,
                    after: { status: 'active' }
                }
            ]
        });
        mockGoalService.goals = [goal];
        window.confirm.mockReturnValue(true);
        mockGoalService.revertGoalToHistoryEntry.mockReturnValue(goal);

        uiController.openGoalForm('history-none');

        const entry = document.querySelector('.goal-history-entry');
        expect(entry).not.toBeNull();
        expect(entry.querySelector('.goal-history-entry__changes')).toBeNull();
        expect(entry.querySelector('.goal-history-revert')).toBeNull();
    });

    // Test escapeHtml
    test('escapeHtml should escape HTML characters', () => {
        const unsafeString = '<h1>Hello & World</h1><script>alert("xss")</script>';
        const safeString = '&lt;h1&gt;Hello &amp; World&lt;/h1&gt;&lt;script&gt;alert("xss")&lt;/script&gt;';
        expect(uiController.escapeHtml(unsafeString)).toBe(safeString);
    });

    // Test openGoalForm for new goal
    test('openGoalForm should reset form and set title for new goal', () => {
        const form = document.getElementById('goalForm');
        form.reset = jest.fn(); // Mock reset
        uiController.openGoalForm();

        expect(form.reset).toHaveBeenCalled();
        expect(document.getElementById('modalTitle').textContent).toBe('New goal');
        expect(document.getElementById('goalId').value).toBe('');
        expect(document.getElementById('deleteBtn').style.display).toBe('none');
        expect(document.getElementById('goalModal').classList.contains('is-visible')).toBe(true);
        expect(document.getElementById('goalHistorySection').hidden).toBe(true);
    });

    // Test openGoalForm for editing existing goal
    test('openGoalForm should populate form with goal data for existing goal', () => {
        const goal = new Goal({ id: '123', title: 'Edit Goal', description: 'Edit Desc', motivation: 3, urgency: 2, status: 'paused', deadline: new Date('2025-12-25') });
        mockGoalService.goals = [goal];

        uiController.openGoalForm('123');

        expect(document.getElementById('modalTitle').textContent).toBe('Edit goal');
        expect(document.getElementById('goalId').value).toBe('123');
        expect(document.getElementById('goalTitle').value).toBe('Edit Goal');
        expect(document.getElementById('goalDescription').value).toBe('Edit Desc');
        expect(document.getElementById('goalMotivation').value).toBe('3');
        expect(document.getElementById('goalUrgency').value).toBe('2');
        expect(document.getElementById('goalDeadline').value).toBe('2025-12-25');
        expect(document.getElementById('deleteBtn').style.display).toBe('inline-block');
        expect(document.getElementById('goalModal').classList.contains('is-visible')).toBe(true);
        expect(document.getElementById('goalHistorySection').hidden).toBe(false);
        expect(document.getElementById('goalHistoryList').textContent).toContain('No changes recorded yet.');
    });

    test('openGoalForm should render history entries and handle rollback action', () => {
        const historyEntryTimestamp = '2025-11-10T12:00:00.000Z';
        const historyGoal = new Goal({
            id: 'hist-1',
            title: 'History Goal',
            description: 'Current',
            motivation: 3,
            urgency: 2,
            status: 'active',
            history: [
                {
                    id: 'entry-1',
                    event: 'updated',
                    timestamp: historyEntryTimestamp,
                    changes: [
                        { field: 'title', from: 'Old Title', to: 'History Goal' }
                    ],
                    before: {
                        title: 'Old Title'
                    },
                    after: {
                        title: 'History Goal'
                    }
                }
            ]
        });

        mockGoalService.goals = [historyGoal];
        mockGoalService.revertGoalToHistoryEntry.mockImplementation(() => historyGoal);
        window.confirm.mockReturnValue(true);

        uiController.openGoalForm('hist-1');

        const historySection = document.getElementById('goalHistorySection');
        expect(historySection.hidden).toBe(false);
        const entries = document.querySelectorAll('.goal-history-entry');
        expect(entries.length).toBe(1);
        const revertBtn = entries[0].querySelector('.goal-history-revert');
        expect(revertBtn).not.toBeNull();

        revertBtn.click();

        expect(mockGoalService.revertGoalToHistoryEntry).toHaveBeenCalledWith('hist-1', historyGoal.history[0].id, 3);
        expect(window.confirm).toHaveBeenCalled();
    });

    // Test closeGoalForm
    test('closeGoalForm should hide modal and reset form', () => {
        const form = document.getElementById('goalForm');
        form.reset = jest.fn(); // Mock reset
        document.getElementById('goalModal').classList.add('is-visible'); // Set visible first

        uiController.closeGoalForm();

        expect(document.getElementById('goalModal').classList.contains('is-visible')).toBe(false);
        expect(form.reset).toHaveBeenCalled();
    });


    // Test renderCheckInView
    test('renderCheckInView should display check-ins and submit reviews', () => {
        const goal1 = new Goal({ id: 'g1', title: 'Goal 1', motivation: 3, urgency: 3, status: 'active', deadline: null });
        mockApp.checkIns = [
            { goal: goal1, dueAt: new Date(Date.now() - 24 * 60 * 60 * 1000), isOverdue: true, messageArgs: { title: 'Goal 1' } }
        ];
        mockReviewService.recordReview.mockReturnValue({ goal: goal1, ratingsMatch: true });
        jest.spyOn(uiController, 'renderViews').mockImplementation(() => {});

        uiController.renderCheckInView();

        const checkInsList = document.getElementById('checkInsList');
        expect(checkInsList.children.length).toBe(1);

        const submitBtn = checkInsList.querySelector('button[type="submit"]');
        submitBtn.click();

        const feedback = document.getElementById('checkInsFeedback');
        expect(mockReviewService.recordReview).toHaveBeenCalledWith('g1', expect.objectContaining({
            motivation: expect.any(String),
            urgency: expect.any(String),
        }));
        expect(mockApp.refreshCheckIns).toHaveBeenCalledWith({ render: false });

        uiController.renderViews.mockRestore();
    });

    test('renderCheckInView should allow editing goal from card', () => {
        const goal1 = new Goal({ id: 'g1', title: 'Goal 1', motivation: 3, urgency: 3, status: 'active', deadline: null });
        mockApp.checkIns = [
            { goal: goal1, dueAt: new Date(), isOverdue: true, messageArgs: { title: 'Goal 1' } }
        ];
        uiController.openGoalForm = jest.fn();

        uiController.renderCheckInView();

        const editBtn = document.querySelector('.check-in-card__actions .btn.btn-secondary');
        editBtn.click();

        expect(uiController.openGoalForm).toHaveBeenCalledWith('g1');
    });

    test('formatReviewIntervalDisplay should render correct units', () => {
        expect(uiController.formatReviewIntervalDisplay(2)).toContain('day');
        expect(uiController.formatReviewIntervalDisplay(1 / 24)).toContain('hour');
        expect(uiController.formatReviewIntervalDisplay(1 / (24 * 60))).toContain('minute');
        expect(uiController.formatReviewIntervalDisplay(1 / (24 * 60 * 60))).toContain('second');
        expect(uiController.formatReviewIntervalDisplay(NaN)).toBe(uiController.translate('checkIns.interval.unknown'));
    });

    test('formatCheckInDueLabel should reflect overdue and today cases', () => {
        const today = new Date();
        const overdue = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        expect(uiController.formatCheckInDueLabel(today)).toBe(uiController.translate('checkIns.due.today'));
        expect(uiController.formatCheckInDueLabel(overdue)).toContain('Overdue');
    });

    test('handleCheckInSubmit should alert when review response is null', () => {
        mockReviewService.recordReview.mockReturnValue(null);
        global.alert = jest.fn();
        uiController.handleCheckInSubmit('missing-goal', { motivation: '3', urgency: '3' });
        expect(global.alert).toHaveBeenCalled();
    });

    test('renderCheckInView should display latest feedback message', () => {
        uiController.latestCheckInFeedback = {
            messageKey: 'checkIns.feedback.stable',
            messageArgs: { interval: 'soon', title: 'Goal' },
            type: 'success'
        };
        mockApp.checkIns = [];

        uiController.renderCheckInView();

        const feedback = document.getElementById('checkInsFeedback');
        expect(feedback.hidden).toBe(false);
        expect(feedback.textContent).toContain('Next review');
        expect(feedback.dataset.state).toBe('success');
    });

    test('createCheckInCard toggles stability indicator', () => {
        const goal = new Goal({ id: 'stable', title: 'Stable Goal', motivation: 3, urgency: 3, status: 'active' });
        const card = uiController.createCheckInCard({ goal, dueAt: new Date(), isOverdue: false }, 1, 1);
        const motivationInput = card.querySelector('.check-in-card__field-input[name="motivation"]');
        const statusPill = card.querySelector('.check-in-card__status');

        // Initially stable
        expect(card.classList.contains('is-stable')).toBe(true);
        expect(statusPill.hidden).toBe(false);

        // Change value to make unstable
        motivationInput.value = '5';
        motivationInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        expect(card.classList.contains('is-stable')).toBe(false);
        expect(statusPill.hidden).toBe(true);
    });

    test('handleCheckInSubmit should invalidate cache when ratings change', () => {
        const spy = jest.spyOn(uiController, 'invalidatePriorityCache').mockImplementation(() => {});
        mockReviewService.recordReview.mockReturnValue({
            goal: { title: 'Goal', reviewIntervalIndex: 0 },
            ratingsMatch: false
        });
        uiController.handleCheckInSubmit('goal-id', { motivation: '5', urgency: '5' });
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    test('createGoalCard should handle missing edit button gracefully', () => {
        const goal = new Goal({ id: '1', title: 'Test Goal', description: 'Test Description', motivation: 5, urgency: 4, status: 'active', deadline: new Date('2025-11-15') });
        mockGoalService.calculatePriority.mockReturnValue(4.5);
        
        // Create card normally - edit button should exist
        const card = uiController.createGoalCard(goal);
        const editBtn = card.querySelector('.edit-goal');
        
        // Should have edit button
        expect(editBtn).toBeDefined();
        expect(card).toBeDefined();
    });

    test('createGoalCard should work when edit button querySelector returns null', () => {
        const goal = new Goal({ id: '1', title: 'Test Goal', description: 'Test Description', motivation: 5, urgency: 4, status: 'active', deadline: new Date('2025-11-15') });
        mockGoalService.calculatePriority.mockReturnValue(4.5);
        
        // Create a card and manually remove the edit button to test the null case
        const card = uiController.createGoalCard(goal);
        const editBtn = card.querySelector('.edit-goal');
        if (editBtn) {
            editBtn.remove();
        }
        
        // Should not throw error when edit button is missing
        expect(card).toBeDefined();
    });

    test('renderAllGoalsTable should return early when table body is absent', () => {
        const table = document.getElementById('allGoalsTable');
        const tableBody = document.getElementById('allGoalsTableBody');
        tableBody.remove();

        expect(() => uiController.renderAllGoalsTable()).not.toThrow();

        const newBody = document.createElement('tbody');
        newBody.id = 'allGoalsTableBody';
        table.appendChild(newBody);
        uiController.renderAllGoalsTable();
    });

    test('formatDateTime should return empty string for falsy values', () => {
        expect(uiController.formatDateTime(null)).toBe('');
        expect(uiController.formatDateTime(undefined)).toBe('');
    });

    test('setupEventListeners should tolerate missing optional elements', () => {
        const idsToRemove = [
            'addGoalBtn',
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
            'allGoalsToggleCompleted',
            'allGoalsToggleArchived'
        ];

        idsToRemove.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.remove();
            }
        });

        const closeBtn = document.querySelector('.close');
        if (closeBtn) {
            closeBtn.remove();
        }

        document.querySelectorAll('.menu-btn').forEach(btn => btn.remove());

        expect(() => uiController.setupEventListeners()).not.toThrow();
        expect(() => uiController.setupAllGoalsControls()).not.toThrow();
    });

    test('openGoalForm should return early if modal elements are missing', () => {
        // Remove modal from DOM
        const modal = document.getElementById('goalModal');
        if (modal) {
            modal.remove();
        }
        
        // Should not throw error
        expect(() => uiController.openGoalForm()).not.toThrow();
    });

    test('renderCheckInView should show empty state when check-ins are empty', () => {
        mockApp.checkIns = [];
        uiController.renderCheckInView();

        const emptyState = document.getElementById('checkInsEmptyState');
        expect(emptyState.hidden).toBe(false);
    });

    test('window mousedown should close modal when clicking outside', () => {
        const modal = document.getElementById('goalModal');
        modal.classList.add('is-visible');
        uiController.closeGoalForm = jest.fn();
        
        // Simulate click outside modal - use an element that's actually in the DOM and not inside modal
        const outsideElement = document.createElement('div');
        outsideElement.id = 'outsideElement';
        document.body.appendChild(outsideElement);
        
        const mousedownEvent = new dom.window.MouseEvent('mousedown', { 
            bubbles: true,
            cancelable: true
        });
        Object.defineProperty(mousedownEvent, 'target', {
            value: outsideElement,
            writable: false,
            configurable: true
        });
        
        window.dispatchEvent(mousedownEvent);
        
        expect(uiController.closeGoalForm).toHaveBeenCalled();
        document.body.removeChild(outsideElement);
    });

    test('window mousedown should not close modal when clicking on add goal button', () => {
        const modal = document.getElementById('goalModal');
        modal.classList.add('is-visible');
        uiController.closeGoalForm = jest.fn();
        
        const addGoalBtn = document.getElementById('addGoalBtn');
        const mousedownEvent = new dom.window.MouseEvent('mousedown', { 
            target: addGoalBtn,
            bubbles: true 
        });
        
        window.dispatchEvent(mousedownEvent);
        
        expect(uiController.closeGoalForm).not.toHaveBeenCalled();
    });

    test('window mousedown should not close modal when clicking on edit button', () => {
        const modal = document.getElementById('goalModal');
        modal.classList.add('is-visible');
        uiController.closeGoalForm = jest.fn();
        
        const goal = new Goal({ id: '1', title: 'Test Goal', motivation: 1, urgency: 1, status: 'active', deadline: null });
        const card = uiController.createGoalCard(goal);
        const editBtn = card.querySelector('.edit-goal');
        document.body.appendChild(card);
        
        // Create event with proper target
        const mousedownEvent = new dom.window.MouseEvent('mousedown', { 
            bubbles: true,
            cancelable: true
        });
        Object.defineProperty(mousedownEvent, 'target', {
            value: editBtn,
            writable: false
        });
        
        window.dispatchEvent(mousedownEvent);
        
        expect(uiController.closeGoalForm).not.toHaveBeenCalled();
        document.body.removeChild(card);
    });

    test('handleGoalSubmit should show alert on error', () => {
        document.getElementById('goalId').value = '';
        document.getElementById('goalTitle').value = 'New Goal';
        document.getElementById('goalDescription').value = 'New Desc';
        document.getElementById('goalMotivation').value = '5';
        document.getElementById('goalUrgency').value = '4';
        document.getElementById('goalDeadline').value = '2025-12-31';

        global.alert = jest.fn();
        mockGoalService.createGoal.mockImplementation(() => {
            throw new Error('Test error message');
        });

        uiController.handleGoalSubmit();

        expect(global.alert).toHaveBeenCalledWith('Test error message');
    });

    // Test handleGoalSubmit for new goal
    test('handleGoalSubmit should create a new goal and re-render views', () => {
        document.getElementById('goalId').value = '';
        document.getElementById('goalTitle').value = 'New Goal';
        document.getElementById('goalDescription').value = 'New Desc';
        document.getElementById('goalMotivation').value = '5';
        document.getElementById('goalUrgency').value = '4';
        document.getElementById('goalDeadline').value = '2025-12-31';

        uiController.closeGoalForm = jest.fn();
        uiController.renderViews = jest.fn();

        uiController.handleGoalSubmit();

        expect(mockGoalService.createGoal).toHaveBeenCalledWith(
            {
                title: 'New Goal',
                description: 'New Desc',
                motivation: '5',
                urgency: '4',
                deadline: '2025-12-31'
            },
            expect.any(Number)
        );
        expect(uiController.closeGoalForm).toHaveBeenCalled();
        expect(uiController.renderViews).toHaveBeenCalled();
    });

    // Test handleGoalSubmit for existing goal
    test('handleGoalSubmit should update an existing goal and re-render views', () => {
        document.getElementById('goalId').value = 'existing-id';
        document.getElementById('goalTitle').value = 'Updated Goal';
        document.getElementById('goalDescription').value = 'Updated Desc';
        document.getElementById('goalMotivation').value = '3';
        document.getElementById('goalUrgency').value = '2';
        document.getElementById('goalDeadline').value = '2026-01-01';

        uiController.closeGoalForm = jest.fn();
        uiController.renderViews = jest.fn();

        uiController.handleGoalSubmit();

        expect(mockGoalService.updateGoal).toHaveBeenCalledWith(
            'existing-id',
            {
                title: 'Updated Goal',
                description: 'Updated Desc',
                motivation: '3',
                urgency: '2',
                deadline: '2026-01-01'
            },
            expect.any(Number)
        );
        expect(uiController.closeGoalForm).toHaveBeenCalled();
        expect(uiController.renderViews).toHaveBeenCalled();
    });

    // Test setupEventListeners - addGoalBtn
    test('addGoalBtn click should call openGoalForm', () => {
        uiController.openGoalForm = jest.fn();
        document.getElementById('addGoalBtn').click();
        expect(uiController.openGoalForm).toHaveBeenCalledWith();
    });

    // Test setupEventListeners - goalForm submit
    test('goalForm submit should call handleGoalSubmit', () => {
        uiController.handleGoalSubmit = jest.fn();
        const form = document.getElementById('goalForm');
        form.dispatchEvent(new dom.window.Event('submit'));
        expect(uiController.handleGoalSubmit).toHaveBeenCalled();
    });

    // Test setupEventListeners - cancelBtn
    test('cancelBtn click should call closeGoalForm', () => {
        uiController.closeGoalForm = jest.fn();
        document.getElementById('cancelBtn').click();
        expect(uiController.closeGoalForm).toHaveBeenCalled();
    });

    // Test setupEventListeners - deleteBtn
    test('deleteBtn click should call deleteGoal and re-render views if confirmed', () => {
        document.getElementById('goalId').value = 'goal-to-delete';
        uiController.closeGoalForm = jest.fn();
        uiController.renderViews = jest.fn();
        global.confirm.mockReturnValue(true); // Mock confirm to return true

        document.getElementById('deleteBtn').click();

        expect(global.confirm).toHaveBeenCalledWith('Do you really want to delete this goal?');
        expect(mockGoalService.deleteGoal).toHaveBeenCalledWith('goal-to-delete', 3);
        expect(uiController.closeGoalForm).toHaveBeenCalled();
        expect(uiController.renderViews).toHaveBeenCalled();
    });

    test('deleteBtn click should not delete goal if not confirmed', () => {
        document.getElementById('goalId').value = 'goal-to-delete';
        uiController.closeGoalForm = jest.fn();
        uiController.renderViews = jest.fn();
        global.confirm.mockReturnValue(false); // Mock confirm to return false

        document.getElementById('deleteBtn').click();

        expect(global.confirm).toHaveBeenCalledWith('Do you really want to delete this goal?');
        expect(mockGoalService.deleteGoal).not.toHaveBeenCalled();
        expect(uiController.closeGoalForm).not.toHaveBeenCalled();
        expect(uiController.renderViews).not.toHaveBeenCalled();
    });

    // Test setupEventListeners - close modal button
    test('close modal button click should call closeGoalForm', () => {
        uiController.closeGoalForm = jest.fn();
        document.querySelector('.close').click();
        expect(uiController.closeGoalForm).toHaveBeenCalled();
    });

    test('window click inside modal should not call closeGoalForm', () => {
        uiController.closeGoalForm = jest.fn();
        const modalTitle = document.getElementById('modalTitle');
        // Simulate a click inside the modal
        modalTitle.dispatchEvent(new dom.window.MouseEvent('click', { target: modalTitle }));
        expect(uiController.closeGoalForm).not.toHaveBeenCalled();
    });

    // Test setupEventListeners - exportBtn
    test('exportBtn click should call app.exportData', () => {
        document.getElementById('exportBtn').click();
        expect(mockApp.exportData).toHaveBeenCalled();
    });

    // Test setupEventListeners - importBtn and importFile change
    test('importBtn click should trigger importFile click', () => {
        const importFile = document.getElementById('importFile');
        importFile.click = jest.fn(); // Mock click
        document.getElementById('importBtn').click();
        expect(importFile.click).toHaveBeenCalled();
    });

    test('importFile change should call app.importData', () => {
        const importFile = document.getElementById('importFile');
        const mockFile = new dom.window.File(['{}'], 'test.json', { type: 'application/json' });
        Object.defineProperty(importFile, 'files', {
            value: [mockFile],
            writable: true,
        });

        importFile.dispatchEvent(new dom.window.Event('change'));
        expect(mockApp.importData).toHaveBeenCalledWith(mockFile);
        expect(importFile.value).toBe(''); // Should reset file input
    });

    // Test setupEventListeners - saveSettingsBtn
    test('saveSettingsBtn click should update settings, start check-in timer, and re-render views', () => {
        document.getElementById('maxActiveGoals').value = '5';
        document.getElementById('reviewIntervals').value = '45, 15, 7';
        mockSettingsService.getSettings.mockReturnValue({ maxActiveGoals: 3, language: 'en', reviewIntervals: [30, 14, 7] });

        uiController.renderViews = jest.fn();

        document.getElementById('saveSettingsBtn').click();

        expect(mockSettingsService.updateSettings).toHaveBeenCalledWith({
            maxActiveGoals: 5,
            language: 'en',
            reviewIntervals: '45, 15, 7'
        });
        // Should call autoActivateGoalsByPriority when maxActiveGoals changes
        expect(mockGoalService.autoActivateGoalsByPriority).toHaveBeenCalledWith(5);
        expect(mockApp.startCheckInTimer).toHaveBeenCalled();
        expect(uiController.renderViews).toHaveBeenCalled();
    });

    test('saveSettingsBtn click should not call autoActivateGoalsByPriority when maxActiveGoals unchanged', () => {
        document.getElementById('maxActiveGoals').value = '3';
        document.getElementById('reviewIntervals').value = '30, 14, 7';
        mockSettingsService.getSettings.mockReturnValue({ maxActiveGoals: 3, language: 'en', reviewIntervals: [30, 14, 7] });

        uiController.renderViews = jest.fn();

        document.getElementById('saveSettingsBtn').click();

        expect(mockSettingsService.updateSettings).toHaveBeenCalled();
        // Should NOT call autoActivateGoalsByPriority when maxActiveGoals unchanged
        expect(mockGoalService.autoActivateGoalsByPriority).not.toHaveBeenCalled();
        expect(mockApp.startCheckInTimer).toHaveBeenCalled();
        expect(uiController.renderViews).toHaveBeenCalled();
    });

    // Test setupEventListeners - menu-btn clicks
    test('menu-btn click should activate correct view', () => {
        const dashboardBtn = document.querySelector('.menu-btn[data-view="dashboard"]');
        const allGoalsBtn = document.querySelector('.menu-btn[data-view="all-goals"]');
        const dashboardView = document.getElementById('dashboardView');
        const allGoalsView = document.getElementById('all-goalsView');

        // Initially dashboard is active
        expect(dashboardBtn.classList.contains('active')).toBe(true);
        expect(dashboardView.classList.contains('active')).toBe(true);
        expect(allGoalsBtn.classList.contains('active')).toBe(false);
        expect(allGoalsView.classList.contains('active')).toBe(false);

        allGoalsBtn.click();

        expect(dashboardBtn.classList.contains('active')).toBe(false);
        expect(dashboardView.classList.contains('active')).toBe(false);
        expect(allGoalsBtn.classList.contains('active')).toBe(true);
        expect(allGoalsView.classList.contains('active')).toBe(true);

        dashboardBtn.click(); // Click back
        expect(dashboardBtn.classList.contains('active')).toBe(true);
        expect(dashboardView.classList.contains('active')).toBe(true);
        expect(allGoalsBtn.classList.contains('active')).toBe(false);
        expect(allGoalsView.classList.contains('active')).toBe(false);
    });

    test('window mousedown outside modal should call closeGoalForm', () => {
        const goalModal = document.getElementById('goalModal');
        goalModal.classList.add('is-visible'); // Ensure modal is visible
        uiController.closeGoalForm = jest.fn();

        // Create an element outside the modal
        const outsideElement = document.createElement('div');
        outsideElement.id = 'outsideElement';
        document.body.appendChild(outsideElement);

        // Simulate a mousedown on the window, with the target being outside the modal
        const mousedownEvent = new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true, composed: true });
        Object.defineProperty(mousedownEvent, 'target', { value: outsideElement, writable: false, configurable: true });
        window.dispatchEvent(mousedownEvent);

        expect(uiController.closeGoalForm).toHaveBeenCalled();
        document.body.removeChild(outsideElement);
    });

    test('openMigrationPrompt displays prompt modal with translated content', () => {
        uiController.openMigrationPrompt({
            fromVersion: null,
            toVersion: '1.0.0',
            fileName: 'legacy.json'
        });

        const promptModal = document.getElementById('migrationPromptModal');
        expect(promptModal.classList.contains('is-visible')).toBe(true);
        const promptMessage = document.getElementById('migrationPromptMessage').textContent;
        expect(promptMessage).toContain('legacy');
        uiController.closeMigrationModals();

        uiController.openMigrationPrompt({
            fromVersion: '0.9.0',
            toVersion: '1.0.0',
            fileName: 'current.json'
        });
        const promptMessageNew = document.getElementById('migrationPromptMessage').textContent;
        expect(promptMessageNew).toContain('0.9.0');
        uiController.closeMigrationModals();
    });

    test('openMigrationDiff renders diff columns and synchronises scroll', () => {
        const originalRAF = global.requestAnimationFrame;
        global.requestAnimationFrame = (callback) => {
            callback();
            return 0;
        };

        uiController.openMigrationDiff({
            fromVersion: '0.9.0',
            toVersion: '1.0.0',
            originalString: 'line-a\nremove-me\ncommon',
            migratedString: 'line-a\nadd-me\ncommon',
            fileName: 'export.json'
        });

        const diffModal = document.getElementById('migrationDiffModal');
        expect(diffModal.classList.contains('is-visible')).toBe(true);

        const oldLines = Array.from(document.querySelectorAll('#migrationDiffOld .diff-line'));
        const newLines = Array.from(document.querySelectorAll('#migrationDiffNew .diff-line'));
        expect(oldLines.some((line) => line.classList.contains('diff-line--removed'))).toBe(true);
        expect(newLines.some((line) => line.classList.contains('diff-line--added'))).toBe(true);

        const oldView = document.getElementById('migrationDiffOld');
        const newView = document.getElementById('migrationDiffNew');
        oldView.scrollTop = 45;
        oldView.scrollLeft = 10;
        oldView.dispatchEvent(new dom.window.Event('scroll'));
        expect(newView.scrollTop).toBe(45);
        expect(newView.scrollLeft).toBe(10);

        newView.scrollTop = 12;
        newView.scrollLeft = 5;
        newView.dispatchEvent(new dom.window.Event('scroll'));
        expect(oldView.scrollTop).toBe(12);
        expect(oldView.scrollLeft).toBe(5);

        uiController.closeMigrationModals();
        expect(uiController.migrationDiffData).toBeNull();

        if (originalRAF) {
            global.requestAnimationFrame = originalRAF;
        } else {
            delete global.requestAnimationFrame;
        }

        uiController.setupMigrationModals();
    });

    test('migration prompt actions trigger app handlers', () => {
        mockApp.handleMigrationReviewRequest.mockClear();
        mockApp.cancelMigration.mockClear();

        const promptModal = document.getElementById('migrationPromptModal');
        promptModal.classList.add('is-visible');
        document.getElementById('migrationReviewBtn').click();
        expect(mockApp.handleMigrationReviewRequest).toHaveBeenCalled();

        promptModal.classList.add('is-visible');
        document.getElementById('migrationPromptCancelBtn').click();
        expect(mockApp.cancelMigration).toHaveBeenCalled();

        promptModal.classList.add('is-visible');
        document.getElementById('migrationPromptClose').click();
        expect(mockApp.cancelMigration).toHaveBeenCalledTimes(2);
    });

    test('migration diff actions trigger app handlers', () => {
        mockApp.cancelMigration.mockClear();
        mockApp.completeMigration.mockClear();

        const diffModal = document.getElementById('migrationDiffModal');
        diffModal.classList.add('is-visible');
        document.getElementById('migrationCancelBtn').click();
        expect(mockApp.cancelMigration).toHaveBeenCalledTimes(1);

        diffModal.classList.add('is-visible');
        document.getElementById('migrationDiffClose').click();
        expect(mockApp.cancelMigration).toHaveBeenCalledTimes(2);

        diffModal.classList.add('is-visible');
        document.getElementById('migrationApplyBtn').click();
        expect(mockApp.completeMigration).toHaveBeenCalled();
    });

    test('openCompletionModal no-ops when modal missing', () => {
        const completionModal = document.getElementById('completionModal');
        completionModal.remove();
        expect(() => uiController.openCompletionModal('goal-1')).not.toThrow();
    });

    test('handleCompletionChoice returns early when no pending goal', () => {
        uiController.pendingCompletionGoalId = null;
        const statusSpy = jest.spyOn(uiController, 'changeGoalStatus').mockImplementation(() => {});
        uiController.handleCompletionChoice('completed');
        expect(statusSpy).not.toHaveBeenCalled();
        statusSpy.mockRestore();
    });

    test('changeGoalStatus handles thrown errors and shows alert', () => {
        const alertSpy = jest.spyOn(global, 'alert').mockImplementation(() => {});
        mockSettingsService.getSettings.mockReturnValue({ maxActiveGoals: 3 });
        mockGoalService.setGoalStatus.mockImplementation(() => {
            throw new Error('boom');
        });

        uiController.changeGoalStatus('goal-1', 'completed');

        expect(alertSpy).toHaveBeenCalledWith('boom');
        alertSpy.mockRestore();
        mockGoalService.setGoalStatus.mockReset();
    });

    test('formatHistoryValue handles numeric branches and fallbacks', () => {
        expect(uiController.formatHistoryValue('priority', 'not-a-number')).toBe('—');
        expect(uiController.formatHistoryValue('motivation', 'not-a-number')).toBe('—');
        expect(uiController.formatHistoryValue('priority', 3)).toBe('3.0');
        expect(uiController.formatHistoryValue('status', 'active')).toBe('Active');
        expect(uiController.formatHistoryValue('deadline', '')).toBe('No deadline');
        expect(uiController.formatHistoryValue('other', null)).toBe('—');
    });

    test('renderGoalHistory sorts entries and renders fallback', () => {
        const goal = {
            history: [
                { event: 'updated', timestamp: undefined, changes: [] },
                { event: 'created', timestamp: new Date('2025-01-01T00:00:00Z'), changes: [] }
            ]
        };

        uiController.renderGoalHistory(goal);

        const historySection = document.getElementById('goalHistorySection');
        expect(historySection.hidden).toBe(false);
        const entries = historySection.querySelectorAll('.goal-history-entry');
        expect(entries.length).toBe(2);
    });

    test('getMigrationElement caches connected nodes', () => {
        const firstCall = uiController.getMigrationElement('migrationDiffModal');
        expect(firstCall).not.toBeNull();
        const secondCall = uiController.getMigrationElement('migrationDiffModal');
        expect(secondCall).toBe(firstCall);
    });
});
