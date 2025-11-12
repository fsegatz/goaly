// src/ui/ui-controller.js

const HISTORY_FIELD_LABELS = {
    title: 'Titel',
    description: 'Beschreibung',
    motivation: 'Motivation',
    urgency: 'Dringlichkeit',
    deadline: 'Deadline',
    status: 'Status',
    priority: 'Priorität'
};

const HISTORY_EVENT_LABELS = {
    created: 'Erstellt',
    updated: 'Aktualisiert',
    'status-change': 'Status angepasst',
    rollback: 'Zurückgesetzt'
};

class UIController {
    constructor(app) {
        this.app = app;
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
            allGoalsToggleCompleted: document.getElementById('allGoalsToggleCompleted'),
            allGoalsToggleAbandoned: document.getElementById('allGoalsToggleAbandoned'),
            allGoalsTableBody: document.getElementById('allGoalsTableBody'),
            allGoalsEmptyState: document.getElementById('allGoalsEmptyState')
        };
        this.completionModalRefs = {
            completionModal: document.getElementById('completionModal'),
            completionSuccessBtn: document.getElementById('completionSuccessBtn'),
            completionFailureBtn: document.getElementById('completionFailureBtn'),
            completionCancelBtn: document.getElementById('completionCancelBtn'),
            completionCloseBtn: document.getElementById('completionCloseBtn')
        };
        this.pendingCompletionGoalId = null;
        this.completionModalInitialized = false;
        this.priorityCache = new Map();
        this.priorityCacheDirty = true;
        this.setupEventListeners();
    }

    renderViews() {
        this.invalidatePriorityCache();
        this.refreshPriorityCache();
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
            <div class="goal-description" contenteditable="true" role="textbox" aria-label="Beschreibung bearbeiten" data-goal-id="${goal.id}" data-placeholder="Beschreibung hinzufügen..."></div>
            <div class="goal-metrics">
                <div class="metric">
                    <span class="metric-label">Priorität</span>
                    <span class="metric-value priority">${priority.toFixed(1)}</span>
                </div>
            </div>
            <div class="goal-deadline ${this.isDeadlineUrgent(goal.deadline) ? 'urgent' : ''}">
                📅 ${deadlineText}
            </div>
            <div class="goal-actions">
                <button class="btn btn-primary edit-goal" data-id="${goal.id}" aria-expanded="false">Bearbeiten</button>
            </div>
            <div class="goal-inline-editor" aria-hidden="true">
                <div class="inline-fields">
                    <label>
                        <span>Deadline</span>
                        <input type="date" class="inline-deadline" value="${goal.deadline ? goal.deadline.toISOString().split('T')[0] : ''}">
                    </label>
                    <label>
                        <span>Motivation</span>
                        <input type="number" class="inline-motivation" min="1" max="5" step="1" value="${goal.motivation}">
                    </label>
                    <label>
                        <span>Dringlichkeit</span>
                        <input type="number" class="inline-urgency" min="1" max="5" step="1" value="${goal.urgency}">
                    </label>
                </div>
                <div class="inline-actions">
                    <button type="button" class="btn btn-primary save-inline">Speichern</button>
                    <button type="button" class="btn btn-secondary cancel-inline">Abbrechen</button>
                </div>
            </div>
        `;

        const descriptionEl = card.querySelector('.goal-description');
        if (descriptionEl) {
            const currentDescription = goal.description || '';
            descriptionEl.textContent = currentDescription;

            const sanitizeDescription = (value) => {
                if (!value) {
                    return '';
                }
                return value.replace(/\u00a0/g, ' ').trim();
            };

            const resetDescription = () => {
                descriptionEl.textContent = goal.description || '';
                if (!descriptionEl.textContent) {
                    descriptionEl.innerHTML = '';
                }
            };

            descriptionEl.addEventListener('focus', () => {
                card.classList.add('is-editing-description');
                descriptionEl.classList.add('is-editing');
            });

            descriptionEl.addEventListener('blur', () => {
                descriptionEl.classList.remove('is-editing');
                card.classList.remove('is-editing-description');

                const sanitizedValue = sanitizeDescription(descriptionEl.textContent);
                const originalValue = sanitizeDescription(goal.description);

                if (sanitizedValue === originalValue) {
                    resetDescription();
                    return;
                }

                try {
                    const { maxActiveGoals } = this.app.settingsService.getSettings();
                    this.app.goalService.updateGoal(goal.id, { description: sanitizedValue }, maxActiveGoals);
                    goal.description = sanitizedValue;
                } catch (error) {
                    alert(error.message || 'Aktualisierung des Ziels fehlgeschlagen.');
                    resetDescription();
                }
            });

            descriptionEl.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    resetDescription();
                    descriptionEl.blur();
                }
            });
        }

        const actionsContainer = card.querySelector('.goal-actions');
        if (actionsContainer && goal.status !== 'completed' && goal.status !== 'abandoned') {
            const completeButton = document.createElement('button');
            completeButton.type = 'button';
            completeButton.className = 'btn btn-secondary complete-goal';
            completeButton.textContent = 'Abschließen';
            completeButton.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.openCompletionModal(goal.id);
            });
            actionsContainer.appendChild(completeButton);
        }

        const editBtn = card.querySelector('.edit-goal');
        const inlineEditor = card.querySelector('.goal-inline-editor');

        if (editBtn && inlineEditor) {
            const deadlineInput = inlineEditor.querySelector('.inline-deadline');
            const motivationInput = inlineEditor.querySelector('.inline-motivation');
            const urgencyInput = inlineEditor.querySelector('.inline-urgency');
            const saveButton = inlineEditor.querySelector('.save-inline');
            const cancelButton = inlineEditor.querySelector('.cancel-inline');

            const toggleInlineEditor = (open) => {
                inlineEditor.setAttribute('aria-hidden', open ? 'false' : 'true');
                editBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
                if (open) {
                    card.classList.add('is-inline-editing');
                    inlineEditor.classList.add('is-visible');
                    deadlineInput.value = goal.deadline ? goal.deadline.toISOString().split('T')[0] : '';
                    motivationInput.value = goal.motivation;
                    urgencyInput.value = goal.urgency;
                    deadlineInput.focus();
                } else {
                    card.classList.remove('is-inline-editing');
                    inlineEditor.classList.remove('is-visible');
                }
            };

            editBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const isVisible = inlineEditor.classList.contains('is-visible');
                toggleInlineEditor(!isVisible);
            });

            saveButton.addEventListener('click', (event) => {
                event.preventDefault();
                const parseOrFallback = (value, fallback) => {
                    const parsed = Number.parseInt(value, 10);
                    return Number.isNaN(parsed) ? fallback : parsed;
                };
                const updates = {
                    deadline: deadlineInput.value || null,
                    motivation: parseOrFallback(motivationInput.value, goal.motivation),
                    urgency: parseOrFallback(urgencyInput.value, goal.urgency)
                };
                this.updateGoalInline(goal.id, updates);
            });

            cancelButton.addEventListener('click', (event) => {
                event.preventDefault();
                toggleInlineEditor(false);
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
            completed: 'Erreicht',
            abandoned: 'Nicht erreicht'
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

        let goal = null;
        if (goalId) {
            goal = this.app.goalService.goals.find(g => g.id === goalId) || null;
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

        if (goal) {
            this.renderGoalHistory(goal);
        } else {
            this.resetGoalHistoryView();
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
        this.setupCompletionModal();
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
                id: 'allGoalsToggleAbandoned',
                event: 'change',
                key: 'includeAbandoned',
                getValue: (element) => element.checked
            }
        ];

        controls.forEach(({ id, event, key, getValue }) => {
            const element = this.getControlElement(id);
            if (!element) {
                return;
            }
            element.addEventListener(event, () => {
                this.allGoalsState[key] = getValue(element);
                this.renderAllGoalsTable();
            });
        });
    }

    setupCompletionModal() {
        if (this.completionModalInitialized) {
            return;
        }

        const modal = this.getCompletionElement('completionModal');
        if (!modal) {
            return;
        }

        const successBtn = this.getCompletionElement('completionSuccessBtn');
        if (successBtn) {
            successBtn.addEventListener('click', () => this.handleCompletionChoice('completed'));
        }

        const failureBtn = this.getCompletionElement('completionFailureBtn');
        if (failureBtn) {
            failureBtn.addEventListener('click', () => this.handleCompletionChoice('abandoned'));
        }

        const cancelBtn = this.getCompletionElement('completionCancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeCompletionModal());
        }

        const closeBtn = this.getCompletionElement('completionCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeCompletionModal());
        }

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                this.closeCompletionModal();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modal.classList.contains('is-visible')) {
                this.closeCompletionModal();
            }
        });

        this.completionModalInitialized = true;
    }

    renderAllGoalsTable() {
        const tableBody = this.getControlElement('allGoalsTableBody');
        const emptyState = this.getControlElement('allGoalsEmptyState');
        const statusFilter = this.getControlElement('allGoalsStatusFilter');
        const priorityFilter = this.getControlElement('allGoalsPriorityFilter');
        const sortSelect = this.getControlElement('allGoalsSort');
        const toggleCompleted = this.getControlElement('allGoalsToggleCompleted');
        const toggleAbandoned = this.getControlElement('allGoalsToggleAbandoned');

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
        if (toggleAbandoned) {
            toggleAbandoned.checked = this.allGoalsState.includeAbandoned;
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

    getCompletionElement(id) {
        if (!this.completionModalRefs) {
            this.completionModalRefs = {};
        }
        const cached = this.completionModalRefs[id];
        if (cached && cached.isConnected) {
            return cached;
        }
        const element = document.getElementById(id);
        this.completionModalRefs[id] = element || null;
        return element || null;
    }

    invalidatePriorityCache() {
        this.priorityCacheDirty = true;
    }

    refreshPriorityCache() {
        if (!this.priorityCacheDirty) {
            return;
        }
        this.priorityCache.clear();
        this.app.goalService.goals.forEach(goal => {
            this.priorityCache.set(goal.id, this.app.goalService.calculatePriority(goal));
        });
        this.priorityCacheDirty = false;
    }

    formatHistoryValue(field, rawValue) {
        if (rawValue === null || rawValue === undefined) {
            return '—';
        }

        if (field === 'deadline') {
            if (!rawValue) {
                return 'Keine Deadline';
            }
            try {
                const date = new Date(rawValue);
                if (Number.isNaN(date.getTime())) {
                    return '—';
                }
                return date.toLocaleDateString('de-DE');
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

    renderGoalHistory(goal) {
        const section = document.getElementById('goalHistorySection');
        const list = document.getElementById('goalHistoryList');
        if (!section || !list) {
            return;
        }

        section.hidden = false;

        if (!goal || !Array.isArray(goal.history) || goal.history.length === 0) {
            list.innerHTML = '<p class="goal-history-empty">Noch keine Änderungen protokolliert.</p>';
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
            eventLabel.textContent = HISTORY_EVENT_LABELS[entry.event] || 'Änderung';

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
                    fieldLabel.textContent = HISTORY_FIELD_LABELS[change.field] || change.field;

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
                revertButton.textContent = 'Auf diese Version zurücksetzen';
                revertButton.addEventListener('click', () => {
                    this.handleHistoryRevert(goal.id, entry.id);
                });
                entryElement.appendChild(revertButton);
            }

            list.appendChild(entryElement);
        });
    }

    handleHistoryRevert(goalId, historyEntryId) {
        if (!goalId || !historyEntryId) {
            return;
        }

        if (!window.confirm('Möchtest du dieses Ziel wirklich auf diese Version zurücksetzen?')) {
            return;
        }

        const { maxActiveGoals } = this.app.settingsService.getSettings();
        const revertedGoal = this.app.goalService.revertGoalToHistoryEntry(goalId, historyEntryId, maxActiveGoals);
        if (!revertedGoal) {
            alert('Zurücksetzen nicht möglich.');
            return;
        }

        this.renderViews();
        this.openGoalForm(goalId);
    }

    openCompletionModal(goalId) {
        if (!goalId) {
            return;
        }
        const modal = this.getCompletionElement('completionModal');
        if (!modal) {
            return;
        }
        this.pendingCompletionGoalId = goalId;
        modal.classList.add('is-visible');
    }

    closeCompletionModal() {
        const modal = this.getCompletionElement('completionModal');
        if (modal) {
            modal.classList.remove('is-visible');
        }
        this.pendingCompletionGoalId = null;
    }

    handleCompletionChoice(status) {
        if (!this.pendingCompletionGoalId) {
            return;
        }
        this.changeGoalStatus(this.pendingCompletionGoalId, status);
        this.closeCompletionModal();
    }

    changeGoalStatus(goalId, newStatus) {
        if (!goalId || !newStatus) {
            return;
        }

        try {
            const { maxActiveGoals } = this.app.settingsService.getSettings();
            const updatedGoal = this.app.goalService.setGoalStatus(goalId, newStatus, maxActiveGoals);
            if (!updatedGoal) {
                alert('Ziel nicht gefunden.');
                return;
            }

            this.app.checkIns = this.app.checkInService.getCheckIns();
            this.renderViews();
        } catch (error) {
            alert(error.message || 'Statusänderung fehlgeschlagen.');
        }
    }

    updateGoalInline(goalId, updates) {
        try {
            const { maxActiveGoals } = this.app.settingsService.getSettings();
            this.app.goalService.updateGoal(goalId, updates, maxActiveGoals);
            this.invalidatePriorityCache();
            this.renderViews();
        } catch (error) {
            alert(error.message || 'Aktualisierung des Ziels fehlgeschlagen.');
            this.renderViews();
        }
    }
}

export default UIController;
