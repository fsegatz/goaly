const { JSDOM } = require('jsdom');
const { HelpView } = require('../src/ui/desktop/help-view.js');
const LanguageService = require('../src/domain/services/language-service').default;

let dom;
let document;
let window;
let mockApp;
let helpView;

beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div id="helpView">
            <h1>Help</h1>
            <p>This is the help content</p>
        </div>
    </body></html>`, { url: "http://localhost" });
    document = dom.window.document;
    window = dom.window;

    global.document = document;
    global.window = window;

    const languageService = new LanguageService();
    languageService.init('en');

    mockApp = {
        languageService,
        goalService: {},
        settingsService: {},
        reviewService: {}
    };

    helpView = new HelpView(mockApp);
});

afterEach(() => {
    delete global.document;
    delete global.window;
    jest.restoreAllMocks();
});

describe('HelpView', () => {
    test('render should apply translations when helpView element exists', () => {
        const applyTranslationsSpy = jest.spyOn(mockApp.languageService, 'applyTranslations');
        
        helpView.render();
        
        expect(applyTranslationsSpy).toHaveBeenCalledWith(document.getElementById('helpView'));
    });

    test('render should not throw when helpView element does not exist', () => {
        // Remove the element
        const helpViewElement = document.getElementById('helpView');
        if (helpViewElement) {
            helpViewElement.remove();
        }
        
        expect(() => {
            helpView.render();
        }).not.toThrow();
    });

    test('setupEventListeners should not throw', () => {
        expect(() => {
            helpView.setupEventListeners();
        }).not.toThrow();
    });

    test('render should handle null helpView element gracefully', () => {
        // Create a new DOM without helpView element
        const newDom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, { url: "http://localhost" });
        global.document = newDom.window.document;
        
        expect(() => {
            helpView.render();
        }).not.toThrow();
    });
});

