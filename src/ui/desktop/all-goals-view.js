// src/ui/desktop/all-goals-view.js

import { BaseUIController } from './base-ui-controller.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export class AllGoalsView extends BaseUIController {
    constructor(app) {
        super(app);
        this.allGoalsState = {
            statusFilter: 'all',
            minPriority: 0,
            sort: 'priority-desc',
            includeCompleted: true,
            includeAbandoned: true
        };
        this.allGoalsControlRefs = {
            allGoalsStatusFilter: document.getElementById('allGoalsStatusFilter'),
            allGoalsPriorityFilter: document.getElementById('allGoalsPriorityFilter'),
            allGoalsSort: document.getElementById('allGoalsSort'),
            allGoalsTableBody: document.getElementById('allGoalsTableBody'),
            allGoalsEmptyState: document.getElementById('allGoalsEmptyState')
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
            const element = this.getControlElement(id);
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
        const tableBody = this.getControlElement('allGoalsTableBody');
        const emptyState = this.getControlElement('allGoalsEmptyState');
        const statusFilter = this.getControlElement('allGoalsStatusFilter');
        const priorityFilter = this.getControlElement('allGoalsPriorityFilter');
        const sortSelect = this.getControlElement('allGoalsSort');

        if (!tableBody) {
            return;
        }

        if (emptyState) {
            emptyState.textContent = this.translate('tables.allGoals.emptyState');
        }

        if (statusFilter) {
            statusFilter.value = this.allGoalsState.statusFilter;
        }
        if (priorityFilter) {
            priorityFilter.value = `${this.allGoalsState.minPriority}`;
        }
        if (sortSelect) {
            sortSelect.value = this.allGoalsState.sort;
        }

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

        tableBody.innerHTML = '';

        if (sorted.length === 0) {
            if (emptyState) {
                emptyState.hidden = false;
            }
            return;
        }

        if (emptyState) {
            emptyState.hidden = true;
        }

        sorted.forEach(({ goal, priority }) => {
            const row = document.createElement('tr');
            row.className = `goal-row status-${goal.status}`;
            row.dataset.goalId = goal.id;
            row.tabIndex = 0;
            row.setAttribute('role', 'button');
            row.setAttribute('aria-label', this.translate('allGoals.openGoalAria', { title: goal.title }));

            const cells = [
                {
                    labelKey: 'tables.allGoals.headers.title',
                    content: this.escapeHtml(goal.title),
                    isHtml: true,
                    className: 'cell-title'
                },
                {
                    labelKey: 'tables.allGoals.headers.status',
                    content: `<span class="goal-status-badge status-${goal.status}">${this.getStatusText(goal.status)}</span>`,
                    isHtml: true
                },
                {
                    labelKey: 'tables.allGoals.headers.priority',
                    content: priority.toFixed(1)
                },
                {
                    labelKey: 'tables.allGoals.headers.motivation',
                    content: `${goal.motivation}/5`
                },
                {
                    labelKey: 'tables.allGoals.headers.urgency',
                    content: `${goal.urgency}/5`
                },
                {
                    labelKey: 'tables.allGoals.headers.deadline',
                    content: goal.deadline ? this.formatDate(goal.deadline) : this.translate('goalCard.noDeadline')
                },
                {
                    labelKey: 'tables.allGoals.headers.lastUpdated',
                    content: goal.lastUpdated ? this.formatDateTime(goal.lastUpdated) : '—'
                }
            ];

            cells.forEach(({ labelKey, content, isHtml, className }) => {
                const cell = document.createElement('td');
                const label = this.translate(labelKey);
                cell.dataset.label = label;
                if (className) {
                    cell.classList.add(className);
                }
                if (isHtml) {
                    cell.innerHTML = content;
                } else {
                    cell.textContent = content;
                }
                row.appendChild(cell);
            });

            row.addEventListener('click', () => openGoalForm(goal.id));
            row.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openGoalForm(goal.id);
                }
            });

            tableBody.appendChild(row);
        });
    }

    getControlElement(id) {
        if (!this.allGoalsControlRefs) {
            this.allGoalsControlRefs = {};
        }
        const cached = this.allGoalsControlRefs[id];
        if (cached && cached.isConnected) {
            return cached;
        }
        const element = document.getElementById(id);
        this.allGoalsControlRefs[id] = element || null;
        return element || null;
    }
}

