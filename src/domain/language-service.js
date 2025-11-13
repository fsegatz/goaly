import en from '../language/en.js';
import de from '../language/de.js';
import sv from '../language/sv.js';

const DEFAULT_LOCALE_MAP = {
    en: 'en-US',
    de: 'de-DE',
    sv: 'sv-SE'
};

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

class LanguageService {
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

    onChange(callback) {
        if (typeof callback !== 'function') {
            return () => {};
        }
        this.listeners.add(callback);
        return () => {
            this.listeners.delete(callback);
        };
    }

    getLanguage() {
        return this.currentLanguage;
    }

    getLocale() {
        return this.localeMap[this.currentLanguage] || this.localeMap[this.defaultLanguage];
    }

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

    applyTranslations(root = document) {
        if (!root || typeof root.querySelectorAll !== 'function') {
            return;
        }

        const elements = root.querySelectorAll('[data-i18n-key]');
        elements.forEach((element) => {
            const key = element.getAttribute('data-i18n-key');
            if (!key) {
                return;
            }

            let replacements = {};
            const args = element.getAttribute('data-i18n-args');
            if (args) {
                try {
                    replacements = JSON.parse(args);
                } catch (error) {
                    // Fallback to empty replacements on parse error
                    replacements = {};
                }
            }

            const translated = this.translate(key, replacements);
            const targetAttr = element.getAttribute('data-i18n-attr');

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

    getSupportedLanguages() {
        return [...this.availableLanguages];
    }

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

    getStoredLanguage() {
        try {
            return window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
        } catch (error) {
            return null;
        }
    }

    persistLanguage(language) {
        try {
            window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
        } catch (error) {
            // Ignore storage errors (e.g., disabled cookies)
        }
    }

    updateDocumentLanguage(language) {
        if (typeof document === 'undefined') {
            return;
        }
        document.documentElement.setAttribute('lang', language);
    }

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

    applyReplacements(template, replacements) {
        if (typeof template !== 'string') {
            return template;
        }
        return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) => {
            if (Object.prototype.hasOwnProperty.call(replacements, name)) {
                return replacements[name];
            }
            return match;
        });
    }
}

export default LanguageService;

