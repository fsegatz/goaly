// tests/mocks/services.js

/**
 * Creates a mock GoalService
 */
function createMockGoalService(overrides = {}) {
    return {
        goals: overrides.goals || [],
        getActiveGoals: jest.fn(() => overrides.getActiveGoals || []),
        createGoal: jest.fn(),
        updateGoal: jest.fn(),
        setGoalStatus: jest.fn(),
        deleteGoal: jest.fn(),
        calculatePriority: jest.fn(() => overrides.calculatePriority || 0),
        autoActivateGoalsByPriority: jest.fn(),
        onAfterSave: jest.fn(),
        ...overrides
    };
}

/**
 * Creates a mock SettingsService
 */
function createMockSettingsService(overrides = {}) {
    const defaultSettings = {
        maxActiveGoals: 3,
        language: 'en',
        reviewIntervals: [30, 14, 7]
    };

    return {
        getSettings: jest.fn(() => overrides.settings || defaultSettings),
        updateSettings: jest.fn(),
        getReviewIntervals: jest.fn(() => overrides.reviewIntervals || [30, 14, 7]),
        onAfterSave: jest.fn(),
        ...overrides
    };
}

/**
 * Creates a mock ReviewService
 */
function createMockReviewService(overrides = {}) {
    return {
        getReviews: jest.fn(() => overrides.reviews || []),
        recordReview: jest.fn(),
        ...overrides
    };
}

/**
 * Creates a mock LanguageService with translation function
 */
function createMockLanguageService(translations = {}) {
    return {
        translate: jest.fn((key, replacements = {}) => {
            if (translations[key]) {
                if (typeof translations[key] === 'function') {
                    return translations[key](replacements);
                }
                // Simple string replacement for {{key}} patterns
                let result = translations[key];
                Object.keys(replacements).forEach(k => {
                    result = result.replace(`{{${k}}}`, replacements[k]);
                });
                return result;
            }
            return key;
        }),
        init: jest.fn(),
        setLanguage: jest.fn(),
        ...translations
    };
}

/**
 * Creates a mock SyncManager
 */
function createMockSyncManager(overrides = {}) {
    return {
        isAvailable: jest.fn(() => overrides.isAvailable ?? true),
        isAuthenticated: jest.fn(() => overrides.isAuthenticated ?? false),
        authenticateGoogleDrive: jest.fn(),
        signOutGoogleDrive: jest.fn(),
        syncWithGoogleDrive: jest.fn(),
        downloadFromGoogleDrive: jest.fn(),
        googleDriveSyncService: overrides.googleDriveSyncService || null,
        ...overrides
    };
}

/**
 * Creates a mock UIController with settingsView
 */
function createMockUIController(overrides = {}) {
    return {
        settingsView: {
            updateGoogleDriveUI: jest.fn(),
            showGoogleDriveStatus: jest.fn(),
            ...overrides.settingsView
        },
        ...overrides
    };
}

module.exports = {
    createMockGoalService,
    createMockSettingsService,
    createMockReviewService,
    createMockLanguageService,
    createMockSyncManager,
    createMockUIController
};

