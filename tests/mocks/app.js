// tests/mocks/app.js

const LanguageService = require('../../src/domain/services/language-service').default;
const ErrorHandler = require('../../src/domain/services/error-handler').default;
const {
    createMockGoalService,
    createMockSettingsService,
    createMockReviewService,
    createMockSyncManager,
    createMockUIController
} = require('./services');

/**
 * Creates a mock App instance with all services
 */
function createMockApp(overrides = {}) {
    const goalService = overrides.goalService || createMockGoalService();
    const settingsService = overrides.settingsService || createMockSettingsService();
    const reviewService = overrides.reviewService || createMockReviewService();

    // Use real LanguageService by default, but allow override
    let languageService;
    if (overrides.languageService) {
        languageService = overrides.languageService;
    } else {
        languageService = new LanguageService();
        languageService.init(overrides.language || 'en');
    }

    // Create error handler with language service
    const errorHandler = overrides.errorHandler || new ErrorHandler(languageService);

    const syncManager = overrides.syncManager || createMockSyncManager();
    const uiController = overrides.uiController || createMockUIController();

    return {
        goalService,
        settingsService,
        reviewService,
        languageService,
        errorHandler,
        syncManager,
        uiController,
        reviews: overrides.reviews || [],
        currentDataVersion: overrides.currentDataVersion,
        exportData: jest.fn(),
        importData: jest.fn(),
        startReviewTimer: jest.fn(),
        refreshReviews: jest.fn(),
        handleMigrationReviewRequest: jest.fn(),
        cancelMigration: jest.fn(),
        completeMigration: jest.fn(),
        applyImportedPayload: jest.fn(),
        beginMigration: jest.fn(),
        ...overrides
    };
}

module.exports = {
    createMockApp
};

