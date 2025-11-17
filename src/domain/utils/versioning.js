const SEMVER_REGEX = /^(\d+)\.(\d+)\.(\d+)$/;

export const GOAL_FILE_VERSION = '1.0.0';

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

export function isNewerVersion(candidate, reference = GOAL_FILE_VERSION) {
    if (!isValidVersion(candidate)) {
        return false;
    }
    return compareVersions(candidate, reference) > 0;
}

