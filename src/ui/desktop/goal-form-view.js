// src/ui/desktop/goal-form-view.js

import { BaseUIController } from './base-ui-controller.js';

const HISTORY_FIELD_LABEL_KEYS = {
    title: 'history.fields.title',
    description: 'history.fields.description',
    motivation: 'history.fields.motivation',
    urgency: 'history.fields.urgency',
    deadline: 'history.fields.deadline',
    status: 'history.fields.status',
    priority: 'history.fields.priority'
};

const HISTORY_EVENT_LABEL_KEYS = {
    created: 'history.events.created',
    updated: 'history.events.updated',
    'status-change': 'history.events.statusChanged',
    rollback: 'history.events.rollback'
};

export class GoalFormView extends BaseUIController {
    constructor(app) {
        super(app);
    }

    openGoalForm(goalId = null, renderViews) {
        const modal = document.getElementById('goalModal');
        const form = document.getElementById('goalForm');
        const deleteBtn = document.getElementById('deleteBtn');
        const modalTitle = document.getElementById('modalTitle');

        if (!modal || !form || !deleteBtn || !modalTitle) {
            return;
        }

        let goal = null;
        if (goalId) {
            goal = this.app.goalService.goals.find(g => g.id === goalId) || null;
            if (goal) {
                modalTitle.textContent = this.translate('goalForm.editTitle');
                document.getElementById('goalId').value = goal.id;
                document.getElementById('goalTitle').value = goal.title;
                document.getElementById('goalDescription').value = goal.description || '';
                document.getElementById('goalMotivation').value = goal.motivation;
                document.getElementById('goalUrgency').value = goal.urgency;
                document.getElementById('goalDeadline').value = goal.deadline 
                    ? goal.deadline.toISOString().split('T')[0]
                    : '';
                deleteBtn.style.display = 'inline-block';
            }
        } else {
            modalTitle.textContent = this.translate('goalForm.createTitle');
            form.reset();
            document.getElementById('goalId').value = '';
            deleteBtn.style.display = 'none';
        }

        if (goal) {
            this.renderGoalHistory(goal, renderViews);
        } else {
            this.resetGoalHistoryView();
        }

        // Show modal by toggling CSS class
        modal.classList.add('is-visible');
    }

    closeGoalForm() {
        const modal = document.getElementById('goalModal');
        if (modal) {
            modal.classList.remove('is-visible');
        }
        const form = document.getElementById('goalForm');
        if (form) {
            form.reset();
        }
    }

