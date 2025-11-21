const { JSDOM } = require('jsdom');
const { EventManager } = require('../src/ui/utils/event-manager.js');

let dom;
let document;
let window;

beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' });
    document = dom.window.document;
    window = dom.window;

    global.document = document;
    global.window = window;
});

afterEach(() => {
    delete global.document;
    delete global.window;
});

describe('EventManager', () => {
    test('should create an EventManager instance', () => {
        const eventManager = new EventManager();
        expect(eventManager).toBeDefined();
        expect(eventManager.listeners).toBeDefined();
        expect(eventManager.listeners.size).toBe(0);
    });

    test('on should attach event listener', () => {
        const eventManager = new EventManager();
        const element = document.createElement('button');
        const handler = jest.fn();

        eventManager.on(element, 'click', handler);

        element.click();
        expect(handler).toHaveBeenCalledTimes(1);
    });

    test('on should ignore null element', () => {
        const eventManager = new EventManager();
        const handler = jest.fn();

        eventManager.on(null, 'click', handler);
        
        expect(eventManager.hasListeners()).toBe(false);
    });

    test('on should ignore non-function handler', () => {
        const eventManager = new EventManager();
        const element = document.createElement('button');

        eventManager.on(element, 'click', null);
        eventManager.on(element, 'click', 'not a function');
        eventManager.on(element, 'click', {});

        expect(eventManager.hasListeners()).toBe(false);
    });

    test('on should attach multiple listeners to same element', () => {
        const eventManager = new EventManager();
        const element = document.createElement('button');
        const clickHandler = jest.fn();
        const changeHandler = jest.fn();

        eventManager.on(element, 'click', clickHandler);
        eventManager.on(element, 'change', changeHandler);

        element.click();
        expect(clickHandler).toHaveBeenCalledTimes(1);
        expect(changeHandler).not.toHaveBeenCalled();

        const changeEvent = new window.Event('change');
        element.dispatchEvent(changeEvent);
        expect(changeHandler).toHaveBeenCalledTimes(1);
    });

    test('off should remove all listeners for an element', () => {
        const eventManager = new EventManager();
        const element = document.createElement('button');
        const handler1 = jest.fn();
        const handler2 = jest.fn();

        eventManager.on(element, 'click', handler1);
        eventManager.on(element, 'change', handler2);
        expect(eventManager.hasListeners()).toBe(true);

        eventManager.off(element);
        expect(eventManager.hasListeners()).toBe(false);

        element.click();
        const changeEvent = new window.Event('change');
        element.dispatchEvent(changeEvent);

        expect(handler1).not.toHaveBeenCalled();
        expect(handler2).not.toHaveBeenCalled();
    });

    test('off should remove listeners for specific event type', () => {
        const eventManager = new EventManager();
        const element = document.createElement('button');
        const clickHandler = jest.fn();
        const changeHandler = jest.fn();

        eventManager.on(element, 'click', clickHandler);
        eventManager.on(element, 'change', changeHandler);

        eventManager.off(element, 'click');

        element.click();
        const changeEvent = new window.Event('change');
        element.dispatchEvent(changeEvent);

        expect(clickHandler).not.toHaveBeenCalled();
        expect(changeHandler).toHaveBeenCalledTimes(1);
    });

    test('off should handle null element gracefully', () => {
        const eventManager = new EventManager();
        eventManager.off(null);
        eventManager.off(null, 'click');
        // Should not throw
        expect(eventManager.hasListeners()).toBe(false);
    });

    test('off should handle non-tracked element gracefully', () => {
        const eventManager = new EventManager();
        const element = document.createElement('button');
        eventManager.off(element);
        // Should not throw
    });

    test('cleanup should remove all listeners', () => {
        const eventManager = new EventManager();
        const element1 = document.createElement('button');
        const element2 = document.createElement('button');
        const handler1 = jest.fn();
        const handler2 = jest.fn();

        eventManager.on(element1, 'click', handler1);
        eventManager.on(element2, 'click', handler2);
        expect(eventManager.hasListeners()).toBe(true);

        eventManager.cleanup();
        expect(eventManager.hasListeners()).toBe(false);

        element1.click();
        element2.click();

        expect(handler1).not.toHaveBeenCalled();
        expect(handler2).not.toHaveBeenCalled();
    });

    test('hasListeners should return false when no listeners', () => {
        const eventManager = new EventManager();
        expect(eventManager.hasListeners()).toBe(false);
    });

    test('hasListeners should return true when listeners exist', () => {
        const eventManager = new EventManager();
        const element = document.createElement('button');
        const handler = jest.fn();

        eventManager.on(element, 'click', handler);
        expect(eventManager.hasListeners()).toBe(true);
    });

    test('getElementCount should return number of tracked elements', () => {
        const eventManager = new EventManager();
        expect(eventManager.getElementCount()).toBe(0);

        const element1 = document.createElement('button');
        const element2 = document.createElement('button');
        const handler = jest.fn();

        eventManager.on(element1, 'click', handler);
        expect(eventManager.getElementCount()).toBe(1);

        eventManager.on(element2, 'click', handler);
        expect(eventManager.getElementCount()).toBe(2);

        eventManager.off(element1);
        expect(eventManager.getElementCount()).toBe(1);
    });

    test('should support event listener options', () => {
        const eventManager = new EventManager();
        const parent = document.createElement('div');
        const child = document.createElement('button');
        parent.appendChild(child);
        const captureHandler = jest.fn();
        const bubbleHandler = jest.fn();

        eventManager.on(parent, 'click', captureHandler, true);
        eventManager.on(child, 'click', bubbleHandler, false);

        child.click();

        // Capture phase happens before bubble phase
        expect(captureHandler).toHaveBeenCalled();
        expect(bubbleHandler).toHaveBeenCalled();
    });
});

