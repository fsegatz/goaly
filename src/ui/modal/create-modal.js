// src/ui/modal/create-modal.js

import { BaseModal } from '../base-modal.js';
import { getElement, getOptionalElement } from '../utils/dom-utils.js';

export class CreateModal extends BaseModal {
    constructor(app) {
        super(app);
        this.renderViews = null;
    }

    /**
     * Opens the goal form modal for creating a new goal.
     * @param {Function} renderViews - Callback to render views after changes
     */
    open(renderViews) {
        console.log('CreateModal.open called');
        this.renderViews = renderViews;

        const modal = getOptionalElement('goalModal');
        const form = getOptionalElement('goalForm');

        console.log('CreateModal: modal element found:', !!modal);
        console.log('CreateModal: form element found:', !!form);

        if (!modal || !form) {
            console.error('CreateModal: Goal modal elements not found in DOM');
            return;
        }

        // Attach Submit Handler (Dynamic) - Fixes Double Listener Bug
        form.onsubmit = (e) => {
            e.preventDefault();
            this.handleGoalSubmit();
        };

        // Reset form state
        console.log('CreateModal: calling _resetFormState');
        this._resetFormState();
        console.log('CreateModal: calling _setupCreateMode');
        this._setupCreateMode(form);

        console.log('CreateModal: adding is-visible class');
        modal.classList.add('is-visible');
        console.log('CreateModal: modal classes after add:', modal.classList.toString());

        // Focus title input
        const titleInput = getOptionalElement('goalTitle');
        if (titleInput) {
            setTimeout(() => titleInput.focus(), 50);
        }
        console.log('CreateModal.open completed');
    }

    /** @private */
    _resetFormState() {
        const goalIdInput = getOptionalElement('goalId');
        if (goalIdInput) goalIdInput.value = '';

        const deleteBtn = getOptionalElement('deleteBtn');
        if (deleteBtn) deleteBtn.style.display = 'none';

        // Reset recurrence section
        const recurringCheckbox = getOptionalElement('goalIsRecurring');
        const periodGroup = getOptionalElement('recurringPeriodContainer');
        if (recurringCheckbox) recurringCheckbox.checked = false;
        if (periodGroup) periodGroup.style.display = 'none';

        // Hide state management section by default
        const stateManagementSection = getOptionalElement('goalStateManagementSection');
        if (stateManagementSection) {
            stateManagementSection.style.display = 'none';
        }
    }

    /** @private */
    _setupCreateMode(form) {
        form.reset();

        const modalTitle = getOptionalElement('modalTitle');
        if (modalTitle) {
            modalTitle.textContent = this.translate('goalForm.createTitle');
        }

        // Hide edit-specific buttons if any are visible from previous state
        const ui = this._getFormUIElements();
        if (ui.deleteBtn) ui.deleteBtn.style.display = 'none';
        if (ui.completeBtn) ui.completeBtn.style.display = 'none';
        if (ui.unpauseBtn) ui.unpauseBtn.style.display = 'none';
        if (ui.reactivateBtn) ui.reactivateBtn.style.display = 'none';
        if (ui.forceActivateBtn) ui.forceActivateBtn.style.display = 'none';
    }

    /** @protected */
    _getFormUIElements() {
        return {
            modalTitle: getOptionalElement('modalTitle'),
            goalIdInput: getOptionalElement('goalId'),
            titleInput: getOptionalElement('goalTitle'),
            motivationInput: getOptionalElement('goalMotivation'),
            urgencyInput: getOptionalElement('goalUrgency'),
            deadlineInput: getOptionalElement('goalDeadline'),
            recurringCheckbox: getOptionalElement('goalIsRecurring'),
            periodInput: getOptionalElement('goalRecurPeriod'),
            periodUnitSelect: getOptionalElement('goalRecurPeriodUnit'),
            periodGroup: getOptionalElement('recurringPeriodContainer'),
            deleteBtn: getOptionalElement('deleteBtn'),
            completeBtn: getOptionalElement('completeGoalBtn'),
            unpauseBtn: getOptionalElement('unpauseGoalBtn'),
            reactivateBtn: getOptionalElement('reactivateGoalBtn'),
            forceActivateBtn: getOptionalElement('forceActivateGoalBtn'),
            stateManagementSection: getOptionalElement('goalStateManagementSection')
        };
    }

