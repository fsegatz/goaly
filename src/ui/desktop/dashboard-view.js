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

        card.innerHTML = `
            <div class="goal-header">
                <div>
                    <div class="goal-title">${this.escapeHtml(goal.title)}</div>
                </div>
            </div>
            <div class="goal-description dashboard-description" contenteditable="true" role="textbox" aria-label="${this.translate('goalCard.descriptionAria')}" data-goal-id="${goal.id}" data-placeholder="${this.translate('goalCard.descriptionPlaceholder')}"></div>
            <div class="goal-footer">
                <div class="goal-deadline ${this.isDeadlineUrgent(goal.deadline) ? 'urgent' : ''}">
                    ${this.translate('goalCard.deadlinePrefix', { deadline: deadlineText })}
                </div>
                <div class="goal-actions">
                    <button class="btn btn-primary edit-goal" data-id="${goal.id}" aria-expanded="false">${this.translate('goalCard.actions.edit')}</button>
                </div>
            </div>
            <div class="goal-inline-editor" aria-hidden="true">
                <div class="inline-fields">
                    <label>
                        <span>${this.translate('goalCard.inline.deadline')}</span>
                        <input type="date" class="inline-deadline" value="${goal.deadline ? goal.deadline.toISOString().split('T')[0] : ''}">
                    </label>
                    <label>
                        <span>${this.translate('goalCard.inline.motivation')}</span>
                        <input type="number" class="inline-motivation" min="1" max="5" step="1" value="${goal.motivation}">
                    </label>
                    <label>
                        <span>${this.translate('goalCard.inline.urgency')}</span>
                        <input type="number" class="inline-urgency" min="1" max="5" step="1" value="${goal.urgency}">
                    </label>
                </div>
                <div class="inline-actions">
                    <button type="button" class="btn btn-primary save-inline">${this.translate('common.save')}</button>
                    <button type="button" class="btn btn-secondary cancel-inline">${this.translate('common.cancel')}</button>
                </div>
            </div>
        `;

        const descriptionEl = card.querySelector('.goal-description');
        if (descriptionEl) {
            const currentDescription = goal.description || '';
            descriptionEl.textContent = currentDescription;

            const sanitizeDescription = (value) => {
                if (!value) {
                    return '';
                }
                return value.replace(/\u00a0/g, ' ').trim();
            };

            const resetDescription = () => {
                descriptionEl.textContent = goal.description || '';
                if (!descriptionEl.textContent) {
                    descriptionEl.innerHTML = '';
                }
            };

            descriptionEl.addEventListener('focus', () => {
                card.classList.add('is-editing-description');
                descriptionEl.classList.add('is-editing');
            });

            descriptionEl.addEventListener('blur', () => {
                descriptionEl.classList.remove('is-editing');
                card.classList.remove('is-editing-description');

                const sanitizedValue = sanitizeDescription(descriptionEl.textContent);
                const originalValue = sanitizeDescription(goal.description);

                if (sanitizedValue === originalValue) {
                    resetDescription();
                    return;
                }

                try {
                    const { maxActiveGoals } = this.app.settingsService.getSettings();
                    this.app.goalService.updateGoal(goal.id, { description: sanitizedValue }, maxActiveGoals);
                    goal.description = sanitizedValue;
                } catch (error) {
                    alert(error.message || this.translate('errors.goalUpdateFailed'));
                    resetDescription();
                }
            });

            descriptionEl.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    resetDescription();
                    descriptionEl.blur();
                }
            });
        }

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

        const editBtn = card.querySelector('.edit-goal');
        const inlineEditor = card.querySelector('.goal-inline-editor');

        if (editBtn && inlineEditor) {
            const deadlineInput = inlineEditor.querySelector('.inline-deadline');
            const motivationInput = inlineEditor.querySelector('.inline-motivation');
            const urgencyInput = inlineEditor.querySelector('.inline-urgency');
            const saveButton = inlineEditor.querySelector('.save-inline');
            const cancelButton = inlineEditor.querySelector('.cancel-inline');

            const toggleInlineEditor = (open) => {
                inlineEditor.setAttribute('aria-hidden', open ? 'false' : 'true');
                editBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
                if (open) {
                    card.classList.add('is-inline-editing');
                    inlineEditor.classList.add('is-visible');
                    deadlineInput.value = goal.deadline ? goal.deadline.toISOString().split('T')[0] : '';
                    motivationInput.value = goal.motivation;
                    urgencyInput.value = goal.urgency;
                    deadlineInput.focus();
                } else {
                    card.classList.remove('is-inline-editing');
                    inlineEditor.classList.remove('is-visible');
                }
            };

            editBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const isVisible = inlineEditor.classList.contains('is-visible');
                toggleInlineEditor(!isVisible);
            });

            saveButton.addEventListener('click', (event) => {
                event.preventDefault();
                const parseOrFallback = (value, fallback) => {
                    const parsed = Number.parseInt(value, 10);
                    return Number.isNaN(parsed) ? fallback : parsed;
                };
                const updates = {
                    deadline: deadlineInput.value || null,
                    motivation: parseOrFallback(motivationInput.value, goal.motivation),
                    urgency: parseOrFallback(urgencyInput.value, goal.urgency)
                };
                updateGoalInline(goal.id, updates);
            });

            cancelButton.addEventListener('click', (event) => {
                event.preventDefault();
                toggleInlineEditor(false);
            });
        }

        return card;
    }
}

