// src/ui/modal/edit-modal.js

import { CreateModal } from './create-modal.js';
import { getElement, getOptionalElement } from '../utils/dom-utils.js';

export class EditModal extends CreateModal {
    constructor(app) {
        super(app);
        this.currentGoalId = null;
    }

    /**
     * Opens the goal form modal for editing an existing goal.
     * @param {Function} renderViews - Callback to render views after changes
     * @param {string} goalId - ID of the goal to edit
     */
    open(renderViews, goalId) {
        // Call parent open to show modal and reset form
        super.open(renderViews);
        this.currentGoalId = goalId;

        const form = getOptionalElement('goalForm');



        if (!goalId) {
            console.error('EditModal: goalId is required for editing');
            this.close();
            return;
        }

        try {
            // Setup Edit Mode
            this._setupEditMode(goalId, form);
        } catch (error) {
            console.error('EditModal: Failed to setup edit mode', error);
            this.close();
            alert(this.translate('errors.goalLoadFailed') || 'Failed to load goal for editing');
        }
    }

    /** @private */
    _setupEditMode(goalId, form) {
        // Find goal by ID using loose comparison to handle both string and number IDs
        const goal = this.app.goalService.goals?.find(g => String(g.id) === String(goalId));

        if (!goal) {
            console.error(`EditModal: Goal not found for id ${goalId}`);
            this.close();
            return;
        }

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
                    this.handleDelete();
                }
            };
        }

        // Show Status Buttons
        this._updateStatusButtons(goal);
    }

    /** @private */
    _populateFormFields(goal, ui) {
        if (ui.goalIdInput) ui.goalIdInput.value = goal.id;
        if (ui.titleInput) ui.titleInput.value = goal.title || '';
        if (ui.motivationInput) ui.motivationInput.value = goal.motivation || 1;
        if (ui.urgencyInput) ui.urgencyInput.value = goal.urgency || 1;

        if (ui.deadlineInput) {
            try {
                if (goal.deadline) {
                    const date = new Date(goal.deadline);
                    if (!isNaN(date.getTime())) {
                        ui.deadlineInput.value = date.toISOString().split('T')[0];
                    } else {
                        console.warn('EditModal: Invalid deadline date encountered', goal.deadline);
                        ui.deadlineInput.value = '';
                    }
                } else {
                    ui.deadlineInput.value = '';
                }
            } catch (e) {
                console.warn('EditModal: Error formatting deadline', e);
                ui.deadlineInput.value = '';
            }
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

    handleGoalSubmit() {
        const goalData = this.getFormData();
        const id = getElement('goalId').value;

        try {
            if (id) {
                // Update existing goal
                this.app.goalService.updateGoal(id, goalData, this.app.settingsService.getSettings().maxActiveGoals);
            } else {
                // Fallback to create if ID somehow missing in edit mode (should not happen)
                this.app.goalService.createGoal(goalData, this.app.settingsService.getSettings().maxActiveGoals);
            }
            this.close();
            if (this.renderViews) this.renderViews();
        } catch (error) {
            alert(error.message || this.translate('errors.goalSaveFailed'));
        }
    }

    handleDelete() {
        const id = getElement('goalId').value;
        this.app.goalService.deleteGoal(id, this.app.settingsService.getSettings().maxActiveGoals);
        this.close();
        if (this.renderViews) this.renderViews();
    }

    _getGoalFromForm() {
        const id = getElement('goalId').value;
        if (!id) return null;
        const goal = this.app.goalService.goals.find(g => g.id === id);
        return goal || null;
    }

    handleUnpauseGoal() {
        const goal = this._getGoalFromForm();
        if (!goal) return;
        this.app.goalService.unpauseGoal(goal.id, this.app.settingsService.getSettings().maxActiveGoals);
        // Refresh form to update buttons
        this.open(this.renderViews, goal.id);
        if (this.renderViews) this.renderViews();
    }

    handleReactivateGoal() {
        const goal = this._getGoalFromForm();
        if (!goal) return;
        this.app.goalService.setGoalStatus(goal.id, 'inactive', this.app.settingsService.getSettings().maxActiveGoals);
        this.open(this.renderViews, goal.id);
        if (this.renderViews) this.renderViews();
    }

    handleForceActivateGoal() {
        const goal = this._getGoalFromForm();
        if (!goal) return;
        this.app.goalService.forceActivateGoal(goal.id, this.app.settingsService.getSettings().maxActiveGoals);
        this.open(this.renderViews, goal.id);
        if (this.renderViews) this.renderViews();
    }

    // Override verifyEventListeners to attach edit-specific stuff?
    // Parent setupEventListeners attaches submit -> logic handles dispatch.
    // Parent attaches close/cancel.
    // We need to attach Unpause/Reactivate etc.
    setupEventListeners(openCompletionModal) {
        // Call parent for basic listeners (Submit, Cancel, Close, Recurring Toggle)
        super.setupEventListeners();

        // Attach edit-specific listeners
        const completeBtn = getOptionalElement('completeGoalBtn');
        if (completeBtn) {
            // Remove old listener if possible (hard with anonymous), but UIController calls this once.
            // But wait, setupEventListeners might be called in constructor? No, UIController calls it.
            // To replace listeners, we rely on cloning or cleaner handling.
            // For now, assume single setup.

            // Wait, parent setupEventListeners attaches submit which calls `this.handleGoalSubmit`.
            // Since we override `handleGoalSubmit`, it calls OURS. Good.

            // Completion Logic
            const newCompleteBtn = completeBtn.cloneNode(true);
            completeBtn.parentNode.replaceChild(newCompleteBtn, completeBtn);
            newCompleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const goalId = getElement('goalId').value;
                if (goalId && openCompletionModal) {
                    openCompletionModal(goalId);
                }
            });
        }

        const unpauseBtn = getOptionalElement('unpauseGoalBtn');
        if (unpauseBtn) {
            const newBtn = unpauseBtn.cloneNode(true);
            unpauseBtn.parentNode.replaceChild(newBtn, unpauseBtn);
            newBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleUnpauseGoal();
            });
        }

        const reactivateBtn = getOptionalElement('reactivateGoalBtn');
        if (reactivateBtn) {
            const newBtn = reactivateBtn.cloneNode(true);
            reactivateBtn.parentNode.replaceChild(newBtn, reactivateBtn);
            newBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleReactivateGoal();
            });
        }

        const forceActivateBtn = getOptionalElement('forceActivateGoalBtn');
        if (forceActivateBtn) {
            const newBtn = forceActivateBtn.cloneNode(true);
            forceActivateBtn.parentNode.replaceChild(newBtn, forceActivateBtn);
            newBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleForceActivateGoal();
            });
        }
    }
}
