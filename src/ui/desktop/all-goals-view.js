// src/ui/desktop/all-goals-view.js

import { BaseUIController } from './base-ui-controller.js';
import { MAX_RATING_VALUE } from '../../domain/utils/constants.js';
import { getElement, getOptionalElement } from '../utils/dom-utils.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export class AllGoalsView extends BaseUIController {
    constructor(app) {
        super(app);
        this.allGoalsState = {
            statusFilter: ['all'],
            minPriority: 0,
            sort: 'priority-desc',
            includeCompleted: true,
            includeAbandoned: true
        };
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

    setupControls(openGoalForm) {
        // Setup status filter dropdown
        this.setupStatusFilterDropdown(openGoalForm);

        // Setup priority filter
        const priorityFilter = this.getControlElement('allGoalsPriorityFilter');
        if (priorityFilter) {
            priorityFilter.addEventListener('input', () => {
                const parsed = parseInt(priorityFilter.value, 10);
                this.allGoalsState.minPriority = Number.isNaN(parsed) ? 0 : parsed;
                this.render(openGoalForm);
            });
        }

        // Setup sort
        const sortSelect = this.getControlElement('allGoalsSort');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.allGoalsState.sort = sortSelect.value;
                this.render(openGoalForm);
            });
        }
    }

    setupStatusFilterDropdown(openGoalForm) {
        const dropdown = this.getControlElement('allGoalsStatusFilter');
        const button = this.getControlElement('allGoalsStatusFilterButton');
        const menu = this.getControlElement('allGoalsStatusFilterMenu');
        const clearButton = getOptionalElement('allGoalsStatusFilterClear');
        const checkboxes = dropdown?.querySelectorAll('.status-filter-checkbox');

        if (!dropdown || !button || !menu) {
            return;
        }

        // Toggle dropdown
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const isExpanded = button.getAttribute('aria-expanded') === 'true';
            button.setAttribute('aria-expanded', !isExpanded);
            menu.setAttribute('aria-hidden', isExpanded);
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                button.setAttribute('aria-expanded', 'false');
                menu.setAttribute('aria-hidden', 'true');
            }
        });

        // Handle checkbox changes
        if (checkboxes) {
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    this.handleStatusFilterChange(checkbox, checkboxes);
                    this.updateStatusFilterButtonText(button);
                    this.render(openGoalForm);
                });
            });
        }

        // Handle clear filter
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

    handleStatusFilterChange(changedCheckbox, allCheckboxes) {
        if (changedCheckbox.value === 'all') {
            // If "all" is checked, uncheck everything else and set filter to ['all']
            if (changedCheckbox.checked) {
                allCheckboxes.forEach(cb => {
                    if (cb.value !== 'all') {
                        cb.checked = false;
                    }
                });
                this.allGoalsState.statusFilter = ['all'];
            } else {
                // If "all" is unchecked, check all others
                allCheckboxes.forEach(cb => {
                    if (cb.value !== 'all') {
                        cb.checked = true;
                    }
                });
                this.allGoalsState.statusFilter = ['active', 'inactive', 'paused', 'completed', 'abandoned'];
            }
        } else {
            // If a specific status is changed, uncheck "all" if it was checked
            const allCheckbox = Array.from(allCheckboxes).find(cb => cb.value === 'all');
            if (allCheckbox && allCheckbox.checked) {
                allCheckbox.checked = false;
            }

            // Update the filter array
            const selectedStatuses = Array.from(allCheckboxes)
                .filter(cb => cb.checked && cb.value !== 'all')
                .map(cb => cb.value);

            if (selectedStatuses.length === 0) {
                // If nothing is selected, select "all"
                if (allCheckbox) {
                    allCheckbox.checked = true;
                }
                this.allGoalsState.statusFilter = ['all'];
            } else {
                this.allGoalsState.statusFilter = selectedStatuses;
            }
        }
    }

    updateStatusFilterButtonText(button) {
        const buttonText = button?.querySelector('.status-filter-button-text');
        if (!buttonText) {
            return;
        }

        const statusCount = this.allGoalsState.statusFilter.length;
        const isAll = this.allGoalsState.statusFilter.includes('all') || 
                     (statusCount === 5 && this.allGoalsState.statusFilter.includes('active') && 
                      this.allGoalsState.statusFilter.includes('inactive') &&
                      this.allGoalsState.statusFilter.includes('paused') && 
                      this.allGoalsState.statusFilter.includes('completed') && 
                      this.allGoalsState.statusFilter.includes('abandoned'));

        if (isAll) {
            buttonText.textContent = this.translate('filters.statusOptions.all');
        } else if (statusCount === 1) {
            const status = this.allGoalsState.statusFilter[0];
            buttonText.textContent = this.translate(`filters.statusOptions.${status}`);
        } else {
            buttonText.textContent = `${statusCount} ${this.translate('filters.statusLabel').toLowerCase()}`;
        }
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

        // Sync status filter checkboxes
        if (statusFilter) {
            const checkboxes = statusFilter.querySelectorAll('.status-filter-checkbox');
            const button = this.getControlElement('allGoalsStatusFilterButton');
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

        const goalsWithMeta = this.app.goalService.goals.map(goal => ({
            goal,
            priority: this.getPriority(goal.id)
        }));

        const filtered = goalsWithMeta.filter(({ goal, priority }) => {
            if (!this.allGoalsState.includeCompleted && goal.status === 'completed') {
                return false;
            }
            if (!this.allGoalsState.includeAbandoned && goal.status === 'abandoned') {
                return false;
            }
            // Check if status matches any of the selected filters
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

            // Add actions cell with Force Activate button
            const actionsCell = document.createElement('td');
            actionsCell.className = 'cell-actions';
            actionsCell.dataset.label = this.translate('tables.allGoals.headers.actions');
            
            // Only show Force Activate for goals that are not active, completed, or abandoned
            if (goal.status !== 'active' && goal.status !== 'completed' && goal.status !== 'abandoned') {
                const forceActivateBtn = document.createElement('button');
                forceActivateBtn.className = 'btn btn-small btn-secondary force-activate-btn';
                forceActivateBtn.textContent = this.translate('allGoals.forceActivate');
                forceActivateBtn.setAttribute('aria-label', this.translate('allGoals.forceActivateAria', { title: goal.title }));
                forceActivateBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleForceActivate(goal.id, openGoalForm);
                });
                actionsCell.appendChild(forceActivateBtn);
            } else if (goal.status === 'active' && goal.forceActivated) {
                // Show indicator for force-activated goals
                const indicator = document.createElement('span');
                indicator.className = 'force-activated-indicator';
                indicator.textContent = this.translate('allGoals.forceActivated');
                indicator.setAttribute('aria-label', this.translate('allGoals.forceActivatedAria'));
                actionsCell.appendChild(indicator);
            }
            
            row.appendChild(actionsCell);

            row.addEventListener('click', (e) => {
                // Don't open form if clicking on action buttons
                if (!e.target.closest('.force-activate-btn') && !e.target.closest('.force-activated-indicator')) {
                    openGoalForm(goal.id);
                }
            });
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
        const element = getOptionalElement(id);
        this.allGoalsControlRefs[id] = element || null;
        return element || null;
    }

    handleForceActivate(goalId, openGoalForm) {
        const goal = this.app.goalService.goals.find(g => g.id === goalId);
        if (!goal) return;

        // Cannot force-activate completed or abandoned goals
        if (goal.status === 'completed' || goal.status === 'abandoned') {
            return;
        }

        const maxActiveGoals = this.app.settingsService.getSettings().maxActiveGoals;
        const result = this.app.goalService.forceActivateGoal(goalId, maxActiveGoals);
        
        if (result) {
            // Re-render the view
            this.render(openGoalForm);
        }
    }
}

