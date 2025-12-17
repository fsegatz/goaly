// src/domain/developer-mode-service.js

/**
 * @module DeveloperModeService
 * @description Service for managing developer mode state.
 * Controls access to experimental or debug features.
 */

/**
 * Service to manage developer mode.
 * @class
 */
class DeveloperModeService {
    isEnabled = false;


    /**
     * Enable developer mode.
     */
    enable() {
        this.isEnabled = true;
    }

    /**
     * Disable developer mode.
     */
    disable() {
        this.isEnabled = false;
    }

    /**
     * Toggle developer mode state.
     * @returns {boolean} New state (true if enabled)
     */
    toggle() {
        if (this.isEnabled) {
            this.disable();
        } else {
            this.enable();
        }
        return this.isEnabled;
    }

    /**
     * Check if developer mode is enabled.
     * @returns {boolean} True if enabled
     */
    isDeveloperMode() {
        return this.isEnabled;
    }
}

export default DeveloperModeService;

