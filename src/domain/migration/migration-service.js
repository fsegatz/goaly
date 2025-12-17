// src/domain/migration/migration-service.js

/**
 * @module MigrationService
 * @description Core logic for data migration, serialization, and version updates.
 * Handles deep cloning, Date serialization, and schema transformation rules.
 */

import { GOAL_FILE_VERSION } from '../utils/versioning.js';

/**
 * Checks if a value is a Date object (works across realms)
 * @param {*} value - The value to check
 * @returns {boolean} - True if the value is a Date object
 */
function isDate(value) {
    return Object.prototype.toString.call(value) === '[object Date]';
}

/**
 * Recursively converts Date objects to ISO strings within an object.
 * This is needed because structuredClone preserves Date objects,
 * but we need string serialization for storage compatibility.
 * @param {*} value - The value to process
 * @returns {*} - The value with all Date objects converted to ISO strings
 */
function serializeDates(value) {
    if (value === null || value === undefined) {
        return value;
    }

    if (isDate(value)) {
        return value.toISOString();
    }

    if (Array.isArray(value)) {
        return value.map(item => serializeDates(item));
    }

    if (typeof value === 'object') {
        const result = {};
        for (const key of Object.keys(value)) {
            result[key] = serializeDates(value[key]);
        }
        return result;
    }

    return value;
}

/**
 * Deep clones a value and serializes all Date objects to ISO strings.
 * Uses structuredClone for proper deep cloning when available,
 * otherwise serializeDates handles both cloning and serialization.
 * This ensures Date objects are converted to strings for storage compatibility.
 * @param {*} value - The value to clone
 * @returns {*} - A deep clone with Date objects serialized to strings
 */
function deepClone(value) {
    if (value === null || value === undefined) {
        return null;
    }

    // Use structuredClone if available for optimal cloning, then serialize dates
    if (typeof globalThis.structuredClone === 'function') {
        const cloned = globalThis.structuredClone(value);
        return serializeDates(cloned);
    }

    // Fallback: serializeDates creates new objects, effectively deep cloning
    // while also converting dates to strings
    return serializeDates(value);
}

function serializeGoals(goals = []) {
    if (!Array.isArray(goals)) {
        return [];
    }
    return goals.map(goal => deepClone(goal));
}

/**
 * Prepare payload for export (file download or sync).
 * @param {Array<Object>} goals - The goals to export
 * @param {Object} settings - Application settings
 * @returns {Object} Export payload with version and export date
 */
export function prepareExportPayload(goals, settings) {
    return {
        version: GOAL_FILE_VERSION,
        goals: serializeGoals(goals),
        settings: deepClone(settings),
        exportDate: new Date().toISOString()
    };
}

/**
 * Prepare payload for local storage (lightweight).
 * @param {Array<Object>} goals - The goals to store
 * @returns {Object} Storage payload with version
 */
export function prepareGoalsStoragePayload(goals) {
    return {
        version: GOAL_FILE_VERSION,
        goals: serializeGoals(goals)
    };
}

/**
 * Migrate any data payload to the current schema version.
 * Handles legacy array formats and older object schemas.
 * @param {Object|Array} payload - The raw data payload
 * @returns {Object} Migrated payload conforming to current schema
 */
export function migratePayloadToCurrent(payload) {
    if (Array.isArray(payload)) {
        // Legacy array format - migrate each goal
        const migratedGoals = payload.map((goal, index) => migrateGoalDescriptionToStep(goal, index));
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
        // Migrate each goal: convert description to first step and rename checkIn fields to review
        migrated.goals = clonedPayload.goals.map((goal, index) => {
            const goalWithSteps = migrateGoalDescriptionToStep(goal, index);
            return migrateCheckInToReview(goalWithSteps);
        });
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
 * @param {Object} goal - The goal object to migrate
 * @param {number} index - Optional index to include in step ID generation for uniqueness
 */
function migrateGoalDescriptionToStep(goal, index = 0) {
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
            id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2, 10)}`,
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

/**
 * Migrates checkIn field names to review field names.
 * Renames:
 * - checkInDates → reviewDates
 * - lastCheckInAt → lastReviewAt
 * - nextCheckInAt → nextReviewAt
 * @param {Object} goal - The goal object to migrate
 */
function migrateCheckInToReview(goal) {
    if (!goal || typeof goal !== 'object') {
        return goal;
    }

    const migrated = { ...goal };

    // Rename checkInDates to reviewDates
    if ('checkInDates' in migrated) {
        migrated.reviewDates = migrated.checkInDates;
        delete migrated.checkInDates;
    }

    // Rename lastCheckInAt to lastReviewAt
    if ('lastCheckInAt' in migrated) {
        migrated.lastReviewAt = migrated.lastCheckInAt;
        delete migrated.lastCheckInAt;
    }

    // Rename nextCheckInAt to nextReviewAt
    if ('nextCheckInAt' in migrated) {
        migrated.nextReviewAt = migrated.nextCheckInAt;
        delete migrated.nextReviewAt;
    }

    return migrated;
}

