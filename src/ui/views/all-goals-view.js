// src/ui/views/all-goals-view.js

/**
 * @module AllGoalsView
 * @description View for displaying a comprehensive list of all goals.
 * Supports filtering by status, sorting by priority or date, and pagination (if applicable).
 */

import { BaseView } from '../base-view.js';
import { MAX_RATING_VALUE } from '../../domain/utils/constants.js';
import { getOptionalElement } from '../utils/dom-utils.js';

/**
 * All available goal statuses for filtering.
 */
const ALL_STATUSES = ['active', 'inactive', 'paused', 'completed', 'notCompleted'];

/**
 * AllGoalsView handles displaying and filtering all goals in a table format.
 * Contains shared state management, filtering, sorting, and status filter dropdown logic.
 * @class
 * @extends BaseView
 */
export class AllGoalsView extends BaseView {
    /**
     * @param {Object} app - The main application instance
     */
    constructor(app) {
        super(app);
        this.allGoalsState = {
            statusFilter: ['all'],
            minPriority: 0,
            sort: 'priority-desc',
            includeCompleted: true,
            includeNotCompleted: true
        };
        this.allGoalsControlRefs = {
            allGoalsStatusFilter: getOptionalElement('allGoalsStatusFilter'),
            allGoalsStatusFilterButton: getOptionalElement('allGoalsStatusFilterButton'),
            allGoalsStatusFilterMenu: getOptionalElement('allGoalsStatusFilterMenu'),
            allGoalsPriorityFilter: getOptionalElement('allGoalsPriorityFilter'),
            allGoalsSort: getOptionalElement('allGoalsSort'),
            allGoalsTableBody: getOptionalElement('allGoalsTableBody'),
            allGoalsEmptyState: getOptionalElement('allGoalsEmptyState')
        };
    }

