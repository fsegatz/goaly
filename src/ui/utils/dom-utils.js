// src/ui/utils/dom-utils.js

/**
 * Gets an element by ID, throwing an error if not found.
 * @param {string} id - The element ID
 * @returns {HTMLElement} The element
 * @throws {Error} If element is not found
 */
export function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Element with id "${id}" not found`);
    }
    return element;
}

/**
 * Gets an element by ID, returning null if not found.
 * @param {string} id - The element ID
 * @returns {HTMLElement|null} The element or null
 */
export function getOptionalElement(id) {
    return document.getElementById(id);
}

/**
 * Safely queries a single element using a CSS selector.
 * @param {string} selector - The CSS selector
 * @returns {HTMLElement|null} The element or null if not found
 */
export function querySelectorSafe(selector) {
    return document.querySelector(selector);
}

/**
 * Safely queries multiple elements using a CSS selector.
 * @param {string} selector - The CSS selector
 * @returns {NodeList} The list of elements (may be empty)
 */
export function querySelectorAllSafe(selector) {
    return document.querySelectorAll(selector);
}

