// src/ui/desktop/dashboard-view.js

import { BaseUIController } from './base-ui-controller.js';
import { MAX_RATING_VALUE } from '../../domain/utils/constants.js';
import { getElement, getOptionalElement } from '../utils/dom-utils.js';
import { EventManager } from '../utils/event-manager.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const BLUR_SAVE_DELAY_MS = 200;

export class DashboardView extends BaseUIController {
    constructor(app) {
        super(app);
    }

    render(openCompletionModal, updateGoalInline, openGoalForm, handleReviewSubmit, renderViews, openPauseModal) {
        this.openPauseModal = openPauseModal;
        const settings = this.app.settingsService.getSettings();
        // Get active goals (excluding manually paused ones)
        const activeGoals = this.app.goalService.getActiveGoals();
        const dashboardGoals = activeGoals.slice(0, settings.maxActiveGoals);
        // Get reviews - these include ALL active and paused goals that need review
        // (not limited by maxActiveGoals - all goals needing review should show review cards)
        const reviews = Array.isArray(this.app.reviews) ? this.app.reviews : [];

        const dashboardList = getElement('goalsList');
        const feedbackElement = getOptionalElement('dashboardFeedback');

        // Clean up EventManager instances for existing cards before clearing the list
        // This prevents memory leaks when cards are removed from the DOM
        for (const card of dashboardList.querySelectorAll('.goal-card, .review-card')) {
            if (card._stepEventManager) {
                card._stepEventManager.cleanup();
            }
        }

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
        input.max = String(MAX_RATING_VALUE);
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

        // Create radio buttons for values 1-MAX_RATING_VALUE
        for (let i = 1; i <= MAX_RATING_VALUE; i++) {
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
        const isManuallyPaused = this.app.goalService.isGoalPaused(goal);
        card.className = `goal-card ${goal.status}${isManuallyPaused ? ' manually-paused' : ''}`;

        const deadlineText = goal.deadline
            ? this.formatDeadline(goal.deadline)
            : this.translate('goalCard.noDeadline');

        const sortedSteps = this.sortStepsWithCompletedAtBottom(goal.steps || []);
        const stepsHtml = sortedSteps.length > 0
            ? sortedSteps.map(step => `
                <li class="goal-step ${step.completed ? 'completed' : ''}" data-step-id="${step.id}">
                    <input type="checkbox" class="step-checkbox" ${step.completed ? 'checked' : ''} aria-label="Toggle step completion">
                    <span class="step-text" contenteditable="true">${this.escapeHtml(step.text)}</span>
                    <button type="button" class="step-delete" aria-label="${this.translate('goalCard.steps.delete')}">×</button>
                </li>
            `).join('')
            : `<li class="steps-empty">${this.translate('goalCard.steps.empty')}</li>`;

        // Get pause indicator text
        let pauseIndicator = '';
        if (isManuallyPaused) {
            if (goal.pauseUntil) {
                const pauseDate = new Date(goal.pauseUntil);
                pauseDate.setHours(0, 0, 0, 0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const daysUntil = Math.ceil((pauseDate - today) / (1000 * 60 * 60 * 24));
                if (daysUntil === 0) {
                    pauseIndicator = `<span class="goal-pause-indicator" data-i18n-key="goalCard.paused.untilToday">⏸️ ${this.translate('goalCard.paused.untilToday')}</span>`;
                } else if (daysUntil === 1) {
                    pauseIndicator = `<span class="goal-pause-indicator" data-i18n-key="goalCard.paused.untilTomorrow">⏸️ ${this.translate('goalCard.paused.untilTomorrow')}</span>`;
                } else {
                    const formattedDate = this.formatDeadline(pauseDate);
                    pauseIndicator = `<span class="goal-pause-indicator" data-i18n-key="goalCard.paused.untilDate">⏸️ ${this.translate('goalCard.paused.untilDate', { date: formattedDate })}</span>`;
                }
            } else if (goal.pauseUntilGoalId) {
                const dependencyGoal = this.app.goalService.goals.find(g => g.id === goal.pauseUntilGoalId);
                if (dependencyGoal) {
                    pauseIndicator = `<span class="goal-pause-indicator" data-i18n-key="goalCard.paused.untilGoal">⏸️ ${this.translate('goalCard.paused.untilGoal', { goalTitle: this.escapeHtml(dependencyGoal.title) })}</span>`;
                } else {
                    pauseIndicator = `<span class="goal-pause-indicator">⏸️ ${this.translate('goalCard.paused.untilGoal', { goalTitle: '' })}</span>`;
                }
            }
        }

        // Get force activated indicator
        let forceActivatedIndicator = '';
        if (goal.status === 'active' && goal.forceActivated) {
            forceActivatedIndicator = `<span class="goal-force-activated-indicator" data-i18n-key="allGoals.forceActivated">⚡ ${this.translate('allGoals.forceActivated')}</span>`;
        }

        card.innerHTML = `
            <div class="goal-header">
                <div>
                    <div class="goal-title">${this.escapeHtml(goal.title)}</div>
                    ${forceActivatedIndicator}
                    ${pauseIndicator}
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
            // Add pause button for active goals
            if (goal.status === 'active') {
                const pauseButton = document.createElement('button');
                pauseButton.type = 'button';
                pauseButton.className = 'btn btn-secondary pause-goal';
                pauseButton.textContent = this.translate('goalCard.actions.pause');
                pauseButton.setAttribute('data-i18n-key', 'goalCard.actions.pause');
                pauseButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    // Pass openPauseModal callback - will be set up in render method
                    if (this.openPauseModal) {
                        this.openPauseModal(goal.id);
                    }
                });
                actionsContainer.appendChild(pauseButton);
            }

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
            // The date input is now positioned over the label and directly clickable
            // No need for showPicker() - iOS Safari will open the native picker when tapping the input

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

        // Setup inline title editing
        this.setupTitleEditing(card, goal, updateGoalInline);

        return card;
    }

    setupTitleEditing(card, goal, updateGoalInline) {
        const titleElement = card.querySelector('.goal-title');
        if (!titleElement) {
            return;
        }

        this.makeTitleEditable(titleElement);
        this.attachTitleEditListeners(titleElement, goal, updateGoalInline);
    }

    makeTitleEditable(titleElement) {
        titleElement.style.cursor = 'pointer';
        titleElement.setAttribute('role', 'button');
        titleElement.setAttribute('tabindex', '0');
        titleElement.setAttribute('aria-label', 'Click to edit goal title');
    }

    attachTitleEditListeners(titleElement, goal, updateGoalInline) {
        let isEditing = false;
        let originalTitle = goal.title;
        let input = null;
        let errorMessage = null;

        const createInputElement = () => {
            input = document.createElement('input');
            input.type = 'text';
            input.className = 'goal-title-input';
            input.value = originalTitle;
            input.setAttribute('aria-label', 'Edit goal title');
            return input;
        };

        const showError = (message) => {
            if (!input) return;
            input.classList.add('goal-title-input-error');
            input.setAttribute('aria-invalid', 'true');

            // Create or update error message
            if (!errorMessage) {
                errorMessage = document.createElement('span');
                errorMessage.className = 'goal-title-error-message';
                errorMessage.setAttribute('role', 'alert');
                input.parentNode.insertBefore(errorMessage, input.nextSibling);
            }
            errorMessage.textContent = message;
        };

        const clearError = () => {
            if (!input) return;
            input.classList.remove('goal-title-input-error');
            input.removeAttribute('aria-invalid');
            if (errorMessage) {
                errorMessage.remove();
                errorMessage = null;
            }
        };

        const startEditing = () => {
            if (isEditing) {
                return;
            }
            isEditing = true;
            originalTitle = titleElement.textContent.trim();

            input = createInputElement();
            titleElement.style.display = 'none';
            titleElement.parentNode.insertBefore(input, titleElement);
            input.focus();
            input.select();

            const cancelEditing = () => {
                if (!isEditing) {
                    return;
                }
                isEditing = false;
                if (input && input.parentNode) {
                    input.remove();
                }
                input = null;
                clearError();
                titleElement.style.display = '';
            };

            this.attachInputEventListeners(input, titleElement, goal, updateGoalInline, () => isEditing, originalTitle, showError, clearError, cancelEditing);
        };

        const handleTitleClick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            startEditing();
        };

        const handleTitleKeydown = (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                startEditing();
            }
        };

        titleElement.addEventListener('click', handleTitleClick);
        titleElement.addEventListener('keydown', handleTitleKeydown);
    }

    attachInputEventListeners(input, titleElement, goal, updateGoalInline, isEditingCheck, originalTitle, showError, clearError, cancelEditing) {
        const saveTitle = () => {
            const newTitle = input.value.trim();
            clearError();

            if (newTitle === originalTitle) {
                cancelEditing();
                return;
            }

            if (newTitle === '') {
                const errorText = this.translate('errors.titleRequired') || 'Title cannot be empty';
                showError(errorText);
                input.focus();
                input.select();
                return;
            }

            updateGoalInline(goal.id, { title: newTitle });
            goal.title = newTitle;
            titleElement.textContent = newTitle;
            cancelEditing();
        };

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                saveTitle();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                cancelEditing();
            }
        });

        input.addEventListener('blur', () => {
            setTimeout(() => {
                // Check if input still exists in DOM and editing is still active
                if (input && input.parentNode && isEditingCheck()) {
                    saveTitle();
                }
            }, BLUR_SAVE_DELAY_MS);
        });

        input.addEventListener('mousedown', (event) => {
            event.stopPropagation();
        });

        // Clear error on input
        input.addEventListener('input', () => {
            clearError();
        });
    }

    /**
     * Sets up step management for a goal card, including rendering and event handling.
     * 
     * Event Listener Lifecycle:
     * - Uses EventManager utility class to handle listener lifecycle management
     * - Before re-rendering, existing step element listeners are automatically cleaned up
     * - The addStepBtn listener is managed via EventManager to prevent duplicates
     * - This simplifies listener management compared to manual Map-based tracking
     * 
     * @param {HTMLElement} card - The goal card element
     * @param {Object} goal - The goal object
     * @param {Function} updateGoalInline - Callback to update goal data
     */
    setupSteps(card, goal, updateGoalInline) {
        const stepsList = card.querySelector('.goal-steps-list');
        const addStepBtn = card.querySelector('.add-step');

        // Initialize EventManager for this card if it doesn't exist
        // This manages all event listeners for steps on this card
        if (!card._stepEventManager) {
            card._stepEventManager = new EventManager();
        }
        const eventManager = card._stepEventManager;

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
            // Clean up existing step element listeners before re-rendering
            // This is more robust as it doesn't depend on specific selectors.
            // We iterate through EventManager's tracked listeners and remove any
            // that are descendants of the stepsList, preventing duplicate listeners
            // when steps are re-rendered.
            for (const element of [...eventManager.listeners.keys()]) {
                if (stepsList.contains(element)) {
                    eventManager.off(element);
                }
            }

            const sortedSteps = this.sortStepsWithCompletedAtBottom(goal.steps || []);
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
                this.attachStepListeners(stepsList, saveSteps, renderSteps, card, goal, updateGoalInline, eventManager);
            }
        };

        // Remove existing addStepBtn listener if it exists (via EventManager)
        // This prevents duplicate listeners when setupSteps is called multiple times
        eventManager.off(addStepBtn);

        // Create and attach the addStepBtn click handler via EventManager
        const handleAddStepClick = () => {
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
        };

        // Attach listener via EventManager
        eventManager.on(addStepBtn, 'click', handleAddStepClick);

        // Initial render
        renderSteps();
    }

    /**
     * Attaches event listeners to step elements using EventManager.
     * 
     * Listener Management:
     * - All listeners are managed via EventManager for automatic cleanup
     * - When steps are re-rendered, EventManager automatically removes old listeners
     * - This simplifies listener lifecycle management compared to manual tracking
     * 
     * @param {HTMLElement} stepsList - The container element for all steps
     * @param {Function} saveSteps - Callback to save step changes
     * @param {Function} renderSteps - Callback to re-render steps (replaces recursive setupSteps calls)
     * @param {HTMLElement} card - The goal card element
     * @param {Object} goal - The goal object
     * @param {Function} updateGoalInline - Callback to update goal data
     * @param {EventManager} eventManager - The EventManager instance for this card
     */
    attachStepListeners(stepsList, saveSteps, renderSteps, card, goal, updateGoalInline, eventManager) {
        stepsList.querySelectorAll('.goal-step').forEach(stepEl => {
            const checkbox = stepEl.querySelector('.step-checkbox');
            const textEl = stepEl.querySelector('.step-text');
            const deleteBtn = stepEl.querySelector('.step-delete');

            // Create named handler functions
            const handleCheckboxChange = () => {
                stepEl.classList.toggle('completed', checkbox.checked);
                // Update the goal.steps array to reflect the checkbox state
                const stepId = stepEl.dataset.stepId;
                if (goal.steps) {
                    const step = goal.steps.find(s => s.id === stepId);
                    if (step) {
                        step.completed = checkbox.checked;
                    }
                }
                saveSteps();
                // Re-render steps to move completed steps to bottom
                renderSteps();
            };

            const handleTextBlur = () => {
                if (!textEl.textContent.trim()) {
                    const stepId = stepEl.dataset.stepId;
                    if (goal.steps) {
                        goal.steps = goal.steps.filter(s => s.id !== stepId);
                    }
                    // Save based on goal object, not DOM, since DOM hasn't updated yet
                    const { maxActiveGoals } = this.app.settingsService.getSettings();
                    this.app.goalService.updateGoal(goal.id, { steps: goal.steps }, maxActiveGoals);
                    // Re-render steps directly instead of recursively calling setupSteps
                    // This eliminates recursive re-rendering and simplifies the component lifecycle
                    renderSteps();
                } else {
                    saveSteps();
                }
            };

            const handleTextKeydown = (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    textEl.blur();
                }
            };

            const handleDeleteClick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                const stepId = stepEl.dataset.stepId;
                if (goal.steps) {
                    goal.steps = goal.steps.filter(s => s.id !== stepId);
                }
                // Save based on goal object, not DOM, since DOM hasn't updated yet
                const { maxActiveGoals } = this.app.settingsService.getSettings();
                this.app.goalService.updateGoal(goal.id, { steps: goal.steps }, maxActiveGoals);
                // Re-render steps directly instead of recursively calling setupSteps
                // This eliminates recursive re-rendering and simplifies the component lifecycle
                renderSteps();
            };

            // Attach listeners via EventManager for automatic lifecycle management
            eventManager.on(checkbox, 'change', handleCheckboxChange);
            eventManager.on(textEl, 'blur', handleTextBlur);
            eventManager.on(textEl, 'keydown', handleTextKeydown);
            eventManager.on(deleteBtn, 'click', handleDeleteClick);
        });
    }

    /**
     * Sorts steps so that uncompleted steps appear at the top and completed steps at the bottom.
     * Within each group, steps maintain their original order.
     * @param {Array} steps - Array of step objects with completed and order properties
     * @returns {Array} Sorted array of steps
     */
    sortStepsWithCompletedAtBottom(steps) {
        if (!Array.isArray(steps) || steps.length === 0) {
            return [];
        }

        // Separate completed and uncompleted steps
        const uncompleted = steps.filter(step => !step.completed);
        const completed = steps.filter(step => step.completed);

        // Sort each group by order
        uncompleted.sort((a, b) => (a.order || 0) - (b.order || 0));
        completed.sort((a, b) => (a.order || 0) - (b.order || 0));

        // Return uncompleted first, then completed
        return [...uncompleted, ...completed];
    }

}

