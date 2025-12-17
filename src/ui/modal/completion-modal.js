// src/ui/modal/completion-modal.js

import { getOptionalElement } from '../utils/dom-utils.js';
import { BaseModal } from '../base-modal.js';

export class CompletionModal extends BaseModal {
    constructor(app) {
        super(app);
        this.completionModalRefs = {
            completionModal: null,
            completionSuccessBtn: null,
            completionFailureBtn: null,
            completionCloseBtn: null,
            completionRecurringCheckbox: null,
            completionRecurDateContainer: null,
            completionRecurDate: null
        };
        this.pendingCompletionGoalId = null;
        this.completionModalInitialized = false;
    }

    setup(handleCompletionChoice) {
        if (this.completionModalInitialized) {
            return;
        }

        const modal = this.getElement('completionModal');
        if (!modal) {
            return;
        }

        // Get recurring elements
        const recurringCheckbox = this.getElement('completionRecurringCheckbox');
        const recurDateContainer = this.getElement('completionRecurDateContainer');
        const recurDate = this.getElement('completionRecurDate');

        // Toggle recurrence date visibility
        if (recurringCheckbox && recurDateContainer) {
            recurringCheckbox.addEventListener('change', () => {
                if (recurringCheckbox.checked) {
                    recurDateContainer.style.display = 'block';
                } else {
                    recurDateContainer.style.display = 'none';
                    if (recurDate) {
                        recurDate.value = '';
                    }
                }
            });
        }

        const successBtn = this.getElement('completionSuccessBtn');
        if (successBtn) {
            successBtn.addEventListener('click', () => {
                const recurrenceData = this.getRecurrenceData();
                // If validation failed (returns false), don't proceed
                if (recurrenceData === false) {
                    return;
                }
                handleCompletionChoice('completed', recurrenceData);
            });
        }

        const failureBtn = this.getElement('completionFailureBtn');
        if (failureBtn) {
            failureBtn.addEventListener('click', () => {
                const recurrenceData = this.getRecurrenceData();
                // If validation failed (returns false), don't proceed
                if (recurrenceData === false) {
                    return;
                }
                handleCompletionChoice('notCompleted', recurrenceData);
            });
        }

        const closeBtn = this.getElement('completionCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
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

        this.completionModalInitialized = true;
    }

    open(goalId) {
        if (!goalId) return;

        const modal = this.getElement('completionModal');
        if (!modal) return;

        const goal = this.app.goalService.goals.find(g => g.id === goalId);

        if (goal?.isRecurring) {
            this._setupRecurringFields(goal);
        } else {
            this._resetRecurringFields();
        }

        this.pendingCompletionGoalId = goalId;
        modal.classList.add('is-visible');
        this.languageService.applyTranslations(modal);
    }

    /** @private */
    _setupRecurringFields(goal) {
        // Pre-check checkbox for recurring goals
        const recurringCheckbox = this.getElement('completionRecurringCheckbox');
        if (recurringCheckbox) recurringCheckbox.checked = true;

        // Calculate and display next recurrence date
        const nextDate = this._calculateNextRecurrenceDate(goal);

        // Set the date input value
        const recurDateInput = this.getElement('completionRecurDate');
        if (recurDateInput) {
            recurDateInput.value = nextDate.toISOString().split('T')[0];

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            recurDateInput.min = today.toISOString().split('T')[0];
        }

        // Show the date container
        const recurDateContainer = this.getElement('completionRecurDateContainer');
        if (recurDateContainer) recurDateContainer.style.display = 'block';
    }

    /** @private */
    _calculateNextRecurrenceDate(goal) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let nextDate = new Date(today);

        const period = goal.recurPeriod || 7;
        const unit = goal.recurPeriodUnit || 'days';

        if (unit === 'days') {
            nextDate.setDate(nextDate.getDate() + period);
        } else if (unit === 'weeks') {
            nextDate.setDate(nextDate.getDate() + (period * 7));
        } else if (unit === 'months') {
            nextDate.setMonth(nextDate.getMonth() + period);
        }
        return nextDate;
    }

    /** @private */
    _resetRecurringFields() {
        const recurringCheckbox = this.getElement('completionRecurringCheckbox');
        if (recurringCheckbox) recurringCheckbox.checked = false;

        const recurDateContainer = this.getElement('completionRecurDateContainer');
        if (recurDateContainer) recurDateContainer.style.display = 'none';

        const recurDateInput = this.getElement('completionRecurDate');
        if (recurDateInput) recurDateInput.value = '';
    }

    close() {
        const modal = this.getElement('completionModal');
        if (modal) {
            modal.classList.remove('is-visible');
        }
        this.pendingCompletionGoalId = null;
    }

    getPendingGoalId() {
        return this.pendingCompletionGoalId;
    }

    getRecurrenceData() {
        const recurringCheckbox = this.getElement('completionRecurringCheckbox');
        const recurDate = this.getElement('completionRecurDate');

        if (!recurringCheckbox?.checked) {
            return null;
        }

        if (!recurDate?.value) {
            // Show error if recurring is checked but no date provided
            alert(this.translate('completionModal.recurDateRequired') || 'Please select a recurrence date');
            return false; // Return false to indicate validation error
        }

        // Parse date in local timezone to avoid off-by-one-day errors
        const recurrenceDate = new Date(recurDate.value + 'T00:00:00');

        return {
            isRecurring: true,
            recurrenceDate
        };
    }

    getElement(id) {
        if (!this.completionModalRefs) {
            this.completionModalRefs = {};
        }
        return this.getCachedElement(this.completionModalRefs, id, getOptionalElement);
    }
}