    close() {
        const modal = getOptionalElement('goalModal');
        if (modal) {
            modal.classList.remove('is-visible');
        }
        const form = getOptionalElement('goalForm');
        if (form) {
            form.reset();
            // Optional: clear onsubmit, though open() will overwrite it next time
            form.onsubmit = null;
        }
        this.renderViews = null;
    }

    setupEventListeners() {
        // NOTE: Submit listener listener Removed. Handled dynamically in open() via onsubmit.

        const cancelBtn = getOptionalElement('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.close());
        }

        // Toggle recurrence period container visibility
        const recurringCheckbox = getOptionalElement('goalIsRecurring');
        const recurringPeriodGroup = getOptionalElement('recurringPeriodContainer');
        if (recurringCheckbox && recurringPeriodGroup) {
            recurringCheckbox.addEventListener('change', () => {
                recurringPeriodGroup.style.display = recurringCheckbox.checked ? 'block' : 'none';
                if (!recurringCheckbox.checked) {
                    // Reset defaults
                    const recurPeriodInput = getOptionalElement('goalRecurPeriod');
                    const recurPeriodUnitSelect = getOptionalElement('goalRecurPeriodUnit');
                    if (recurPeriodInput) recurPeriodInput.value = 7;
                    if (recurPeriodUnitSelect) recurPeriodUnitSelect.value = 'days';
                }
            });
        }

        // Get the close button specifically from the goal modal
        const goalModal = getOptionalElement('goalModal');
        const closeBtn = goalModal ? goalModal.querySelector('.close') : null;
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // Global keydown listener for Escape
        document.addEventListener('keydown', (e) => {
            const modal = getOptionalElement('goalModal');
            if (e.key === 'Escape' && modal?.classList.contains('is-visible')) {
                const completionModal = getOptionalElement('completionModal');
                if (completionModal?.classList.contains('is-visible')) {
                    return;
                }
                this.close();
            }
        });

        // Outside click
        document.addEventListener('mousedown', (e) => this._handleOutsideClick(e));
    }

    /** @private */
    _handleOutsideClick(e) {
        const modal = getOptionalElement('goalModal');
        if (!modal) return;

        const isModalVisible = modal.classList.contains('is-visible');

        if (isModalVisible && e.target?.nodeType === 1) {
            try {
                if (!modal.contains(e.target)) {
                    // Check logic for other modals or buttons to avoid closing immediately
                    const clickedOnOtherModal = e.target.closest('.modal') && !e.target.closest('#goalModal');
                    const clickedElement = e.target;
                    const isAddGoalBtn = clickedElement.id === 'addGoalBtn' || clickedElement.closest('#addGoalBtn');
                    // 'edit-goal' class might be used by EditModal triggers
                    const isEditBtn = clickedElement.classList && (clickedElement.classList.contains('edit-goal') || clickedElement.closest('.edit-goal'));

                    if (!isAddGoalBtn && !isEditBtn && !clickedOnOtherModal) {
                        this.close();
                    }
                }
            } catch {
                // Ignore
            }
        }
    }

    getFormData() {
        const recurringCheckbox = getOptionalElement('goalIsRecurring');
        const data = {
            title: getElement('goalTitle').value,
            motivation: getElement('goalMotivation').value,
            urgency: getElement('goalUrgency').value,
            deadline: getElement('goalDeadline').value || null,
            isRecurring: recurringCheckbox ? recurringCheckbox.checked : false
        };

        if (data.isRecurring) {
            const recurPeriodInput = getOptionalElement('goalRecurPeriod');
            const recurPeriodUnitSelect = getOptionalElement('goalRecurPeriodUnit');
            data.recurPeriod = Number.parseInt(recurPeriodInput?.value, 10) || 7;
            data.recurPeriodUnit = recurPeriodUnitSelect?.value || 'days';
        }
        return data;
    }

    handleGoalSubmit() {
        console.log('CreateModal.handleGoalSubmit called');
        try {
            const goalData = this.getFormData();
            console.log('CreateModal: Form data retrieved:', goalData);
            this.app.goalService.createGoal(goalData, this.app.settingsService.getSettings().maxActiveGoals);
            console.log('CreateModal: Goal created successfully');
            this.close();
            if (this.renderViews) this.renderViews();
        } catch (error) {
            console.error('CreateModal: handleGoalSubmit error:', error);
            alert(error.message || this.translate('errors.goalSaveFailed'));
        }
    }
}

