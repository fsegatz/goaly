// src/ui/desktop/dashboard-view.js

import { BaseUIController } from './base-ui-controller.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export class DashboardView extends BaseUIController {
    constructor(app) {
        super(app);
    }

    render(openCompletionModal, updateGoalInline, openGoalForm, handleReviewSubmit, renderViews) {
        this.invalidatePriorityCache();
        this.refreshPriorityCache();
        const settings = this.app.settingsService.getSettings();
        const activeGoals = this.app.goalService.getActiveGoals();
        const dashboardGoals = activeGoals.slice(0, settings.maxActiveGoals);
        
        // Get reviews - these include ALL active and paused goals that need review
        // (not limited by maxActiveGoals - all goals needing review should show review cards)
        const reviews = Array.isArray(this.app.reviews) ? this.app.reviews : [];

        const dashboardList = document.getElementById('goalsList');
        const feedbackElement = document.getElementById('dashboardFeedback');
        
        dashboardList.innerHTML = '';

        // Display feedback if available
        if (feedbackElement) {
            if (this.latestReviewFeedback) {
                const { messageKey, messageArgs, type } = this.latestReviewFeedback;
                feedbackElement.hidden = false;
                feedbackElement.textContent = this.translate(messageKey, messageArgs);
                feedbackElement.dataset.state = type || 'info';
            } else {
                feedbackElement.hidden = true;
                feedbackElement.textContent = '';
                feedbackElement.dataset.state = '';
            }
        }

        // Combine review cards and active goal cards, with review cards first
        // Review cards show ALL active and paused goals that need review (not limited by maxActiveGoals)
        // Active goal cards show up to maxActiveGoals goals (including those that also have review cards)
        const allCards = [];
        
        // Add review cards first - these include ALL active and paused goals that need review
        // (not limited by maxActiveGoals - all goals needing review should show review cards)
        reviews.forEach((review, index) => {
            allCards.push({
                type: 'review',
                data: review,
                position: index + 1,
                total: reviews.length
            });
        });
        
        // Add active goal cards - show all active goals up to maxActiveGoals
        // (some of these may also have review cards above, which is fine)
        dashboardGoals.forEach(goal => {
            allCards.push({
                type: 'goal',
                data: goal
            });
        });

        if (allCards.length === 0) {
            const emptyState = document.createElement('p');
            emptyState.style.textAlign = 'center';
            emptyState.style.color = '#888';
            emptyState.style.padding = '40px';
            emptyState.textContent = this.translate('dashboard.noActiveGoals');
            emptyState.setAttribute('data-i18n-key', 'dashboard.noActiveGoals');
            dashboardList.appendChild(emptyState);
        } else {
            let hasReviewCards = false;
            let firstGoalCard = true;
            
            allCards.forEach(cardItem => {
                if (cardItem.type === 'review') {
                    hasReviewCards = true;
                    dashboardList.appendChild(this.createReviewCard(cardItem.data, cardItem.position, cardItem.total, openGoalForm, handleReviewSubmit, renderViews));
                } else {
                    // Add separator before first goal card if there were review cards before
                    if (hasReviewCards && firstGoalCard) {
                        const separator = document.createElement('div');
                        separator.className = 'dashboard-card-separator desktop-only';
                        dashboardList.appendChild(separator);
                        firstGoalCard = false;
                    }
                    dashboardList.appendChild(this.createGoalCard(cardItem.data, openCompletionModal, updateGoalInline));
                }
            });
        }
    }

    createReviewCard(review, position, total, openGoalForm, handleReviewSubmit, renderViews) {
        const { goal, dueAt } = review;
        const card = document.createElement('form');
        card.className = 'review-card dashboard-review-card';
        card.dataset.goalId = goal.id;

        const header = document.createElement('div');
        header.className = 'review-card__header';

        const title = document.createElement('h3');
        title.className = 'review-card__title';
        title.textContent = goal.title;
        header.appendChild(title);

        // Review card indicator badge anchored to right upper corner
        const reviewBadge = document.createElement('span');
        reviewBadge.className = 'review-card__review-badge';
        reviewBadge.textContent = '📋 Review';
        reviewBadge.setAttribute('aria-label', 'Review card');
        header.appendChild(reviewBadge);

        // Due date below review badge (positioned absolutely)
        const dueInfo = document.createElement('p');
        dueInfo.className = 'review-card__due';
        dueInfo.textContent = this.formatReviewDueLabel(dueAt);
        header.appendChild(dueInfo);

        // Bottom section: fields and actions grouped together
        const bottomSection = document.createElement('div');
        bottomSection.className = 'review-card__bottom';
        
        const fields = document.createElement('div');
        fields.className = 'review-card__fields';

        const motivationField = this.createReviewRadioGroup('reviews.fields.motivation', 'motivation', goal.motivation, goal.id);
        const urgencyField = this.createReviewRadioGroup('reviews.fields.urgency', 'urgency', goal.urgency, goal.id);

        fields.appendChild(motivationField.container);
        fields.appendChild(urgencyField.container);

        const actions = document.createElement('div');
        actions.className = 'review-card__actions';

        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'btn btn-primary';
        submitBtn.setAttribute('data-i18n-key', 'reviews.actions.done');
        submitBtn.textContent = this.translate('reviews.actions.done');
        actions.appendChild(submitBtn);

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-secondary';
        editBtn.setAttribute('data-i18n-key', 'reviews.actions.edit');
        editBtn.textContent = this.translate('reviews.actions.edit');
        editBtn.addEventListener('click', (event) => {
            event.preventDefault();
            openGoalForm(goal.id);
        });
        actions.appendChild(editBtn);

        bottomSection.appendChild(fields);
        bottomSection.appendChild(actions);

        card.appendChild(header);
        card.appendChild(bottomSection);

        card.addEventListener('submit', (event) => {
            event.preventDefault();
            const selectedMotivation = motivationField.container.querySelector('input[type="radio"]:checked');
            const selectedUrgency = urgencyField.container.querySelector('input[type="radio"]:checked');
            handleReviewSubmit(goal.id, {
                motivation: selectedMotivation ? selectedMotivation.value : goal.motivation,
                urgency: selectedUrgency ? selectedUrgency.value : goal.urgency
            }, renderViews);
        });

        return card;
    }

    createReviewInput(labelKey, name, value) {
        const container = document.createElement('label');
        container.className = 'review-card__field';

        const label = document.createElement('span');
        label.className = 'review-card__field-label';
        label.setAttribute('data-i18n-key', labelKey);
        container.appendChild(label);

        const input = document.createElement('input');
        input.type = 'number';
        input.name = name;
        input.min = '1';
        input.max = '5';
        input.step = '1';
        input.value = value;
        input.className = 'review-card__field-input';
        input.setAttribute('data-i18n-key', labelKey);
        input.setAttribute('data-i18n-attr', 'aria-label');
        container.appendChild(input);

        return { container, input };
    }

    createReviewRadioGroup(labelKey, name, currentValue, goalId) {
        const container = document.createElement('div');
        container.className = 'review-card__field review-card__radio-field';

        const label = document.createElement('span');
        label.className = 'review-card__field-label';
        label.setAttribute('data-i18n-key', labelKey);
        label.textContent = this.translate(labelKey);
        container.appendChild(label);

        const radioGroup = document.createElement('div');
        radioGroup.className = 'review-card__radio-group';
        // Use a unique but consistent name for the radio group
        const groupName = `review_${name}_${goalId || Date.now()}`;

        // Create radio buttons for values 1-5
        for (let i = 1; i <= 5; i++) {
            const radioWrapper = document.createElement('label');
            radioWrapper.className = 'review-card__radio-option';
            if (i === currentValue) {
                radioWrapper.classList.add('is-current');
            }

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = groupName;
            radio.value = i.toString();
            radio.checked = i === currentValue;
            radio.setAttribute('aria-label', `${this.translate(labelKey)}: ${i}`);

            const radioLabel = document.createElement('span');
            radioLabel.className = 'review-card__radio-label';
            radioLabel.textContent = i;

            radioWrapper.appendChild(radio);
            radioWrapper.appendChild(radioLabel);
            radioGroup.appendChild(radioWrapper);
        }

        // Store current value on radio group for easy access
        radioGroup.dataset.name = name;
        container.appendChild(radioGroup);

        return { container, radioGroup };
    }

    formatReviewDueLabel(dueAt) {
        if (!dueAt) {
            return this.translate('reviews.due.unknown');
        }
        const dueDate = dueAt instanceof Date ? dueAt : new Date(dueAt);
        if (Number.isNaN(dueDate.getTime())) {
            return this.translate('reviews.due.unknown');
        }

        const now = new Date();
        const diffMs = now.getTime() - dueDate.getTime();
        const diffDays = Math.floor(diffMs / DAY_IN_MS);

        if (diffDays <= 0) {
            return this.translate('reviews.due.today');
        }
        return this.translate('reviews.due.overdue', { count: diffDays });
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

