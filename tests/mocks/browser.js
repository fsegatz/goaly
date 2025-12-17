// tests/mocks/browser.js

/**
 * Sets up browser API mocks (File, FileReader, console, alert, confirm)
 */
function setupBrowserMocks() {
    // Mock File
    if (!global.File) {
        global.File = class File {
            constructor(parts, name, options) {
                this.parts = parts;
                this.name = name;
                this._textContent = Array.isArray(parts) ? parts.join('') : String(parts);
                this.type = options?.type || 'application/json';
            }

            // Modern Blob.text() API
            async text() {
                return this._textContent;
            }
        };
    }

    // Mock FileReader
    if (!global.FileReader) {
        global.FileReader = class FileReader {
            constructor() {
                this.onload = null;
                this.onerror = null;
            }
            readAsText(file) {
                // Simulate async read
                const self = this;
                setTimeout(() => {
                    if (self.onload) {
                        const result = file instanceof File ? file._textContent : String(file);
                        self.onload({ target: { result } });
                    }
                }, 0);
            }
        };
    }

    // Mock console
    if (!global.console) {
        global.console = {};
    }
    global.console.error = global.console.error || jest.fn();
    global.console.warn = global.console.warn || jest.fn();
    global.console.log = global.console.log || jest.fn();

    // Mock alert
    global.alert = global.alert || jest.fn();

    // Mock confirm
    global.confirm = global.confirm || jest.fn();

    // Make alert and confirm available on window if it exists
    if (global.window) {
        global.window.alert = global.alert;
        global.window.confirm = global.confirm;
    }
}

/**
 * Cleans up browser API mocks
 */
function cleanupBrowserMocks() {
    delete global.File;
    delete global.FileReader;
    delete global.alert;
    delete global.confirm;
    // Don't delete console as it might be used elsewhere
}

module.exports = {
    setupBrowserMocks,
    cleanupBrowserMocks
};

