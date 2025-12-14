// tests/goal.test.js
const Goal = require('../src/domain/models/goal').default;

describe('Goal', () => {
    test('should create a Goal object with provided data', () => {
        const goalData = {
            id: '123',
            title: 'Test Goal',
            motivation: 5,
            urgency: 4,
            deadline: '2025-12-31',
            status: 'active',
            createdAt: '2024-01-01',
            lastUpdated: '2024-10-26',
            reviewDates: ['2024-10-26']
        };
        const goal = new Goal(goalData);

        expect(goal.id).toBe(goalData.id);
        expect(goal.title).toBe(goalData.title);
        expect(goal.motivation).toBe(goalData.motivation);
        expect(goal.urgency).toBe(goalData.urgency);
        expect(goal.deadline).toEqual(new Date(goalData.deadline + 'T00:00:00'));
        expect(goal.status).toBe(goalData.status);
        expect(goal.createdAt).toEqual(new Date(goalData.createdAt));
        expect(goal.lastUpdated).toEqual(new Date(goalData.lastUpdated));
        expect(goal.reviewDates).toEqual(goalData.reviewDates);
        expect(goal.history).toBeUndefined();
        expect(goal.steps).toEqual([]);
        expect(goal.resources).toEqual([]);
    });

    test('should create a Goal object with default values for missing data', () => {
        const goalData = {
            title: 'Default Goal'
        };
        const goal = new Goal(goalData);

        expect(typeof goal.id).toBe('string');
        expect(goal.title).toBe(goalData.title);
        expect(goal.motivation).toBeNaN(); // Since motivation is parsed as int, and not provided, it will be NaN
        expect(goal.urgency).toBeNaN(); // Same as motivation
        expect(goal.deadline).toBeNull();
        expect(goal.status).toBe('active');
        expect(goal.createdAt).toBeInstanceOf(Date);
        expect(goal.lastUpdated).toBeInstanceOf(Date);
        expect(goal.reviewDates).toEqual([]);
        expect(goal.history).toBeUndefined();
        expect(goal.steps).toEqual([]);
        expect(goal.resources).toEqual([]);
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


    test('should initialize steps and resources from goalData', () => {
        const goalData = {
            title: 'Steps and Resources Goal',
            steps: [
                { id: 'step1', text: 'Step 1', completed: false, order: 0 },
                { id: 'step2', text: 'Step 2', completed: true, order: 1 }
            ],
            resources: [
                { id: 'res1', text: 'Resource 1', type: 'contact' },
                { id: 'res2', text: 'Resource 2', type: 'general' }
            ]
        };
        const goal = new Goal(goalData);

        expect(goal.steps).toHaveLength(2);
        expect(goal.steps[0].id).toBe('step1');
        expect(goal.steps[0].text).toBe('Step 1');
        expect(goal.steps[0].completed).toBe(false);
        expect(goal.steps[0].order).toBe(0);
        expect(goal.steps[1].completed).toBe(true);

        expect(goal.resources).toHaveLength(2);
        expect(goal.resources[0].id).toBe('res1');
        expect(goal.resources[0].text).toBe('Resource 1');
        expect(goal.resources[0].type).toBe('contact');
        expect(goal.resources[1].type).toBe('general');
    });

    test('should generate IDs for steps and resources if not provided', () => {
        const goalData = {
            title: 'Auto ID Goal',
            steps: [
                { text: 'Step 1', completed: false, order: 0 }
            ],
            resources: [
                { text: 'Resource 1', type: 'general' }
            ]
        };
        const goal = new Goal(goalData);

        expect(goal.steps[0].id).toBeDefined();
        expect(typeof goal.steps[0].id).toBe('string');
        expect(goal.resources[0].id).toBeDefined();
        expect(typeof goal.resources[0].id).toBe('string');
    });

});
