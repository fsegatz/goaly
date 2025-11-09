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

    it('should not create a new active goal if the limit is reached', () => {
        goalService.createGoal({ title: 'Active Goal 1', motivation: 3, urgency: 4, status: 'active' }, 1);
        
        expect(() => {
            goalService.createGoal({ title: 'Active Goal 2', motivation: 3, urgency: 4, status: 'active' }, 1);
        }).toThrow('Maximale Anzahl aktiver Ziele erreicht (1). Bitte ein anderes Ziel pausieren oder das Limit erhöhen.');
    });

    it('should update a goal', () => {
        const goal = goalService.createGoal({ title: 'Initial Title', motivation: 1, urgency: 1 }, 3);
        const updatedGoal = goalService.updateGoal(goal.id, { title: 'Updated Title' }, 3);
        expect(updatedGoal.title).toBe('Updated Title');
        expect(goalService.goals[0].title).toBe('Updated Title');
        expect(localStorage.setItem).toHaveBeenCalledTimes(2);
    });

    it('should not activate a goal if the limit is reached', () => {
        goalService.createGoal({ title: 'Active Goal', motivation: 3, urgency: 4, status: 'active' }, 1);
        const pausedGoal = goalService.createGoal({ title: 'Paused Goal', motivation: 3, urgency: 4, status: 'paused' }, 2);

        expect(() => {
            goalService.updateGoal(pausedGoal.id, { status: 'active' }, 1);
        }).toThrow('Maximale Anzahl aktiver Ziele erreicht (1). Bitte ein anderes Ziel pausieren oder das Limit erhöhen.');
    });

    it('should delete a goal', () => {
        const goal = goalService.createGoal({ title: 'To be deleted', motivation: 1, urgency: 1 }, 3);
        goalService.deleteGoal(goal.id);
        expect(goalService.goals.length).toBe(0);
        expect(localStorage.setItem).toHaveBeenCalledTimes(2);
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
        // bonus = 0
        // total = 53
        expect(goalService.calculatePriority(goal)).toBe(53);
    });

    it('should return active goals sorted by priority', () => {
        const goal1 = goalService.createGoal({ id: '1', title: 'Goal 1', motivation: 5, urgency: 5, status: 'active' }, 3); // Priority 55
        const goal2 = goalService.createGoal({ id: '2', title: 'Goal 2', motivation: 1, urgency: 1, status: 'active' }, 3); // Priority 11
        const goal3 = goalService.createGoal({ id: '3', title: 'Goal 3', motivation: 3, urgency: 3, status: 'paused' }, 3); // Paused
        const goal4 = goalService.createGoal({ id: '4', title: 'Goal 4', motivation: 4, urgency: 4, status: 'active' }, 3); // Priority 44

        const activeGoals = goalService.getActiveGoals();
        expect(activeGoals.length).toBe(3);
        expect(activeGoals[0].title).toBe('Goal 1'); // Highest priority
        expect(activeGoals[1].title).toBe('Goal 4');
        expect(activeGoals[2].title).toBe('Goal 2'); // Lowest priority
    });

    it('should return an empty array if no active goals', () => {
        goalService.createGoal({ title: 'Goal 1', motivation: 1, urgency: 1, status: 'paused' }, 3);
        goalService.createGoal({ title: 'Goal 2', motivation: 1, urgency: 1, status: 'completed' }, 3);

        const activeGoals = goalService.getActiveGoals();
        expect(activeGoals.length).toBe(0);
    });
});