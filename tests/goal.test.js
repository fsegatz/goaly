// tests/goal.test.js
const Goal = require('../src/domain/goal').default;

describe('Goal', () => {
    test('should create a Goal object with provided data', () => {
        const goalData = {
            id: '123',
            title: 'Test Goal',
            description: 'This is a test description',
            motivation: 5,
            urgency: 4,
            deadline: '2025-12-31',
            status: 'active',
            createdAt: '2024-01-01',
            lastUpdated: '2024-10-26',
            checkInDates: ['2024-10-26']
        };
        const goal = new Goal(goalData);

        expect(goal.id).toBe(goalData.id);
        expect(goal.title).toBe(goalData.title);
        expect(goal.description).toBe(goalData.description);
        expect(goal.motivation).toBe(goalData.motivation);
        expect(goal.urgency).toBe(goalData.urgency);
        expect(goal.deadline).toEqual(new Date(goalData.deadline));
        expect(goal.status).toBe(goalData.status);
        expect(goal.createdAt).toEqual(new Date(goalData.createdAt));
        expect(goal.lastUpdated).toEqual(new Date(goalData.lastUpdated));
        expect(goal.checkInDates).toEqual(goalData.checkInDates);
    });

    test('should create a Goal object with default values for missing data', () => {
        const goalData = {
            title: 'Default Goal'
        };
        const goal = new Goal(goalData);

        expect(typeof goal.id).toBe('string');
        expect(goal.title).toBe(goalData.title);
        expect(goal.description).toBe('');
        expect(goal.motivation).toBeNaN(); // Since motivation is parsed as int, and not provided, it will be NaN
        expect(goal.urgency).toBeNaN(); // Same as motivation
        expect(goal.deadline).toBeNull();
        expect(goal.status).toBe('active');
        expect(goal.createdAt).toBeInstanceOf(Date);
        expect(goal.lastUpdated).toBeInstanceOf(Date);
        expect(goal.checkInDates).toEqual([]);
    });

    test('should correctly parse motivation and urgency as integers', () => {
        const goalData = {
            title: 'Parsed Goal',
            motivation: '3',
            urgency: '2'
        };
        const goal = new Goal(goalData);

        expect(goal.motivation).toBe(3);
        expect(goal.urgency).toBe(2);
    });

    test('should handle empty string for motivation and urgency gracefully', () => {
        const goalData = {
            title: 'Empty String Goal',
            motivation: '',
            urgency: ''
        };
        const goal = new Goal(goalData);

        expect(goal.motivation).toBeNaN();
        expect(goal.urgency).toBeNaN();
    });
});
