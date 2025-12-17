// src/domain/services/language-service.js

/**
 * @module LanguageService
 * @description Service for handling application localization.
 * Manages language selection, persistence, and string translation.
 */

import en from '../../language/en.js';
import de from '../../language/de.js';
import sv from '../../language/sv.js';

const DEFAULT_LOCALE_MAP = {
    en: 'en-US',
    de: 'de-DE',
    sv: 'sv-SE'
};

/** @constant {string} LANGUAGE_STORAGE_KEY - Key for storing selected language in local storage */
const LANGUAGE_STORAGE_KEY = 'goaly_language';

const merge = (target, source) => {
    if (!source) {
        return target;
    }
    const result = { ...target };
    Object.entries(source).forEach(([key, value]) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            result[key] = merge(result[key] || {}, value);
        } else {
            result[key] = value;
        }
    });
    return result;
};

/**
 * Service for managing application localization and translations.
 * Handles language detection, storage persistence, and dynamic content updates.
 * @class
 */

/**
 * @typedef {Object} LanguageServiceOptions
 * @property {Object} [translations] - Translation dictionaries
 * @property {string} [defaultLanguage='en'] - Default language code
 * @property {Object} [localeMap] - Map of language codes to locale strings
 */
class LanguageService {
    /**
     * Create a new LanguageService instance.
     * Create a new LanguageService instance.
     * @param {LanguageServiceOptions} options - Configuration options
     */
    constructor(options = {}) {
        const { translations, defaultLanguage = 'en', localeMap } = options;
        this.translations = translations || { en, de, sv };
        this.availableLanguages = Object.keys(this.translations);
        this.defaultLanguage = this.availableLanguages.includes(defaultLanguage)
            ? defaultLanguage
            : 'en';
        this.localeMap = merge(DEFAULT_LOCALE_MAP, localeMap);
        this.currentLanguage = this.defaultLanguage;
        this.listeners = new Set();
    }

    /**
     * Initialize the language service.
     * resolving the initial language from arguments, storage, or browser settings.
     * @param {string} initialLanguage - Optional initial language code
     * @returns {string} The resolved language code
     */
    init(initialLanguage) {
        const resolved =
            this.resolveLanguage(initialLanguage) ||
            this.getStoredLanguage() ||
            this.detectBrowserLanguage() ||
            this.defaultLanguage;

        this.currentLanguage = resolved;
        this.persistLanguage(resolved);
        this.updateDocumentLanguage(resolved);
        return resolved;
    }

    /**
     * Subscribe to language change events.
     * @param {Function} callback - Function to call when language changes
     * @returns {Function} Unsubscribe function
     */
    onChange(callback) {
        if (typeof callback !== 'function') {
            return () => { };
        }
        this.listeners.add(callback);
        return () => {
            this.listeners.delete(callback);
        };
    }

    /**
     * Get the current language code.
     * @returns {string} Current language code (e.g., 'en')
     */
    getLanguage() {
        return this.currentLanguage;
    }

    /**
     * Get the current locale string.
     * @returns {string} Current locale (e.g., 'en-US')
     */
    getLocale() {
        return this.localeMap[this.currentLanguage] || this.localeMap[this.defaultLanguage];
    }

    /**
     * Set the current language.
     * @param {string} language - Language code to set
     * @param {Object} options - Options
     * @param {boolean} [options.persist=true] - Whether to save to local storage
     * @param {boolean} [options.notify=true] - Whether to notify listeners
     */
    setLanguage(language, { persist = true, notify = true } = {}) {
        const resolved = this.resolveLanguage(language) || this.defaultLanguage;
        if (resolved === this.currentLanguage && notify) {
            return;
        }

        this.currentLanguage = resolved;
        if (persist) {
            this.persistLanguage(resolved);
        }
        this.updateDocumentLanguage(resolved);
        if (notify) {
            this.listeners.forEach((listener) => listener(resolved));
        }
    }

    /**
     * Translate a key with optional replacements.
     * @param {string} key - The translation key (e.g., 'common.save')
     * @param {Object} replacements - Key-value pairs for template replacement
     * @returns {string} Translated string or key if not found
     */
    translate(key, replacements = {}) {
        if (!key) {
            return '';
        }

        const value =
            this.lookup(this.translations[this.currentLanguage], key) ??
            this.lookup(this.translations[this.defaultLanguage], key) ??
            key;

        return this.applyReplacements(value, replacements);
    }

