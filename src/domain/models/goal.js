// src/domain/goal.js

/**
 * Parse a date string in local timezone to avoid off-by-one-day errors.
 * @param {string|Date|null} value - The date value to parse
 * @returns {Date|null}
 */
function parseLocalDate(value) {
    if (!value) {
        return null;
    }
    if (typeof value === 'string' && !value.includes('T')) {
        return new Date(value + 'T00:00:00');
    }
    return new Date(value);
}

/**
 * Parse a date value, with fallback to an alternative field (for migration compatibility).
 * @param {*} primary - Primary date value
 * @param {*} fallback - Fallback date value
 * @returns {Date|null}
 */
function parseDateWithFallback(primary, fallback) {
    if (primary) {
        return new Date(primary);
    }
    if (fallback) {
        return new Date(fallback);
    }
    return null;
}

/**
 * Parse review dates array, supporting legacy checkInDates field.
 * @param {*} reviewDates - Primary review dates array
 * @param {*} checkInDates - Legacy check-in dates array
 * @returns {Array}
 */
function parseReviewDates(reviewDates, checkInDates) {
    if (Array.isArray(reviewDates)) {
        return [...reviewDates];
    }
    if (Array.isArray(checkInDates)) {
        return [...checkInDates];
    }
    return [];
}

/**
 * Parse steps array with default values.
 * @param {Array|*} steps - Steps array from goal data
 * @returns {Array}
 */
function parseSteps(steps) {
    if (!Array.isArray(steps)) {
        return [];
    }
    return steps.map((step, index) => ({
        id: step.id || `${Date.now()}-${index}-${Math.random().toString(16).slice(2, 10)}`,
        text: step.text || '',
        completed: Boolean(step.completed),
        order: Number.isInteger(step.order) ? step.order : index
    }));
}

/**
 * Parse resources array with default values.
 * @param {Array|*} resources - Resources array from goal data
 * @returns {Array}
 */
function parseResources(resources) {
    if (!Array.isArray(resources)) {
        return [];
    }
    return resources.map((resource, index) => ({
        id: resource.id || `${Date.now()}-${index}-${Math.random().toString(16).slice(2, 10)}`,
        text: resource.text || '',
        type: resource.type || 'general'
    }));
}

/**
 * Parse recurrence period unit with validation.
 * @param {string|*} unit - Period unit value
 * @returns {string}
 */
function parseRecurPeriodUnit(unit) {
    const validUnits = ['days', 'weeks', 'months'];
    return validUnits.includes(unit) ? unit : 'days';
}

/**
 * Create a Goal object from goal data.
 * @param {Object} goalData - The goal data object
 * @returns {Object} A Goal object
 */
function createGoal(goalData) {
    return {
        id: goalData.id || (Date.now().toString() + Math.random().toString()),
        title: goalData.title,
        motivation: Number.parseInt(goalData.motivation),
        urgency: Number.parseInt(goalData.urgency),
        deadline: parseLocalDate(goalData.deadline),
        status: goalData.status || 'active',
        createdAt: goalData.createdAt ? new Date(goalData.createdAt) : new Date(),
        lastUpdated: goalData.lastUpdated ? new Date(goalData.lastUpdated) : new Date(),
        // Support both old checkIn* and new review* field names for migration compatibility
        reviewDates: parseReviewDates(goalData.reviewDates, goalData.checkInDates),
        lastReviewAt: parseDateWithFallback(goalData.lastReviewAt, goalData.lastCheckInAt),
        nextReviewAt: parseDateWithFallback(goalData.nextReviewAt, goalData.nextCheckInAt),
        reviewIntervalIndex: Number.isInteger(goalData.reviewIntervalIndex)
            ? goalData.reviewIntervalIndex
            : null,
        steps: parseSteps(goalData.steps),
        resources: parseResources(goalData.resources),
        // Pause metadata: pauseUntil (date) or pauseUntilGoalId (goal ID that must be completed)
        pauseUntil: parseLocalDate(goalData.pauseUntil),
        pauseUntilGoalId: goalData.pauseUntilGoalId || null,
        // Track if goal was force-activated by user (not priority-based)
        forceActivated: Boolean(goalData.forceActivated),
        // Recurring goal metadata
        isRecurring: Boolean(goalData.isRecurring),
        recurCount: Number.isInteger(goalData.recurCount) ? goalData.recurCount : 0,
        completionCount: Number.isInteger(goalData.completionCount) ? goalData.completionCount : 0,
        notCompletedCount: Number.isInteger(goalData.notCompletedCount) ? goalData.notCompletedCount : 0,
        // Recurrence period (e.g., 7 days, 2 weeks)
        recurPeriod: Number.isInteger(goalData.recurPeriod) && goalData.recurPeriod > 0 ? goalData.recurPeriod : 7,
        recurPeriodUnit: parseRecurPeriodUnit(goalData.recurPeriodUnit)
    };
}

export default createGoal;
