// tests/goal-service.test.js

const GoalService = require('../src/domain/goal-service').default;

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
        expect(goal3.status).toBe('paused');
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
        expect(goal2.status).toBe('paused');
        
        // Increase goal2's priority
        goalService.updateGoal(goal2.id, { motivation: 10, urgency: 10 }, 1);
        
        // Now goal2 should be active (higher priority)
        expect(goal2.status).toBe('active');
        expect(goal1.status).toBe('paused');
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
        expect(goal2.status).toBe('paused');
        expect(goal3.status).toBe('paused');
        
        // Delete goal1
        goalService.deleteGoal(goal1.id, 1);
        
        // goal2 should now be active
        expect(goal2.status).toBe('active');
        expect(goal3.status).toBe('paused');
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
        expect(goal1.status).toBe('paused');
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
        const goal1 = new (require('../src/domain/goal').default)({ 
            id: '1', title: 'Goal 1', motivation: 1, urgency: 1, status: 'active' 
        });
        const goal2 = new (require('../src/domain/goal').default)({ 
            id: '2', title: 'Goal 2', motivation: 5, urgency: 5, status: 'paused' 
        });
        goalService.goals = [goal1, goal2];
        
        // Migrate - should activate goal2 (higher priority) and pause goal1
        goalService.migrateGoalsToAutoActivation(1);
        
        expect(goal2.status).toBe('active');
        expect(goal1.status).toBe('paused');
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
        expect(goal2.status).toBe('paused');
        
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
        expect(goal2.status).toBe('paused');
    });
});