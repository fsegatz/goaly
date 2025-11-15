// src/ui/desktop/check-in-view.js

import { BaseUIController } from './base-ui-controller.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export class CheckInView extends BaseUIController {
    constructor(app) {
        super(app);
    }

    render(openGoalForm, handleCheckInSubmit, renderViews) {
        const panel = document.getElementById('checkInsPanel');
        const list = document.getElementById('checkInsList');
        const emptyState = document.getElementById('checkInsEmptyState');
        const feedbackElement = document.getElementById('checkInsFeedback');

        if (!panel || !list) {
            return;
        }

        const checkIns = Array.isArray(this.app.checkIns) ? this.app.checkIns : [];

        panel.style.display = '';
        list.innerHTML = '';

        if (feedbackElement) {
            if (this.latestCheckInFeedback) {
                const { messageKey, messageArgs, type } = this.latestCheckInFeedback;
                feedbackElement.hidden = false;
                feedbackElement.textContent = this.translate(messageKey, messageArgs);
                feedbackElement.dataset.state = type || 'info';
            } else {
                feedbackElement.hidden = true;
                feedbackElement.textContent = '';
                feedbackElement.dataset.state = '';
            }
        }

        if (!checkIns.length) {
            if (emptyState) {
                emptyState.hidden = false;
                emptyState.textContent = this.translate('checkIns.emptyState');
            }
            return;
        }

        if (emptyState) {
            emptyState.hidden = true;
        }

        const total = checkIns.length;
        checkIns.forEach((checkIn, index) => {
            const card = this.createCheckInCard(checkIn, index + 1, total, openGoalForm, handleCheckInSubmit, renderViews);
            list.appendChild(card);
        });

        this.languageService.applyTranslations(panel);
    }

    createCheckInCard(checkIn, position, total, openGoalForm, handleCheckInSubmit, renderViews) {
        const { goal, dueAt } = checkIn;
        const card = document.createElement('form');
        card.className = 'check-in-card';
        card.dataset.goalId = goal.id;

        const header = document.createElement('div');
        header.className = 'check-in-card__header';

        const title = document.createElement('h3');
        title.className = 'check-in-card__title';
        title.textContent = goal.title;
        header.appendChild(title);

        const sequence = document.createElement('span');
        sequence.className = 'check-in-card__sequence';
        sequence.textContent = this.translate('checkIns.sequence', { current: position, total });
        header.appendChild(sequence);

        const dueInfo = document.createElement('p');
        dueInfo.className = 'check-in-card__due';
        dueInfo.textContent = this.formatCheckInDueLabel(dueAt);
        header.appendChild(dueInfo);

        const fields = document.createElement('div');
        fields.className = 'check-in-card__fields';

        const motivationField = this.createCheckInInput('checkIns.fields.motivation', 'motivation', goal.motivation);
        const urgencyField = this.createCheckInInput('checkIns.fields.urgency', 'urgency', goal.urgency);

        fields.appendChild(motivationField.container);
        fields.appendChild(urgencyField.container);

        const statusPill = document.createElement('span');
        statusPill.className = 'check-in-card__status';
        statusPill.setAttribute('data-i18n-key', 'checkIns.status.stable');
        statusPill.hidden = true;
        fields.appendChild(statusPill);

        const actions = document.createElement('div');
        actions.className = 'check-in-card__actions';

        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'btn btn-primary';
        submitBtn.setAttribute('data-i18n-key', 'checkIns.actions.done');
        actions.appendChild(submitBtn);

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-secondary';
        editBtn.setAttribute('data-i18n-key', 'checkIns.actions.edit');
        editBtn.addEventListener('click', (event) => {
            event.preventDefault();
            openGoalForm(goal.id);
        });
        actions.appendChild(editBtn);

        card.appendChild(header);
        card.appendChild(fields);
        card.appendChild(actions);

        const updateStability = () => {
            const currentMotivation = Number.parseInt(motivationField.input.value, 10);
            const currentUrgency = Number.parseInt(urgencyField.input.value, 10);
            const isStable = currentMotivation === goal.motivation && currentUrgency === goal.urgency;
            card.classList.toggle('is-stable', isStable);
            statusPill.hidden = !isStable;
        };

        updateStability();

        motivationField.input.addEventListener('input', updateStability);
        urgencyField.input.addEventListener('input', updateStability);

        card.addEventListener('submit', (event) => {
            event.preventDefault();
            handleCheckInSubmit(goal.id, {
                motivation: motivationField.input.value,
                urgency: urgencyField.input.value
            }, renderViews);
        });

        return card;
    }

    createCheckInInput(labelKey, name, value) {
        const container = document.createElement('label');
        container.className = 'check-in-card__field';

        const label = document.createElement('span');
        label.className = 'check-in-card__field-label';
        label.setAttribute('data-i18n-key', labelKey);
        container.appendChild(label);

        const input = document.createElement('input');
        input.type = 'number';
        input.name = name;
        input.min = '1';
        input.max = '5';
        input.step = '1';
        input.value = value;
        input.className = 'check-in-card__field-input';
        input.setAttribute('data-i18n-key', labelKey);
        input.setAttribute('data-i18n-attr', 'aria-label');
        container.appendChild(input);

        return { container, input };
    }

    formatCheckInDueLabel(dueAt) {
        if (!dueAt) {
            return this.translate('checkIns.due.unknown');
        }
        const dueDate = dueAt instanceof Date ? dueAt : new Date(dueAt);
        if (Number.isNaN(dueDate.getTime())) {
            return this.translate('checkIns.due.unknown');
        }

        const now = new Date();
        const diffMs = now.getTime() - dueDate.getTime();
        const diffDays = Math.floor(diffMs / DAY_IN_MS);

        if (diffDays <= 0) {
            return this.translate('checkIns.due.today');
        }
        return this.translate('checkIns.due.overdue', { count: diffDays });
    }

    handleCheckInSubmit(goalId, ratings, renderViews) {
        try {
            const result = this.app.reviewService.recordReview(goalId, ratings);
            if (!result) {
                alert(this.translate('errors.goalNotFound'));
                return;
            }

            const intervals = this.app.settingsService.getReviewIntervals?.() || this.app.settingsService.getSettings().reviewIntervals;
            const intervalDays = Array.isArray(intervals) && intervals.length > 0
                ? intervals[result.goal.reviewIntervalIndex] ?? intervals[0]
                : null;
            const formattedInterval = this.formatReviewIntervalDisplay(intervalDays);

            this.latestCheckInFeedback = {
                messageKey: result.ratingsMatch ? 'checkIns.feedback.stable' : 'checkIns.feedback.updated',
                messageArgs: {
                    title: result.goal.title,
                    interval: formattedInterval
                },
                type: result.ratingsMatch ? 'success' : 'info'
            };

            if (!result.ratingsMatch) {
                this.invalidatePriorityCache();
            }

            this.app.refreshCheckIns({ render: false });
            renderViews();
        } catch (error) {
            alert(error?.message || this.translate('errors.goalUpdateFailed'));
        }
    }
}

