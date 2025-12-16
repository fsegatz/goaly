// src/ui/desktop/settings-view.js

import { getElement, getOptionalElement } from '../utils/dom-utils.js';

import { BaseUIController } from './base-ui-controller.js';

export class SettingsView extends BaseUIController {
    constructor(app) {
        super(app);
        this.statusTimeout = null;
        this.statusLocked = false;
        this._lastStatusCheck = 0;
    }

    initializeLanguageControls() {
        this.updateLanguageOptions();
        this.syncSettingsForm();
        this.languageService.applyTranslations(document);
    }

    syncSettingsForm() {
        const settings = this.app.settingsService.getSettings();
        const maxActiveGoals = getOptionalElement('maxActiveGoals');
        const languageSelect = getOptionalElement('languageSelect');
        const reviewIntervals = getOptionalElement('reviewIntervals');

        if (maxActiveGoals) {
            maxActiveGoals.value = settings.maxActiveGoals;
        }
        if (languageSelect) {
            languageSelect.value = settings.language;
        }
        if (reviewIntervals) {
            // Only sync if the input is not focused to avoid overwriting user input
            if (document.activeElement !== reviewIntervals) {
                const intervals = Array.isArray(settings.reviewIntervals) ? settings.reviewIntervals : [];
                reviewIntervals.value = intervals
                    .map((interval) => this.formatReviewIntervalInput(interval))
                    .filter(Boolean)
                    .join(', ');
            }
        }

        // Update Google Drive UI
        this.updateGoogleDriveUI();

        // Update developer mode visibility
        this.updateDeveloperModeVisibility();
    }

    updateLanguageOptions() {
        const languageSelect = getOptionalElement('languageSelect');
        if (!languageSelect) {
            return;
        }

        languageSelect.innerHTML = '';

        this.languageService.getSupportedLanguages().forEach((languageCode) => {
            const option = document.createElement('option');
            option.value = languageCode;
            option.textContent = this.translate(`language.names.${languageCode}`);
            option.dataset.i18nKey = `language.names.${languageCode}`;
            languageSelect.appendChild(option);
        });

        const effectiveLanguage = this.app.settingsService.getSettings().language || this.languageService.getLanguage();
        languageSelect.value = effectiveLanguage;
    }

