// src/ui/ui-controller.js

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

const DAY_IN_MS = 24 * 60 * 60 * 1000;

class UIController {
    constructor(app) {
        this.app = app;
        this.languageService = app.languageService;
        this.translate = (key, replacements) => this.languageService.translate(key, replacements);
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
        this.latestCheckInFeedback = null;
        this.languageChangeUnsubscribe = this.languageService.onChange(() => {
            this.applyLanguageUpdates();
        });

        this.initializeLanguageControls();
        this.setupEventListeners();
    }

    initializeLanguageControls() {
        this.updateLanguageOptions();
        this.syncSettingsForm();
        this.languageService.applyTranslations(document);
    }

    applyLanguageUpdates() {
        this.updateLanguageOptions();
        this.syncSettingsForm();
        this.languageService.applyTranslations(document);
        this.renderViews();
    }

    updateLanguageOptions() {
        const languageSelect = document.getElementById('languageSelect');
        if (!languageSelect) {
            return;
        }

        const currentValue = languageSelect.value;
        languageSelect.innerHTML = '';

        this.languageService.getSupportedLanguages().forEach((languageCode) => {
            const option = document.createElement('option');
            option.value = languageCode;
            option.textContent = this.translate(`language.names.${languageCode}`);
            option.setAttribute('data-i18n-key', `language.names.${languageCode}`);
            languageSelect.appendChild(option);
        });

        const effectiveLanguage = this.app.settingsService.getSettings().language || this.languageService.getLanguage();
        languageSelect.value = effectiveLanguage;
    }

    syncSettingsForm() {
        const settings = this.app.settingsService.getSettings();
        const maxActiveGoals = document.getElementById('maxActiveGoals');
        const languageSelect = document.getElementById('languageSelect');
        const reviewIntervals = document.getElementById('reviewIntervals');

        if (maxActiveGoals) {
            maxActiveGoals.value = settings.maxActiveGoals;
        }
        if (languageSelect) {
            languageSelect.value = settings.language;
        }
        if (reviewIntervals) {
            const intervals = Array.isArray(settings.reviewIntervals) ? settings.reviewIntervals : [];
            reviewIntervals.value = intervals
                .map((interval) => this.formatReviewIntervalInput(interval))
                .filter(Boolean)
                .join(', ');
        }
    }

    renderViews() {
        this.invalidatePriorityCache();
        this.refreshPriorityCache();
        this.syncSettingsForm();
        const settings = this.app.settingsService.getSettings();
        const activeGoals = this.app.goalService.getActiveGoals();
        const dashboardGoals = activeGoals.slice(0, settings.maxActiveGoals);

        const dashboardList = document.getElementById('goalsList');
        dashboardList.innerHTML = '';

        if (dashboardGoals.length === 0) {
            const emptyState = document.createElement('p');
            emptyState.style.textAlign = 'center';
            emptyState.style.color = '#888';
            emptyState.style.padding = '40px';
            emptyState.textContent = this.translate('dashboard.noActiveGoals');
            emptyState.setAttribute('data-i18n-key', 'dashboard.noActiveGoals');
            dashboardList.appendChild(emptyState);
        } else {
            dashboardGoals.forEach(goal => {
                dashboardList.appendChild(this.createGoalCard(goal));
            });
        }

        this.renderAllGoalsTable();
        this.renderCheckInView();
    }

