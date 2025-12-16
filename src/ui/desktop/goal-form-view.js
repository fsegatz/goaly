// src/ui/desktop/goal-form-view.js

import { BaseUIController } from './base-ui-controller.js';
import { getElement, getOptionalElement } from '../utils/dom-utils.js';

export class GoalFormView extends BaseUIController {
    constructor(app) {
        super(app);
        this.renderViews = null;
        this.currentGoalId = null;
    }

    /**
     * Opens the goal form modal.
     * @param {Function} renderViews - Callback to render views after changes
     * @param {string|null} goalId - ID of the goal to edit, or null to create new
     */
    openGoalForm(renderViews, goalId = null) {
        this.renderViews = renderViews;
        this.currentGoalId = goalId;

        const modal = getElement('goalModal');
        const form = getElement('goalForm');

        if (!modal || !form) return;

        // Reset form state first
        this._resetFormState();

        if (goalId) {
            this._setupEditMode(goalId, form);
        } else {
            this._setupCreateMode(form);
        }

        modal.classList.add('is-visible');

        // Focus title input
        const titleInput = getElement('goalTitle');
        if (titleInput) {
            setTimeout(() => titleInput.focus(), 50);
        }
    }

    /** @private */
    _resetFormState() {
        const goalIdInput = getElement('goalId');
        if (goalIdInput) goalIdInput.value = '';

        const deleteBtn = getElement('deleteGoalBtn');
        if (deleteBtn) deleteBtn.style.display = 'none';

        // Reset recurrence section
        const recurringCheckbox = getElement('recurringCheckbox');
        const periodGroup = getElement('recurrencePeriodGroup');
        if (recurringCheckbox) recurringCheckbox.checked = false;
        if (periodGroup) periodGroup.style.display = 'none';

        // Hide state management section by default
        const stateManagementSection = getOptionalElement('goalStateManagementSection');
        if (stateManagementSection) {
            stateManagementSection.style.display = 'none';
        }
    }

    /** @private */
    _setupEditMode(goalId, form) {
        const goal = this.app.goalService.getGoal(goalId);
        if (!goal) return;

        const uiElements = this._getFormUIElements();

        // Update Title
        if (uiElements.modalTitle) {
            uiElements.modalTitle.textContent = this.translate('goalForm.editTitle');
        }

        // Populate Fields
        this._populateFormFields(goal, uiElements);

        // Update Delete Button
        if (uiElements.deleteBtn) {
            uiElements.deleteBtn.style.display = 'inline-block';
            uiElements.deleteBtn.onclick = () => {
                if (confirm(this.translate('goalForm.confirmDelete'))) {
                    this.handleDelete(this.renderViews);
                }
            };
        }

        // Show Status Buttons
        this._updateStatusButtons(goal);
    }

    /** @private */
    _setupCreateMode(form) {
        form.reset();

        const modalTitle = getElement('goalModalTitle');
        if (modalTitle) {
            modalTitle.textContent = this.translate('goalForm.createTitle');
        }

        // Hide state management section for new goals
        const stateManagementSection = getOptionalElement('goalStateManagementSection');
        if (stateManagementSection) {
            stateManagementSection.style.display = 'none';
        }
    }

    /** @private */
    _getFormUIElements() {
        return {
            modalTitle: getElement('goalModalTitle'),
            goalIdInput: getElement('goalId'),
            titleInput: getElement('goalTitle'),
            motivationInput: getElement('goalMotivation'),
            urgencyInput: getElement('goalUrgency'),
            deadlineInput: getElement('goalDeadline'),
            recurringCheckbox: getElement('recurringCheckbox'),
            periodInput: getElement('recurrencePeriod'),
            periodUnitSelect: getElement('recurrencePeriodUnit'),
            periodGroup: getElement('recurrencePeriodGroup'),
            deleteBtn: getElement('deleteGoalBtn'),
            completeBtn: getElement('completeGoalBtn'),
            unpauseBtn: getElement('unpauseGoalBtn'),
            reactivateBtn: getElement('reactivateGoalBtn'),
            forceActivateBtn: getElement('forceActivateGoalBtn'),
            stateManagementSection: getElement('goalStateManagementSection')
        };
    }

