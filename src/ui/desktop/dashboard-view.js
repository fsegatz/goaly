// src/ui/desktop/dashboard-view.js

import { BaseUIController } from './base-ui-controller.js';

export class DashboardView extends BaseUIController {
    constructor(app) {
        super(app);
    }

    render(openCompletionModal, updateGoalInline) {
        this.invalidatePriorityCache();
        this.refreshPriorityCache();
        const settings = this.app.settingsService.getSettings();
        const activeGoals = this.app.goalService.getActiveGoals();
        const dashboardGoals = activeGoals.slice(0, settings.maxActiveGoals);

        const dashboardList = document.getElementById('goalsList');
        dashboardList.innerHTML = '';

        if (dashboardGoals.length === 0) {
            const emptyState = document.createElement('p');
            emptyState.style.textAlign = 'center';
            emptyState.style.color = '#888';
            emptyState.style.padding = '40px';
            emptyState.textContent = this.translate('dashboard.noActiveGoals');
            emptyState.setAttribute('data-i18n-key', 'dashboard.noActiveGoals');
            dashboardList.appendChild(emptyState);
        } else {
            dashboardGoals.forEach(goal => {
                dashboardList.appendChild(this.createGoalCard(goal, openCompletionModal, updateGoalInline));
            });
        }
    }

    createGoalCard(goal, openCompletionModal, updateGoalInline) {
        const card = document.createElement('div');
        card.className = `goal-card ${goal.status}`;

        const deadlineText = goal.deadline
            ? this.formatDeadline(goal.deadline)
            : this.translate('goalCard.noDeadline');

        const sortedSteps = [...(goal.steps || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
        const stepsHtml = sortedSteps.length > 0
            ? sortedSteps.map(step => `
                <li class="goal-step ${step.completed ? 'completed' : ''}" data-step-id="${step.id}">
                    <input type="checkbox" class="step-checkbox" ${step.completed ? 'checked' : ''} aria-label="Toggle step completion">
                    <span class="step-text" contenteditable="true">${this.escapeHtml(step.text)}</span>
                    <button type="button" class="step-delete" aria-label="${this.translate('goalCard.steps.delete')}">×</button>
                </li>
            `).join('')
            : `<li class="steps-empty">${this.translate('goalCard.steps.empty')}</li>`;

        card.innerHTML = `
            <div class="goal-header">
                <div>
                    <div class="goal-title">${this.escapeHtml(goal.title)}</div>
                </div>
            </div>
            <div class="goal-steps-section">
                <div class="goal-steps-header">
                    <h4>${this.translate('goalCard.steps.title')}</h4>
                    <button type="button" class="btn btn-small add-step" aria-label="${this.translate('goalCard.steps.add')}">+</button>
                </div>
                <ul class="goal-steps-list">${stepsHtml}</ul>
            </div>
            <div class="goal-footer">
                <div class="goal-deadline-wrapper">
                    <span class="goal-deadline-label ${this.isDeadlineUrgent(goal.deadline) ? 'urgent' : ''}">${this.translate('goalCard.deadlinePrefix', { deadline: deadlineText })}</span>
                    <input type="date" class="goal-deadline-input" value="${goal.deadline ? goal.deadline.toISOString().split('T')[0] : ''}" aria-label="${this.translate('goalCard.deadlineClickable')}">
                </div>
                <div class="goal-actions">
                </div>
            </div>
        `;

        const actionsContainer = card.querySelector('.goal-actions');
        if (actionsContainer && goal.status !== 'completed' && goal.status !== 'abandoned') {
            const completeButton = document.createElement('button');
            completeButton.type = 'button';
            completeButton.className = 'btn btn-secondary complete-goal';
            completeButton.textContent = this.translate('goalCard.actions.complete');
            completeButton.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                openCompletionModal(goal.id);
            });
            actionsContainer.appendChild(completeButton);
        }

        // Make deadline editable directly via date input
        const deadlineLabel = card.querySelector('.goal-deadline-label');
        const deadlineInput = card.querySelector('.goal-deadline-input');

        if (deadlineLabel && deadlineInput) {
            // Click on label opens the date picker
            deadlineLabel.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                deadlineInput.showPicker();
            });

