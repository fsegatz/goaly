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

                // Set recurring checkbox and period
                const recurringCheckbox = getOptionalElement('goalIsRecurring');
                const recurringPeriodContainer = getOptionalElement('recurringPeriodContainer');
                const recurPeriodInput = getOptionalElement('goalRecurPeriod');
                const recurPeriodUnitSelect = getOptionalElement('goalRecurPeriodUnit');

                if (recurringCheckbox) {
                    recurringCheckbox.checked = Boolean(goal.isRecurring);

                    // Show/hide recurrence period container
                    if (recurringPeriodContainer) {
                        recurringPeriodContainer.style.display = goal.isRecurring ? 'block' : 'none';
                    }
                }

                // Set recurrence period if available
                if (recurPeriodInput && goal.isRecurring) {
                    recurPeriodInput.value = goal.recurPeriod || 7;
                } else if (recurPeriodInput) {
                    recurPeriodInput.value = 7;
                }

                // Set recurrence period unit if available
                if (recurPeriodUnitSelect && goal.isRecurring) {
                    recurPeriodUnitSelect.value = goal.recurPeriodUnit || 'days';
                } else if (recurPeriodUnitSelect) {
                    recurPeriodUnitSelect.value = 'days';
                }

                deleteBtn.style.display = 'inline-block';

                // Show state management section for existing goals
                if (stateManagementSection) {
                    stateManagementSection.style.display = 'block';
                }

                // Show/hide state management buttons based on current status
                if (completeBtn) {
                    completeBtn.style.display = goal.status !== 'completed' && goal.status !== 'notCompleted'
                        ? 'inline-block'
                        : 'none';
                }
                if (unpauseBtn) {
                    const isPaused = goal.status === 'paused' || this.app.goalService.isGoalPaused(goal);
                    unpauseBtn.style.display = isPaused ? 'inline-block' : 'none';
                }
                if (reactivateBtn) {
                    reactivateBtn.style.display = goal.status === 'completed' || goal.status === 'notCompleted'
                        ? 'inline-block'
                        : 'none';
                }
                if (forceActivateBtn) {
                    const canForceActivate = goal.status !== 'active' &&
                        goal.status !== 'completed' &&
                        goal.status !== 'notCompleted' &&
                        goal.status !== 'notCompleted';
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

        // Toggle recurrence period container visibility
        const recurringCheckbox = getOptionalElement('goalIsRecurring');
        const recurringPeriodContainer = getOptionalElement('recurringPeriodContainer');
        if (recurringCheckbox && recurringPeriodContainer) {
            recurringCheckbox.addEventListener('change', () => {
                recurringPeriodContainer.style.display = recurringCheckbox.checked ? 'block' : 'none';
                // Reset to defaults if unchecked
                if (!recurringCheckbox.checked) {
                    const recurPeriodInput = getOptionalElement('goalRecurPeriod');
                    const recurPeriodUnitSelect = getOptionalElement('goalRecurPeriodUnit');
                    if (recurPeriodInput) {
                        recurPeriodInput.value = 7;
                    }
                    if (recurPeriodUnitSelect) {
                        recurPeriodUnitSelect.value = 'days';
                    }
                }
            });
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
            const modal = getOptionalElement('goalModal');
            if (modal) {
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
        });
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
