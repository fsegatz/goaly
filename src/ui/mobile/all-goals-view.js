// src/ui/mobile/all-goals-view.js

import { BaseUIController } from '../desktop/base-ui-controller.js';

export class MobileAllGoalsView extends BaseUIController {
    constructor(app) {
        super(app);
        this.allGoalsState = {
            statusFilter: ['all'],
            minPriority: 0,
            sort: 'priority-desc',
            includeCompleted: true,
            includeAbandoned: true
        };
    }

    setupControls(openGoalForm) {
        // Setup status filter dropdown
        this.setupStatusFilterDropdown(openGoalForm);

        // Setup priority filter
        const priorityFilter = document.getElementById('allGoalsPriorityFilter');
        if (priorityFilter) {
            priorityFilter.addEventListener('input', () => {
                const parsed = parseInt(priorityFilter.value, 10);
                this.allGoalsState.minPriority = Number.isNaN(parsed) ? 0 : parsed;
                this.render(openGoalForm);
            });
        }

        // Setup sort
        const sortSelect = document.getElementById('allGoalsSort');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.allGoalsState.sort = sortSelect.value;
                this.render(openGoalForm);
            });
        }
    }

    setupStatusFilterDropdown(openGoalForm) {
        const dropdown = document.getElementById('allGoalsStatusFilter');
        const button = document.getElementById('allGoalsStatusFilterButton');
        const menu = document.getElementById('allGoalsStatusFilterMenu');
        const clearButton = document.getElementById('allGoalsStatusFilterClear');
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
                this.allGoalsState.statusFilter = ['active', 'paused', 'completed', 'abandoned'];
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
                     (statusCount === 4 && this.allGoalsState.statusFilter.includes('active') && 
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

