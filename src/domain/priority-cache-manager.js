// src/domain/priority-cache-manager.js

/**
 * @module PriorityCacheManager
 * @description Centralized cache manager for goal priorities to improve performance.
 */

/**
 * Manages priority cache for goals, automatically invalidating when goals change.
 * This centralizes cache management so views don't need to manually invalidate caches.
 */
export class PriorityCacheManager {
    constructor(goalService) {
        this.goalService = goalService;
        this.cache = new Map();
        this.isDirty = true;
    }

    /**
     * Get priority for a goal, using cache if available.
     * @param {string} goalId - The goal ID
     * @returns {number} - The calculated priority
     */
    getPriority(goalId) {
        this.refreshIfNeeded();
        return this.cache.get(goalId) ?? 0;
    }

    /**
     * Get all priorities as a Map.
     * @returns {Map<string, number>} - Map of goal ID to priority
     */
    getAllPriorities() {
        this.refreshIfNeeded();
        return new Map(this.cache);
    }

    /**
     * Invalidate the cache, marking it as dirty.
     * This should be called whenever goals are modified.
     */
    invalidate() {
        this.isDirty = true;
    }

    /**
     * Refresh the cache if it's dirty.
     * This is called automatically when accessing priorities.
     */
    refreshIfNeeded() {
        if (!this.isDirty) {
            return;
        }
        this.cache.clear();
        this.goalService.goals.forEach(goal => {
            this.cache.set(goal.id, this.goalService.calculatePriority(goal));
        });
        this.isDirty = false;
    }

    /**
     * Clear the cache completely.
     */
    clear() {
        this.cache.clear();
        this.isDirty = true;
    }
}

