// tests/goal-service.test.js

const GoalService = require('../src/domain/services/goal-service').default;

describe('Goal Service', () => {
    let goalService;

    beforeEach(() => {
        // Mock localStorage
        global.localStorage = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            clear: jest.fn()
        };
        goalService = new GoalService();
    });

    it('should load goals from localStorage', () => {
        const savedGoals = [
            { id: '1', title: 'Goal 1', motivation: 3, urgency: 4, status: 'active', createdAt: '2025-01-01T00:00:00.000Z', lastUpdated: '2025-01-01T00:00:00.000Z' }
        ];
        global.localStorage.getItem.mockReturnValue(JSON.stringify(savedGoals));
        
        goalService.loadGoals();
        
        expect(goalService.goals.length).toBe(1);
        expect(goalService.goals[0].title).toBe('Goal 1');
    });

    it('should handle empty localStorage when loading goals', () => {
        global.localStorage.getItem.mockReturnValue(null);
        
        goalService.loadGoals();
        
        expect(goalService.goals.length).toBe(0);
    });

    it('should create a new goal', () => {
        const goalData = {
            title: 'Test Goal',
            motivation: 3,
            urgency: 4,
        };
        const goal = goalService.createGoal(goalData, 3);
        expect(goal.title).toBe('Test Goal');
        expect(goalService.goals.length).toBe(1);
        expect(localStorage.setItem).toHaveBeenCalledWith('goaly_goals', expect.any(String));
    });

    it('should automatically activate goals by priority when creating', () => {
        // Create goals with different priorities
        const goal1 = goalService.createGoal({ title: 'High Priority', motivation: 5, urgency: 5 }, 2);
        const goal2 = goalService.createGoal({ title: 'Medium Priority', motivation: 3, urgency: 3 }, 2);
        const goal3 = goalService.createGoal({ title: 'Low Priority', motivation: 1, urgency: 1 }, 2);
        
        // The two highest priority goals should be active
        const activeGoals = goalService.getActiveGoals();
        expect(activeGoals.length).toBe(2);
        expect(activeGoals.map(g => g.title)).toContain('High Priority');
        expect(activeGoals.map(g => g.title)).toContain('Medium Priority');
        expect(goal3.status).toBe('inactive');
    });

    it('should update a goal', () => {
        const goal = goalService.createGoal({ title: 'Initial Title', motivation: 1, urgency: 1 }, 3);
        const updatedGoal = goalService.updateGoal(goal.id, { title: 'Updated Title' }, 3);
        expect(updatedGoal.title).toBe('Updated Title');
        expect(goalService.goals[0].title).toBe('Updated Title');
        expect(localStorage.setItem).toHaveBeenCalledTimes(2);
    });

    it('should automatically reactivate goals when priority changes', () => {
        const goal1 = goalService.createGoal({ title: 'Goal 1', motivation: 5, urgency: 5 }, 1);
        const goal2 = goalService.createGoal({ title: 'Goal 2', motivation: 1, urgency: 1 }, 1);
        
        // Initially goal1 should be active (higher priority)
        expect(goal1.status).toBe('active');
        expect(goal2.status).toBe('inactive');
        
        // Increase goal2's priority
        goalService.updateGoal(goal2.id, { motivation: 10, urgency: 10 }, 1);
        
        // Now goal2 should be active (higher priority)
        expect(goal2.status).toBe('active');
        expect(goal1.status).toBe('inactive');
    });

    it('should delete a goal', () => {
        const goal = goalService.createGoal({ title: 'To be deleted', motivation: 1, urgency: 1 }, 3);
        goalService.deleteGoal(goal.id, 3);
        expect(goalService.goals.length).toBe(0);
        expect(localStorage.setItem).toHaveBeenCalledTimes(2);
    });

    it('should reactivate goals when an active goal is deleted', () => {
        const goal1 = goalService.createGoal({ title: 'Goal 1', motivation: 5, urgency: 5 }, 1);
        const goal2 = goalService.createGoal({ title: 'Goal 2', motivation: 3, urgency: 3 }, 1);
        const goal3 = goalService.createGoal({ title: 'Goal 3', motivation: 1, urgency: 1 }, 1);
        
        // goal1 should be active
        expect(goal1.status).toBe('active');
        expect(goal2.status).toBe('inactive');
        expect(goal3.status).toBe('inactive');
        
        // Delete goal1
        goalService.deleteGoal(goal1.id, 1);
        
        // goal2 should now be active
        expect(goal2.status).toBe('active');
        expect(goal3.status).toBe('inactive');
    });

    it('should calculate priority correctly', () => {
        const goal = {
            motivation: 3,
            urgency: 5,
            deadline: null
        };
        // priority = 3 + (5 * 10) = 53
        expect(goalService.calculatePriority(goal)).toBe(53);
    });

    it('should calculate priority with a deadline bonus', () => {
        const today = new Date();
        const deadline = new Date(today);
        deadline.setDate(today.getDate() + 10); // 10 days from now

        const goal = {
            motivation: 3,
            urgency: 5,
            deadline: deadline
        };

        // priority = 3 + (5 * 10) = 53
        // bonus = 30 - 10 = 20
        // total = 53 + 20 = 73
        expect(goalService.calculatePriority(goal)).toBe(73);
    });

    it('should load goals from localStorage', () => {
        const mockGoals = [
            { id: '1', title: 'Loaded Goal 1', motivation: 1, urgency: 1, status: 'active', createdAt: new Date().toISOString(), lastUpdated: new Date().toISOString() },
            { id: '2', title: 'Loaded Goal 2', motivation: 2, urgency: 2, status: 'paused', createdAt: new Date().toISOString(), lastUpdated: new Date().toISOString() }
        ];
        localStorage.getItem.mockReturnValue(JSON.stringify(mockGoals));
        
        goalService = new GoalService(); // Re-initialize to trigger loadGoals
        goalService.loadGoals(); // Explicitly call loadGoals after re-initialization
        
        expect(goalService.goals.length).toBe(2);
        expect(goalService.goals[0].title).toBe('Loaded Goal 1');
        expect(localStorage.getItem).toHaveBeenCalledWith('goaly_goals');
    });

    it('should handle no goals in localStorage', () => {
        localStorage.getItem.mockReturnValue(null);
        
        goalService = new GoalService(); // Re-initialize to trigger loadGoals
        goalService.loadGoals(); // Explicitly call loadGoals after re-initialization
        
        expect(goalService.goals.length).toBe(0);
        expect(localStorage.getItem).toHaveBeenCalledWith('goaly_goals');
    });

    it('should return null if goal to update is not found', () => {
        const updatedGoal = goalService.updateGoal('non-existent-id', { title: 'New Title' }, 3);
        expect(updatedGoal).toBeNull();
        expect(localStorage.setItem).not.toHaveBeenCalled(); // Should not save if goal not found
    });

    it('should calculate priority with no deadline bonus if deadline is far in the future', () => {
        const today = new Date();
        const deadline = new Date(today);
        deadline.setDate(today.getDate() + 31); // 31 days from now (more than 30)

        const goal = {
            motivation: 3,
            urgency: 5,
            deadline: deadline
        };

        // priority = 3 + (5 * 10) = 53
        // No bonus for deadlines > 30 days
        expect(goalService.calculatePriority(goal)).toBe(53);
    });

    it('should auto activate goals by priority', () => {
        // Create multiple goals with different priorities
        const goal1 = goalService.createGoal({ title: 'Low Priority', motivation: 1, urgency: 1 }, 2);
        const goal2 = goalService.createGoal({ title: 'High Priority', motivation: 5, urgency: 5 }, 2);
        const goal3 = goalService.createGoal({ title: 'Medium Priority', motivation: 3, urgency: 3 }, 2);
        
        // Manually call autoActivateGoalsByPriority
        goalService.autoActivateGoalsByPriority(2);
        
        const activeGoals = goalService.getActiveGoals();
        expect(activeGoals.length).toBe(2);
        // Should be sorted by priority (highest first)
        expect(activeGoals[0].title).toBe('High Priority');
        expect(activeGoals[1].title).toBe('Medium Priority');
        expect(goal1.status).toBe('inactive');
    });

    it('should not activate completed goals', () => {
        const goal1 = goalService.createGoal({ title: 'Active Goal', motivation: 5, urgency: 5 }, 1);
        const goal2 = goalService.createGoal({ title: 'Completed Goal', motivation: 10, urgency: 10 }, 1);
        
        // Mark goal2 as completed
        goal2.status = 'completed';
        goalService.saveGoals();
        
        // Auto activate should only consider non-completed goals
        goalService.autoActivateGoalsByPriority(1);
        
        expect(goal1.status).toBe('active');
        expect(goal2.status).toBe('completed'); // Should remain completed
    });

    it('should migrate goals to auto activation', () => {
        // Manually set goals with different statuses
        const goal1 = new (require('../src/domain/models/goal').default)({ 
            id: '1', title: 'Goal 1', motivation: 1, urgency: 1, status: 'active' 
        });
        const goal2 = new (require('../src/domain/models/goal').default)({ 
            id: '2', title: 'Goal 2', motivation: 5, urgency: 5, status: 'inactive' 
        });
        goalService.goals = [goal1, goal2];
        
        // Migrate - should activate goal2 (higher priority) and inactivate goal1
        goalService.migrateGoalsToAutoActivation(1);
        
        expect(goal2.status).toBe('active');
        expect(goal1.status).toBe('inactive');
    });

    it('should return early when migrating empty goals list', () => {
        goalService.goals = [];
        const autoActivateSpy = jest.spyOn(goalService, 'autoActivateGoalsByPriority');
        
        goalService.migrateGoalsToAutoActivation(3);
        
        expect(autoActivateSpy).not.toHaveBeenCalled();
    });

    it('should handle deadline update to null', () => {
        const today = new Date();
        const deadline = new Date(today);
        deadline.setDate(today.getDate() + 10);
        const goal = goalService.createGoal({ 
            title: 'Goal with deadline', 
            motivation: 3, 
            urgency: 4,
            deadline: deadline
        }, 3);
        
        // Update deadline to null
        goalService.updateGoal(goal.id, { deadline: null }, 3);
        
        expect(goal.deadline).toBeNull();
    });

    it('should not reactivate when deleting a paused goal', () => {
        const goal1 = goalService.createGoal({ title: 'Goal 1', motivation: 5, urgency: 5 }, 1);
        const goal2 = goalService.createGoal({ title: 'Goal 2', motivation: 3, urgency: 3 }, 1);
        
        // goal1 should be active, goal2 paused
        expect(goal1.status).toBe('active');
        expect(goal2.status).toBe('inactive');
        
        // Delete paused goal2 - should not trigger reactivation
        const saveGoalsSpy = jest.spyOn(goalService, 'saveGoals');
        goalService.deleteGoal(goal2.id, 1);
        
        // Should call saveGoals, not autoActivateGoalsByPriority
        expect(saveGoalsSpy).toHaveBeenCalled();
        expect(goal1.status).toBe('active');
    });

    it('should calculate priority with deadline more than 30 days away', () => {
        const today = new Date();
        const deadline = new Date(today);
        deadline.setDate(today.getDate() + 35); // 35 days from now
        
        const goal = {
            motivation: 3,
            urgency: 5,
            deadline: deadline
        };
        
        // priority = 3 + (5 * 10) = 53
        // No bonus for deadlines > 30 days
        expect(goalService.calculatePriority(goal)).toBe(53);
    });

    it('should handle goals with same priority in autoActivateGoalsByPriority', () => {
        const today = new Date();
        const goal1 = goalService.createGoal({ 
            title: 'Goal 1', 
            motivation: 3, 
            urgency: 3,
            createdAt: new Date(today.getTime() - 1000) // Older
        }, 1);
        const goal2 = goalService.createGoal({ 
            title: 'Goal 2', 
            motivation: 3, 
            urgency: 3,
            createdAt: new Date(today.getTime()) // Newer
        }, 1);
        
        // Both have same priority, older should be preferred
        goalService.autoActivateGoalsByPriority(1);
        
        // The older goal should be active
        expect(goal1.status).toBe('active');
        expect(goal2.status).toBe('inactive');
    });

    it('should record history entries when creating and updating goals', () => {
        const goal = goalService.createGoal({ title: 'History Test', motivation: 2, urgency: 2 }, 3);
        const creationEntry = goal.history.find(entry => entry.event === 'created');
        expect(creationEntry).toBeDefined();
        expect(creationEntry.changes.some(change => change.field === 'title' && change.to === 'History Test')).toBe(true);

        goalService.updateGoal(goal.id, { title: 'Updated title' }, 3);
        const updateEntry = goal.history.find(entry => entry.event === 'updated' && entry.changes.some(change => change.field === 'title' && change.to === 'Updated title'));
        expect(updateEntry).toBeDefined();
    });

    it('should record status change history when auto activating goals', () => {
        const goal1 = goalService.createGoal({ title: 'Priority 1', motivation: 5, urgency: 5 }, 1);
        const goal2 = goalService.createGoal({ title: 'Priority 2', motivation: 1, urgency: 1 }, 1);

        // Increase goal2 priority to trigger reactivation
        goalService.updateGoal(goal2.id, { motivation: 10, urgency: 10 }, 1);

        const goal1StatusEntries = goal1.history.filter(entry => entry.event === 'status-change');
        const goal2StatusEntries = goal2.history.filter(entry => entry.event === 'status-change');

        expect(goal1StatusEntries.length).toBeGreaterThan(0);
        expect(goal1StatusEntries[goal1StatusEntries.length - 1].changes[0].field).toBe('status');
        expect(goal2StatusEntries.length).toBeGreaterThan(0);
    });

    it('should revert goal to previous history entry and create rollback entry', () => {
        const goal = goalService.createGoal({ title: 'Rollback Goal', motivation: 2, urgency: 2 }, 3);
        goalService.updateGoal(goal.id, { title: 'First title' }, 3);
        const targetEntry = goal.history.find(entry => entry.event === 'updated' && entry.changes.some(change => change.field === 'title'));
        expect(targetEntry).toBeDefined();

        goalService.updateGoal(goal.id, { title: 'Second title' }, 3);
        expect(goal.title).toBe('Second title');

        const revertedGoal = goalService.revertGoalToHistoryEntry(goal.id, targetEntry.id, 3);
        expect(revertedGoal).not.toBeNull();
        expect(revertedGoal.title).toBe('Rollback Goal');

        const rollbackEntry = goal.history.find(entry => entry.event === 'rollback' && entry.meta?.revertedEntryId === targetEntry.id);
        expect(rollbackEntry).toBeDefined();
    });

    it('should call saveGoals when revert does not change goal state', () => {
        const saveSpy = jest.spyOn(goalService, 'saveGoals');
        const goal = goalService.createGoal({ title: 'No Change Revert', motivation: 2, urgency: 2 }, 3);
        goalService.updateGoal(goal.id, { title: 'Interim value' }, 3);
        const historyEntry = goal.history.find(entry => entry.event === 'updated' && entry.changes.some(change => change.field === 'title'));
        expect(historyEntry).toBeDefined();

        goalService.updateGoal(goal.id, { title: 'No Change Revert' }, 3);

        const result = goalService.revertGoalToHistoryEntry(goal.id, historyEntry.id, 3);
        expect(result).not.toBeNull();
        expect(result.title).toBe('No Change Revert');
        expect(saveSpy).toHaveBeenCalled();
        saveSpy.mockRestore();
    });

    it('should return null when reverting with invalid history id or missing before snapshot', () => {
        const goal = goalService.createGoal({ title: 'Invalid Revert', motivation: 2, urgency: 2 }, 3);
        expect(goalService.revertGoalToHistoryEntry(goal.id, 'does-not-exist', 3)).toBeNull();

        const historyEntry = goal.history.find(entry => entry.event === 'created');
        expect(historyEntry).toBeDefined();
        expect(goalService.revertGoalToHistoryEntry(goal.id, historyEntry.id, 3)).toBeNull();
    });

    it('should treat NaN values as equal when diffing snapshots', () => {
        const changes = goalService.diffSnapshots({ motivation: NaN }, { motivation: NaN });
        expect(changes).toEqual([]);
    });

    it('should not record history when change list is empty', () => {
        const goal = goalService.createGoal({ title: 'No History', motivation: 1, urgency: 1 }, 3);
        const initialLength = goal.history.length;
        goalService.recordHistory(goal, {
            event: 'updated',
            timestamp: new Date(),
            before: {},
            after: {},
            changes: []
        });
        expect(goal.history.length).toBe(initialLength);
    });

    it('should initialize history array when appending history to goal without history', () => {
        const goal = {};
        const entry = {
            id: 'init-entry',
            event: 'updated',
            timestamp: new Date(),
            changes: [{ field: 'title', from: null, to: 'Value' }]
        };
        goalService.appendHistoryEntry(goal, entry);
        expect(Array.isArray(goal.history)).toBe(true);
        expect(goal.history).toHaveLength(1);
    });

    it('should enforce the history limit when appending entries', () => {
        const goal = { history: [] };
        const baseEntry = {
            event: 'updated',
            timestamp: new Date(),
            changes: [{ field: 'title', from: 'A', to: 'B' }]
        };
        for (let index = 0; index < 55; index += 1) {
            goalService.appendHistoryEntry(goal, { ...baseEntry, id: `entry-${index}` });
        }
        expect(goal.history.length).toBe(50);
        expect(goal.history[0].id).toBe('entry-5');
    });

    it('should update goal properties from snapshot via applySnapshotToGoal', () => {
        const goal = new (require('../src/domain/models/goal').default)({ title: 'Snapshot Goal', motivation: 2, urgency: 3, status: 'active' });
        const snapshot = {
            title: 'Snapshot Updated',
            motivation: null,
            urgency: 4,
            deadline: '2025-12-31T00:00:00.000Z',
            status: 'paused'
        };
        goalService.applySnapshotToGoal(goal, snapshot);
        expect(goal.title).toBe('Snapshot Updated');
        expect(Number.isNaN(goal.motivation)).toBe(true);
        expect(goal.urgency).toBe(4);
        expect(goal.deadline).toBeInstanceOf(Date);
        expect(goal.status).toBe('paused');
    });

    it('should return goal unchanged when update data does not modify fields', () => {
        const goal = goalService.createGoal({ title: 'No Update', motivation: 2, urgency: 2 }, 3);
        const historyLength = goal.history.length;
        const result = goalService.updateGoal(goal.id, { title: 'No Update' }, 3);
        expect(result).toBe(goal);
        expect(goal.history.length).toBe(historyLength);
    });

    it('should return null when goal for rollback is missing', () => {
        expect(goalService.revertGoalToHistoryEntry('unknown-goal', 'entry', 3)).toBeNull();
    });

    it('setGoalStatus should return null when goal is missing', () => {
        const saveSpy = jest.spyOn(goalService, 'saveGoals');
        const result = goalService.setGoalStatus('missing', 'abandoned', 3);
        expect(result).toBeNull();
        expect(saveSpy).not.toHaveBeenCalled();
        saveSpy.mockRestore();
    });

    it('setGoalStatus should skip saving when status stays the same', () => {
        const goal = goalService.createGoal({ title: 'Same Status', motivation: 3, urgency: 3 }, 2);
        const saveSpy = jest.spyOn(goalService, 'saveGoals');

        const result = goalService.setGoalStatus(goal.id, goal.status, 2);

        expect(result).toBe(goal);
        expect(saveSpy).not.toHaveBeenCalled();
        saveSpy.mockRestore();
    });

    it('setGoalStatus should abandon active goals and trigger reactivation', () => {
        const first = goalService.createGoal({ title: 'Primary', motivation: 5, urgency: 5 }, 1);
        const second = goalService.createGoal({ title: 'Secondary', motivation: 3, urgency: 3 }, 1);
        const autoSpy = jest.spyOn(goalService, 'autoActivateGoalsByPriority');

        expect(first.status).toBe('active');
        expect(second.status).toBe('inactive');

        goalService.setGoalStatus(first.id, 'abandoned', 1);

        expect(first.status).toBe('abandoned');
        expect(second.status).toBe('active');
        expect(autoSpy).toHaveBeenCalledWith(1);
        autoSpy.mockRestore();
    });

    it('setGoalStatus should trigger auto activation when activating a paused goal', () => {
        const first = goalService.createGoal({ title: 'High Priority', motivation: 5, urgency: 5 }, 1);
        const second = goalService.createGoal({ title: 'Activate Me', motivation: 3, urgency: 3 }, 1);
        const autoSpy = jest.spyOn(goalService, 'autoActivateGoalsByPriority');

        expect(first.status).toBe('active');
        expect(second.status).toBe('inactive');

        goalService.setGoalStatus(second.id, 'active', 1);

        expect(autoSpy).toHaveBeenCalledWith(1);
        expect(goalService.goals.some(goal => goal.status === 'active')).toBe(true);
        autoSpy.mockRestore();
    });

    it('autoActivateGoalsByPriority should ignore completed and abandoned goals', () => {
        const candidate = goalService.createGoal({ title: 'Candidate', motivation: 4, urgency: 4 }, 2);
        const abandonedGoal = goalService.createGoal({ title: 'Abandoned', motivation: 5, urgency: 5 }, 2);
        const completedGoal = goalService.createGoal({ title: 'Completed', motivation: 5, urgency: 5 }, 2);

        goalService.setGoalStatus(abandonedGoal.id, 'abandoned', 2);
        goalService.setGoalStatus(completedGoal.id, 'completed', 2);

        goalService.autoActivateGoalsByPriority(2);

        expect(abandonedGoal.status).toBe('abandoned');
        expect(completedGoal.status).toBe('completed');
        expect(candidate.status).toBe('active');
    });

    it('onAfterSave should ignore non-function listeners', () => {
        goalService.onAfterSave('not a function');
        goalService.onAfterSave(null);
        goalService.onAfterSave(undefined);
        goalService.onAfterSave({});

        expect(goalService._listeners.afterSave.length).toBe(0);
    });

    it('_notifyAfterSave should handle listener errors gracefully', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const goodListener = jest.fn();
        const badListener = jest.fn(() => {
            throw new Error('Listener error');
        });
        const anotherGoodListener = jest.fn();

        goalService.onAfterSave(goodListener);
        goalService.onAfterSave(badListener);
        goalService.onAfterSave(anotherGoodListener);

        goalService.saveGoals();

        expect(goodListener).toHaveBeenCalled();
        expect(badListener).toHaveBeenCalled();
        expect(anotherGoodListener).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith('GoalService afterSave listener error', expect.any(Error));

        consoleErrorSpy.mockRestore();
    });

    it('loadGoals should handle JSON parse errors', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        localStorage.getItem.mockReturnValue('invalid json');

        goalService.loadGoals();

        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load goals from storage', expect.any(Error));
        expect(goalService.goals.length).toBe(0);

        consoleErrorSpy.mockRestore();
    });

    it('loadGoals should handle invalid parsed structure', () => {
        localStorage.getItem.mockReturnValue('{"invalid": "structure"}');

        goalService.loadGoals();

        expect(goalService.goals.length).toBe(0);
    });

    it('loadGoals should handle parsed data with version', () => {
        const savedGoals = {
            version: '1.0.0',
            goals: [
                { id: '1', title: 'Goal 1', motivation: 3, urgency: 4, status: 'active', createdAt: '2025-01-01T00:00:00.000Z', lastUpdated: '2025-01-01T00:00:00.000Z' }
            ]
        };
        localStorage.getItem.mockReturnValue(JSON.stringify(savedGoals));
        const saveSpy = jest.spyOn(goalService, 'saveGoals');

        goalService.loadGoals();

        expect(goalService.goals.length).toBe(1);
        expect(saveSpy).not.toHaveBeenCalled(); // Should not save if version exists

        saveSpy.mockRestore();
    });

    it('applySnapshotToGoal should return early when snapshot is null', () => {
        const goal = goalService.createGoal({ title: 'Test', motivation: 2, urgency: 2 }, 3);
        const originalTitle = goal.title;

        goalService.applySnapshotToGoal(goal, null);

        expect(goal.title).toBe(originalTitle);
    });

    it('applySnapshotToGoal should return early when snapshot is undefined', () => {
        const goal = goalService.createGoal({ title: 'Test', motivation: 2, urgency: 2 }, 3);
        const originalTitle = goal.title;

        goalService.applySnapshotToGoal(goal, undefined);

        expect(goal.title).toBe(originalTitle);
    });

    it('handleStatusTransition should return early when status is the same', () => {
        const goal = goalService.createGoal({ title: 'Test', motivation: 2, urgency: 2 }, 3);
        const initialHistoryLength = goal.history.length;

        goalService.handleStatusTransition(goal, goal.status);

        expect(goal.history.length).toBe(initialHistoryLength);
    });

    it('setGoalStatus should use goals.length when maxActiveGoals is invalid', () => {
        const goal1 = goalService.createGoal({ title: 'Goal 1', motivation: 5, urgency: 5 }, 1);
        const goal2 = goalService.createGoal({ title: 'Goal 2', motivation: 3, urgency: 3 }, 1);
        const autoSpy = jest.spyOn(goalService, 'autoActivateGoalsByPriority');

        goalService.setGoalStatus(goal1.id, 'paused', NaN);
        expect(autoSpy).toHaveBeenCalledWith(2); // Should use goals.length

        goalService.setGoalStatus(goal1.id, 'active', 0);
        expect(autoSpy).toHaveBeenCalledWith(2); // Should use goals.length

        goalService.setGoalStatus(goal1.id, 'paused', -1);
        expect(autoSpy).toHaveBeenCalledWith(2); // Should use goals.length

        autoSpy.mockRestore();
    });

    it('setGoalStatus should save when status change does not affect active status', () => {
        const goal = goalService.createGoal({ title: 'Test', motivation: 2, urgency: 2 }, 3);
        goal.status = 'paused';
        const saveSpy = jest.spyOn(goalService, 'saveGoals');

        goalService.setGoalStatus(goal.id, 'completed', 3);

        expect(saveSpy).toHaveBeenCalled();
        saveSpy.mockRestore();
    });

    it('updateGoal should not change priority when motivation/urgency/deadline unchanged', () => {
        const goal = goalService.createGoal({ title: 'Test', motivation: 3, urgency: 4 }, 1);
        const autoSpy = jest.spyOn(goalService, 'autoActivateGoalsByPriority');
        const saveSpy = jest.spyOn(goalService, 'saveGoals');

        // When motivation is unchanged, updates object will be empty, so function returns early
        // without calling saveGoals. Let's test with a field that does change.
        goalService.updateGoal(goal.id, { motivation: 3, title: 'New title' }, 1);
        expect(autoSpy).not.toHaveBeenCalled();
        expect(saveSpy).toHaveBeenCalled();

        autoSpy.mockClear();
        saveSpy.mockClear();

        goalService.updateGoal(goal.id, { urgency: 4, title: 'Another title' }, 1);
        expect(autoSpy).not.toHaveBeenCalled();
        expect(saveSpy).toHaveBeenCalled();

        autoSpy.mockClear();
        saveSpy.mockClear();

        const deadline = new Date('2025-12-31');
        goal.deadline = deadline;
        goalService.updateGoal(goal.id, { deadline: deadline.toISOString(), title: 'Yet another title' }, 1);
        expect(autoSpy).not.toHaveBeenCalled();
        expect(saveSpy).toHaveBeenCalled();

        autoSpy.mockRestore();
        saveSpy.mockRestore();
    });

    it('updateGoal should handle undefined steps and resources', () => {
        const goal = goalService.createGoal({ title: 'Test', motivation: 2, urgency: 2 }, 3);
        goal.steps = ['step1'];
        goal.resources = ['res1'];

        goalService.updateGoal(goal.id, { steps: undefined, resources: undefined }, 3);

        expect(goal.steps).toEqual(['step1']); // Should not change
        expect(goal.resources).toEqual(['res1']); // Should not change
    });

    it('updateGoal should handle empty steps and resources arrays', () => {
        const goal = goalService.createGoal({ title: 'Test', motivation: 2, urgency: 2 }, 3);
        goal.steps = ['step1'];
        goal.resources = ['res1'];

        goalService.updateGoal(goal.id, { steps: [], resources: [] }, 3);

        expect(goal.steps).toEqual([]);
        expect(goal.resources).toEqual([]);
    });

    it('updateGoal should handle non-array steps and resources', () => {
        const goal = goalService.createGoal({ title: 'Test', motivation: 2, urgency: 2 }, 3);

        goalService.updateGoal(goal.id, { steps: 'not an array', resources: { not: 'array' } }, 3);

        expect(goal.steps).toEqual([]);
        expect(goal.resources).toEqual([]);
    });
});