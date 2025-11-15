// src/ui/desktop/settings-view.js

import { BaseUIController } from './base-ui-controller.js';

export class SettingsView extends BaseUIController {
    constructor(app) {
        super(app);
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
    }
}