    /** @private */
    _populateFormFields(goal, ui) {
        if (ui.goalIdInput) ui.goalIdInput.value = goal.id;
        if (ui.titleInput) ui.titleInput.value = goal.title || '';
        if (ui.motivationInput) ui.motivationInput.value = goal.motivation || 1;
        if (ui.urgencyInput) ui.urgencyInput.value = goal.urgency || 1;

        if (ui.deadlineInput) {
            ui.deadlineInput.value = goal.deadline ? new Date(goal.deadline).toISOString().split('T')[0] : '';
        }

        if (ui.recurringCheckbox) {
            ui.recurringCheckbox.checked = goal.isRecurring || false;
        }

        if (ui.periodGroup) {
            ui.periodGroup.style.display = goal.isRecurring ? 'block' : 'none';
        }

        if (ui.periodInput) {
            ui.periodInput.value = goal.recurPeriod || 7;
        }
        if (ui.periodUnitSelect) {
            ui.periodUnitSelect.value = goal.recurPeriodUnit || 'days';
        }
    }

    /** @private */
    _updateStatusButtons(goal) {
        const ui = this._getFormUIElements();
        if (!ui.stateManagementSection) return;

        ui.stateManagementSection.style.display = 'block';

        // Show/hide state management buttons based on current status
        if (ui.completeBtn) {
            ui.completeBtn.style.display = goal.status !== 'completed' && goal.status !== 'notCompleted'
                ? 'inline-block'
                : 'none';
        }
        if (ui.unpauseBtn) {
            const isPaused = goal.status === 'paused' || this.app.goalService.isGoalPaused(goal);
            ui.unpauseBtn.style.display = isPaused ? 'inline-block' : 'none';
        }
        if (ui.reactivateBtn) {
            ui.reactivateBtn.style.display = goal.status === 'completed' || goal.status === 'notCompleted'
                ? 'inline-block'
                : 'none';
        }
        if (ui.forceActivateBtn) {
            const canForceActivate = goal.status !== 'active' &&
                goal.status !== 'completed' &&
                goal.status !== 'notCompleted';
            ui.forceActivateBtn.style.display = canForceActivate ? 'inline-block' : 'none';
        }
    }

    closeGoalForm() {
        const modal = getOptionalElement('goalModal');
        if (modal) {
            modal.classList.remove('is-visible');
        }
        const form = getOptionalElement('goalForm');
        if (form) {
            form.reset();
        }
        this.renderViews = null;
        this.currentGoalId = null;
    }