    setupEventListeners(handleGoalSubmit, handleDelete, renderViews) {
        const goalForm = document.getElementById('goalForm');
        if (goalForm) {
            goalForm.addEventListener('submit', (e) => {
                e.preventDefault();
                handleGoalSubmit();
            });
        }

        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeGoalForm());
        }

        const deleteBtn = document.getElementById('deleteBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (confirm(this.translate('goalForm.confirmDelete'))) {
                    handleDelete();
                }
            });
        }

        const closeBtn = document.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeGoalForm());
        }

        // Use mousedown instead of click to avoid closing the modal immediately
        window.addEventListener('mousedown', (e) => {
            const modal = document.getElementById('goalModal');
            if (modal) {
                const isModalVisible = modal.classList.contains('is-visible');
                
                // Close only when the click happens outside the modal
                if (isModalVisible && e.target && e.target.nodeType === 1) {
                    try {
                        if (!modal.contains(e.target)) {
                            // Check if the click target is a button that opens the modal
                            const clickedElement = e.target;
                            const isAddGoalBtn = clickedElement.id === 'addGoalBtn' || clickedElement.closest('#addGoalBtn');
                            const isEditBtn = clickedElement.classList && (clickedElement.classList.contains('edit-goal') || clickedElement.closest('.edit-goal'));
                            
                            if (!isAddGoalBtn && !isEditBtn) {
                                this.closeGoalForm();
                            }
                        }
                    } catch (error) {
                        // Ignore errors if contains fails
                    }
                }
            }
        });
    }

    handleGoalSubmit(renderViews) {
        const id = document.getElementById('goalId').value;
        const goalData = {
            title: document.getElementById('goalTitle').value,
            description: document.getElementById('goalDescription').value,
            motivation: document.getElementById('goalMotivation').value,
            urgency: document.getElementById('goalUrgency').value,
            deadline: document.getElementById('goalDeadline').value || null
        };

        try {
            if (id) {
                this.app.goalService.updateGoal(id, goalData, this.app.settingsService.getSettings().maxActiveGoals);
            } else {
                this.app.goalService.createGoal(goalData, this.app.settingsService.getSettings().maxActiveGoals);
            }
            this.closeGoalForm();
            renderViews();
        } catch (error) {
            alert(error.message || this.translate('errors.goalSaveFailed'));
        }
    }

    handleDelete(renderViews) {
        const id = document.getElementById('goalId').value;
        this.app.goalService.deleteGoal(id, this.app.settingsService.getSettings().maxActiveGoals);
        this.closeGoalForm();
        renderViews();
    }

    formatHistoryValue(field, rawValue) {
        if (rawValue === null || rawValue === undefined) {
            return '—';
        }

        if (field === 'deadline') {
            if (!rawValue) {
                return this.translate('goalCard.noDeadline');
            }
            try {
                const date = new Date(rawValue);
                if (Number.isNaN(date.getTime())) {
                    return '—';
                }
                return this.formatDate(date);
            } catch (error) {
                return '—';
            }
        }

        if (field === 'status') {
            return this.getStatusText(rawValue);
        }

        if (field === 'priority') {
            const numberValue = Number(rawValue);
            if (!Number.isFinite(numberValue)) {
                return '—';
            }
            return numberValue.toFixed(1);
        }

        if (field === 'motivation' || field === 'urgency') {
            const numberValue = Number(rawValue);
            if (!Number.isFinite(numberValue)) {
                return '—';
            }
            return `${numberValue}`;
        }

        return `${rawValue}`;
    }

    resetGoalHistoryView() {
        const section = document.getElementById('goalHistorySection');
        const list = document.getElementById('goalHistoryList');
        if (!section || !list) {
            return;
        }
        section.hidden = true;
        list.innerHTML = '';
    }

    renderGoalHistory(goal, renderViews) {
        const section = document.getElementById('goalHistorySection');
        const list = document.getElementById('goalHistoryList');
        if (!section || !list) {
            return;
        }

        section.hidden = false;

        if (!goal || !Array.isArray(goal.history) || goal.history.length === 0) {
            list.innerHTML = '';
            const emptyState = document.createElement('p');
            emptyState.className = 'goal-history-empty';
            emptyState.textContent = this.translate('history.empty');
            list.appendChild(emptyState);
            return;
        }

        list.innerHTML = '';

        const sortedEntries = [...goal.history].sort((a, b) => {
            const timeA = a?.timestamp?.getTime?.() || 0;
            const timeB = b?.timestamp?.getTime?.() || 0;
            return timeB - timeA;
        });

        sortedEntries.forEach(entry => {
            const entryElement = document.createElement('article');
            entryElement.className = 'goal-history-entry';

            const header = document.createElement('div');
            header.className = 'goal-history-entry__header';

            const eventLabel = document.createElement('span');
            eventLabel.className = 'goal-history-entry__event';
            const eventKey = HISTORY_EVENT_LABEL_KEYS[entry.event] || 'history.events.generic';
            eventLabel.textContent = this.translate(eventKey);

            const timestamp = document.createElement('time');
            timestamp.className = 'goal-history-entry__timestamp';
            timestamp.textContent = this.formatDateTime(entry.timestamp);

            header.appendChild(eventLabel);
            header.appendChild(timestamp);

            entryElement.appendChild(header);

            if (Array.isArray(entry.changes) && entry.changes.length > 0) {
                const changesContainer = document.createElement('div');
                changesContainer.className = 'goal-history-entry__changes';

                entry.changes.forEach(change => {
                    const row = document.createElement('div');
                    row.className = 'goal-history-change';

                    const fieldLabel = document.createElement('span');
                    fieldLabel.className = 'goal-history-change__field';
                    const fieldKey = HISTORY_FIELD_LABEL_KEYS[change.field];
                    fieldLabel.textContent = fieldKey ? this.translate(fieldKey) : change.field;

                    const valueLabel = document.createElement('span');
                    valueLabel.className = 'goal-history-change__values';
                    const fromText = this.formatHistoryValue(change.field, change.from);
                    const toText = this.formatHistoryValue(change.field, change.to);
                    valueLabel.textContent = `${fromText} → ${toText}`;

                    row.appendChild(fieldLabel);
                    row.appendChild(valueLabel);
                    changesContainer.appendChild(row);
                });

                entryElement.appendChild(changesContainer);
            }

            if (entry.before) {
                const revertButton = document.createElement('button');
                revertButton.type = 'button';
                revertButton.className = 'btn btn-secondary btn-compact goal-history-revert';
                revertButton.textContent = this.translate('history.revertButton');
                revertButton.addEventListener('click', () => {
                    this.handleHistoryRevert(goal.id, entry.id, renderViews);
                });
                entryElement.appendChild(revertButton);
            }

            list.appendChild(entryElement);
        });
    }

    handleHistoryRevert(goalId, historyEntryId, renderViews) {
        if (!goalId || !historyEntryId) {
            return;
        }

        if (!window.confirm(this.translate('history.confirmRevert'))) {
            return;
        }

        const { maxActiveGoals } = this.app.settingsService.getSettings();
        const revertedGoal = this.app.goalService.revertGoalToHistoryEntry(goalId, historyEntryId, maxActiveGoals);
        if (!revertedGoal) {
            alert(this.translate('errors.revertNotPossible'));
            return;
        }

        renderViews();
        this.openGoalForm(goalId, renderViews);
    }
}

