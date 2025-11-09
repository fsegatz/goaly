// tests/goal-service.test.js

const GoalService = require('../src/domain/goal-service');

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
});