    setupEventListeners(handleGoalSubmit, handleDelete, renderViews, openCompletionModal) {
        const goalForm = getOptionalElement('goalForm');
        if (goalForm) {
            goalForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleGoalSubmit(renderViews);
            });
        }

        const cancelBtn = getOptionalElement('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeGoalForm());
        }

        // Toggle recurrence period container visibility
        const recurringCheckbox = getOptionalElement('recurringCheckbox');
        const recurringPeriodGroup = getOptionalElement('recurrencePeriodGroup');
        if (recurringCheckbox && recurringPeriodGroup) {
            recurringCheckbox.addEventListener('change', () => {
                recurringPeriodGroup.style.display = recurringCheckbox.checked ? 'block' : 'none';
                // Reset to defaults if unchecked
                if (!recurringCheckbox.checked) {
                    const recurPeriodInput = getOptionalElement('recurrencePeriod');
                    const recurPeriodUnitSelect = getOptionalElement('recurrencePeriodUnit');
                    if (recurPeriodInput) {
                        recurPeriodInput.value = 7;
                    }
                    if (recurPeriodUnitSelect) {
                        recurPeriodUnitSelect.value = 'days';
                    }
                }
            });
        }

        // Delete button listener is now set in _setupEditMode

        const completeBtn = getOptionalElement('completeGoalBtn');
        if (completeBtn) {
            completeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const goalId = getElement('goalId').value;
                if (goalId && openCompletionModal) {
                    // Open the completion modal without closing the goal form modal
                    openCompletionModal(goalId);
                }
            });
        }

        const unpauseBtn = getOptionalElement('unpauseGoalBtn');
        if (unpauseBtn) {
            unpauseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleUnpauseGoal(renderViews);
            });
        }

        const reactivateBtn = getOptionalElement('reactivateGoalBtn');
        if (reactivateBtn) {
            reactivateBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleReactivateGoal(renderViews);
            });
        }

        const forceActivateBtn = getOptionalElement('forceActivateGoalBtn');
        if (forceActivateBtn) {
            forceActivateBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleForceActivateGoal(renderViews);
            });
        }

        // Get the close button specifically from the goal modal
        const goalModal = getOptionalElement('goalModal');
        const closeBtn = goalModal ? goalModal.querySelector('.close') : null;
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeGoalForm());
        }

        // Global keydown listener for Escape to close modal
        document.addEventListener('keydown', (e) => {
            const modal = getElement('goalModal');
            if (e.key === 'Escape' && modal && modal.classList.contains('is-visible')) {
                // Check if any other modal is open on top (like reset confirmation)
                const completionModal = getElement('completionModal');
                if (completionModal && completionModal.classList.contains('is-visible')) {
                    return;
                }
                this.closeGoalForm();
            }
        });

        // Use mousedown instead of click to avoid closing the modal immediately
        document.addEventListener('mousedown', (e) => this._handleOutsideClick(e));
    }

    /** @private */
    _handleOutsideClick(e) {
        const modal = getOptionalElement('goalModal');
        if (!modal) return;

        const isModalVisible = modal.classList.contains('is-visible');

        // Close only when the click happens outside the modal
        if (isModalVisible && e.target?.nodeType === 1) {
            try {
                if (!modal.contains(e.target)) {
                    // Check if the click is on another modal (completion, pause, etc.)
                    const clickedOnOtherModal = e.target.closest('.modal') && !e.target.closest('#goalModal');

                    // Check if the click target is a button that opens the modal
                    const clickedElement = e.target;
                    const isAddGoalBtn = clickedElement.id === 'addGoalBtn' || clickedElement.closest('#addGoalBtn');
                    const isEditBtn = clickedElement.classList && (clickedElement.classList.contains('edit-goal') || clickedElement.closest('.edit-goal'));

                    if (!isAddGoalBtn && !isEditBtn && !clickedOnOtherModal) {
                        this.closeGoalForm();
                    }
                }
            } catch {
                // Contains check failed, ignore
            }
        }
    }

    handleGoalSubmit(renderViews) {
        const id = getElement('goalId').value;
        const recurringCheckbox = getOptionalElement('goalIsRecurring');

        const goalData = {
            title: getElement('goalTitle').value,
            motivation: getElement('goalMotivation').value,
            urgency: getElement('goalUrgency').value,
            deadline: getElement('goalDeadline').value || null,
            isRecurring: recurringCheckbox ? recurringCheckbox.checked : false
        };

        // Add period fields if recurring
        if (goalData.isRecurring) {
            const recurPeriodInput = getOptionalElement('goalRecurPeriod');
            const recurPeriodUnitSelect = getOptionalElement('goalRecurPeriodUnit');
            if (recurPeriodInput) {
                goalData.recurPeriod = Number.parseInt(recurPeriodInput.value, 10) || 7;
            } else {
                goalData.recurPeriod = 7; // Default
            }
            if (recurPeriodUnitSelect) {
                goalData.recurPeriodUnit = recurPeriodUnitSelect.value || 'days';
            } else {
                goalData.recurPeriodUnit = 'days'; // Default
            }
        }

        try {
            if (id) {
                // Update existing goal
                this.app.goalService.updateGoal(id, goalData, this.app.settingsService.getSettings().maxActiveGoals);

                // No need to handle recurrence date separately - it's in goalData
            } else {
                // Create new goal
                this.app.goalService.createGoal(goalData, this.app.settingsService.getSettings().maxActiveGoals);
            }
            this.closeGoalForm();
            renderViews();
        } catch (error) {
            alert(error.message || this.translate('errors.goalSaveFailed'));
        }
    }

    handleDelete(renderViews) {
        const id = getElement('goalId').value;
        this.app.goalService.deleteGoal(id, this.app.settingsService.getSettings().maxActiveGoals);
        this.closeGoalForm();
        renderViews();
    }

    _getGoalFromForm() {
        const id = getElement('goalId').value;
        if (!id) return null;

        const goal = this.app.goalService.goals.find(g => g.id === id);
        return goal || null;
    }

    handleUnpauseGoal(renderViews) {
        const goal = this._getGoalFromForm();
        if (!goal) return;

        this.app.goalService.unpauseGoal(goal.id, this.app.settingsService.getSettings().maxActiveGoals);
        // Refresh the goal form to update button visibility
        this.openGoalForm(renderViews, goal.id);
        renderViews();
    }

    handleReactivateGoal(renderViews) {
        const goal = this._getGoalFromForm();
        if (!goal) return;

        // Reactivate by setting status to inactive, then let auto-activation handle it
        // This ensures the goal is reactivated based on priority
        this.app.goalService.setGoalStatus(goal.id, 'inactive', this.app.settingsService.getSettings().maxActiveGoals);
        // Refresh the goal form to update button visibility
        this.openGoalForm(renderViews, goal.id);
        renderViews();
    }

    handleForceActivateGoal(renderViews) {
        const goal = this._getGoalFromForm();
        if (!goal) return;

        const maxActiveGoals = this.app.settingsService.getSettings().maxActiveGoals;
        this.app.goalService.forceActivateGoal(goal.id, maxActiveGoals);

        // Refresh the goal form to update button visibility
        this.openGoalForm(renderViews, goal.id);
        renderViews();
    }

}
