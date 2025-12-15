const AnalyticsService = require('../src/domain/services/analytics-service').default;

describe('AnalyticsService', () => {
    let mockGoalService;
    let analyticsService;

    beforeEach(() => {
        mockGoalService = {
            goals: []
        };
        analyticsService = new AnalyticsService(mockGoalService);
    });

    describe('getStatusDistribution', () => {
        test('should return zero counts when no goals exist', () => {
            const distribution = analyticsService.getStatusDistribution();

            expect(distribution).toEqual({
                active: 0,
                inactive: 0,
                paused: 0,
                completed: 0,
                notCompleted: 0
            });
        });

        test('should count goals by status correctly', () => {
            mockGoalService.goals = [
                { id: '1', status: 'active' },
                { id: '2', status: 'active' },
                { id: '3', status: 'completed' },
                { id: '4', status: 'paused' },
                { id: '5', status: 'notCompleted' }
            ];

            const distribution = analyticsService.getStatusDistribution();

            expect(distribution).toEqual({
                active: 2,
                inactive: 0,
                paused: 1,
                completed: 1,
                notCompleted: 1
            });
        });

        test('should handle all status types', () => {
            mockGoalService.goals = [
                { id: '1', status: 'active' },
                { id: '2', status: 'inactive' },
                { id: '3', status: 'paused' },
                { id: '4', status: 'completed' },
                { id: '5', status: 'notCompleted' }
            ];

            const distribution = analyticsService.getStatusDistribution();

            expect(distribution.active).toBe(1);
            expect(distribution.inactive).toBe(1);
            expect(distribution.paused).toBe(1);
            expect(distribution.completed).toBe(1);
            expect(distribution.notCompleted).toBe(1);
        });
    });

    describe('getCompletionStats', () => {
        test('should return zero stats when no goals exist', () => {
            const stats = analyticsService.getCompletionStats();

            expect(stats).toEqual({
                completed: 0,
                notCompleted: 0,
                total: 0,
                completionRate: 0
            });
        });

        test('should calculate completion rate correctly', () => {
            mockGoalService.goals = [
                { id: '1', status: 'completed' },
                { id: '2', status: 'completed' },
                { id: '3', status: 'active' },
                { id: '4', status: 'notCompleted' }
            ];

            const stats = analyticsService.getCompletionStats();

            expect(stats.completed).toBe(2);
            expect(stats.notCompleted).toBe(1);
            expect(stats.total).toBe(4);
            // completionRate = completed / (completed + notCompleted) = 2/3 = 67%
            expect(stats.completionRate).toBe(67);
        });

        test('should return 100% completion rate when all goals are completed', () => {
            mockGoalService.goals = [
                { id: '1', status: 'completed' },
                { id: '2', status: 'completed' }
            ];

            const stats = analyticsService.getCompletionStats();

            expect(stats.completionRate).toBe(100);
        });

        test('should return 0% completion rate when no goals are completed', () => {
            mockGoalService.goals = [
                { id: '1', status: 'active' },
                { id: '2', status: 'paused' }
            ];

            const stats = analyticsService.getCompletionStats();

            expect(stats.completionRate).toBe(0);
        });
    });

    describe('getSummaryStats', () => {
        test('should return summary statistics with period', () => {
            mockGoalService.goals = [
                { id: '1', status: 'completed', createdAt: new Date('2024-01-15'), lastUpdated: new Date('2024-01-20') },
                { id: '2', status: 'active', createdAt: new Date('2024-02-10'), lastUpdated: new Date('2024-02-10') }
            ];

            const stats = analyticsService.getSummaryStats('month');

            expect(stats).toHaveProperty('totalGoals');
            expect(stats).toHaveProperty('completed');
            expect(stats).toHaveProperty('completionRate');
            expect(stats).toHaveProperty('avgPerPeriod');
            expect(stats).toHaveProperty('period');
            expect(stats.totalGoals).toBe(2);
            expect(stats.period).toBe('month');
        });

        test('should calculate average per period', () => {
            mockGoalService.goals = [
                { id: '1', status: 'active', createdAt: new Date('2024-01-15'), lastUpdated: new Date('2024-01-15') },
                { id: '2', status: 'active', createdAt: new Date('2024-02-20'), lastUpdated: new Date('2024-02-20') }
            ];

            const stats = analyticsService.getSummaryStats('month');

            expect(stats.avgPerPeriod).toBe(1);
        });
    });

    describe('getGoalsByPeriod', () => {
        test('should return empty object when no goals exist', () => {
            const result = analyticsService.getGoalsByPeriod('month');
            expect(Object.keys(result).length).toBe(0);
        });

        test('should group goals by month', () => {
            mockGoalService.goals = [
                { id: '1', status: 'active', createdAt: new Date('2024-01-15'), lastUpdated: new Date('2024-01-15') },
                { id: '2', status: 'completed', createdAt: new Date('2024-01-20'), lastUpdated: new Date('2024-01-25') },
                { id: '3', status: 'active', createdAt: new Date('2024-02-10'), lastUpdated: new Date('2024-02-10') }
            ];

            const result = analyticsService.getGoalsByPeriod('month');

            expect(result).toHaveProperty('2024-01');
            expect(result).toHaveProperty('2024-02');
            expect(result['2024-01'].created.length).toBe(2);
            expect(result['2024-02'].created.length).toBe(1);
        });

        test('should track completed goals in correct period', () => {
            mockGoalService.goals = [
                { id: '1', status: 'completed', createdAt: new Date('2024-01-15'), lastUpdated: new Date('2024-02-20') }
            ];

            const result = analyticsService.getGoalsByPeriod('month');

            expect(result['2024-01'].created.length).toBe(1);
            expect(result['2024-02'].completed.length).toBe(1);
        });

        test('should group goals by year', () => {
            mockGoalService.goals = [
                { id: '1', status: 'active', createdAt: new Date('2023-06-15'), lastUpdated: new Date('2023-06-15') },
                { id: '2', status: 'active', createdAt: new Date('2024-03-10'), lastUpdated: new Date('2024-03-10') }
            ];

            const result = analyticsService.getGoalsByPeriod('year');

            expect(result).toHaveProperty('2023');
            expect(result).toHaveProperty('2024');
        });

        test('should group goals by week', () => {
            mockGoalService.goals = [
                { id: '1', status: 'active', createdAt: new Date('2024-01-08'), lastUpdated: new Date('2024-01-08') },
                { id: '2', status: 'active', createdAt: new Date('2024-01-15'), lastUpdated: new Date('2024-01-15') }
            ];

            const result = analyticsService.getGoalsByPeriod('week');

            const keys = Object.keys(result);
            expect(keys.length).toBeGreaterThanOrEqual(1);
            keys.forEach(key => {
                expect(key).toMatch(/^\d{4}-W\d{2}$/);
            });
        });
    });

    describe('_getWeekNumber', () => {
        test('should return correct week number', () => {
            const date = new Date('2024-01-15');
            const weekNumber = analyticsService._getWeekNumber(date);
            expect(weekNumber).toBeGreaterThan(0);
            expect(weekNumber).toBeLessThanOrEqual(53);
        });
    });

    describe('_parsePeriodKey', () => {
        test('should parse month key', () => {
            const date = analyticsService._parsePeriodKey('2024-03', 'month');
            expect(date.getFullYear()).toBe(2024);
            expect(date.getMonth()).toBe(2);
        });

        test('should parse year key', () => {
            const date = analyticsService._parsePeriodKey('2024', 'year');
            expect(date.getFullYear()).toBe(2024);
        });

        test('should parse week key', () => {
            const date = analyticsService._parsePeriodKey('2024-W02', 'week');
            expect(date.getFullYear()).toBe(2024);
        });

        test('should throw error for unknown period', () => {
            expect(() => {
                analyticsService._parsePeriodKey('invalid', 'unknownPeriod');
            }).toThrow('Unknown period type: unknownPeriod');
        });
    });

    describe('_incrementPeriod', () => {
        test('should increment month correctly', () => {
            const date = new Date('2024-01-15');
            const nextMonth = analyticsService._incrementPeriod(date, 'month');
            expect(nextMonth.getMonth()).toBe(1);
        });

        test('should increment year correctly', () => {
            const date = new Date('2024-06-15');
            const nextYear = analyticsService._incrementPeriod(date, 'year');
            expect(nextYear.getFullYear()).toBe(2025);
        });

        test('should increment week correctly', () => {
            const date = new Date('2024-01-15');
            const nextWeek = analyticsService._incrementPeriod(date, 'week');
            const diffDays = (nextWeek - date) / (1000 * 60 * 60 * 24);
            expect(diffDays).toBe(7);
        });
    });

    describe('edge cases', () => {
        test('should handle notCompleted goals in getGoalsByPeriod', () => {
            mockGoalService.goals = [
                { id: '1', status: 'notCompleted', createdAt: new Date('2024-01-15'), lastUpdated: new Date('2024-02-20') }
            ];

            const result = analyticsService.getGoalsByPeriod('month');

            expect(result['2024-01'].created.length).toBe(1);
            expect(result['2024-02'].notCompleted.length).toBe(1);
        });

        test('should handle unknown status in getStatusDistribution', () => {
            mockGoalService.goals = [
                { id: '1', status: 'unknownStatus' }
            ];

            const distribution = analyticsService.getStatusDistribution();

            expect(distribution.active).toBe(0);
            expect(distribution.completed).toBe(0);
        });

        test('should return default for unknown period in _getPeriodKey', () => {
            const date = new Date('2024-01-15');
            const key = analyticsService._getPeriodKey(date, 'unknownPeriod');
            expect(key).toBe('2024-01');
        });
    });
});