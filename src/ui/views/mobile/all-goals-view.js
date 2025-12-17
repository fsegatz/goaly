// src/ui/views/mobile/all-goals-view.js

import { AllGoalsView } from '../all-goals-view.js';
import { MAX_RATING_VALUE } from '../../../domain/utils/constants.js';
import { getOptionalElement } from '../../utils/dom-utils.js';

export class MobileAllGoalsView extends AllGoalsView {
    constructor(app) {
        super(app);
    }

    render(openGoalForm) {
        // Persist callback if provided, otherwise use stored callback
        if (openGoalForm) {
            this.openGoalFormCallback = openGoalForm;
        } else if (this.openGoalFormCallback) {
            openGoalForm = this.openGoalFormCallback;
        } else {
            console.warn('MobileAllGoalsView: openGoalForm callback missing and none stored');
        }

        const container = getOptionalElement('allGoalsMobileContainer');
        if (!container) {
            return;
        }

        // Get filtered and sorted goals from base class
        const sorted = this.getFilteredAndSortedGoals();

        container.innerHTML = '';

        if (sorted.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'mobile-goals-empty';
            emptyState.textContent = this.translate('tables.allGoals.emptyState');
            container.appendChild(emptyState);
            return;
        }

        sorted.forEach(({ goal, priority }) => {
            const card = this.createGoalCard(goal, priority, openGoalForm);
            container.appendChild(card);
        });
    }

    /**
     * Creates a mobile goal card.
     * @param {Object} goal - The goal object
     * @param {number} priority - Calculated priority
     * @param {Function} openGoalForm - Callback to open goal form
     * @returns {HTMLDivElement}
     */
    createGoalCard(goal, priority, openGoalForm) {
        const card = document.createElement('div');
        card.className = `mobile-goal-card status-${goal.status}`;
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', this.translate('allGoals.openGoalAria', { title: goal.title }));

        const deadlineText = goal.deadline ? this.formatDate(goal.deadline) : this.translate('goalCard.noDeadline');
        const lastUpdatedText = goal.lastUpdated ? this.formatDateTime(goal.lastUpdated) : '—';

        card.innerHTML = `
            <div class="mobile-goal-card__header">
                <h3 class="mobile-goal-card__title">${this.escapeHtml(goal.title)}</h3>
                <span class="goal-status-badge status-${goal.status}">${this.getStatusText(goal.status)}</span>
            </div>
            <div class="mobile-goal-card__body">
                <div class="mobile-goal-card__metrics">
                    <div class="mobile-goal-card__metric">
                        <span class="mobile-goal-card__metric-label">${this.translate('tables.allGoals.headers.priority')}</span>
                        <span class="mobile-goal-card__metric-value">${priority.toFixed(1)}</span>
                    </div>
                    <div class="mobile-goal-card__metric">
                        <span class="mobile-goal-card__metric-label">${this.translate('tables.allGoals.headers.motivation')}</span>
                        <span class="mobile-goal-card__metric-value">${goal.motivation}/${MAX_RATING_VALUE}</span>
                    </div>
                    <div class="mobile-goal-card__metric">
                        <span class="mobile-goal-card__metric-label">${this.translate('tables.allGoals.headers.urgency')}</span>
                        <span class="mobile-goal-card__metric-value">${goal.urgency}/${MAX_RATING_VALUE}</span>
                    </div>
                </div>
                <div class="mobile-goal-card__details">
                    <div class="mobile-goal-card__detail">
                        <span class="mobile-goal-card__detail-label">${this.translate('tables.allGoals.headers.deadline')}</span>
                        <span class="mobile-goal-card__detail-value">${deadlineText}</span>
                    </div>
                    <div class="mobile-goal-card__detail">
                        <span class="mobile-goal-card__detail-label">${this.translate('tables.allGoals.headers.lastUpdated')}</span>
                        <span class="mobile-goal-card__detail-value">${lastUpdatedText}</span>
                    </div>
                </div>
            </div>
        `;

        card.addEventListener('click', () => openGoalForm(goal.id));
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openGoalForm(goal.id);
            }
        });

        return card;
    }
}
