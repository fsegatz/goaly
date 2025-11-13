const { JSDOM } = require('jsdom');
const LanguageService = require('../src/domain/language-service').default;

describe('LanguageService', () => {
    let dom;

    beforeEach(() => {
        dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', { url: 'http://localhost' });

        const createStorageMock = () => {
            let store = {};
            return {
                getItem: jest.fn((key) => (key in store ? store[key] : null)),
                setItem: jest.fn((key, value) => { store[key] = value; }),
                removeItem: jest.fn((key) => { delete store[key]; }),
                clear: jest.fn(() => { store = {}; })
            };
        };

        const storageMock = createStorageMock();
        Object.defineProperty(dom.window, 'localStorage', {
            configurable: true,
            value: storageMock
        });

        global.window = dom.window;
        global.document = dom.window.document;
        global.navigator = dom.window.navigator;
        global.localStorage = storageMock;

        window.localStorage.clear();
        document.documentElement.setAttribute('lang', '');
    });

    afterEach(() => {
        dom.window.close();
        delete global.window;
        delete global.document;
        delete global.navigator;
        delete global.localStorage;
    });

    test('init prefers stored language and updates document language', () => {
        window.localStorage.setItem('goaly_language', 'de');
        const service = new LanguageService();
        const language = service.init();

        expect(language).toBe('de');
        expect(document.documentElement.getAttribute('lang')).toBe('de');
    });

    test('setLanguage resolves base language code and notifies listeners', () => {
        const service = new LanguageService();
        service.init('en');

        const callback = jest.fn();
        service.onChange(callback);

        service.setLanguage('de-DE');

        expect(service.getLanguage()).toBe('de');
        expect(callback).toHaveBeenCalledWith('de');
    });

    test('setLanguage skips notifications when unchanged', () => {
        const service = new LanguageService();
        service.init('en');

        const callback = jest.fn();
        service.onChange(callback);

        service.setLanguage('en');
        expect(callback).not.toHaveBeenCalled();

        service.setLanguage('en', { notify: false });
        expect(callback).not.toHaveBeenCalled();
    });

    test('setLanguage falls back to default for unsupported languages', () => {
        const service = new LanguageService();
        service.init('en');

        service.setLanguage('fr');

        expect(service.getLanguage()).toBe('en');
    });

    test('getLocale respects custom locale map', () => {
        const service = new LanguageService({ localeMap: { en: 'en-GB' } });
        service.init('en');

        expect(service.getLocale()).toBe('en-GB');
    });

    test('constructor merges nested locale map entries', () => {
        const service = new LanguageService({ localeMap: { en: { region: 'en-GB' } } });
        expect(service.localeMap.en.region).toBe('en-GB');
    });

    test('detectBrowserLanguage uses navigator languages', () => {
        const languageSpy = jest.spyOn(global.navigator, 'language', 'get').mockReturnValue('sv-SE');
        const languagesSpy = jest.spyOn(global.navigator, 'languages', 'get').mockReturnValue(['sv-SE', 'en-US']);

        const service = new LanguageService();
        const detected = service.detectBrowserLanguage();

        expect(detected).toBe('sv');
        languageSpy.mockRestore();
        languagesSpy.mockRestore();
    });

    test('detectBrowserLanguage returns null when navigator missing', () => {
        const service = new LanguageService();
        const originalNavigator = global.navigator;
        delete global.navigator;

        expect(service.detectBrowserLanguage()).toBeNull();

        global.navigator = originalNavigator;
    });

    test('detectBrowserLanguage returns null when no candidate matches', () => {
        const languageSpy = jest.spyOn(global.navigator, 'language', 'get').mockReturnValue('fr-FR');
        const languagesSpy = jest.spyOn(global.navigator, 'languages', 'get').mockReturnValue(['fr-FR']);

        const service = new LanguageService();
        expect(service.detectBrowserLanguage()).toBeNull();

        languageSpy.mockRestore();
        languagesSpy.mockRestore();
    });

    test('applyTranslations updates text content, attributes and handles replacements', () => {
        const service = new LanguageService();
        service.init('en');

        const root = document.createElement('div');

        const textElement = document.createElement('span');
        textElement.setAttribute('data-i18n-key', 'actions.export');
        root.appendChild(textElement);

        const attrElement = document.createElement('input');
        attrElement.setAttribute('data-i18n-key', 'goalCard.descriptionPlaceholder');
        attrElement.setAttribute('data-i18n-attr', 'placeholder');
        root.appendChild(attrElement);

        const htmlElement = document.createElement('div');
        htmlElement.setAttribute('data-i18n-key', 'goalCard.deadlinePrefix');
        htmlElement.setAttribute('data-i18n-attr', 'innerHTML');
        htmlElement.setAttribute('data-i18n-args', JSON.stringify({ deadline: 'Tomorrow' }));
        root.appendChild(htmlElement);

        const invalidArgsElement = document.createElement('span');
        invalidArgsElement.setAttribute('data-i18n-key', 'deadline.overdue');
        invalidArgsElement.setAttribute('data-i18n-args', '{invalid-json');
        root.appendChild(invalidArgsElement);

        service.applyTranslations(root);

        expect(textElement.textContent).toBe('Export');
        expect(attrElement.getAttribute('placeholder')).toBe('Add a description...');
        expect(htmlElement.innerHTML).toBe('📅 Tomorrow');
        expect(invalidArgsElement.textContent).toContain('{{count}}');
    });

    test('applyTranslations no-ops when root is invalid or key missing', () => {
        const service = new LanguageService();
        service.init('en');

        expect(() => service.applyTranslations(null)).not.toThrow();

        const root = document.createElement('div');
        const element = document.createElement('span');
        element.setAttribute('data-i18n-key', '');
        root.appendChild(element);

        expect(() => service.applyTranslations(root)).not.toThrow();
    });

    test('getSupportedLanguages returns a copy', () => {
        const service = new LanguageService();
        service.init('en');

        const supported = service.getSupportedLanguages();
        supported.push('fr');

        expect(service.getSupportedLanguages()).toEqual(['en', 'de', 'sv']);
    });

    test('storage methods handle errors gracefully', () => {
        const service = new LanguageService();
        service.init('en');

        const storage = window.localStorage;
        const getItemSpy = jest.spyOn(storage, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
        const setItemSpy = jest.spyOn(storage, 'setItem').mockImplementation(() => { throw new Error('blocked'); });

        expect(service.getStoredLanguage()).toBeNull();
        expect(() => service.persistLanguage('de')).not.toThrow();

        getItemSpy.mockRestore();
        setItemSpy.mockRestore();
    });

    test('onChange returns a noop unsubscribe for non-functions', () => {
        const service = new LanguageService();
        service.init('en');

        const unsubscribe = service.onChange(123);
        expect(typeof unsubscribe).toBe('function');
        expect(() => unsubscribe()).not.toThrow();
    });

    test('updateDocumentLanguage does nothing when document is undefined', () => {
        const service = new LanguageService();
        const originalDocument = global.document;
        delete global.document;

        expect(() => service.updateDocumentLanguage('de')).not.toThrow();

        global.document = originalDocument;
    });

    test('applyReplacements leaves non-string templates untouched', () => {
        const service = new LanguageService();
        const template = { foo: 'bar' };

        expect(service.applyReplacements(template, { foo: 'baz' })).toBe(template);
    });

    test('translate returns empty string for falsy keys', () => {
        const service = new LanguageService();
        service.init('en');

        expect(service.translate('')).toBe('');
        expect(service.translate(null)).toBe('');
    });
});