    /**
     * Apply translations to the DOM.
     * searches for elements with data-i18n-key attributes.
     * @param {Document|HTMLElement} root - Root element to search within
     */
    applyTranslations(root = document) {
        if (!root || typeof root.querySelectorAll !== 'function') {
            return;
        }

        const elements = root.querySelectorAll('[data-i18n-key]');
        elements.forEach((element) => {
            const key = element.dataset.i18nKey;
            if (!key) {
                return;
            }

            let replacements = {};
            const args = element.dataset.i18nArgs;
            if (args) {
                try {
                    replacements = JSON.parse(args);
                } catch {
                    // Fallback to empty replacements on parse error
                    replacements = {};
                }
            }

            const translated = this.translate(key, replacements);
            const targetAttr = element.dataset.i18nAttr;

            if (targetAttr) {
                if (targetAttr === 'innerHTML') {
                    element.innerHTML = translated;
                } else {
                    element.setAttribute(targetAttr, translated);
                }
            } else {
                element.textContent = translated;
            }
        });
    }

    /**
     * Get list of supported languages.
     * @returns {string[]} Array of supported language codes
     */
    getSupportedLanguages() {
        return [...this.availableLanguages];
    }

    /**
     * Resolve a language code to a supported one.
     * Checks exact match, then base language (e.g., 'en-US' -> 'en').
     * @param {string} language - Input language string
     * @returns {string|null} Resolved language code or null
     */
    resolveLanguage(language) {
        if (!language) {
            return null;
        }
        const normalized = language.toLowerCase();
        if (this.availableLanguages.includes(normalized)) {
            return normalized;
        }
        const base = normalized.split('-')[0];
        if (this.availableLanguages.includes(base)) {
            return base;
        }
        return null;
    }

    /**
     * Detect the user's preferred language from the browser.
     * @returns {string|null} Detected supported language or null
     */
    detectBrowserLanguage() {
        if (typeof navigator === 'undefined') {
            return null;
        }

        const candidates = [
            navigator.language,
            ...(navigator.languages || [])
        ];

        for (const candidate of candidates) {
            const resolved = this.resolveLanguage(candidate);
            if (resolved) {
                return resolved;
            }
        }

        return null;
    }

    /**
     * Retrieve the stored language preference.
     * @returns {string|null} Stored language code or null
     */
    getStoredLanguage() {
        try {
            return globalThis.localStorage.getItem(LANGUAGE_STORAGE_KEY);
        } catch {
            return null;
        }
    }

    /**
     * Persist the language preference to local storage.
     * @param {string} language - Language code to save
     */
    persistLanguage(language) {
        try {
            globalThis.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
        } catch {
            // Ignore storage errors (e.g., disabled cookies)
        }
    }

    /**
     * Update the document's `lang` attribute.
     * @param {string} language - Language code
     */
    updateDocumentLanguage(language) {
        if (typeof document === 'undefined') {
            return;
        }
        document.documentElement.setAttribute('lang', language);
    }

    /**
     * Lookup a key in a translation tree.
     * @param {Object} tree - Translation object
     * @param {string} key - Dot-notation key
     * @returns {string|Object|null} Value or null if not found
     */
    lookup(tree, key) {
        if (!tree) {
            return null;
        }
        return key.split('.').reduce((acc, segment) => {
            if (acc && typeof acc === 'object' && segment in acc) {
                return acc[segment];
            }
            return null;
        }, tree);
    }

    /**
     * Replace placeholders in a template string.
     * @param {string} template - Template string with {{key}} placeholders
     * @param {Object} replacements - Replacement values
     * @returns {string} Resulting string
     */
    applyReplacements(template, replacements) {
        if (typeof template !== 'string') {
            return template;
        }
        return template.replaceAll(/\{\{\s*(\w+)\s*\}\}/g, (match, name) => {
            if (Object.hasOwn(replacements, name)) {
                return replacements[name];
            }
            return match;
        });
    }
}

/**
 * Utility to get all keys from a nested object as dot-notation strings.
 * Used for validation testing to ensure all language files have consistent keys.
 * @param {Object} obj - Object to extract keys from
 * @param {string} prefix - Current key prefix
 * @returns {string[]} Array of dot-notation keys
 */
export function getAllKeys(obj, prefix = '') {
    let keys = [];

    for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];

        if (value && typeof value === 'object' && !Array.isArray(value)) {
            keys = keys.concat(getAllKeys(value, fullKey));
        } else {
            keys.push(fullKey);
        }
    }

    return keys;
}

/**
 * All available translations for validation.
 */
export const translations = { en, de, sv };

export default LanguageService;

