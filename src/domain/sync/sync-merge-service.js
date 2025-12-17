// src/domain/sync/sync-merge-service.js

/**
 * @module SyncMergeService
 * @description Logic for merging goal data from different sources (local, remote, base).
 * Implements a three-way merge strategy to resolve conflicts and preserve data integrity.
 */

import Goal from '../models/goal.js';
import { migratePayloadToCurrent } from '../migration/migration-service.js';
import { GOAL_FILE_VERSION } from '../utils/versioning.js';

function parseDate(value) {
	if (!value) return null;
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? null : d;
}

function indexById(array) {
	const map = new Map();
	if (Array.isArray(array)) {
		for (const item of array) {
			if (item?.id) {
				map.set(item.id, item);
			}
		}
	}
	return map;
}

function normalizeGoalForMerge(raw) {
	// Ensure dates are ISO strings for comparison; avoid mutating input
	const clone = { ...raw };
	if (clone.createdAt instanceof Date) clone.createdAt = clone.createdAt.toISOString();
	if (clone.lastUpdated instanceof Date) clone.lastUpdated = clone.lastUpdated.toISOString();
	if (clone.deadline instanceof Date) clone.deadline = clone.deadline.toISOString();
	return clone;
}

function mergeGoalHistories(hists, limit = 100) {
	const seen = new Set();
	const merged = [];
	const add = (entry) => {
		if (!entry?.id) return;
		if (seen.has(entry.id)) return;
		seen.add(entry.id);
		merged.push(entry);
	};

	for (const hist of (hists || [])) {
		(hist || []).forEach(add);
	}

	merged.sort((x, y) => {
		const dx = parseDate(x.timestamp)?.getTime() ?? 0;
		const dy = parseDate(y.timestamp)?.getTime() ?? 0;
		return dx - dy;
	});
	if (merged.length > limit) {
		return merged.slice(merged.length - limit);
	}
	return merged;
}

/**
 * Check if one side equals base in three-way merge
 * @private
 */
function isThreeWayMergeCandidate(local, remote, base) {
	if (!base) return null;

	const baseJson = JSON.stringify(base);
	const localJson = JSON.stringify(local);
	const remoteJson = JSON.stringify(remote);

	if (localJson === baseJson && remoteJson !== baseJson) return remote;
	if (remoteJson === baseJson && localJson !== baseJson) return local;
	return null;
}

/**
 * Compare timestamps and return the latest goal
 * @private
 */
function compareByTimestamp(local, remote) {
	const lUpdated = parseDate(local.lastUpdated)?.getTime() ?? 0;
	const rUpdated = parseDate(remote.lastUpdated)?.getTime() ?? 0;

	if (lUpdated !== rUpdated) {
		return lUpdated > rUpdated ? local : remote;
	}

	const lCreated = parseDate(local.createdAt)?.getTime() ?? 0;
	const rCreated = parseDate(remote.createdAt)?.getTime() ?? 0;
	return lCreated >= rCreated ? local : remote;
}

function latestGoal(local, remote, base) {
	// If goals exist in only one side, take that
	if (local && !remote) return local;
	if (remote && !local) return remote;
	if (!local && !remote) return null;

	// If both exist, attempt three-way: if one side equals base, take the other
	const threeWayResult = isThreeWayMergeCandidate(local, remote, base);
	if (threeWayResult) return threeWayResult;

	// Fallback: latest edit wins by lastUpdated; tie-breaker by createdAt
	return compareByTimestamp(local, remote);
}

function mergeGoal(localRaw, remoteRaw, baseRaw) {
	const local = localRaw ? normalizeGoalForMerge(localRaw) : null;
	const remote = remoteRaw ? normalizeGoalForMerge(remoteRaw) : null;
	const base = baseRaw ? normalizeGoalForMerge(baseRaw) : null;

	const picked = latestGoal(local, remote, base);
	if (!picked) return null;

	// Merge histories from all three sides to preserve audit trail
	const mergedHistory = mergeGoalHistories([
		local?.history,
		remote?.history,
		base?.history
	]);
	const result = { ...picked, history: mergedHistory };
	return result;
}

/**
 * Merge payloads using three-way merge strategy.
 * @param {Object} context - Merge context
 * @param {Object} context.base - Base payload (last common ancestor)
 * @param {Object} context.local - Local payload (current device)
 * @param {Object} context.remote - Remote payload (server/cloud)
 * @returns {Object} Merged payload containing version, exportDate, goals, and settings
 */
export function mergePayloads({ base, local, remote }) {
	// Migrate to current schema first
	const baseCur = base ? migratePayloadToCurrent(base) : null;
	const localCur = migratePayloadToCurrent(local);
	const remoteCur = remote ? migratePayloadToCurrent(remote) : null;

	// Index goals
	const baseIdx = indexById(baseCur?.goals);
	const localIdx = indexById(localCur?.goals);
	const remoteIdx = indexById(remoteCur?.goals);
	const allIds = new Set([
		...Array.from(localIdx.keys()),
		...Array.from(remoteIdx.keys()),
		...Array.from(baseIdx.keys())
	]);

	const mergedGoals = [];
	for (const id of allIds) {
		const merged = mergeGoal(localIdx.get(id), remoteIdx.get(id), baseIdx.get(id));
		if (merged) {
			mergedGoals.push(merged);
		}
	}

	// Settings: pick from newer exportDate between local and remote
	const chosenSettings =
		parseDate(remoteCur?.exportDate) > parseDate(localCur?.exportDate)
			? (remoteCur?.settings ?? localCur?.settings ?? {})
			: (localCur?.settings ?? remoteCur?.settings ?? {});

	// Compose merged payload
	const exportDate = new Date().toISOString();
	return {
		version: GOAL_FILE_VERSION,
		exportDate,
		goals: mergedGoals.map(g => new Goal(g)),
		settings: chosenSettings
	};
}

/**
 * Compute a two-way merge (simplification of three-way where base is null).
 * @param {Object} local - Local payload
 * @param {Object} remote - Remote payload
 * @returns {Object} Merged payload
 */
export function computeTwoWayMerge(local, remote) {
	return mergePayloads({ base: null, local, remote });
}


