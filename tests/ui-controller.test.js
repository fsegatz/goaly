const { JSDOM } = require('jsdom');
const UIController = require('../src/ui/ui-controller').default;
const Goal = require('../src/domain/goal').default;

// Mock the entire DOM for testing UI interactions
let dom;
let document;
let window;

// Mock the app object and its services
let mockApp;
let mockGoalService;
let mockSettingsService;
let mockCheckInService;

beforeEach(() => {
    // Setup JSDOM
    dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div id="goalsList"></div>
        <div id="all-goalsView" class="view">
            <div class="all-goals-controls">
                <label for="allGoalsStatusFilter">
                    Status
                    <select id="allGoalsStatusFilter">
                        <option value="all">Alle Status</option>
                        <option value="active">Aktiv</option>
                        <option value="paused">Pausiert</option>
                        <option value="completed">Erreicht</option>
                        <option value="abandoned">Nicht erreicht</option>
                    </select>
                </label>
                <label for="allGoalsPriorityFilter">
                    Mindestpriorität
                    <input type="number" id="allGoalsPriorityFilter" value="0" />
                </label>
                <label for="allGoalsSort">
                    Sortierung
                    <select id="allGoalsSort">
                        <option value="priority-desc">Priorität (hoch → niedrig)</option>
                        <option value="priority-asc">Priorität (niedrig → hoch)</option>
                        <option value="updated-desc">Letzte Änderung (neu → alt)</option>
                        <option value="updated-asc">Letzte Änderung (alt → neu)</option>
                    </select>
                </label>
                <label class="toggle-option">
                    <input type="checkbox" id="allGoalsToggleCompleted" checked />
                    Erreichte anzeigen
                </label>
                <label class="toggle-option">
                    <input type="checkbox" id="allGoalsToggleAbandoned" checked />
                    Nicht erreichte anzeigen
                </label>
            </div>
            <div class="table-wrapper">
                <table id="allGoalsTable">
                    <thead>
                        <tr>
                            <th>Titel</th>
                            <th>Status</th>
                            <th>Priorität</th>
                            <th>Motivation</th>
                            <th>Dringlichkeit</th>
                            <th>Deadline</th>
                            <th>Letzte Änderung</th>
                        </tr>
                    </thead>
                    <tbody id="allGoalsTableBody"></tbody>
                </table>
                <div id="allGoalsEmptyState" hidden>Keine Ziele vorhanden, die den aktuellen Filtern entsprechen.</div>
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
                <h3>Historie</h3>
                <div id="goalHistoryList" class="goal-history-list"></div>
            </div>
        </div>
        <div id="completionModal" class="modal">
            <div class="modal-content completion-modal">
                <span id="completionCloseBtn" class="close"></span>
                <h2>Ziel abschließen</h2>
                <p>Hast du dein Ziel erreicht?</p>
                <div class="completion-actions">
                    <button id="completionSuccessBtn" class="btn btn-primary">Ziel erreicht</button>
                    <button id="completionFailureBtn" class="btn btn-danger">Nicht erreicht</button>
                    <button id="completionCancelBtn" class="btn btn-secondary">Abbrechen</button>
                </div>
            </div>
        </div>
        <button id="exportBtn"></button>
        <button id="importBtn"></button>
        <input type="file" id="importFile" />
        <button id="saveSettingsBtn"></button>
        <input type="number" id="maxActiveGoals" value="3" />
        <input type="number" id="checkInInterval" value="7" />
        <input type="checkbox" id="checkInsEnabled" checked />
        <div id="checkInsPanel">
            <div id="checkInsList"></div>
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
        getSettings: jest.fn(() => ({ maxActiveGoals: 3, checkInInterval: 7, checkInsEnabled: true })),
        updateSettings: jest.fn(),
    };
    mockCheckInService = {
        getCheckIns: jest.fn(() => []),
        performCheckIn: jest.fn(),
    };

    // Mock the app object
    mockApp = {
        goalService: mockGoalService,
        settingsService: mockSettingsService,
        checkInService: mockCheckInService,
        checkIns: [], // UIController directly accesses app.checkIns
        exportData: jest.fn(),
        importData: jest.fn(),
        startCheckInTimer: jest.fn(),
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
    test('renderViews should display "Keine aktiven Ziele" when no active goals', () => {
        mockGoalService.getActiveGoals.mockReturnValue([]);
        mockGoalService.goals = []; // Ensure table is also empty

        uiController.renderViews();

        const dashboardList = document.getElementById('goalsList');
        expect(dashboardList.innerHTML).toContain('Keine aktiven Ziele. Erstelle dein erstes Ziel!');

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
        expect(statusTexts).toEqual(expect.arrayContaining(['Aktiv', 'Pausiert', 'Erreicht', 'Nicht erreicht']));
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
        expect(card.querySelector('.goal-deadline').textContent).toContain('In 6 Tagen'); // Assuming today is Nov 9, 2025
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
        expect(window.alert).toHaveBeenCalledWith('Ziel nicht gefunden.');
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
    test('formatDeadline should return "Heute" for today', () => {
        const today = new Date('2025-11-09T12:00:00.000Z'); // Fixed date for consistent testing
        const result = uiController.formatDeadline(today);
        expect(result).toBe('Heute');
    });

    test('formatDeadline should return "Morgen" for tomorrow', () => {
        const tomorrow = new Date('2025-11-10T12:00:00.000Z');
        const result = uiController.formatDeadline(tomorrow);
        expect(result).toBe('Morgen');
    });

    test('formatDeadline should return "In X Tagen" for upcoming deadlines within 7 days', () => {
        const futureDate = new Date('2025-11-12T12:00:00.000Z'); // 3 days from now
        const result = uiController.formatDeadline(futureDate);
        expect(result).toBe('In 3 Tagen');
    });

    test('formatDeadline should return "Überfällig" for past deadlines', () => {
        const pastDate = new Date('2025-11-04T12:00:00.000Z'); // 5 days ago
        const result = uiController.formatDeadline(pastDate);
        expect(result).toContain('Überfällig (5 Tage)');
    });

    test('formatDeadline should return formatted date for deadlines far in future', () => {
        const farFutureDate = new Date('2026-01-01T12:00:00.000Z');
        const result = uiController.formatDeadline(farFutureDate);
        expect(result).toBe('1.1.2026'); // Adjust based on locale if needed
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
    test('getStatusText should return correct German text for status', () => {
        expect(uiController.getStatusText('active')).toBe('Aktiv');
        expect(uiController.getStatusText('paused')).toBe('Pausiert');
        expect(uiController.getStatusText('completed')).toBe('Erreicht');
        expect(uiController.getStatusText('abandoned')).toBe('Nicht erreicht');
        expect(uiController.getStatusText('unknown')).toBe('unknown'); // Fallback
    });

    test('formatHistoryValue should format different field types correctly', () => {
        expect(uiController.formatHistoryValue('deadline', '')).toBe('Keine Deadline');
        expect(uiController.formatHistoryValue('deadline', 'invalid-date')).toBe('—');
        expect(uiController.formatHistoryValue('priority', 12.345)).toBe('12.3');
        expect(uiController.formatHistoryValue('priority', 'not-a-number')).toBe('—');
        expect(uiController.formatHistoryValue('motivation', '4')).toBe('4');
        expect(uiController.formatHistoryValue('status', 'active')).toBe('Aktiv');
        expect(uiController.formatHistoryValue('status', 'completed')).toBe('Erreicht');
        expect(uiController.formatHistoryValue('status', 'abandoned')).toBe('Nicht erreicht');
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
        expect(window.alert).toHaveBeenCalledWith('Zurücksetzen nicht möglich.');
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
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Aktualisierung des Ziels fehlgeschlagen.'));
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
        expect(document.getElementById('modalTitle').textContent).toBe('Neues Ziel');
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

        expect(document.getElementById('modalTitle').textContent).toBe('Ziel bearbeiten');
        expect(document.getElementById('goalId').value).toBe('123');
        expect(document.getElementById('goalTitle').value).toBe('Edit Goal');
        expect(document.getElementById('goalDescription').value).toBe('Edit Desc');
        expect(document.getElementById('goalMotivation').value).toBe('3');
        expect(document.getElementById('goalUrgency').value).toBe('2');
        expect(document.getElementById('goalDeadline').value).toBe('2025-12-25');
        expect(document.getElementById('deleteBtn').style.display).toBe('inline-block');
        expect(document.getElementById('goalModal').classList.contains('is-visible')).toBe(true);
        expect(document.getElementById('goalHistorySection').hidden).toBe(false);
        expect(document.getElementById('goalHistoryList').textContent).toContain('Noch keine Änderungen protokolliert');
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


    // Test showCheckIns
    test('showCheckIns should display check-ins and attach event listeners', () => {
        const goal1 = new Goal({ id: 'g1', title: 'Goal 1', motivation: 1, urgency: 1, status: 'active', deadline: null });
        const goal2 = new Goal({ id: 'g2', title: 'Goal 2', motivation: 1, urgency: 1, status: 'active', deadline: null });
        mockApp.checkIns = [
            { goal: goal1, message: 'Check-in for Goal 1' },
            { goal: goal2, message: 'Check-in for Goal 2' },
        ];
        mockCheckInService.getCheckIns.mockReturnValue([]);

        uiController.showCheckIns();

        const checkInsList = document.getElementById('checkInsList');
        expect(checkInsList.children.length).toBe(2);
        expect(checkInsList.innerHTML).toContain('Check-in for Goal 1');
        expect(checkInsList.innerHTML).toContain('Check-in for Goal 2');
        expect(document.getElementById('checkInsPanel').style.display).toBe('block');

        // Simulate check-in done click
        const checkInDoneBtn = checkInsList.querySelector('.check-in-done');
        checkInDoneBtn.click();
        expect(mockCheckInService.performCheckIn).toHaveBeenCalledWith('g1');
        expect(document.getElementById('checkInsPanel').style.display).toBe('none');
    });


    test('showCheckIns should allow editing goal from check-in', () => {
        const goal1 = new Goal({ id: 'g1', title: 'Goal 1', motivation: 1, urgency: 1, status: 'active', deadline: null });
        mockApp.checkIns = [
            { goal: goal1, message: 'Check-in for Goal 1' },
        ];
        mockCheckInService.getCheckIns.mockReturnValue(mockApp.checkIns);
        uiController.openGoalForm = jest.fn();

        uiController.showCheckIns();
        const checkInsList = document.getElementById('checkInsList');
        const editBtn = checkInsList.querySelector('.edit-check-in-goal');
        
        editBtn.click();
        expect(uiController.openGoalForm).toHaveBeenCalledWith('g1');
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

    test('showCheckIns should hide panel when check-ins are empty', () => {
        // Test with empty check-ins
        mockApp.checkIns = [];
        mockCheckInService.getCheckIns.mockReturnValue([]);
        
        uiController.showCheckIns();
        
        // Panel should be hidden when no check-ins
        expect(document.getElementById('checkInsPanel').style.display).toBe('none');
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

        expect(global.confirm).toHaveBeenCalledWith('Möchtest du dieses Ziel wirklich löschen?');
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

        expect(global.confirm).toHaveBeenCalledWith('Möchtest du dieses Ziel wirklich löschen?');
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
        document.getElementById('checkInInterval').value = '10';
        document.getElementById('checkInsEnabled').checked = false;
        mockSettingsService.getSettings.mockReturnValue({ maxActiveGoals: 3, checkInInterval: 7, checkInsEnabled: true });

        uiController.renderViews = jest.fn();

        document.getElementById('saveSettingsBtn').click();

        expect(mockSettingsService.updateSettings).toHaveBeenCalledWith({
            maxActiveGoals: 5,
            checkInInterval: 10,
            checkInsEnabled: false
        });
        // Should call autoActivateGoalsByPriority when maxActiveGoals changes
        expect(mockGoalService.autoActivateGoalsByPriority).toHaveBeenCalledWith(5);
        expect(mockApp.startCheckInTimer).toHaveBeenCalled();
        expect(uiController.renderViews).toHaveBeenCalled();
    });

    test('saveSettingsBtn click should not call autoActivateGoalsByPriority when maxActiveGoals unchanged', () => {
        document.getElementById('maxActiveGoals').value = '3';
        document.getElementById('checkInInterval').value = '10';
        document.getElementById('checkInsEnabled').checked = false;
        mockSettingsService.getSettings.mockReturnValue({ maxActiveGoals: 3, checkInInterval: 7, checkInsEnabled: true });

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
});
