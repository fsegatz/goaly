// src/ui/utils/event-manager.js

/**
 * @module EventManager
 * @description Utility for managing DOM event listener lifecycle.
 * Provides a centralized way to attach and clean up event listeners to prevent memory leaks.
 */

/**
 * EventManager utility class for managing event listener lifecycle.
 * 
 * Provides a simple API for attaching and automatically cleaning up event listeners,
 * eliminating the need for manual tracking and removal of listeners.
 * 
 * **Important:** To prevent memory leaks, it is crucial to call `cleanup()` or `off()`
 * when the managed elements are removed from the DOM. Since this class uses a Map to
 * track elements, it holds strong references to elements, which can prevent garbage
 * collection if not managed correctly.
 * 
 * @example
 * const eventManager = new EventManager();
 * 
 * // Attach a listener
 * eventManager.on(element, 'click', handler);
 * 
 * // Attach multiple listeners to the same element
 * eventManager.on(element, 'change', changeHandler);
 * eventManager.on(element, 'blur', blurHandler);
 * 
 * // Clean up all listeners for an element
 * eventManager.off(element);
 * 
 * // Clean up all listeners (useful for component teardown)
 * eventManager.cleanup();
 */
export class EventManager {
    constructor() {
        /**
         * Map of elements to their registered event listeners.
         * Structure: Map<HTMLElement, Map<string, Array<{handler: Function, options?: any}>>>
         */
        this.listeners = new Map();
    }

    /**
     * Attaches an event listener to an element and tracks it for cleanup.
     * 
     * @param {HTMLElement} element - The element to attach the listener to
     * @param {string} eventType - The event type (e.g., 'click', 'change', 'blur')
     * @param {Function} handler - The event handler function
     * @param {boolean|Object} [options] - Optional event listener options (e.g., {capture: true})
     */
    on(element, eventType, handler, options) {
        if (!element || typeof handler !== 'function') {
            return;
        }

        // Get or create the listeners map for this element
        if (!this.listeners.has(element)) {
            this.listeners.set(element, new Map());
        }
        const elementListeners = this.listeners.get(element);

        // Get or create the array for this event type
        if (!elementListeners.has(eventType)) {
            elementListeners.set(eventType, []);
        }
        const eventHandlers = elementListeners.get(eventType);

        // Store the listener info
        const listenerInfo = { handler, options };
        eventHandlers.push(listenerInfo);

        // Attach the actual listener
        element.addEventListener(eventType, handler, options);
    }

    /**
     * Removes all event listeners for a specific event type from an element.
     * 
     * @param {HTMLElement} element - The element to remove listeners from
     * @param {string} [eventType] - Optional event type to remove. If not provided, removes all listeners for the element.
     */
    off(element, eventType) {
        if (!element || !this.listeners.has(element)) {
            return;
        }

        const elementListeners = this.listeners.get(element);

        if (eventType) {
            // Remove listeners for a specific event type
            const eventHandlers = elementListeners.get(eventType);
            if (eventHandlers) {
                eventHandlers.forEach(({ handler, options }) => {
                    element.removeEventListener(eventType, handler, options);
                });
                elementListeners.delete(eventType);
            }
        } else {
            // Remove all listeners for this element
            elementListeners.forEach((eventHandlers, type) => {
                eventHandlers.forEach(({ handler, options }) => {
                    element.removeEventListener(type, handler, options);
                });
            });
            this.listeners.delete(element);
        }
    }

    /**
     * Removes all tracked event listeners.
     * Useful for component teardown or cleanup.
     */
    cleanup() {
        this.listeners.forEach((elementListeners, element) => {
            elementListeners.forEach((eventHandlers, eventType) => {
                eventHandlers.forEach(({ handler, options }) => {
                    element.removeEventListener(eventType, handler, options);
                });
            });
        });
        this.listeners.clear();
    }

    /**
     * Checks if any listeners are currently tracked.
     * 
     * @returns {boolean} True if listeners are tracked, false otherwise
     */
    hasListeners() {
        return this.listeners.size > 0;
    }

    /**
     * Gets the number of tracked elements.
     * 
     * @returns {number} The number of elements with tracked listeners
     */
    getElementCount() {
        return this.listeners.size;
    }
}

