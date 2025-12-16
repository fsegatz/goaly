// src/ui/desktop/all-goals-view.js

import { BaseAllGoalsView } from '../shared/base-all-goals-view.js';
import { MAX_RATING_VALUE } from '../../domain/utils/constants.js';
import { getElement, getOptionalElement } from '../utils/dom-utils.js';

export class AllGoalsView extends BaseAllGoalsView {
    constructor(app) {
        super(app);
        this.allGoalsControlRefs = {
            allGoalsStatusFilter: getOptionalElement('allGoalsStatusFilter'),
            allGoalsStatusFilterButton: getOptionalElement('allGoalsStatusFilterButton'),
            allGoalsStatusFilterMenu: getOptionalElement('allGoalsStatusFilterMenu'),
            allGoalsPriorityFilter: getOptionalElement('allGoalsPriorityFilter'),
            allGoalsSort: getOptionalElement('allGoalsSort'),
            allGoalsTableBody: getElement('allGoalsTableBody'),
            allGoalsEmptyState: getElement('allGoalsEmptyState')
        };
    }

    /**
     * Gets a filter element by ID with caching.
     * @param {string} id - Element ID
     * @returns {HTMLElement|null}
     */
    getFilterElement(id) {
        return this.getControlElement(id);
    }

    render(openGoalForm) {
        const tableBody = this.getControlElement('allGoalsTableBody');
        const emptyState = this.getControlElement('allGoalsEmptyState');

        if (!tableBody) {
            return;
        }

        if (emptyState) {
            emptyState.textContent = this.translate('tables.allGoals.emptyState');
        }

        // Sync filter UI with state
        this.syncFilterControls();

        // Get filtered and sorted goals from base class
        const sorted = this.getFilteredAndSortedGoals();

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
            const row = this.createGoalRow(goal, priority, openGoalForm);
            tableBody.appendChild(row);
        });
    }

    /**
     * Creates a table row for a goal.
     * @param {Object} goal - The goal object
     * @param {number} priority - Calculated priority
     * @param {Function} openGoalForm - Callback to open goal form
     * @returns {HTMLTableRowElement}
     */
    createGoalRow(goal, priority, openGoalForm) {
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
                content: `${goal.motivation}/${MAX_RATING_VALUE}`
            },
            {
                labelKey: 'tables.allGoals.headers.urgency',
                content: `${goal.urgency}/${MAX_RATING_VALUE}`
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

        row.addEventListener('click', () => {
            openGoalForm(goal.id);
        });
        row.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openGoalForm(goal.id);
            }
        });

        return row;
    }

    getControlElement(id) {
        if (!this.allGoalsControlRefs) {
            this.allGoalsControlRefs = {};
        }
        return this.getCachedElement(this.allGoalsControlRefs, id, getOptionalElement);
    }
}
