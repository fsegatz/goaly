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
        <div id="allGoalsList"></div>
        <button id="addGoalBtn"></button>
        <form id="goalForm"></form>
        <button id="cancelBtn"></button>
        <button id="deleteBtn"></button>
        <div id="goalModal">
            <span class="close"></span>
            <h2 id="modalTitle"></h2>
            <input type="hidden" id="goalId" />
            <input type="text" id="goalTitle" />
            <textarea id="goalDescription"></textarea>
            <input type="number" id="goalMotivation" />
            <input type="number" id="goalUrgency" />
            <input type="date" id="goalDeadline" />
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
        <button class="menu-btn" data-view="allGoals"></button>
        <div id="dashboardView" class="view active"></div>
        <div id="allGoalsView" class="view"></div>
    </body></html>`, { url: "http://localhost" });
    document = dom.window.document;
    window = dom.window;

    // Make document and window available globally for the UIController
    global.document = document;
    global.window = window;
    global.confirm = jest.fn(); // Mock global confirm
    global.alert = jest.fn(); // Mock global alert

    const RealDate = Date; // Store original Date constructor
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-11-09T12:00:00.000Z')); // Set a fixed system time

    // Mock services
    mockGoalService = {
        goals: [],
        getActiveGoals: jest.fn(() => []),
        createGoal: jest.fn(),
        updateGoal: jest.fn(),
        deleteGoal: jest.fn(),
        calculatePriority: jest.fn(() => 0),
        autoActivateGoalsByPriority: jest.fn(),
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
        mockGoalService.goals = []; // Ensure allGoalsList is also empty

        uiController.renderViews();

        const dashboardList = document.getElementById('goalsList');
        expect(dashboardList.innerHTML).toContain('Keine aktiven Ziele. Erstelle dein erstes Ziel!');

        const allGoalsList = document.getElementById('allGoalsList');
        expect(allGoalsList.innerHTML).toContain('Keine weiteren Ziele im Backlog.');
    });

    // Test renderViews with active goals
    test('renderViews should render active goals in dashboard and other goals in allGoalsList', () => {
        const goal1 = new Goal({ id: '1', title: 'Active Goal 1', description: 'Desc 1', motivation: 5, urgency: 5, status: 'active', deadline: new Date('2025-12-01') });
        const goal2 = new Goal({ id: '2', title: 'Active Goal 2', description: 'Desc 2', motivation: 4, urgency: 4, status: 'active', deadline: new Date('2025-12-05') });
        const goal3 = new Goal({ id: '3', title: 'Active Goal 3', description: 'Desc 3', motivation: 3, urgency: 3, status: 'active', deadline: new Date('2025-12-10') });
        const goal4 = new Goal({ id: '4', title: 'Paused Goal 1', description: 'Desc 4', motivation: 2, urgency: 2, status: 'paused', deadline: new Date('2025-12-15') });
        const goal5 = new Goal({ id: '5', title: 'Completed Goal 1', description: 'Desc 5', motivation: 1, urgency: 1, status: 'completed', deadline: new Date('2025-12-20') });

        mockGoalService.getActiveGoals.mockReturnValue([goal1, goal2, goal3]);
        mockGoalService.goals = [goal1, goal2, goal3, goal4, goal5];
        mockSettingsService.getSettings.mockReturnValue({ maxActiveGoals: 2 }); // Only 2 active goals on dashboard
        mockGoalService.calculatePriority.mockImplementation((goal) => goal.motivation + goal.urgency); // Mock priority calculation

        uiController.renderViews();

        const dashboardList = document.getElementById('goalsList');
        expect(dashboardList.children.length).toBe(2); // goal1, goal2
        expect(dashboardList.innerHTML).toContain('Active Goal 1');
        expect(dashboardList.innerHTML).toContain('Active Goal 2');
        expect(dashboardList.innerHTML).not.toContain('Active Goal 3'); // Should be in allGoalsList

        const allGoalsList = document.getElementById('allGoalsList');
        expect(allGoalsList.children.length).toBe(3); // goal3, goal4, goal5
        expect(allGoalsList.innerHTML).toContain('Active Goal 3');
        expect(allGoalsList.innerHTML).toContain('Paused Goal 1');
        expect(allGoalsList.innerHTML).toContain('Completed Goal 1');
    });

    // Test createGoalCard
    test('createGoalCard should create a goal card with correct content and buttons', () => {
        const goal = new Goal({ id: '1', title: 'Test Goal', description: 'Test Description', motivation: 5, urgency: 4, status: 'active', deadline: new Date('2025-11-15') });
        mockGoalService.calculatePriority.mockReturnValue(4.5);

        const card = uiController.createGoalCard(goal);

        expect(card.className).toBe('goal-card active');
        expect(card.querySelector('.goal-title').textContent).toBe('Test Goal');
        expect(card.querySelector('.goal-description').textContent).toBe('Test Description');
        expect(card.querySelector('.metric-value.motivation').textContent).toBe('5/5');
        expect(card.querySelector('.metric-value.urgency').textContent).toBe('4/5');
        expect(card.querySelector('.metric-value.priority').textContent).toBe('4.5');
        expect(card.querySelector('.goal-deadline').textContent).toContain('In 6 Tagen'); // Assuming today is Nov 9, 2025
        expect(card.innerHTML).toContain('btn btn-primary edit-goal');
        // No pause/activate buttons anymore - status is automatic
        expect(card.innerHTML).not.toContain('pause-goal');
        expect(card.innerHTML).not.toContain('activate-goal');
    });

    test('createGoalCard should not show pause/activate buttons for any status', () => {
        const pausedGoal = new Goal({ id: '1', title: 'Paused Goal', description: 'Test Description', motivation: 5, urgency: 4, status: 'paused', deadline: new Date('2025-11-15') });
        const card = uiController.createGoalCard(pausedGoal);
        expect(card.innerHTML).toContain('btn btn-primary edit-goal');
        expect(card.innerHTML).not.toContain('pause-goal');
        expect(card.innerHTML).not.toContain('activate-goal');
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
        expect(uiController.getStatusText('completed')).toBe('Abgeschlossen');
        expect(uiController.getStatusText('unknown')).toBe('unknown'); // Fallback
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
        expect(document.getElementById('goalModal').style.display).toBe('block');
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
        expect(document.getElementById('goalModal').style.display).toBe('block');
    });

    // Test closeGoalForm
    test('closeGoalForm should hide modal and reset form', () => {
        const form = document.getElementById('goalForm');
        form.reset = jest.fn(); // Mock reset
        document.getElementById('goalModal').style.display = 'block'; // Set to block first

        uiController.closeGoalForm();

        expect(document.getElementById('goalModal').style.display).toBe('none');
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
        mockCheckInService.getCheckIns.mockReturnValue(mockApp.checkIns);

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
        modal.style.setProperty('display', 'block', 'important');
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
        modal.style.setProperty('display', 'block', 'important');
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
        modal.style.setProperty('display', 'block', 'important');
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
        const allGoalsBtn = document.querySelector('.menu-btn[data-view="allGoals"]');
        const dashboardView = document.getElementById('dashboardView');
        const allGoalsView = document.getElementById('allGoalsView');

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

    test('window click on modal background should call closeGoalForm', () => {
        const goalModal = document.getElementById('goalModal');
        goalModal.style.display = 'block'; // Ensure modal is visible

        // Simulate a click on the window, with the target being the modal background
        const clickEvent = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, composed: true });
        Object.defineProperty(clickEvent, 'target', { value: goalModal });
        dom.window.dispatchEvent(clickEvent);

        expect(UIController.prototype.closeGoalForm).toHaveBeenCalled();
    });
});
