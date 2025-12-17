// src/ui/modal/pause-modal.js

import { getOptionalElement } from '../utils/dom-utils.js';
import { BaseModal } from '../base-modal.js';

export class PauseModal extends BaseModal {
    constructor(app) {
        super(app);
        this.pauseModalRefs = {};
        this.pendingPauseGoalId = null;
        this.pauseModalInitialized = false;
    }

    setup(handlePauseChoice) {
        if (this.pauseModalInitialized) {
            return;
        }

        const modal = this.getElement('pauseModal');
        if (!modal) {
            return;
        }

        const confirmBtn = this.getElement('pauseConfirmBtn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                const pauseType = this.getElement('pauseUntilDate')?.checked ? 'date' : 'goal';
                let pauseUntil = null;
                let pauseUntilGoalId = null;

                if (pauseType === 'date') {
                    const dateInput = this.getElement('pauseUntilDateInput');
                    if (dateInput?.value) {
                        // Parse date in local timezone to avoid off-by-one-day errors
                        pauseUntil = new Date(dateInput.value + 'T00:00:00');
                    }
                } else {
                    const goalSelect = this.getElement('pauseUntilGoalSelect');
                    if (goalSelect?.value) {
                        pauseUntilGoalId = goalSelect.value;
                    }
                }

                if (pauseType === 'date' && !pauseUntil) {
                    // Date is required for date pause type
                    return;
                }
                if (pauseType === 'goal' && !pauseUntilGoalId) {
                    // Goal is required for goal pause type
                    return;
                }

                handlePauseChoice({
                    pauseUntil,
                    pauseUntilGoalId
                });
            });
        }

        const cancelBtn = this.getElement('pauseCancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.close();
            });
        }

        const closeBtn = this.getElement('pauseCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.close();
            });
        }

        // Toggle between date and goal options
        const dateRadio = this.getElement('pauseUntilDate');
        const goalRadio = this.getElement('pauseUntilGoal');
        const dateInput = this.getElement('pauseUntilDateInput');
        const goalSelect = this.getElement('pauseUntilGoalSelect');

        if (dateRadio && goalRadio && dateInput && goalSelect) {
            dateRadio.addEventListener('change', () => {
                dateInput.disabled = false;
                goalSelect.disabled = true;
            });
            goalRadio.addEventListener('change', () => {
                dateInput.disabled = true;
                goalSelect.disabled = false;
            });
        }

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                this.close();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modal.classList.contains('is-visible')) {
                this.close();
            }
        });

        this.pauseModalInitialized = true;
    }

    open(goalId) {
        if (!goalId) return;

        const modal = this.getElement('pauseModal');
        if (!modal) return;

        this.pendingPauseGoalId = goalId;

        this._setupDateInput();
        this._populateGoalSelect(goalId);
        this._resetModalState();

        modal.classList.add('is-visible');
        this.languageService.applyTranslations(modal);
    }

    /** @private */
    _setupDateInput() {
        const dateInput = this.getElement('pauseUntilDateInput');
        if (dateInput) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            dateInput.min = today.toISOString().split('T')[0];
            dateInput.value = '';
        }
    }

    /** @private */
    _populateGoalSelect(currentGoalId) {
        const goalSelect = this.getElement('pauseUntilGoalSelect');
        if (!goalSelect) return;

        goalSelect.innerHTML = '<option value="" data-i18n-key="pauseModal.selectGoal">Select a goal...</option>';

        const goals = this.app.goalService.goals.filter(
            g => g.id !== currentGoalId && g.status !== 'completed' && g.status !== 'notCompleted'
        );

        if (goals.length === 0) {
            this._addNoGoalsOption(goalSelect);
        } else {
            goals.forEach(goal => {
                const option = document.createElement('option');
                option.value = goal.id;
                option.textContent = goal.title;
                goalSelect.appendChild(option);
            });
        }
        goalSelect.value = '';
    }

    /** @private */
    _addNoGoalsOption(selectElement) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = this.translate('pauseModal.noGoalsAvailable') || 'No other goals available';
        option.disabled = true;
        selectElement.appendChild(option);
    }

    /** @private */
    _resetModalState() {
        // Reset to date option
        const dateRadio = this.getElement('pauseUntilDate');
        const goalRadio = this.getElement('pauseUntilGoal');
        const dateInput = this.getElement('pauseUntilDateInput');
        const goalSelect = this.getElement('pauseUntilGoalSelect');

        if (dateRadio) dateRadio.checked = true;
        if (goalRadio) goalRadio.checked = false;

        if (dateInput) dateInput.disabled = false;
        if (goalSelect) goalSelect.disabled = true;
    }

    close() {
        const modal = this.getElement('pauseModal');
        if (modal) {
            modal.classList.remove('is-visible');
        }
        this.pendingPauseGoalId = null;
    }

    getPendingGoalId() {
        return this.pendingPauseGoalId;
    }

    getElement(id) {
        if (!this.pauseModalRefs) {
            this.pauseModalRefs = {};
        }
        return this.getCachedElement(this.pauseModalRefs, id, getOptionalElement);
    }
}
