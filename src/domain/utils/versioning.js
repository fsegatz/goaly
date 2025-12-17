// src/domain/utils/versioning.js

/**
 * @module Versioning
 * @description Utilities for semantic version comparisons and validation.
 */

const SEMVER_REGEX = /^(\d+)\.(\d+)\.(\d+)$/;

/** @constant {string} GOAL_FILE_VERSION - Current application data version */
export const GOAL_FILE_VERSION = '1.2.0';

/**
 * Check if a version string is valid semantic versioning.
 * @param {string} version - Version string to check (e.g. "1.0.0")
 * @returns {boolean} True if valid
 */
export function isValidVersion(version) {
    if (typeof version !== 'string') {
        return false;
    }
    return SEMVER_REGEX.test(version.trim());
}

function parseVersion(version) {
    if (!isValidVersion(version)) {
        return null;
    }
    const [, major, minor, patch] = version.match(SEMVER_REGEX);
    return {
        major: Number.parseInt(major, 10),
        minor: Number.parseInt(minor, 10),
        patch: Number.parseInt(patch, 10)
    };
}

/**
 * Compare two semantic version strings.
 * @param {string} a - First version
 * @param {string} b - Second version
 * @returns {number} 1 if a > b, -1 if a < b, 0 if equal
 * @throws {Error} If invalid version format
 */
export function compareVersions(a, b) {
    const parsedA = parseVersion(a);
    const parsedB = parseVersion(b);

    if (!parsedA || !parsedB) {
        throw new Error('Invalid semantic version provided.');
    }

    if (parsedA.major !== parsedB.major) {
        return parsedA.major > parsedB.major ? 1 : -1;
    }
    if (parsedA.minor !== parsedB.minor) {
        return parsedA.minor > parsedB.minor ? 1 : -1;
    }
    if (parsedA.patch !== parsedB.patch) {
        return parsedA.patch > parsedB.patch ? 1 : -1;
    }
    return 0;
}

/**
 * Check if a candidate version is older than reference.
 * @param {string} candidate - Version to check
 * @param {string} [reference] - Reference version (defaults to current app version)
 * @returns {boolean} True if candidate is older
 */
export function isOlderVersion(candidate, reference = GOAL_FILE_VERSION) {
    if (!isValidVersion(candidate)) {
        return true;
    }
    return compareVersions(candidate, reference) < 0;
}

export function isSameVersion(candidate, reference = GOAL_FILE_VERSION) {
    if (!isValidVersion(candidate)) {
        return false;
    }
    return compareVersions(candidate, reference) === 0;
}

/**
 * Check if a candidate version is newer than reference.
 * @param {string} candidate - Version to check
 * @param {string} [reference] - Reference version (defaults to current app version)
 * @returns {boolean} True if candidate is newer
 */
export function isNewerVersion(candidate, reference = GOAL_FILE_VERSION) {
    if (!isValidVersion(candidate)) {
        return false;
    }
    return compareVersions(candidate, reference) > 0;
}