    setupEventListeners(renderViews, startReviewTimer) {
        const saveSettingsBtn = getOptionalElement('saveSettingsBtn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => {
                const languageSelect = getOptionalElement('languageSelect');
                const currentSettings = this.app.settingsService.getSettings();
                const previousLanguage = currentSettings.language;
                const reviewIntervalsInput = getOptionalElement('reviewIntervals');
                const newSettings = {
                    maxActiveGoals: Number.parseInt(getElement('maxActiveGoals').value, 10),
                    language: languageSelect ? languageSelect.value : previousLanguage,
                    reviewIntervals: reviewIntervalsInput ? reviewIntervalsInput.value : currentSettings.reviewIntervals
                };
                const oldMaxActiveGoals = currentSettings.maxActiveGoals;
                this.app.settingsService.updateSettings(newSettings);

                // Automatically re-activate goals if maxActiveGoals changed
                if (newSettings.maxActiveGoals !== oldMaxActiveGoals) {
                    this.app.goalService.autoActivateGoalsByPriority(newSettings.maxActiveGoals);
                }

                if (newSettings.language && newSettings.language !== previousLanguage) {
                    this.app.languageService.setLanguage(newSettings.language);
                }

                this.latestReviewFeedback = null;
                // Immediately refresh reviews when intervals change
                this.app.refreshReviews({ render: true });
                startReviewTimer();
                renderViews();
            });
        }

        const exportBtn = getOptionalElement('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.app.exportData());
        }

        const importBtn = getOptionalElement('importBtn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                const importFile = getOptionalElement('importFile');
                if (importFile) {
                    importFile.click();
                }
            });
        }

        const importFile = getOptionalElement('importFile');
        if (importFile) {
            importFile.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.app.importData(e.target.files[0]);
                    e.target.value = '';
                }
            });
        }

        // Google Drive sync event listeners
        const googleDriveAuthBtn = getOptionalElement('googleDriveAuthBtn');
        if (googleDriveAuthBtn) {
            googleDriveAuthBtn.addEventListener('click', () => {
                this.app.authenticateGoogleDrive();
            });
        }

        const googleDriveSignOutBtn = getOptionalElement('googleDriveSignOutBtn');
        if (googleDriveSignOutBtn) {
            googleDriveSignOutBtn.addEventListener('click', () => {
                this.app.signOutGoogleDrive();
            });
        }

        const googleDriveSyncBtn = getOptionalElement('googleDriveSyncBtn');
        if (googleDriveSyncBtn) {
            googleDriveSyncBtn.addEventListener('click', () => {
                this.app.syncWithGoogleDrive();
            });
        }

        // Update Google Drive UI state
        this.updateGoogleDriveUI();
    }

    updateGoogleDriveUI() {
        if (!this.app.syncManager?.isAvailable()) {
            return;
        }

        const authBtn = getOptionalElement('googleDriveAuthBtn');
        const signOutBtn = getOptionalElement('googleDriveSignOutBtn');
        const syncBtn = getOptionalElement('googleDriveSyncBtn');
        const statusDiv = getOptionalElement('googleDriveAuthStatus');

        if (!authBtn || !signOutBtn || !syncBtn || !statusDiv) {
            return;
        }

        const isAuthenticated = this.app.syncManager.isAuthenticated();

        if (isAuthenticated) {
            authBtn.hidden = true;
            signOutBtn.hidden = false;
            syncBtn.hidden = false;

            // When an explicit status message is active, avoid overwriting it.
            if (!this.statusLocked) {
                statusDiv.hidden = false;
                statusDiv.className = 'google-drive-status google-drive-status-authenticated';
                statusDiv.textContent = this.translate('googleDrive.authenticated');

                // Update sync status asynchronously (debounced to avoid excessive API calls)
                // Only check if we haven't checked recently
                if (!this._lastStatusCheck || (Date.now() - this._lastStatusCheck) > 60000) {
                    this._lastStatusCheck = Date.now();
                    this.app.syncManager.getSyncStatus().then(status => {
                        if (status.synced && status.lastSyncTime && !this.statusLocked) {
                            const syncDate = new Date(status.lastSyncTime);
                            statusDiv.textContent = this.translate('googleDrive.lastSynced', {
                                time: syncDate.toLocaleString()
                            });
                        }
                    }).catch(() => {
                        // Ignore errors when checking status
                    });
                }
            }
        } else {
            authBtn.hidden = false;
            signOutBtn.hidden = true;
            syncBtn.hidden = true;
            statusDiv.hidden = true;
        }
    }

    updateDeveloperModeVisibility() {
        const dataManagementItem = getOptionalElement('dataManagementSection');
        if (dataManagementItem) {
            const isDeveloperMode = this.app.developerModeService.isDeveloperMode();
            dataManagementItem.style.display = isDeveloperMode ? 'block' : 'none';
        }
    }

    showGoogleDriveStatus(message, isError = false, isSuccess = false) {
        const statusDiv = getOptionalElement('googleDriveAuthStatus');
        if (!statusDiv) {
            return;
        }

        // Clear any existing timeout to prevent race conditions
        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
        }

        statusDiv.hidden = false;
        statusDiv.textContent = message;
        let statusClass = 'google-drive-status google-drive-status-info';
        if (isError) {
            statusClass = 'google-drive-status google-drive-status-error';
        } else if (isSuccess) {
            statusClass = 'google-drive-status google-drive-status-authenticated';
        }
        statusDiv.className = statusClass;

        // Mark status as locked so regular UI refreshes do not overwrite it
        this.statusLocked = true;

        // Clear status after a delay
        this.statusTimeout = setTimeout(() => {
            this.statusLocked = false;
            this.updateGoogleDriveUI();
            this.statusTimeout = null;
        }, isSuccess ? 10000 : 5000);

        // Use unref() to prevent timer from keeping Node.js process alive (for testing)
        if (typeof this.statusTimeout.unref === 'function') {
            this.statusTimeout.unref();
        }
    }
}

