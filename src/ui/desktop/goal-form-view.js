// src/ui/desktop/goal-form-view.js

import { BaseUIController } from './base-ui-controller.js';
import { getElement, getOptionalElement, querySelectorSafe } from '../utils/dom-utils.js';

export class GoalFormView extends BaseUIController {
    constructor(app) {
        super(app);
    }

    openGoalForm(goalId = null, renderViews) {
        const modal = getOptionalElement('goalModal');
        const form = getOptionalElement('goalForm');
        const deleteBtn = getOptionalElement('deleteBtn');
        const modalTitle = getOptionalElement('modalTitle');

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
            }
        } else {
            modalTitle.textContent = this.translate('goalForm.createTitle');
            form.reset();
            getElement('goalId').value = '';
            deleteBtn.style.display = 'none';
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

    setupEventListeners(handleGoalSubmit, handleDelete, renderViews) {
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

        const closeBtn = querySelectorSafe('.close');
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
                            // Check if the click target is a button that opens the modal
                            const clickedElement = e.target;
                            const isAddGoalBtn = clickedElement.id === 'addGoalBtn' || clickedElement.closest('#addGoalBtn');
                            const isEditBtn = clickedElement.classList && (clickedElement.classList.contains('edit-goal') || clickedElement.closest('.edit-goal'));
                            
                            if (!isAddGoalBtn && !isEditBtn) {
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

}

