// tests/mocks/index.js
// Central export for all mocks

const { createBasicDOM, createFullDOM, setupGlobalDOM, cleanupGlobalDOM } = require('./dom');
const { createLocalStorageMock, createSimpleLocalStorageMock } = require('./storage');
const {
    createMockGoalService,
    createMockSettingsService,
    createMockReviewService,
    createMockLanguageService,
    createMockSyncManager,
    createMockUIController
} = require('./services');
const { createMockApp } = require('./app');
const { setupBrowserMocks, cleanupBrowserMocks } = require('./browser');

module.exports = {
    // DOM
    createBasicDOM,
    createFullDOM,
    setupGlobalDOM,
    cleanupGlobalDOM,
    // Storage
    createLocalStorageMock,
    createSimpleLocalStorageMock,
    // Services
    createMockGoalService,
    createMockSettingsService,
    createMockReviewService,
    createMockLanguageService,
    createMockSyncManager,
    createMockUIController,
    // App
    createMockApp,
    // Browser APIs
    setupBrowserMocks,
    cleanupBrowserMocks
};

