// tests/error-handler.test.js

const ErrorHandler = require('../src/domain/services/error-handler').default;

describe('ErrorHandler', () => {
    let errorHandler;
    let mockLanguageService;
    let mockUIController;
    let consoleSpy;

    beforeEach(() => {
        // Mock console methods
        consoleSpy = {
            info: jest.spyOn(console, 'info').mockImplementation(() => {}),
            warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
            error: jest.spyOn(console, 'error').mockImplementation(() => {}),
            log: jest.spyOn(console, 'log').mockImplementation(() => {})
        };

        // Mock language service
        mockLanguageService = {
            translate: jest.fn((key, replacements = {}) => {
                const translations = {
                    'errors.generic': 'An error occurred: {{message}}',
                    'errors.goalNotFound': 'Goal not found.',
                    'errors.goalUpdateFailed': 'Updating the goal failed.',
                    'googleDrive.syncError': 'Sync failed: {{message}}'
                };
                let message = translations[key] || key;
                Object.keys(replacements).forEach(k => {
                    message = message.replace(`{{${k}}}`, replacements[k]);
                });
                return message;
            })
        };

        // Mock UI controller
        mockUIController = {
            settingsView: {
                showGoogleDriveStatus: jest.fn()
            }
        };

        // Mock alert
        global.alert = jest.fn();

        errorHandler = new ErrorHandler(mockLanguageService, mockUIController);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Constructor', () => {
        test('should create ErrorHandler without dependencies', () => {
            const handler = new ErrorHandler();
            expect(handler.languageService).toBeNull();
            expect(handler.uiController).toBeNull();
        });

        test('should create ErrorHandler with language service', () => {
            const handler = new ErrorHandler(mockLanguageService);
            expect(handler.languageService).toBe(mockLanguageService);
            expect(handler.uiController).toBeNull();
        });

        test('should create ErrorHandler with both dependencies', () => {
            const handler = new ErrorHandler(mockLanguageService, mockUIController);
            expect(handler.languageService).toBe(mockLanguageService);
            expect(handler.uiController).toBe(mockUIController);
        });
    });

    describe('setLanguageService', () => {
        test('should set language service', () => {
            errorHandler.setLanguageService(mockLanguageService);
            expect(errorHandler.languageService).toBe(mockLanguageService);
        });
    });

    describe('setUIController', () => {
        test('should set UI controller', () => {
            errorHandler.setUIController(mockUIController);
            expect(errorHandler.uiController).toBe(mockUIController);
        });
    });

    describe('log', () => {
        test('should log info messages', () => {
            errorHandler.log('info', 'Test message');
            expect(consoleSpy.info).toHaveBeenCalled();
        });

        test('should log warning messages', () => {
            errorHandler.log('warning', 'Test warning');
            expect(consoleSpy.warn).toHaveBeenCalled();
        });

        test('should log error messages', () => {
            errorHandler.log('error', 'Test error');
            expect(consoleSpy.error).toHaveBeenCalled();
        });

        test('should log critical messages', () => {
            errorHandler.log('critical', 'Test critical');
            expect(consoleSpy.error).toHaveBeenCalled();
        });

        test('should include error object in log entry', () => {
            const testError = new Error('Test error');
            errorHandler.log('error', 'Test message', testError);
            expect(consoleSpy.error).toHaveBeenCalledWith(
                expect.stringContaining('[ERROR] Test message'),
                expect.any(Object),
                testError
            );
        });

        test('should include context in log entry', () => {
            const context = { userId: '123', action: 'test' };
            errorHandler.log('info', 'Test message', null, context);
            expect(consoleSpy.info).toHaveBeenCalledWith(
                expect.stringContaining('[INFO] Test message'),
                context,
                ''
            );
        });
    });

    describe('showError', () => {
        test('should log error before displaying', () => {
            errorHandler.showError('errors.goalNotFound');
            expect(consoleSpy.error).toHaveBeenCalled();
        });

        test('should translate message using language service', () => {
            errorHandler.showError('errors.goalNotFound');
            expect(mockLanguageService.translate).toHaveBeenCalledWith('errors.goalNotFound', {});
        });

        test('should use replacements in translation', () => {
            errorHandler.showError('errors.generic', { message: 'Test error' });
            expect(mockLanguageService.translate).toHaveBeenCalledWith('errors.generic', { message: 'Test error' });
        });

        test('should display Google Drive errors via settings view', () => {
            errorHandler.showError('googleDrive.syncError', { message: 'Test error' });
            expect(mockUIController.settingsView.showGoogleDriveStatus).toHaveBeenCalledWith(
                'Sync failed: Test error',
                true
            );
        });

        test('should fallback to alert when UI controller not available', () => {
            const handler = new ErrorHandler(mockLanguageService);
            handler.showError('errors.goalNotFound');
            expect(global.alert).toHaveBeenCalledWith('Goal not found.');
        });

        test('should fallback to alert for critical errors', () => {
            errorHandler.showError('errors.generic', {}, 'critical');
            expect(global.alert).toHaveBeenCalled();
        });

        test('should use message key as fallback when language service not available', () => {
            const handler = new ErrorHandler(null, mockUIController);
            handler.showError('errors.goalNotFound', { test: 'value' });
            expect(global.alert).toHaveBeenCalledWith('errors.goalNotFound: {"test":"value"}');
        });
    });

    describe('info', () => {
        test('should call showError with info severity', () => {
            const spy = jest.spyOn(errorHandler, 'showError');
            errorHandler.info('errors.generic', { message: 'Test' });
            expect(spy).toHaveBeenCalledWith('errors.generic', { message: 'Test' }, 'info', null, {});
        });
    });

    describe('warning', () => {
        test('should call showError with warning severity', () => {
            const testError = new Error('Test');
            const spy = jest.spyOn(errorHandler, 'showError');
            errorHandler.warning('errors.generic', { message: 'Test' }, testError);
            expect(spy).toHaveBeenCalledWith('errors.generic', { message: 'Test' }, 'warning', testError, {});
        });
    });

    describe('error', () => {
        test('should call showError with error severity', () => {
            const testError = new Error('Test');
            const spy = jest.spyOn(errorHandler, 'showError');
            errorHandler.error('errors.generic', { message: 'Test' }, testError);
            expect(spy).toHaveBeenCalledWith('errors.generic', { message: 'Test' }, 'error', testError, {});
        });
    });

    describe('critical', () => {
        test('should call showError with critical severity', () => {
            const testError = new Error('Test');
            const spy = jest.spyOn(errorHandler, 'showError');
            errorHandler.critical('errors.generic', { message: 'Test' }, testError);
            expect(spy).toHaveBeenCalledWith('errors.generic', { message: 'Test' }, 'critical', testError, {});
        });
    });

    describe('handleError', () => {
        test('should handle Error objects', () => {
            const testError = new Error('Test error message');
            errorHandler.handleError(testError);
            expect(consoleSpy.error).toHaveBeenCalled();
            expect(global.alert).toHaveBeenCalled();
        });

        test('should use error.messageKey if available', () => {
            const testError = { messageKey: 'errors.goalNotFound', message: 'Test' };
            errorHandler.handleError(testError);
            expect(mockLanguageService.translate).toHaveBeenCalledWith('errors.goalNotFound', expect.any(Object));
        });

        test('should map error.code to message key', () => {
            const testError = { code: 'GOAL_NOT_FOUND', message: 'Test' };
            errorHandler.handleError(testError);
            expect(mockLanguageService.translate).toHaveBeenCalledWith('errors.GOAL_NOT_FOUND', expect.any(Object));
        });

        test('should use default message key when no code or messageKey', () => {
            const testError = new Error('Test');
            errorHandler.handleError(testError, 'errors.generic');
            expect(mockLanguageService.translate).toHaveBeenCalledWith('errors.generic', expect.any(Object));
        });

        test('should use error.severity if available', () => {
            const testError = { severity: 'critical', message: 'Test' };
            const spy = jest.spyOn(errorHandler, 'showError');
            errorHandler.handleError(testError);
            expect(spy).toHaveBeenCalledWith(
                'errors.generic',
                expect.any(Object),
                'critical',
                testError,
                {}
            );
        });

        test('should handle string errors', () => {
            errorHandler.handleError('String error');
            expect(consoleSpy.error).toHaveBeenCalled();
        });

        test('should handle null/undefined errors', () => {
            errorHandler.handleError(null);
            expect(consoleSpy.error).toHaveBeenCalled();
        });
    });
});

