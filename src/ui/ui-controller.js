// src/ui/ui-controller.js

class UIController {
    constructor(app) {
        this.app = app;
        this.allGoalsState = {
            statusFilter: 'all',
            minPriority: 0,
            sort: 'priority-desc',
            includeCompleted: true,
            includeArchived: true
        };
        this.setupEventListeners();
    }

    renderViews() {
        const settings = this.app.settingsService.getSettings();
        const activeGoals = this.app.goalService.getActiveGoals();
        const dashboardGoals = activeGoals.slice(0, settings.maxActiveGoals);

        const dashboardList = document.getElementById('goalsList');
        dashboardList.innerHTML = '';

        if (dashboardGoals.length === 0) {
            dashboardList.innerHTML = '<p style="text-align: center; color: #888; padding: 40px;">Keine aktiven Ziele. Erstelle dein erstes Ziel!</p>';
        } else {
            dashboardGoals.forEach(goal => {
                dashboardList.appendChild(this.createGoalCard(goal));
            });
        }

        this.renderAllGoalsTable();
    }

    createGoalCard(goal) {
        const card = document.createElement('div');
        card.className = `goal-card ${goal.status}`;
        
        const priority = this.app.goalService.calculatePriority(goal);
        const deadlineText = goal.deadline 
            ? this.formatDeadline(goal.deadline)
            : 'Keine Deadline';

        card.innerHTML = `
            <div class="goal-header">
                <div>
                    <div class="goal-title">${this.escapeHtml(goal.title)}</div>
                    <span class="goal-status-badge status-${goal.status}">${this.getStatusText(goal.status)}</span>
                </div>
            </div>
            ${goal.description ? `<div class="goal-description">${this.escapeHtml(goal.description)}</div>` : ''}
            <div class="goal-metrics">
                <div class="metric">
                    <span class="metric-label">Motivation</span>
                    <span class="metric-value motivation">${goal.motivation}/5</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Dringlichkeit</span>
                    <span class="metric-value urgency">${goal.urgency}/5</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Priorität</span>
                    <span class="metric-value priority">${priority.toFixed(1)}</span>
                </div>
            </div>
            <div class="goal-deadline ${this.isDeadlineUrgent(goal.deadline) ? 'urgent' : ''}">
                📅 ${deadlineText}
            </div>
            <div class="goal-actions">
                <button class="btn btn-primary edit-goal" data-id="${goal.id}">Bearbeiten</button>
            </div>
        `;

        const editBtn = card.querySelector('.edit-goal');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Verhindere Event-Bubbling
                this.openGoalForm(goal.id);
            });
        }

        return card;
    }

    formatDeadline(deadline) {
        const now = new Date();
        const days = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
        
        if (days < 0) {
            return `Überfällig (${Math.abs(days)} Tage)`;
        } else if (days === 0) {
            return 'Heute';
        } else if (days === 1) {
            return 'Morgen';
        } else if (days <= 7) {
            return `In ${days} Tagen`;
        } else {
            return deadline.toLocaleDateString('de-DE');
        }
    }

    isDeadlineUrgent(deadline) {
        if (!deadline) return false;
        const now = new Date();
        const days = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
        return days <= 7 && days >= 0;
    }

    getStatusText(status) {
        const statusMap = {
            active: 'Aktiv',
            paused: 'Pausiert',
            completed: 'Abgeschlossen'
        };
        return statusMap[status] || status;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    openGoalForm(goalId = null) {
        const modal = document.getElementById('goalModal');
        const form = document.getElementById('goalForm');
        const deleteBtn = document.getElementById('deleteBtn');
        const modalTitle = document.getElementById('modalTitle');

        if (!modal || !form || !deleteBtn || !modalTitle) {
            return;
        }

        if (goalId) {
            const goal = this.app.goalService.goals.find(g => g.id === goalId);
            if (goal) {
                modalTitle.textContent = 'Ziel bearbeiten';
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
            modalTitle.textContent = 'Neues Ziel';
            form.reset();
            document.getElementById('goalId').value = '';
            deleteBtn.style.display = 'none';
        }

        // Zeige Modal über CSS-Klasse
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


    showCheckIns() {
        const panel = document.getElementById('checkInsPanel');
        const list = document.getElementById('checkInsList');
        
        list.innerHTML = '';
        
        if (this.app.checkIns.length === 0) {
            panel.style.display = 'none';
            return;
        }
        
        this.app.checkIns.forEach(checkIn => {
            const item = document.createElement('div');
            item.className = 'check-in-item';
            item.innerHTML = `
                <h3>${this.escapeHtml(checkIn.goal.title)}</h3>
                <p>${checkIn.message}</p>
                <div class="check-in-actions">
                    <button class="btn btn-primary check-in-done" data-id="${checkIn.goal.id}">Check-in durchgeführt</button>
                    <button class="btn btn-secondary edit-check-in-goal" data-id="${checkIn.goal.id}">Ziel bearbeiten</button>
                </div>
            `;
            
            item.querySelector('.check-in-done').addEventListener('click', () => {
                this.app.checkInService.performCheckIn(checkIn.goal.id);
                this.app.checkIns = this.app.checkInService.getCheckIns();
                this.showCheckIns();
                if (this.app.checkIns.length === 0) {
                    panel.style.display = 'none';
                }
            });
            
            item.querySelector('.edit-check-in-goal').addEventListener('click', () => {
                this.openGoalForm(checkIn.goal.id);
            });
            
            list.appendChild(item);
        });
        
        panel.style.display = 'block';
    }

    setupEventListeners() {
        const addGoalBtn = document.getElementById('addGoalBtn');
        if (addGoalBtn) {
            addGoalBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Verhindere Event-Bubbling
                this.openGoalForm();
            });
        }

        const goalForm = document.getElementById('goalForm');
        if (goalForm) {
            goalForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleGoalSubmit();
            });
        }

        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeGoalForm());
        }

        const deleteBtn = document.getElementById('deleteBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (confirm('Möchtest du dieses Ziel wirklich löschen?')) {
                    const id = document.getElementById('goalId').value;
                    this.app.goalService.deleteGoal(id, this.app.settingsService.getSettings().maxActiveGoals);
                    this.closeGoalForm();
                    this.renderViews();
                }
            });
        }

        const closeBtn = document.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeGoalForm());
        }

        // Verwende mousedown statt click, um sicherzustellen, dass das Modal nicht sofort geschlossen wird
        window.addEventListener('mousedown', (e) => {
            const modal = document.getElementById('goalModal');
            if (modal) {
                const isModalVisible = modal.classList.contains('is-visible');
                
                // Schließe nur, wenn der Klick außerhalb des Modals ist
                if (isModalVisible && e.target && e.target.nodeType === 1) {
                    try {
                        if (!modal.contains(e.target)) {
                            // Prüfe, ob der Klick auf einen Button war, der das Modal öffnet
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

        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.app.exportData());
        }

        const importBtn = document.getElementById('importBtn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                const importFile = document.getElementById('importFile');
                if (importFile) {
                    importFile.click();
                }
            });
        }

        const importFile = document.getElementById('importFile');
        if (importFile) {
            importFile.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.app.importData(e.target.files[0]);
                    e.target.value = '';
                }
            });
        }

        const saveSettingsBtn = document.getElementById('saveSettingsBtn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => {
                const newSettings = {
                    maxActiveGoals: parseInt(document.getElementById('maxActiveGoals').value),
                    checkInInterval: parseInt(document.getElementById('checkInInterval').value),
                    checkInsEnabled: document.getElementById('checkInsEnabled').checked
                };
                const oldMaxActiveGoals = this.app.settingsService.getSettings().maxActiveGoals;
                this.app.settingsService.updateSettings(newSettings);
                
                // Wenn sich maxActiveGoals geändert hat, automatisch neu aktivieren
                if (newSettings.maxActiveGoals !== oldMaxActiveGoals) {
                    this.app.goalService.autoActivateGoalsByPriority(newSettings.maxActiveGoals);
                }
                
                this.app.startCheckInTimer();
                this.renderViews();
            });
        }

        document.querySelectorAll('.menu-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const viewName = btn.dataset.view;
                
                document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                document.querySelectorAll('.view').forEach(content => {
                    content.classList.remove('active');
                });
                const targetView = document.getElementById(`${viewName}View`);
                if (targetView) {
                    targetView.classList.add('active');
                }
            });
        });

        this.setupAllGoalsControls();
    }

    handleGoalSubmit() {
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
            this.renderViews();
        } catch (error) {
            alert(error.message);
        }
    }

    setupAllGoalsControls() {
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
            },
            {
                id: 'allGoalsToggleCompleted',
                event: 'change',
                key: 'includeCompleted',
                getValue: (element) => element.checked
            },
            {
                id: 'allGoalsToggleArchived',
                event: 'change',
                key: 'includeArchived',
                getValue: (element) => element.checked
            }
        ];

        controls.forEach(({ id, event, key, getValue }) => {
            const element = document.getElementById(id);
            if (!element) {
                return;
            }
            element.addEventListener(event, () => {
                this.allGoalsState[key] = getValue(element);
                this.renderAllGoalsTable();
            });
        });
    }

    renderAllGoalsTable() {
        const tableBody = document.getElementById('allGoalsTableBody');
        const emptyState = document.getElementById('allGoalsEmptyState');
        const statusFilter = document.getElementById('allGoalsStatusFilter');
        const priorityFilter = document.getElementById('allGoalsPriorityFilter');
        const sortSelect = document.getElementById('allGoalsSort');
        const toggleCompleted = document.getElementById('allGoalsToggleCompleted');
        const toggleArchived = document.getElementById('allGoalsToggleArchived');

        if (!tableBody) {
            return;
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
        if (toggleCompleted) {
            toggleCompleted.checked = this.allGoalsState.includeCompleted;
        }
        if (toggleArchived) {
            toggleArchived.checked = this.allGoalsState.includeArchived;
        }

        const goalsWithMeta = this.app.goalService.goals.map(goal => ({
            goal,
            priority: this.app.goalService.calculatePriority(goal)
        }));

        const filtered = goalsWithMeta.filter(({ goal, priority }) => {
            if (!this.allGoalsState.includeCompleted && goal.status === 'completed') {
                return false;
            }
            if (!this.allGoalsState.includeArchived && goal.status === 'archived') {
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
                    const getTimestamp = (value) => {
                        if (!value) {
                            return 0;
                        }
                        return value instanceof Date ? value.getTime() : new Date(value).getTime();
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
            row.setAttribute('aria-label', `${goal.title} öffnen`);

            const cells = [
                {
                    label: 'Titel',
                    content: this.escapeHtml(goal.title),
                    isHtml: true,
                    className: 'cell-title'
                },
                {
                    label: 'Status',
                    content: `<span class="goal-status-badge status-${goal.status}">${this.getStatusText(goal.status)}</span>`,
                    isHtml: true
                },
                {
                    label: 'Priorität',
                    content: priority.toFixed(1)
                },
                {
                    label: 'Motivation',
                    content: `${goal.motivation}/5`
                },
                {
                    label: 'Dringlichkeit',
                    content: `${goal.urgency}/5`
                },
                {
                    label: 'Deadline',
                    content: goal.deadline ? goal.deadline.toLocaleDateString('de-DE') : 'Keine Deadline'
                },
                {
                    label: 'Letzte Änderung',
                    content: goal.lastUpdated ? this.formatDateTime(goal.lastUpdated) : '—'
                }
            ];

            cells.forEach(({ label, content, isHtml, className }) => {
                const cell = document.createElement('td');
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

            row.addEventListener('click', () => this.openGoalForm(goal.id));
            row.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.openGoalForm(goal.id);
                }
            });

            tableBody.appendChild(row);
        });
    }

    formatDateTime(date) {
        if (!date) {
            return '';
        }
        const dateObj = date instanceof Date ? date : new Date(date);
        return dateObj.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
            ' ' +
            dateObj.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    }
}

export default UIController;
