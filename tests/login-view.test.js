const { JSDOM } = require('jsdom');
const { LoginView } = require('../src/ui/views/login-view.js');

let dom;
let document;
let window;
let mockApp;
let loginView;

beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div id="loginOverlay" class="login-overlay">
            <div class="login-container">
                <div class="login-logo">🎯 Goaly</div>
                <h1 class="login-title" data-i18n-key="login.title">Welcome to Goaly</h1>
                <p class="login-subtitle" data-i18n-key="login.subtitle">Sign in to sync your goals</p>
                <div id="loginError" class="login-error" hidden></div>
                <button id="googleSignInBtn" class="google-signin-button">
                    <span data-i18n-key="login.signInWithGoogle">Sign in with Google</span>
                </button>
                <p class="login-info" data-i18n-key="login.testerInfo">Tester info</p>
            </div>
        </div>
    </body></html>`, { url: "http://localhost" });
    document = dom.window.document;
    window = dom.window;

    global.document = document;
    global.window = window;

    const translations = {
        'login.signInWithGoogle': 'Sign in with Google',
        'login.signingIn': 'Signing in...',
        'login.error': 'Sign in failed. Please try again.'
    };

    mockApp = {
        authenticateGoogleDrive: jest.fn(),
        languageService: {
            translate: jest.fn((key) => translations[key] || key),
            onChange: jest.fn(() => () => { }), // Returns unsubscribe function
            applyTranslations: jest.fn()
        }
    };

    loginView = new LoginView(mockApp);
});

afterEach(() => {
    delete global.document;
    delete global.window;
    jest.restoreAllMocks();
});

describe('LoginView', () => {
    describe('initialize', () => {
        test('should initialize overlay and button references', () => {
            loginView.initialize();

            expect(loginView.overlay).toBeTruthy();
            expect(loginView.signInButton).toBeTruthy();
            expect(loginView.errorDiv).toBeTruthy();
        });

        test('should set up event listeners', () => {
            const addEventListenerSpy = jest.spyOn(document.getElementById('googleSignInBtn'), 'addEventListener');

            loginView.initialize();

            expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
        });

        test('should handle missing elements gracefully', () => {
            // Remove the overlay (which contains the other elements)
            const overlay = document.getElementById('loginOverlay');
            if (overlay) overlay.remove();

            expect(() => loginView.initialize()).not.toThrow();
        });
    });

    describe('show', () => {
        test('should add visible class to overlay', () => {
            loginView.initialize();
            loginView.overlay.classList.remove('visible');

            loginView.show();

            expect(loginView.overlay.classList.contains('visible')).toBe(true);
        });

        test('should add login-active class to body', () => {
            loginView.initialize();

            loginView.show();

            expect(document.body.classList.contains('login-active')).toBe(true);
        });

        test('should handle missing overlay gracefully', () => {
            loginView.overlay = null;

            expect(() => loginView.show()).not.toThrow();
        });
    });

    describe('hide', () => {
        test('should remove visible class from overlay', () => {
            loginView.initialize();
            loginView.overlay.classList.add('visible');

            loginView.hide();

            expect(loginView.overlay.classList.contains('visible')).toBe(false);
        });

        test('should remove login-active class from body', () => {
            loginView.initialize();
            document.body.classList.add('login-active');

            loginView.hide();

            expect(document.body.classList.contains('login-active')).toBe(false);
        });

        test('should handle missing overlay gracefully', () => {
            loginView.overlay = null;

            expect(() => loginView.hide()).not.toThrow();
        });
    });

    describe('isVisible', () => {
        test('should return true when overlay has visible class', () => {
            loginView.initialize();
            loginView.overlay.classList.add('visible');

            expect(loginView.isVisible()).toBe(true);
        });

        test('should return false when overlay does not have visible class', () => {
            loginView.initialize();
            loginView.overlay.classList.remove('visible');

            expect(loginView.isVisible()).toBe(false);
        });

        test('should return false when overlay is null', () => {
            loginView.overlay = null;

            expect(loginView.isVisible()).toBe(false);
        });
    });

    describe('handleSignIn', () => {
        test('should call authenticateGoogleDrive on app', async () => {
            mockApp.authenticateGoogleDrive.mockResolvedValue();
            loginView.initialize();

            await loginView.handleSignIn();

            expect(mockApp.authenticateGoogleDrive).toHaveBeenCalled();
        });

        test('should show loading state before authentication', async () => {
            mockApp.authenticateGoogleDrive.mockImplementation(() => {
                return new Promise(resolve => setTimeout(resolve, 100));
            });
            loginView.initialize();
            const showLoadingSpy = jest.spyOn(loginView, 'showLoading');

            loginView.handleSignIn();

            expect(showLoadingSpy).toHaveBeenCalled();
        });

        test('should hide overlay on successful authentication', async () => {
            mockApp.authenticateGoogleDrive.mockResolvedValue();
            loginView.initialize();
            loginView.show();

            await loginView.handleSignIn();

            expect(loginView.overlay.classList.contains('visible')).toBe(false);
        });

        test('should show error on authentication failure', async () => {
            mockApp.authenticateGoogleDrive.mockRejectedValue(new Error('Auth failed'));
            loginView.initialize();

            await loginView.handleSignIn();

            expect(loginView.errorDiv.hidden).toBe(false);
            expect(loginView.errorDiv.textContent).toBe('Auth failed');
        });

        test('should hide loading state after authentication', async () => {
            mockApp.authenticateGoogleDrive.mockResolvedValue();
            loginView.initialize();
            const hideLoadingSpy = jest.spyOn(loginView, 'hideLoading');

            await loginView.handleSignIn();

            expect(hideLoadingSpy).toHaveBeenCalled();
        });

        test('should prevent multiple parallel sign-in attempts', async () => {
            mockApp.authenticateGoogleDrive.mockImplementation(() => {
                return new Promise(resolve => setTimeout(resolve, 100));
            });
            loginView.initialize();

            // Start first sign-in
            const firstCall = loginView.handleSignIn();

            // Try to start second sign-in while first is in progress
            await loginView.handleSignIn();

            // authenticateGoogleDrive should only be called once
            expect(mockApp.authenticateGoogleDrive).toHaveBeenCalledTimes(1);

            await firstCall;
        });
    });

    describe('showLoading', () => {
        test('should disable sign-in button', () => {
            loginView.initialize();

            loginView.showLoading();

            expect(loginView.signInButton.disabled).toBe(true);
        });

        test('should change button text to signing in', () => {
            loginView.initialize();

            loginView.showLoading();

            expect(loginView.signInButton.querySelector('span').textContent).toBe('Signing in...');
        });

        test('should set loading flag', () => {
            loginView.initialize();

            loginView.showLoading();

            expect(loginView._isLoading).toBe(true);
        });

        test('should handle missing button gracefully', () => {
            loginView.signInButton = null;

            expect(() => loginView.showLoading()).not.toThrow();
        });
    });

    describe('hideLoading', () => {
        test('should enable sign-in button', () => {
            loginView.initialize();
            loginView.signInButton.disabled = true;

            loginView.hideLoading();

            expect(loginView.signInButton.disabled).toBe(false);
        });

        test('should restore button text', () => {
            loginView.initialize();
            loginView.signInButton.querySelector('span').textContent = 'Signing in...';

            loginView.hideLoading();

            expect(loginView.signInButton.querySelector('span').textContent).toBe('Sign in with Google');
        });

        test('should clear loading flag', () => {
            loginView.initialize();
            loginView._isLoading = true;

            loginView.hideLoading();

            expect(loginView._isLoading).toBe(false);
        });

        test('should handle missing button gracefully', () => {
            loginView.signInButton = null;

            expect(() => loginView.hideLoading()).not.toThrow();
        });
    });

    describe('showError', () => {
        test('should show error div with message', () => {
            loginView.initialize();

            loginView.showError('Test error message');

            expect(loginView.errorDiv.hidden).toBe(false);
            expect(loginView.errorDiv.textContent).toBe('Test error message');
        });

        test('should handle missing error div gracefully', () => {
            loginView.errorDiv = null;

            expect(() => loginView.showError('Test error')).not.toThrow();
        });
    });

    describe('hideError', () => {
        test('should hide error div and clear text', () => {
            loginView.initialize();
            loginView.errorDiv.hidden = false;
            loginView.errorDiv.textContent = 'Some error';

            loginView.hideError();

            expect(loginView.errorDiv.hidden).toBe(true);
            expect(loginView.errorDiv.textContent).toBe('');
        });

        test('should handle missing error div gracefully', () => {
            loginView.errorDiv = null;

            expect(() => loginView.hideError()).not.toThrow();
        });
    });

    describe('event listener integration', () => {
        test('should trigger handleSignIn when button is clicked', async () => {
            mockApp.authenticateGoogleDrive.mockResolvedValue();
            loginView.initialize();

            document.getElementById('googleSignInBtn').click();

            // Wait for async operation
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockApp.authenticateGoogleDrive).toHaveBeenCalled();
        });
    });
});
