// src/domain/services/error-handler.js

/**
 * Centralized error handling system for the application
 * Provides consistent error logging and user-facing error messages
 */

/**
 * Convert error to a string message
 * @param {Error|Object|null} error - Error object
 * @param {string} fallback - Fallback message
 * @returns {string}
 */
function getErrorMessage(error, fallback) {
    if (error?.message) {
        return error.message;
    }
    if (error) {
        // Convert to string, but handle objects specially to avoid [object Object]
        if (typeof error === 'object') {
            return JSON.stringify(error);
        }
        return String(error);
    }
    return fallback;
}

/**
 * Prepare error object for logging to avoid stringification issues
 * @param {Error|Object|null} error - Error object
 * @returns {Error|Object|null}
 */
function prepareErrorForLog(error) {
    if (!error) {
        return null;
    }
    if (error.message) {
        return error;
    }
    // Safely convert to a loggable format
    if (typeof error === 'object') {
        return { message: JSON.stringify(error) };
    }
    return { message: String(error) };
}

class ErrorHandler {
    constructor(languageService = null, uiController = null) {
        this.languageService = languageService;
        this.uiController = uiController;
    }

    /**
     * Set the language service for translating error messages
     * @param {LanguageService} languageService - The language service instance
     */
    setLanguageService(languageService) {
        this.languageService = languageService;
    }

    /**
     * Set the UI controller for displaying error messages
     * @param {UIController} uiController - The UI controller instance
     */
    setUIController(uiController) {
        this.uiController = uiController;
    }

    /**
     * Log an error with a consistent format
     * @param {string} severity - Severity level: 'info', 'warning', 'error', 'critical'
     * @param {string} message - Error message
     * @param {Error|Object} error - Error object or additional context
     * @param {Object} context - Additional context information
     */
    log(severity, message, error = null, context = {}) {
        const timestamp = new Date().toISOString();

        // Log to console based on severity
        switch (severity) {
            case 'info':
                console.info(`[${timestamp}] [INFO] ${message}`, context, error || '');
                break;
            case 'warning':
                console.warn(`[${timestamp}] [WARNING] ${message}`, context, error || '');
                break;
            case 'error':
            case 'critical':
                console.error(`[${timestamp}] [${severity.toUpperCase()}] ${message}`, context, error || '');
                break;
            default:
                console.log(`[${timestamp}] [${severity.toUpperCase()}] ${message}`, context, error || '');
        }
    }

    /**
     * Display a user-friendly error message
     * @param {string} messageKey - Translation key for the error message
     * @param {Object} replacements - Replacement values for the message
     * @param {string} severity - Severity level
     * @param {Error|Object} error - Error object for logging
     * @param {Object} context - Additional context for logging
     */
    showError(messageKey, replacements = {}, severity = 'error', error = null, context = {}) {
        // Log the error first
        const errorMessage = getErrorMessage(error, messageKey);
        const errorForLog = prepareErrorForLog(error);
        this.log(severity, errorMessage, errorForLog, { messageKey, ...context });

        // Get translated message
        let userMessage;
        if (this.languageService) {
            userMessage = this.languageService.translate(messageKey, replacements);
        } else {
            // Fallback if language service is not available
            userMessage = messageKey;
            if (Object.keys(replacements).length > 0) {
                userMessage += `: ${JSON.stringify(replacements)}`;
            }
        }

        // Display to user
        // Note: Using event-based system would reduce coupling to specific UI components
        if (this.uiController?.settingsView) {
            // Use settings view for Google Drive errors (existing pattern)
            // This maintains backward compatibility with existing Google Drive error handling
            if (messageKey.startsWith('googleDrive.')) {
                this.uiController.settingsView.showGoogleDriveStatus(userMessage, true);
                return;
            }
        }

        // Fallback to alert. For a better user experience, this could be replaced with
        // a non-blocking toast notification for non-critical errors in the future.
        alert(userMessage);
    }

    /**
     * Handle an info-level message
     * @param {string} messageKey - Translation key
     * @param {Object} replacements - Replacement values
     * @param {Object} context - Additional context
     */
    info(messageKey, replacements = {}, context = {}) {
        this.showError(messageKey, replacements, 'info', null, context);
    }

    /**
     * Handle a warning-level message
     * @param {string} messageKey - Translation key
     * @param {Object} replacements - Replacement values
     * @param {Error|Object} error - Error object
     * @param {Object} context - Additional context
     */
    warning(messageKey, replacements = {}, error = null, context = {}) {
        this.showError(messageKey, replacements, 'warning', error, context);
    }

    /**
     * Handle an error-level message
     * @param {string} messageKey - Translation key
     * @param {Object} replacements - Replacement values
     * @param {Error|Object} error - Error object
     * @param {Object} context - Additional context
     */
    error(messageKey, replacements = {}, error = null, context = {}) {
        this.showError(messageKey, replacements, 'error', error, context);
    }

    /**
     * Handle a critical-level message
     * @param {string} messageKey - Translation key
     * @param {Object} replacements - Replacement values
     * @param {Error|Object} error - Error object
     * @param {Object} context - Additional context
     */
    critical(messageKey, replacements = {}, error = null, context = {}) {
        this.showError(messageKey, replacements, 'critical', error, context);
    }

    /**
     * Handle a generic error (for catch blocks)
     * @param {Error|Object} error - Error object
     * @param {string} defaultMessageKey - Default translation key if error doesn't have a message
     * @param {Object} context - Additional context
     */
    handleError(error, defaultMessageKey = 'errors.generic', context = {}) {
        const errorMessage = getErrorMessage(error, defaultMessageKey);
        const errorForLog = prepareErrorForLog(error);
        const severity = error?.severity || 'error';

        // Try to extract message key from error if it's a structured error
        let messageKey = defaultMessageKey;
        if (error?.messageKey) {
            messageKey = error.messageKey;
        } else if (error?.code) {
            // Map common error codes to message keys
            messageKey = `errors.${error.code}`;
        }

        this.showError(messageKey, { message: errorMessage }, severity, errorForLog, context);
    }
}

export default ErrorHandler;

