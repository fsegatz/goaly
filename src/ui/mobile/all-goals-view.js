// src/ui/mobile/all-goals-view.js

import { BaseUIController } from '../desktop/base-ui-controller.js';

export class MobileAllGoalsView extends BaseUIController {
    constructor(app) {
        super(app);
        this.allGoalsState = {
            statusFilter: 'all',
            minPriority: 0,
            sort: 'priority-desc',
            includeCompleted: true,
            includeAbandoned: true
        };
    }

    setupControls(openGoalForm) {
        const controls = [
            {
                id: 'allGoalsStatusFilter',
                event: 'change',
                key: 'statusFilter',
                getValue: (element) => element.value
            },
            {
                id: 'allGoalsPriorityFilter',
                event: 'input',
                key: 'minPriority',
                getValue: (element) => {
                    const parsed = parseInt(element.value, 10);
                    return Number.isNaN(parsed) ? 0 : parsed;
                }
            },
            {
                id: 'allGoalsSort',
                event: 'change',
                key: 'sort',
                getValue: (element) => element.value
            }
        ];

        controls.forEach(({ id, event, key, getValue }) => {
            const element = document.getElementById(id);
            if (!element) {
                return;
            }
            element.addEventListener(event, () => {
                this.allGoalsState[key] = getValue(element);
                this.render(openGoalForm);
            });
        });
    }

    render(openGoalForm) {
        const container = document.getElementById('allGoalsMobileContainer');
        if (!container) {
            return;
        }

        this.invalidatePriorityCache();
        this.refreshPriorityCache();

        const goalsWithMeta = this.app.goalService.goals.map(goal => ({
            goal,
            priority: this.priorityCache.get(goal.id) ?? 0
        }));

        const filtered = goalsWithMeta.filter(({ goal, priority }) => {
            if (!this.allGoalsState.includeCompleted && goal.status === 'completed') {
                return false;
            }
            if (!this.allGoalsState.includeAbandoned && goal.status === 'abandoned') {
                return false;
            }
            if (this.allGoalsState.statusFilter !== 'all' && goal.status !== this.allGoalsState.statusFilter) {
                return false;
            }
            if (priority < this.allGoalsState.minPriority) {
                return false;
            }
            return true;
        });

        const sortValue = this.allGoalsState.sort;
        const sorted = filtered.sort((a, b) => {
            switch (sortValue) {
                case 'priority-asc':
                    return a.priority - b.priority;
                case 'updated-desc':
                case 'updated-asc': {
                    const getTimestamp = (value) => value instanceof Date ? value.getTime() : (value ? new Date(value).getTime() : 0);
                    const dateA = getTimestamp(a.goal.lastUpdated);
                    const dateB = getTimestamp(b.goal.lastUpdated);
                    return sortValue === 'updated-desc' ? dateB - dateA : dateA - dateB;
                }
                case 'priority-desc':
                default:
                    return b.priority - a.priority;
            }
        });

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
                        <span class="mobile-goal-card__metric-value">${goal.motivation}/5</span>
                    </div>
                    <div class="mobile-goal-card__metric">
                        <span class="mobile-goal-card__metric-label">${this.translate('tables.allGoals.headers.urgency')}</span>
                        <span class="mobile-goal-card__metric-value">${goal.urgency}/5</span>
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

