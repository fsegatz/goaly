// tests/mocks/storage.js

/**
 * Creates a mock localStorage implementation
 */
function createLocalStorageMock() {
    let store = {};
    return {
        getItem: jest.fn((key) => (key in store ? store[key] : null)),
        setItem: jest.fn((key, value) => { store[key] = value; }),
        removeItem: jest.fn((key) => { delete store[key]; }),
        clear: jest.fn(() => { store = {}; }),
        // Helper to set initial state
        _setStore: (newStore) => { store = { ...newStore }; },
        // Helper to get current state
        _getStore: () => ({ ...store })
    };
}

/**
 * Creates a simple localStorage mock with jest.fn() methods
 * (for tests that don't need actual storage behavior)
 */
function createSimpleLocalStorageMock() {
    return {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn()
    };
}

module.exports = {
    createLocalStorageMock,
    createSimpleLocalStorageMock
};

