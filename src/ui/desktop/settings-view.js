// src/ui/desktop/settings-view.js

import { BaseUIController } from './base-ui-controller.js';

export class SettingsView extends BaseUIController {
    constructor(app) {
        super(app);
        this.statusTimeout = null;
        this.statusLocked = false;
    }

    initializeLanguageControls() {
        this.updateLanguageOptions();
        this.syncSettingsForm();
        this.languageService.applyTranslations(document);
    }

    syncSettingsForm() {
        const settings = this.app.settingsService.getSettings();
        const maxActiveGoals = document.getElementById('maxActiveGoals');
        const languageSelect = document.getElementById('languageSelect');
        const reviewIntervals = document.getElementById('reviewIntervals');

        if (maxActiveGoals) {
            maxActiveGoals.value = settings.maxActiveGoals;
        }
        if (languageSelect) {
            languageSelect.value = settings.language;
        }
        if (reviewIntervals) {
            const intervals = Array.isArray(settings.reviewIntervals) ? settings.reviewIntervals : [];
            reviewIntervals.value = intervals
                .map((interval) => this.formatReviewIntervalInput(interval))
                .filter(Boolean)
                .join(', ');
        }
    }

    updateLanguageOptions() {
        const languageSelect = document.getElementById('languageSelect');
        if (!languageSelect) {
            return;
        }

        const currentValue = languageSelect.value;
        languageSelect.innerHTML = '';

        this.languageService.getSupportedLanguages().forEach((languageCode) => {
            const option = document.createElement('option');
            option.value = languageCode;
            option.textContent = this.translate(`language.names.${languageCode}`);
            option.setAttribute('data-i18n-key', `language.names.${languageCode}`);
            languageSelect.appendChild(option);
        });

        const effectiveLanguage = this.app.settingsService.getSettings().language || this.languageService.getLanguage();
        languageSelect.value = effectiveLanguage;
    }

    setupEventListeners(renderViews, startCheckInTimer) {
        const saveSettingsBtn = document.getElementById('saveSettingsBtn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => {
                const languageSelect = document.getElementById('languageSelect');
                const currentSettings = this.app.settingsService.getSettings();
                const previousLanguage = currentSettings.language;
                const reviewIntervalsInput = document.getElementById('reviewIntervals');
                const newSettings = {
                    maxActiveGoals: parseInt(document.getElementById('maxActiveGoals').value),
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

                this.latestCheckInFeedback = null;
                startCheckInTimer();
                renderViews();
            });
        }

        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.app.exportData());
        }

        const importBtn = document.getElementById('importBtn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                const importFile = document.getElementById('importFile');
                if (importFile) {
                    importFile.click();
                }
            });
        }

        const importFile = document.getElementById('importFile');
        if (importFile) {
            importFile.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.app.importData(e.target.files[0]);
                    e.target.value = '';
                }
            });
        }

        // Google Drive sync event listeners
        const googleDriveAuthBtn = document.getElementById('googleDriveAuthBtn');
        if (googleDriveAuthBtn) {
            googleDriveAuthBtn.addEventListener('click', () => {
                this.app.authenticateGoogleDrive();
            });
        }

        const googleDriveSignOutBtn = document.getElementById('googleDriveSignOutBtn');
        if (googleDriveSignOutBtn) {
            googleDriveSignOutBtn.addEventListener('click', () => {
                this.app.signOutGoogleDrive();
            });
        }

        const googleDriveSyncBtn = document.getElementById('googleDriveSyncBtn');
        if (googleDriveSyncBtn) {
            googleDriveSyncBtn.addEventListener('click', () => {
                this.app.syncWithGoogleDrive();
            });
        }

        // Update Google Drive UI state
        this.updateGoogleDriveUI();
    }

    updateGoogleDriveUI() {
        if (!this.app.googleDriveSyncService) {
            return;
        }

        const authBtn = document.getElementById('googleDriveAuthBtn');
        const signOutBtn = document.getElementById('googleDriveSignOutBtn');
        const syncBtn = document.getElementById('googleDriveSyncBtn');
        const statusDiv = document.getElementById('googleDriveAuthStatus');

        if (!authBtn || !signOutBtn || !syncBtn || !statusDiv) {
            return;
        }

        const isAuthenticated = this.app.googleDriveSyncService.isAuthenticated();

        if (isAuthenticated) {
            authBtn.hidden = true;
            signOutBtn.hidden = false;
            syncBtn.hidden = false;

            // When an explicit status message is active, avoid overwriting it.
            if (!this.statusLocked) {
                statusDiv.hidden = false;
                statusDiv.className = 'google-drive-status google-drive-status-authenticated';
                statusDiv.textContent = this.translate('googleDrive.authenticated');
                
                // Update sync status asynchronously
                this.app.googleDriveSyncService.getSyncStatus().then(status => {
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
        } else {
            authBtn.hidden = false;
            signOutBtn.hidden = true;
            syncBtn.hidden = true;
            statusDiv.hidden = true;
        }
    }

    syncSettingsForm() {
        const settings = this.app.settingsService.getSettings();
        const maxActiveGoals = document.getElementById('maxActiveGoals');
        const languageSelect = document.getElementById('languageSelect');
        const reviewIntervals = document.getElementById('reviewIntervals');

        if (maxActiveGoals) {
            maxActiveGoals.value = settings.maxActiveGoals;
        }
        if (languageSelect) {
            languageSelect.value = settings.language;
        }
        if (reviewIntervals) {
            const intervals = Array.isArray(settings.reviewIntervals) ? settings.reviewIntervals : [];
            reviewIntervals.value = intervals
                .map((interval) => this.formatReviewIntervalInput(interval))
                .filter(Boolean)
                .join(', ');
        }

        // Update Google Drive UI
        this.updateGoogleDriveUI();
        
        // Update developer mode visibility
        this.updateDeveloperModeVisibility();
    }

    updateDeveloperModeVisibility() {
        const dataManagementItem = document.getElementById('dataManagementSection');
        if (dataManagementItem) {
            const isDeveloperMode = this.app.developerModeService.isDeveloperMode();
            dataManagementItem.style.display = isDeveloperMode ? 'block' : 'none';
        }
    }

    showGoogleDriveStatus(message, isError = false, isSuccess = false) {
        const statusDiv = document.getElementById('googleDriveAuthStatus');
        if (!statusDiv) {
            return;
        }

        // Clear any existing timeout to prevent race conditions
        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
        }

        statusDiv.hidden = false;
        statusDiv.textContent = message;
        statusDiv.className = isError
            ? 'google-drive-status google-drive-status-error'
            : (isSuccess
                ? 'google-drive-status google-drive-status-authenticated'
                : 'google-drive-status google-drive-status-info');

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

