// src/ui/desktop/goal-form-view.js

import { BaseUIController } from './base-ui-controller.js';
import { getElement, getOptionalElement } from '../utils/dom-utils.js';

export class GoalFormView extends BaseUIController {
    constructor(app) {
        super(app);
    }

    openGoalForm(goalId = null, renderViews) {
        const modal = getOptionalElement('goalModal');
        const form = getOptionalElement('goalForm');
        const deleteBtn = getOptionalElement('deleteBtn');
        const modalTitle = getOptionalElement('modalTitle');
        const stateManagementSection = getOptionalElement('goalStateManagementSection');
        const completeBtn = getOptionalElement('completeGoalBtn');
        const unpauseBtn = getOptionalElement('unpauseGoalBtn');
        const reactivateBtn = getOptionalElement('reactivateGoalBtn');
        const forceActivateBtn = getOptionalElement('forceActivateGoalBtn');

        if (!modal || !form || !deleteBtn || !modalTitle) {
            return;
        }

        let goal = null;
        if (goalId) {
            goal = this.app.goalService.goals.find(g => g.id === goalId) || null;
            if (goal) {
                modalTitle.textContent = this.translate('goalForm.editTitle');
                getElement('goalId').value = goal.id;
                getElement('goalTitle').value = goal.title;
                getElement('goalMotivation').value = goal.motivation;
                getElement('goalUrgency').value = goal.urgency;
                getElement('goalDeadline').value = goal.deadline
                    ? goal.deadline.toISOString().split('T')[0]
                    : '';
                deleteBtn.style.display = 'inline-block';

                // Show state management section for existing goals
                if (stateManagementSection) {
                    stateManagementSection.style.display = 'block';
                }

                // Show/hide state management buttons based on current status
                if (completeBtn) {
                    completeBtn.style.display = goal.status !== 'completed' && goal.status !== 'abandoned'
                        ? 'inline-block'
                        : 'none';
                }
                if (unpauseBtn) {
                    const isPaused = goal.status === 'paused' || this.app.goalService.isGoalPaused(goal);
                    unpauseBtn.style.display = isPaused ? 'inline-block' : 'none';
                }
                if (reactivateBtn) {
                    reactivateBtn.style.display = goal.status === 'completed' || goal.status === 'abandoned'
                        ? 'inline-block'
                        : 'none';
                }
                if (forceActivateBtn) {
                    const canForceActivate = goal.status !== 'active' &&
                        goal.status !== 'completed' &&
                        goal.status !== 'abandoned';
                    forceActivateBtn.style.display = canForceActivate ? 'inline-block' : 'none';
                }
            }
        } else {
            modalTitle.textContent = this.translate('goalForm.createTitle');
            form.reset();
            getElement('goalId').value = '';
            deleteBtn.style.display = 'none';

            // Hide state management section for new goals
            if (stateManagementSection) {
                stateManagementSection.style.display = 'none';
            }
        }


        // Show modal by toggling CSS class
        modal.classList.add('is-visible');
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
    }

    setupEventListeners(handleGoalSubmit, handleDelete, renderViews, openCompletionModal) {
        const goalForm = getOptionalElement('goalForm');
        if (goalForm) {
            goalForm.addEventListener('submit', (e) => {
                e.preventDefault();
                handleGoalSubmit();
            });
        }

        const cancelBtn = getOptionalElement('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeGoalForm());
        }

        const deleteBtn = getOptionalElement('deleteBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (confirm(this.translate('goalForm.confirmDelete'))) {
                    handleDelete();
                }
            });
        }

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

        // Use mousedown instead of click to avoid closing the modal immediately
        window.addEventListener('mousedown', (e) => {
            const modal = getElement('goalModal');
            if (modal) {
                const isModalVisible = modal.classList.contains('is-visible');

                // Close only when the click happens outside the modal
                if (isModalVisible && e.target && e.target.nodeType === 1) {
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
                    } catch (error) {
                        // Ignore errors if contains fails
                    }
                }
            }
        });
    }

    handleGoalSubmit(renderViews) {
        const id = getElement('goalId').value;
        const goalData = {
            title: getElement('goalTitle').value,
            motivation: getElement('goalMotivation').value,
            urgency: getElement('goalUrgency').value,
            deadline: getElement('goalDeadline').value || null
        };

        try {
            if (id) {
                this.app.goalService.updateGoal(id, goalData, this.app.settingsService.getSettings().maxActiveGoals);
            } else {
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
        this.openGoalForm(goal.id, renderViews);
        renderViews();
    }

    handleReactivateGoal(renderViews) {
        const goal = this._getGoalFromForm();
        if (!goal) return;

        // Reactivate by setting status to inactive, then let auto-activation handle it
        // This ensures the goal is reactivated based on priority
        this.app.goalService.setGoalStatus(goal.id, 'inactive', this.app.settingsService.getSettings().maxActiveGoals);
        // Refresh the goal form to update button visibility
        this.openGoalForm(goal.id, renderViews);
        renderViews();
    }

    handleForceActivateGoal(renderViews) {
        const goal = this._getGoalFromForm();
        if (!goal) return;

        const maxActiveGoals = this.app.settingsService.getSettings().maxActiveGoals;
        this.app.goalService.forceActivateGoal(goal.id, maxActiveGoals);

        // Refresh the goal form to update button visibility
        this.openGoalForm(goal.id, renderViews);
        renderViews();
    }

}
