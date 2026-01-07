// src/ui/views/login-view.js

/**
 * @module LoginView
 * @description Manages the login overlay UI and authentication flow.
 * Shows when user is not authenticated and handles Google Sign-in.
 */

import { getOptionalElement } from '../utils/dom-utils.js';
import { BaseView } from '../base-view.js';

/**
 * Login overlay view controller.
 * @class
 * @extends BaseView
 */
export class LoginView extends BaseView {
    constructor(app) {
        super(app);
        this.overlay = null;
        this.signInButton = null;
        this.errorDiv = null;
        this._isLoading = false;
    }

    /**
     * Initialize the login view and set up event listeners.
     */
    initialize() {
        this.overlay = getOptionalElement('loginOverlay');
        this.signInButton = getOptionalElement('googleSignInBtn');
        this.errorDiv = getOptionalElement('loginError');
        this.setupEventListeners();
    }

    /**
     * Set up event listeners for login actions.
     */
    setupEventListeners() {
        if (this.signInButton) {
            this.signInButton.addEventListener('click', () => this.handleSignIn());
        }
    }

    /**
     * Handle sign-in button click.
     * Triggers Google OAuth flow and handles success/failure.
     */
    async handleSignIn() {
        if (this._isLoading) {
            return;
        }

        try {
            this.showLoading();
            this.hideError();
            await this.app.authenticateGoogleDrive();
            // Authentication successful - hide overlay
            this.hide();
        } catch (error) {
            const message = error?.message || this.translate('login.error') || 'Sign in failed. Please try again.';
            this.showError(message);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Show the login overlay.
     */
    show() {
        if (this.overlay) {
            this.overlay.classList.add('visible');
            document.body.classList.add('login-active');
        }
    }

    /**
     * Hide the login overlay.
     */
    hide() {
        if (this.overlay) {
            this.overlay.classList.remove('visible');
            document.body.classList.remove('login-active');
        }
    }

    /**
     * Check if the login overlay is currently visible.
     * @returns {boolean}
     */
    isVisible() {
        return this.overlay?.classList.contains('visible') ?? false;
    }

    /**
     * Show loading state on the sign-in button.
     */
    showLoading() {
        this._isLoading = true;
        if (this.signInButton) {
            this.signInButton.disabled = true;
            this.signInButton.querySelector('span').textContent =
                this.translate('login.signingIn') || 'Signing in...';
        }
    }

    /**
     * Hide loading state on the sign-in button.
     */
    hideLoading() {
        this._isLoading = false;
        if (this.signInButton) {
            this.signInButton.disabled = false;
            this.signInButton.querySelector('span').textContent =
                this.translate('login.signInWithGoogle') || 'Sign in with Google';
        }
    }

    /**
     * Show an error message.
     * @param {string} message - The error message to display
     */
    showError(message) {
        if (this.errorDiv) {
            this.errorDiv.textContent = message;
            this.errorDiv.hidden = false;
        }
    }

    /**
     * Hide the error message.
     */
    hideError() {
        if (this.errorDiv) {
            this.errorDiv.hidden = true;
            this.errorDiv.textContent = '';
        }
    }
}
