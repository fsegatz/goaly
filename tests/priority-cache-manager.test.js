
import { PriorityCacheManager } from '../src/domain/priority-cache-manager';
import Goal from '../src/domain/models/goal';

describe('PriorityCacheManager', () => {
    let priorityCacheManager;
    let mockGoalService;

    beforeEach(() => {
        mockGoalService = {
            goals: [],
            calculatePriority: jest.fn()
        };
        priorityCacheManager = new PriorityCacheManager(mockGoalService);
    });

    test('should initialize with dirty state', () => {
        expect(priorityCacheManager.isDirty).toBe(true);
        expect(priorityCacheManager.cache.size).toBe(0);
    });

    test('getPriority should calculate and cache priority', () => {
        const goal = new Goal({ id: '1', title: 'Test Goal' });
        mockGoalService.goals = [goal];
        mockGoalService.calculatePriority.mockReturnValue(10);

        const priority = priorityCacheManager.getPriority('1');

        expect(priority).toBe(10);
        expect(mockGoalService.calculatePriority).toHaveBeenCalledWith(goal);
        expect(priorityCacheManager.cache.get('1')).toBe(10);
        expect(priorityCacheManager.isDirty).toBe(false);
    });

    test('getPriority should use cached value if not dirty', () => {
        const goal = new Goal({ id: '1', title: 'Test Goal' });
        mockGoalService.goals = [goal];
        mockGoalService.calculatePriority.mockReturnValue(10);

        // First call to populate cache
        priorityCacheManager.getPriority('1');

        // Clear mock to ensure second call doesn't re-calculate
        mockGoalService.calculatePriority.mockClear();

        const priority = priorityCacheManager.getPriority('1');

        expect(priority).toBe(10);
        expect(mockGoalService.calculatePriority).not.toHaveBeenCalled();
    });

    test('getPriority should return 0 for unknown goal', () => {
        const goal = new Goal({ id: '1', title: 'Test Goal' });
        mockGoalService.goals = [goal];
        mockGoalService.calculatePriority.mockReturnValue(10);

        const priority = priorityCacheManager.getPriority('unknown');

        expect(priority).toBe(0);
    });

    test('getAllPriorities should return all cached priorities', () => {
        const goal1 = new Goal({ id: '1', title: 'Goal 1' });
        const goal2 = new Goal({ id: '2', title: 'Goal 2' });
        mockGoalService.goals = [goal1, goal2];
        mockGoalService.calculatePriority.mockImplementation(goal => goal.id === '1' ? 10 : 20);

        const priorities = priorityCacheManager.getAllPriorities();

        expect(priorities.get('1')).toBe(10);
        expect(priorities.get('2')).toBe(20);
        expect(priorities.size).toBe(2);
    });

    test('invalidate should set isDirty to true', () => {
        priorityCacheManager.isDirty = false;
        priorityCacheManager.invalidate();
        expect(priorityCacheManager.isDirty).toBe(true);
    });

    test('refreshIfNeeded should do nothing if not dirty', () => {
        priorityCacheManager.isDirty = false;

        priorityCacheManager.refreshIfNeeded();

        expect(mockGoalService.calculatePriority).not.toHaveBeenCalled();
    });

    test('clear should clear cache and set dirty', () => {
        const goal = new Goal({ id: '1', title: 'Test Goal' });
        mockGoalService.goals = [goal];
        mockGoalService.calculatePriority.mockReturnValue(10);

        priorityCacheManager.getPriority('1'); // Populate

        expect(priorityCacheManager.cache.size).toBe(1);

        priorityCacheManager.clear();

        expect(priorityCacheManager.cache.size).toBe(0);
        expect(priorityCacheManager.isDirty).toBe(true);
    });
});