    /**
     * Sets up filter and sort controls.
     * @param {Function} openGoalForm - Callback to open goal form
     */
    setupControls(openGoalForm) {
        this.setupStatusFilterDropdown(openGoalForm);

        const priorityFilter = this.getFilterElement('allGoalsPriorityFilter');
        if (priorityFilter) {
            priorityFilter.addEventListener('input', () => {
                const parsed = Number.parseInt(priorityFilter.value, 10);
                this.allGoalsState.minPriority = Number.isNaN(parsed) ? 0 : parsed;
                this.render(openGoalForm);
            });
        }

        const sortSelect = this.getFilterElement('allGoalsSort');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.allGoalsState.sort = sortSelect.value;
                this.render(openGoalForm);
            });
        }
    }

    /**
     * Sets up the status filter dropdown behavior.
     * @param {Function} openGoalForm - Callback to open goal form
     */
    setupStatusFilterDropdown(openGoalForm) {
        const dropdown = this.getFilterElement('allGoalsStatusFilter');
        const button = this.getFilterElement('allGoalsStatusFilterButton');
        const menu = this.getFilterElement('allGoalsStatusFilterMenu');
        const clearButton = getOptionalElement('allGoalsStatusFilterClear');
        const checkboxes = dropdown?.querySelectorAll('.status-filter-checkbox');

        if (!dropdown || !button || !menu) {
            return;
        }

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const isExpanded = button.getAttribute('aria-expanded') === 'true';
            button.setAttribute('aria-expanded', !isExpanded);
            menu.setAttribute('aria-hidden', isExpanded);
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                button.setAttribute('aria-expanded', 'false');
                menu.setAttribute('aria-hidden', 'true');
            }
        });

        if (checkboxes) {
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    this.handleStatusFilterChange(checkbox, checkboxes);
                    this.updateStatusFilterButtonText(button);
                    this.render(openGoalForm);
                });
            });
        }

        if (clearButton) {
            clearButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.allGoalsState.statusFilter = ['all'];
                if (checkboxes) {
                    checkboxes.forEach(cb => {
                        cb.checked = cb.value === 'all';
                    });
                }
                this.updateStatusFilterButtonText(button);
                button.setAttribute('aria-expanded', 'false');
                menu.setAttribute('aria-hidden', 'true');
                this.render(openGoalForm);
            });
        }
    }

    /**
     * Handles status filter checkbox changes.
     * @param {HTMLInputElement} changedCheckbox - The checkbox that was changed
     * @param {NodeList} allCheckboxes - All status filter checkboxes
     */
    handleStatusFilterChange(changedCheckbox, allCheckboxes) {
        if (changedCheckbox.value === 'all') {
            if (changedCheckbox.checked) {
                allCheckboxes.forEach(cb => {
                    if (cb.value !== 'all') {
                        cb.checked = false;
                    }
                });
                this.allGoalsState.statusFilter = ['all'];
            } else {
                allCheckboxes.forEach(cb => {
                    if (cb.value !== 'all') {
                        cb.checked = true;
                    }
                });
                this.allGoalsState.statusFilter = [...ALL_STATUSES];
            }
        } else {
            const allCheckbox = Array.from(allCheckboxes).find(cb => cb.value === 'all');
            if (allCheckbox?.checked) {
                allCheckbox.checked = false;
            }

            const selectedStatuses = Array.from(allCheckboxes)
                .filter(cb => cb.checked && cb.value !== 'all')
                .map(cb => cb.value);

            if (selectedStatuses.length === 0) {
                if (allCheckbox) {
                    allCheckbox.checked = true;
                }
                this.allGoalsState.statusFilter = ['all'];
            } else {
                this.allGoalsState.statusFilter = selectedStatuses;
            }
        }
    }

    /**
     * Updates the status filter button text based on current selection.
     * @param {HTMLElement} button - The filter button element
     */
    updateStatusFilterButtonText(button) {
        const buttonText = button?.querySelector('.status-filter-button-text');
        if (!buttonText) {
            return;
        }

        const statusCount = this.allGoalsState.statusFilter.length;
        const isAll = this.allGoalsState.statusFilter.includes('all') ||
            (statusCount === ALL_STATUSES.length &&
                ALL_STATUSES.every(s => this.allGoalsState.statusFilter.includes(s)));

        if (isAll) {
            buttonText.textContent = this.translate('filters.statusOptions.all');
        } else if (statusCount === 1) {
            const status = this.allGoalsState.statusFilter[0];
            buttonText.textContent = this.translate(`filters.statusOptions.${status}`);
        } else {
            buttonText.textContent = `${statusCount} ${this.translate('filters.statusLabel').toLowerCase()}`;
        }
    }

    /**
     * Gets filtered and sorted goals based on current state.
     * @returns {Array<{goal: Object, priority: number}>} Sorted array of goals with priority
     */
    getFilteredAndSortedGoals() {
        const goalsWithMeta = this.app.goalService.goals.map(goal => ({
            goal,
            priority: this.getPriority(goal.id)
        }));

        const filtered = goalsWithMeta.filter(({ goal, priority }) => {
            if (!this.allGoalsState.includeCompleted && goal.status === 'completed') {
                return false;
            }
            if (!this.allGoalsState.includeNotCompleted && goal.status === 'notCompleted') {
                return false;
            }
            if (!this.allGoalsState.statusFilter.includes('all') &&
                !this.allGoalsState.statusFilter.includes(goal.status)) {
                return false;
            }
            if (priority < this.allGoalsState.minPriority) {
                return false;
            }
            return true;
        });

        const sortValue = this.allGoalsState.sort;
        return filtered.sort((a, b) => {
            switch (sortValue) {
                case 'priority-asc':
                    return a.priority - b.priority;
                case 'updated-desc':
                case 'updated-asc': {
                    const getTimestamp = (value) => {
                        if (value instanceof Date) {
                            return value.getTime();
                        }
                        return value ? new Date(value).getTime() : 0;
                    };
                    const dateA = getTimestamp(a.goal.lastUpdated);
                    const dateB = getTimestamp(b.goal.lastUpdated);
                    return sortValue === 'updated-desc' ? dateB - dateA : dateA - dateB;
                }
                case 'priority-desc':
                default:
                    return b.priority - a.priority;
            }
        });
    }

    /**
     * Gets a filter element by ID with caching.
     * @param {string} id - Element ID
     * @returns {HTMLElement|null}
     */
    getFilterElement(id) {
        return this.getControlElement(id);
    }

    /**
     * Syncs filter UI controls with current state.
     */
    syncFilterControls() {
        const statusFilter = this.getFilterElement('allGoalsStatusFilter');
        const priorityFilter = this.getFilterElement('allGoalsPriorityFilter');
        const sortSelect = this.getFilterElement('allGoalsSort');

        if (statusFilter) {
            const checkboxes = statusFilter.querySelectorAll('.status-filter-checkbox');
            const button = this.getFilterElement('allGoalsStatusFilterButton');
            checkboxes.forEach(checkbox => {
                if (this.allGoalsState.statusFilter.includes('all')) {
                    checkbox.checked = checkbox.value === 'all';
                } else {
                    checkbox.checked = this.allGoalsState.statusFilter.includes(checkbox.value);
                }
            });
            this.updateStatusFilterButtonText(button);
        }
        if (priorityFilter) {
            priorityFilter.value = `${this.allGoalsState.minPriority}`;
        }
        if (sortSelect) {
            sortSelect.value = this.allGoalsState.sort;
        }
    }

    /**
     * Renders the all goals table.
     * @param {Function} openGoalForm - Callback to open goal editing form
     */
    render(openGoalForm) {
        // Persist callback if provided, otherwise use stored callback
        if (openGoalForm) {
            this.openGoalFormCallback = openGoalForm;
        } else if (this.openGoalFormCallback) {
            openGoalForm = this.openGoalFormCallback;
        } else {
            console.warn('AllGoalsView: openGoalForm callback missing and none stored');
        }

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

        // Get filtered and sorted goals
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
            if (typeof openGoalForm === 'function') {
                openGoalForm(goal.id);
            }
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
