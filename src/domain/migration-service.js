import { GOAL_FILE_VERSION } from './versioning.js';

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
        return {
            version: GOAL_FILE_VERSION,
            goals: serializeGoals(payload)
        };
    }

    const clonedPayload = deepClone(payload);
    const migrated = {
        ...clonedPayload,
        version: GOAL_FILE_VERSION
    };

    if (Array.isArray(clonedPayload.goals)) {
        migrated.goals = serializeGoals(clonedPayload.goals);
    } else if (!Array.isArray(migrated.goals)) {
        migrated.goals = [];
    }

    return migrated;
}