    createGoalCard(goal) {
        const card = document.createElement('div');
        card.className = `goal-card ${goal.status}`;

        const priority = this.app.goalService.calculatePriority(goal);
        const deadlineText = goal.deadline
            ? this.formatDeadline(goal.deadline)
            : this.translate('goalCard.noDeadline');

        card.innerHTML = `
            <div class="goal-header">
                <div>
                    <div class="goal-title">${this.escapeHtml(goal.title)}</div>
                    <span class="goal-status-badge status-${goal.status}">${this.getStatusText(goal.status)}</span>
                </div>
            </div>
            <div class="goal-description" contenteditable="true" role="textbox" aria-label="${this.translate('goalCard.descriptionAria')}" data-goal-id="${goal.id}" data-placeholder="${this.translate('goalCard.descriptionPlaceholder')}"></div>
            <div class="goal-metrics">
                <div class="metric">
                    <span class="metric-label">${this.translate('goalCard.priorityLabel')}</span>
                    <span class="metric-value priority">${priority.toFixed(1)}</span>
                </div>
            </div>
            <div class="goal-deadline ${this.isDeadlineUrgent(goal.deadline) ? 'urgent' : ''}">
                ${this.translate('goalCard.deadlinePrefix', { deadline: deadlineText })}
            </div>
            <div class="goal-actions">
                <button class="btn btn-primary edit-goal" data-id="${goal.id}" aria-expanded="false">${this.translate('goalCard.actions.edit')}</button>
            </div>
            <div class="goal-inline-editor" aria-hidden="true">
                <div class="inline-fields">
                    <label>
                        <span>${this.translate('goalCard.inline.deadline')}</span>
                        <input type="date" class="inline-deadline" value="${goal.deadline ? goal.deadline.toISOString().split('T')[0] : ''}">
                    </label>
                    <label>
                        <span>${this.translate('goalCard.inline.motivation')}</span>
                        <input type="number" class="inline-motivation" min="1" max="5" step="1" value="${goal.motivation}">
                    </label>
                    <label>
                        <span>${this.translate('goalCard.inline.urgency')}</span>
                        <input type="number" class="inline-urgency" min="1" max="5" step="1" value="${goal.urgency}">
                    </label>
                </div>
                <div class="inline-actions">
                    <button type="button" class="btn btn-primary save-inline">${this.translate('common.save')}</button>
                    <button type="button" class="btn btn-secondary cancel-inline">${this.translate('common.cancel')}</button>
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
                    alert(error.message || this.translate('errors.goalUpdateFailed'));
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
            completeButton.textContent = this.translate('goalCard.actions.complete');
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
            return this.translate('deadline.overdue', { count: Math.abs(days) });
        } else if (days === 0) {
            return this.translate('deadline.today');
        } else if (days === 1) {
            return this.translate('deadline.tomorrow');
        } else if (days <= 7) {
            return this.translate('deadline.inDays', { count: days });
        } else {
            const locale = this.languageService.getLocale();
            return deadline.toLocaleDateString(locale);
        }
    }

    isDeadlineUrgent(deadline) {
        if (!deadline) return false;
        const now = new Date();
        const days = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
        return days <= 7 && days >= 0;
    }

    getStatusText(status) {
        const key = `status.${status}`;
        const translated = this.translate(key);
        return translated === key ? status : translated;
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
            this.renderGoalHistory(goal);
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


    renderCheckInView() {
        const panel = document.getElementById('checkInsPanel');
        const list = document.getElementById('checkInsList');
        const emptyState = document.getElementById('checkInsEmptyState');
        const feedbackElement = document.getElementById('checkInsFeedback');

        if (!panel || !list) {
            return;
        }

        const checkIns = Array.isArray(this.app.checkIns) ? this.app.checkIns : [];

        panel.style.display = '';
        list.innerHTML = '';

        if (feedbackElement) {
            if (this.latestCheckInFeedback) {
                const { messageKey, messageArgs, type } = this.latestCheckInFeedback;
                feedbackElement.hidden = false;
                feedbackElement.textContent = this.translate(messageKey, messageArgs);
                feedbackElement.dataset.state = type || 'info';
            } else {
                feedbackElement.hidden = true;
                feedbackElement.textContent = '';
                feedbackElement.dataset.state = '';
            }
        }

        if (!checkIns.length) {
            if (emptyState) {
                emptyState.hidden = false;
                emptyState.textContent = this.translate('checkIns.emptyState');
            }
            return;
        }

        if (emptyState) {
            emptyState.hidden = true;
        }

        const total = checkIns.length;
        checkIns.forEach((checkIn, index) => {
            const card = this.createCheckInCard(checkIn, index + 1, total);
            list.appendChild(card);
        });

        this.languageService.applyTranslations(panel);
    }

    createCheckInCard(checkIn, position, total) {
        const { goal, dueAt } = checkIn;
        const card = document.createElement('form');
        card.className = 'check-in-card';
        card.dataset.goalId = goal.id;

        const header = document.createElement('div');
        header.className = 'check-in-card__header';

        const title = document.createElement('h3');
        title.className = 'check-in-card__title';
        title.textContent = goal.title;
        header.appendChild(title);

        const sequence = document.createElement('span');
        sequence.className = 'check-in-card__sequence';
        sequence.textContent = this.translate('checkIns.sequence', { current: position, total });
        header.appendChild(sequence);

        const dueInfo = document.createElement('p');
        dueInfo.className = 'check-in-card__due';
        dueInfo.textContent = this.formatCheckInDueLabel(dueAt);
        header.appendChild(dueInfo);

        const fields = document.createElement('div');
        fields.className = 'check-in-card__fields';

        const motivationField = this.createCheckInInput('checkIns.fields.motivation', 'motivation', goal.motivation);
        const urgencyField = this.createCheckInInput('checkIns.fields.urgency', 'urgency', goal.urgency);

        fields.appendChild(motivationField.container);
        fields.appendChild(urgencyField.container);

        const statusPill = document.createElement('span');
        statusPill.className = 'check-in-card__status';
        statusPill.setAttribute('data-i18n-key', 'checkIns.status.stable');
        statusPill.hidden = true;
        fields.appendChild(statusPill);

        const actions = document.createElement('div');
        actions.className = 'check-in-card__actions';

        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'btn btn-primary';
        submitBtn.setAttribute('data-i18n-key', 'checkIns.actions.done');
        actions.appendChild(submitBtn);

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-secondary';
        editBtn.setAttribute('data-i18n-key', 'checkIns.actions.edit');
        editBtn.addEventListener('click', (event) => {
            event.preventDefault();
            this.openGoalForm(goal.id);
        });
        actions.appendChild(editBtn);

        card.appendChild(header);
        card.appendChild(fields);
        card.appendChild(actions);

        const updateStability = () => {
            const currentMotivation = Number.parseInt(motivationField.input.value, 10);
            const currentUrgency = Number.parseInt(urgencyField.input.value, 10);
            const isStable = currentMotivation === goal.motivation && currentUrgency === goal.urgency;
            card.classList.toggle('is-stable', isStable);
            statusPill.hidden = !isStable;
        };

        updateStability();

        motivationField.input.addEventListener('input', updateStability);
        urgencyField.input.addEventListener('input', updateStability);

        card.addEventListener('submit', (event) => {
            event.preventDefault();
            this.handleCheckInSubmit(goal.id, {
                motivation: motivationField.input.value,
                urgency: urgencyField.input.value
            });
        });

        return card;
    }

    createCheckInInput(labelKey, name, value) {
        const container = document.createElement('label');
        container.className = 'check-in-card__field';

        const label = document.createElement('span');
        label.className = 'check-in-card__field-label';
        label.setAttribute('data-i18n-key', labelKey);
        container.appendChild(label);

        const input = document.createElement('input');
        input.type = 'number';
        input.name = name;
        input.min = '1';
        input.max = '5';
        input.step = '1';
        input.value = value;
        input.className = 'check-in-card__field-input';
        input.setAttribute('data-i18n-key', labelKey);
        input.setAttribute('data-i18n-attr', 'aria-label');
        container.appendChild(input);

        return { container, input };
    }

    formatCheckInDueLabel(dueAt) {
        if (!dueAt) {
            return this.translate('checkIns.due.unknown');
        }
        const dueDate = dueAt instanceof Date ? dueAt : new Date(dueAt);
        if (Number.isNaN(dueDate.getTime())) {
            return this.translate('checkIns.due.unknown');
        }

        const now = new Date();
        const diffMs = now.getTime() - dueDate.getTime();
        const diffDays = Math.floor(diffMs / DAY_IN_MS);

        if (diffDays <= 0) {
            return this.translate('checkIns.due.today');
        }
        return this.translate('checkIns.due.overdue', { count: diffDays });
    }

    formatReviewIntervalInput(intervalDays) {
        if (!Number.isFinite(intervalDays) || intervalDays <= 0) {
            return '';
        }

        const totalSeconds = Math.max(1, Math.round(intervalDays * 24 * 60 * 60));

        if (totalSeconds % (24 * 60 * 60) === 0) {
            return `${totalSeconds / (24 * 60 * 60)}d`;
        }
        if (totalSeconds % (60 * 60) === 0) {
            return `${totalSeconds / (60 * 60)}h`;
        }
        if (totalSeconds % 60 === 0) {
            return `${totalSeconds / 60}m`;
        }
        return `${totalSeconds}s`;
    }

    formatReviewIntervalDisplay(intervalDays) {
        if (!Number.isFinite(intervalDays) || intervalDays <= 0) {
            return this.translate('checkIns.interval.unknown');
        }

        const totalSeconds = intervalDays * 24 * 60 * 60;
        const formatter = new Intl.NumberFormat(this.languageService.getLocale(), { maximumFractionDigits: 2 });

        if (totalSeconds >= 24 * 60 * 60) {
            return this.translate('checkIns.interval.days', { count: formatter.format(totalSeconds / (24 * 60 * 60)) });
        }
        if (totalSeconds >= 60 * 60) {
            return this.translate('checkIns.interval.hours', { count: formatter.format(totalSeconds / (60 * 60)) });
        }
        if (totalSeconds >= 60) {
            return this.translate('checkIns.interval.minutes', { count: formatter.format(totalSeconds / 60) });
        }
        return this.translate('checkIns.interval.seconds', { count: formatter.format(totalSeconds) });
    }

    handleCheckInSubmit(goalId, ratings) {
        try {
            const result = this.app.reviewService.recordReview(goalId, ratings);
            if (!result) {
                alert(this.translate('errors.goalNotFound'));
                return;
            }

        const intervals = this.app.settingsService.getReviewIntervals?.() || this.app.settingsService.getSettings().reviewIntervals;
        const intervalDays = Array.isArray(intervals) && intervals.length > 0
            ? intervals[result.goal.reviewIntervalIndex] ?? intervals[0]
            : null;
        const formattedInterval = this.formatReviewIntervalDisplay(intervalDays);

        this.latestCheckInFeedback = {
            messageKey: result.ratingsMatch ? 'checkIns.feedback.stable' : 'checkIns.feedback.updated',
            messageArgs: {
                title: result.goal.title,
                interval: formattedInterval
            },
            type: result.ratingsMatch ? 'success' : 'info'
        };

            if (!result.ratingsMatch) {
                this.invalidatePriorityCache();
            }

            this.app.refreshCheckIns({ render: false });
            this.renderViews();
        } catch (error) {
            alert(error?.message || this.translate('errors.goalUpdateFailed'));
        }
    }

    setupEventListeners() {
        const addGoalBtn = document.getElementById('addGoalBtn');
        if (addGoalBtn) {
            addGoalBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent event bubbling
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
                if (confirm(this.translate('goalForm.confirmDelete'))) {
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
                const languageSelect = document.getElementById('languageSelect');
                const currentSettings = this.app.settingsService.getSettings();
                const previousLanguage = currentSettings.language;
                const reviewIntervalsInput = document.getElementById('reviewIntervals');
                const newSettings = {
                    maxActiveGoals: parseInt(document.getElementById('maxActiveGoals').value),
                    language: languageSelect ? languageSelect.value : previousLanguage,
                    reviewIntervals: reviewIntervalsInput ? reviewIntervalsInput.value : currentSettings.reviewIntervals
                };
                const oldMaxActiveGoals = currentSettings.maxActiveGoals;
                this.app.settingsService.updateSettings(newSettings);
                
                // Automatically re-activate goals if maxActiveGoals changed
                if (newSettings.maxActiveGoals !== oldMaxActiveGoals) {
                    this.app.goalService.autoActivateGoalsByPriority(newSettings.maxActiveGoals);
                }
                
                if (newSettings.language && newSettings.language !== previousLanguage) {
                    this.app.languageService.setLanguage(newSettings.language);
                }

                this.latestCheckInFeedback = null;
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
            alert(error.message || this.translate('errors.goalSaveFailed'));
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
        const locale = this.languageService.getLocale();
        return (
            dateObj.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }) +
            ' ' +
            dateObj.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
        );
    }

    formatDate(date) {
        if (!date) {
            return '';
        }
        const dateObj = date instanceof Date ? date : new Date(date);
        const locale = this.languageService.getLocale();
        return dateObj.toLocaleDateString(locale);
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

    renderGoalHistory(goal) {
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

        if (!window.confirm(this.translate('history.confirmRevert'))) {
            return;
        }

        const { maxActiveGoals } = this.app.settingsService.getSettings();
        const revertedGoal = this.app.goalService.revertGoalToHistoryEntry(goalId, historyEntryId, maxActiveGoals);
        if (!revertedGoal) {
            alert(this.translate('errors.revertNotPossible'));
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
                alert(this.translate('errors.goalNotFound'));
                return;
            }

            this.app.checkIns = this.app.reviewService.getCheckIns();
            this.renderViews();
        } catch (error) {
            alert(error.message || this.translate('errors.statusChangeFailed'));
        }
    }

    updateGoalInline(goalId, updates) {
        try {
            const { maxActiveGoals } = this.app.settingsService.getSettings();
            this.app.goalService.updateGoal(goalId, updates, maxActiveGoals);
            this.invalidatePriorityCache();
            this.renderViews();
        } catch (error) {
            alert(error.message || this.translate('errors.goalUpdateFailed'));
            this.renderViews();
        }
    }
}

export default UIController;
