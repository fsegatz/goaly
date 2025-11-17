import { GOAL_FILE_VERSION } from '../utils/versioning.js';

function deepClone(value) {
    return JSON.parse(JSON.stringify(value ?? null));
}

function serializeGoals(goals = []) {
    if (!Array.isArray(goals)) {
        return [];
    }
    return goals.map(goal => deepClone(goal));
}

export function prepareExportPayload(goals, settings) {
    return {
        version: GOAL_FILE_VERSION,
        goals: serializeGoals(goals),
        settings: deepClone(settings),
        exportDate: new Date().toISOString()
    };
}

export function prepareGoalsStoragePayload(goals) {
    return {
        version: GOAL_FILE_VERSION,
        goals: serializeGoals(goals)
    };
}

export function migratePayloadToCurrent(payload) {
    if (Array.isArray(payload)) {
        // Legacy array format - migrate each goal
        const migratedGoals = payload.map(goal => migrateGoalDescriptionToStep(goal));
        return {
            version: GOAL_FILE_VERSION,
            goals: serializeGoals(migratedGoals)
        };
    }

    const clonedPayload = deepClone(payload);
    const migrated = {
        ...clonedPayload,
        version: GOAL_FILE_VERSION
    };

    if (Array.isArray(clonedPayload.goals)) {
        // Migrate each goal: convert description to first step
        migrated.goals = clonedPayload.goals.map(goal => migrateGoalDescriptionToStep(goal));
        migrated.goals = serializeGoals(migrated.goals);
    } else if (!Array.isArray(migrated.goals)) {
        migrated.goals = [];
    }

    return migrated;
}

/**
 * Migrates a goal's description field to a step.
 * If the goal has a description, it becomes the first step.
 * The description field is removed from the goal.
 */
function migrateGoalDescriptionToStep(goal) {
    if (!goal || typeof goal !== 'object') {
        return goal;
    }

    const migrated = { ...goal };
    const description = migrated.description;

    // Remove description field
    delete migrated.description;

    // Convert description to first step if it exists and is not empty
    if (description && typeof description === 'string' && description.trim().length > 0) {
        const existingSteps = Array.isArray(migrated.steps) ? migrated.steps : [];
        
        // Create a step from the description
        const descriptionStep = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
            text: description.trim(),
            completed: false,
            order: 0
        };

        // Shift existing steps' order by 1
        const reorderedSteps = existingSteps.map(step => ({
            ...step,
            order: (step.order || 0) + 1
        }));

        // Insert description step as first step
        migrated.steps = [descriptionStep, ...reorderedSteps];
    } else if (!Array.isArray(migrated.steps)) {
        // Ensure steps array exists even if no description
        migrated.steps = [];
    }

    return migrated;
}