            deadlineLabel.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    deadlineInput.showPicker();
                }
            });

            // Update deadline when date input changes
            deadlineInput.addEventListener('change', (event) => {
                const deadlineValue = deadlineInput.value || null;
                const updates = {
                    deadline: deadlineValue || null
                };
                updateGoalInline(goal.id, updates);
            });

            // Update the label when deadline changes (for immediate visual feedback)
            deadlineInput.addEventListener('input', () => {
                if (deadlineInput.value) {
                    const newDate = new Date(deadlineInput.value);
                    const newDeadlineText = this.formatDeadline(newDate);
                    deadlineLabel.textContent = this.translate('goalCard.deadlinePrefix', { deadline: newDeadlineText });
                    deadlineLabel.classList.toggle('urgent', this.isDeadlineUrgent(newDate));
                } else {
                    deadlineLabel.textContent = this.translate('goalCard.deadlinePrefix', { deadline: this.translate('goalCard.noDeadline') });
                    deadlineLabel.classList.remove('urgent');
                }
            });
        }

        // Setup steps functionality
        this.setupSteps(card, goal, updateGoalInline);

        return card;
    }

    setupSteps(card, goal, updateGoalInline) {
        const stepsList = card.querySelector('.goal-steps-list');
        const addStepBtn = card.querySelector('.add-step');

        const saveSteps = () => {
            const steps = Array.from(stepsList.querySelectorAll('.goal-step')).map((el, index) => {
                const stepId = el.dataset.stepId;
                const checkbox = el.querySelector('.step-checkbox');
                const textEl = el.querySelector('.step-text');
                return {
                    id: stepId,
                    text: textEl.textContent.trim(),
                    completed: checkbox.checked,
                    order: index
                };
            }).filter(step => step.text.length > 0);

            const { maxActiveGoals } = this.app.settingsService.getSettings();
            this.app.goalService.updateGoal(goal.id, { steps }, maxActiveGoals);
            goal.steps = steps;
        };

        const renderSteps = () => {
            const sortedSteps = [...(goal.steps || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
            if (sortedSteps.length === 0) {
                stepsList.innerHTML = `<li class="steps-empty">${this.translate('goalCard.steps.empty')}</li>`;
            } else {
                stepsList.innerHTML = sortedSteps.map(step => `
                    <li class="goal-step ${step.completed ? 'completed' : ''}" data-step-id="${step.id}">
                        <input type="checkbox" class="step-checkbox" ${step.completed ? 'checked' : ''} aria-label="Toggle step completion">
                        <span class="step-text" contenteditable="true">${this.escapeHtml(step.text)}</span>
                        <button type="button" class="step-delete" aria-label="${this.translate('goalCard.steps.delete')}">×</button>
                    </li>
                `).join('');
                this.attachStepListeners(stepsList, saveSteps, card, goal, updateGoalInline);
            }
        };

        // Remove existing event listeners by cloning the button
        const newAddStepBtn = addStepBtn.cloneNode(true);
        addStepBtn.parentNode.replaceChild(newAddStepBtn, addStepBtn);

        newAddStepBtn.addEventListener('click', () => {
            const newStep = {
                id: `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
                text: '',
                completed: false,
                order: (goal.steps || []).length
            };
            if (!goal.steps) goal.steps = [];
            goal.steps.push(newStep);
            renderSteps();
            const newStepEl = stepsList.querySelector(`[data-step-id="${newStep.id}"]`);
            if (newStepEl) {
                const textEl = newStepEl.querySelector('.step-text');
                textEl.focus();
                const range = document.createRange();
                range.selectNodeContents(textEl);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }
        });

        // Initial render
        renderSteps();
    }

    attachStepListeners(stepsList, saveSteps, card, goal, updateGoalInline) {
        stepsList.querySelectorAll('.goal-step').forEach(stepEl => {
            const checkbox = stepEl.querySelector('.step-checkbox');
            const textEl = stepEl.querySelector('.step-text');
            const deleteBtn = stepEl.querySelector('.step-delete');

            checkbox.addEventListener('change', () => {
                stepEl.classList.toggle('completed', checkbox.checked);
                saveSteps();
            });

            textEl.addEventListener('blur', () => {
                if (!textEl.textContent.trim()) {
                    const stepId = stepEl.dataset.stepId;
                    if (goal.steps) {
                        goal.steps = goal.steps.filter(s => s.id !== stepId);
                    }
                    // Save based on goal object, not DOM, since DOM hasn't updated yet
                    const { maxActiveGoals } = this.app.settingsService.getSettings();
                    this.app.goalService.updateGoal(goal.id, { steps: goal.steps }, maxActiveGoals);
                    this.setupSteps(card, goal, updateGoalInline);
                } else {
                    saveSteps();
                }
            });

            textEl.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    textEl.blur();
                }
            });

            deleteBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const stepId = stepEl.dataset.stepId;
                if (goal.steps) {
                    goal.steps = goal.steps.filter(s => s.id !== stepId);
                }
                // Save based on goal object, not DOM, since DOM hasn't updated yet
                const { maxActiveGoals } = this.app.settingsService.getSettings();
                this.app.goalService.updateGoal(goal.id, { steps: goal.steps }, maxActiveGoals);
                // Re-render the steps list immediately by calling setupSteps again
                this.setupSteps(card, goal, updateGoalInline);
            });
        });
    }

}

