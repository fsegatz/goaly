// src/ui/desktop/modals-view.js

import { getElement, getOptionalElement } from '../utils/dom-utils.js';

import { BaseUIController } from './base-ui-controller.js';
import { computeLineDiff } from '../../domain/utils/diff-utils.js';

export class ModalsView extends BaseUIController {
    constructor(app) {
        super(app);
        this.completionModalRefs = {
            completionModal: getElement('completionModal'),
            completionSuccessBtn: getElement('completionSuccessBtn'),
            completionFailureBtn: getElement('completionFailureBtn'),
            completionCloseBtn: getElement('completionCloseBtn'),
            completionRecurringCheckbox: null,
            completionRecurDateContainer: null,
            completionRecurDate: null
        };
        this.pendingCompletionGoalId = null;
        this.completionModalInitialized = false;
        this.migrationModalRefs = {};
        this.migrationDiffData = null;
        this.isSyncingMigrationScroll = false;
        this.migrationScrollBound = false;
        this.pauseModalRefs = {};
        this.pendingPauseGoalId = null;
        this.pauseModalInitialized = false;
    }

    setupCompletionModal(handleCompletionChoice) {
        if (this.completionModalInitialized) {
            return;
        }

        const modal = this.getCompletionElement('completionModal');
        if (!modal) {
            return;
        }

        // Get recurring elements
        const recurringCheckbox = this.getCompletionElement('completionRecurringCheckbox');
        const recurDateContainer = this.getCompletionElement('completionRecurDateContainer');
        const recurDate = this.getCompletionElement('completionRecurDate');

        // Toggle recurrence date visibility
        if (recurringCheckbox && recurDateContainer) {
            recurringCheckbox.addEventListener('change', () => {
                if (recurringCheckbox.checked) {
                    recurDateContainer.style.display = 'block';
                } else {
                    recurDateContainer.style.display = 'none';
                    if (recurDate) {
                        recurDate.value = '';
                    }
                }
            });
        }

        const successBtn = this.getCompletionElement('completionSuccessBtn');
        if (successBtn) {
            successBtn.addEventListener('click', () => {
                const recurrenceData = this.getRecurrenceData();
                // If validation failed (returns false), don't proceed
                if (recurrenceData === false) {
                    return;
                }
                handleCompletionChoice('completed', recurrenceData);
            });
        }

        const failureBtn = this.getCompletionElement('completionFailureBtn');
        if (failureBtn) {
            failureBtn.addEventListener('click', () => {
                const recurrenceData = this.getRecurrenceData();
                // If validation failed (returns false), don't proceed
                if (recurrenceData === false) {
                    return;
                }
                handleCompletionChoice('notCompleted', recurrenceData);
            });
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

    openCompletionModal(goalId) {
        if (!goalId) return;

        const modal = this.getCompletionElement('completionModal');
        if (!modal) return;

        const goal = this.app.goalService.goals.find(g => g.id === goalId);

        if (goal?.isRecurring) {
            this._setupRecurringFields(goal);
        } else {
            this._resetRecurringFields();
        }

        this.pendingCompletionGoalId = goalId;
        modal.classList.add('is-visible');
        this.languageService.applyTranslations(modal);
    }

    /** @private */
    _setupRecurringFields(goal) {
        // Pre-check checkbox for recurring goals
        const recurringCheckbox = this.getCompletionElement('completionRecurringCheckbox');
        if (recurringCheckbox) recurringCheckbox.checked = true;

        // Calculate and display next recurrence date
        const nextDate = this._calculateNextRecurrenceDate(goal);

        // Set the date input value
        const recurDateInput = this.getCompletionElement('completionRecurDate');
        if (recurDateInput) {
            recurDateInput.value = nextDate.toISOString().split('T')[0];

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            recurDateInput.min = today.toISOString().split('T')[0];
        }

        // Show the date container
        const recurDateContainer = this.getCompletionElement('completionRecurDateContainer');
        if (recurDateContainer) recurDateContainer.style.display = 'block';
    }

    /** @private */
    _calculateNextRecurrenceDate(goal) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let nextDate = new Date(today);

        const period = goal.recurPeriod || 7;
        const unit = goal.recurPeriodUnit || 'days';

        if (unit === 'days') {
            nextDate.setDate(nextDate.getDate() + period);
        } else if (unit === 'weeks') {
            nextDate.setDate(nextDate.getDate() + (period * 7));
        } else if (unit === 'months') {
            nextDate.setMonth(nextDate.getMonth() + period);
        }
        return nextDate;
    }

    /** @private */
    _resetRecurringFields() {
        const recurringCheckbox = this.getCompletionElement('completionRecurringCheckbox');
        if (recurringCheckbox) recurringCheckbox.checked = false;

        const recurDateContainer = this.getCompletionElement('completionRecurDateContainer');
        if (recurDateContainer) recurDateContainer.style.display = 'none';

        const recurDateInput = this.getCompletionElement('completionRecurDate');
        if (recurDateInput) recurDateInput.value = '';
    }

    closeCompletionModal() {
        const modal = this.getCompletionElement('completionModal');
        if (modal) {
            modal.classList.remove('is-visible');
        }
        this.pendingCompletionGoalId = null;
    }

    getPendingCompletionGoalId() {
        return this.pendingCompletionGoalId;
    }

    getRecurrenceData() {
        const recurringCheckbox = this.getCompletionElement('completionRecurringCheckbox');
        const recurDate = this.getCompletionElement('completionRecurDate');

        if (!recurringCheckbox?.checked) {
            return null;
        }

        if (!recurDate?.value) {
            // Show error if recurring is checked but no date provided
            alert(this.translate('completionModal.recurDateRequired') || 'Please select a recurrence date');
            return false; // Return false to indicate validation error
        }

        // Parse date in local timezone to avoid off-by-one-day errors
        const recurrenceDate = new Date(recurDate.value + 'T00:00:00');

        return {
            isRecurring: true,
            recurrenceDate
        };
    }

    setupMigrationModals(cancelMigration, handleMigrationReviewRequest, completeMigration) {
        const promptModal = this.getMigrationElement('migrationPromptModal');
        const diffModal = this.getMigrationElement('migrationDiffModal');

        if (promptModal) {
            const reviewBtn = this.getMigrationElement('migrationReviewBtn');
            if (reviewBtn) {
                reviewBtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    this.closeMigrationPrompt();
                    handleMigrationReviewRequest();
                });
            }

            const promptCancel = this.getMigrationElement('migrationPromptCancelBtn');
            if (promptCancel) {
                promptCancel.addEventListener('click', (event) => {
                    event.preventDefault();
                    this.closeMigrationModals();
                    cancelMigration();
                });
            }

            const promptClose = this.getMigrationElement('migrationPromptClose');
            if (promptClose) {
                promptClose.addEventListener('click', () => {
                    this.closeMigrationModals();
                    cancelMigration();
                });
            }
        }

        if (diffModal) {
            const diffClose = this.getMigrationElement('migrationDiffClose');
            if (diffClose) {
                diffClose.addEventListener('click', () => {
                    this.closeMigrationModals();
                    cancelMigration();
                });
            }

            const diffCancel = this.getMigrationElement('migrationCancelBtn');
            if (diffCancel) {
                diffCancel.addEventListener('click', (event) => {
                    event.preventDefault();
                    this.closeMigrationModals();
                    cancelMigration();
                });
            }

            const diffApply = this.getMigrationElement('migrationApplyBtn');
            if (diffApply) {
                diffApply.addEventListener('click', (event) => {
                    event.preventDefault();
                    completeMigration();
                });
            }

            if (!this.migrationScrollBound) {
                const oldView = this.getMigrationElement('migrationDiffOld');
                const newView = this.getMigrationElement('migrationDiffNew');
                if (oldView && newView) {
                    const syncScroll = (source, target) => {
                        if (this.isSyncingMigrationScroll) {
                            return;
                        }
                        this.isSyncingMigrationScroll = true;
                        target.scrollTop = source.scrollTop;
                        target.scrollLeft = source.scrollLeft;
                        requestAnimationFrame(() => {
                            this.isSyncingMigrationScroll = false;
                        });
                    };
                    oldView.addEventListener('scroll', () => syncScroll(oldView, newView));
                    newView.addEventListener('scroll', () => syncScroll(newView, oldView));
                    this.migrationScrollBound = true;
                }
            }
        }
    }

    openMigrationPrompt({ fromVersion, toVersion, fileName }) {
        const modal = this.getMigrationElement('migrationPromptModal');
        if (!modal) {
            return;
        }

        const title = this.getMigrationElement('migrationPromptTitle');
        if (title) {
            title.textContent = this.translate('migration.prompt.title');
        }

        const messageElement = this.getMigrationElement('migrationPromptMessage');
        if (messageElement) {
            const replacements = {
                fileName: fileName ?? this.translate('migration.prompt.unnamedFile'),
                fromVersion: fromVersion ?? this.translate('migration.prompt.legacyVersion'),
                toVersion
            };
            const messageKey = fromVersion ? 'migration.prompt.message' : 'migration.prompt.messageLegacy';
            messageElement.textContent = this.translate(messageKey, replacements);
        }

        modal.classList.add('is-visible');
        this.languageService.applyTranslations(modal);
    }

    openMigrationDiff({ fromVersion, toVersion, originalString, migratedString, fileName }) {
        const promptModal = this.getMigrationElement('migrationPromptModal');
        if (promptModal) {
            promptModal.classList.remove('is-visible');
        }

        const modal = this.getMigrationElement('migrationDiffModal');
        if (!modal) {
            return;
        }

        const title = this.getMigrationElement('migrationDiffTitle');
        if (title) {
            title.textContent = this.translate('migration.diff.title', {
                fileName: fileName ?? this.translate('migration.prompt.unnamedFile')
            });
        }

        const subtitle = this.getMigrationElement('migrationDiffSubtitle');
        if (subtitle) {
            subtitle.textContent = this.translate('migration.diff.subtitle', {
                fromVersion: fromVersion ?? this.translate('migration.prompt.legacyVersion'),
                toVersion
            });
        }

        const oldLabel = this.getMigrationElement('migrationDiffOldLabel');
        if (oldLabel) {
            oldLabel.textContent = this.translate('migration.diff.originalLabel');
        }

        const newLabel = this.getMigrationElement('migrationDiffNewLabel');
        if (newLabel) {
            newLabel.textContent = this.translate('migration.diff.updatedLabel');
        }

        this.renderMigrationDiff(originalString, migratedString);

        modal.classList.add('is-visible');
        this.languageService.applyTranslations(modal);
    }

    closeMigrationPrompt() {
        const modal = this.getMigrationElement('migrationPromptModal');
        if (modal) {
            modal.classList.remove('is-visible');
        }
    }

    closeMigrationDiff() {
        const modal = this.getMigrationElement('migrationDiffModal');
        if (modal) {
            modal.classList.remove('is-visible');
        }
        this.migrationDiffData = null;
        this.isSyncingMigrationScroll = false;
    }

    closeMigrationModals() {
        this.closeMigrationPrompt();
        this.closeMigrationDiff();
    }

    renderMigrationDiff(originalString, migratedString) {
        const diffLines = computeLineDiff(originalString, migratedString);
        this.migrationDiffData = diffLines;

        const oldContainer = this.getMigrationElement('migrationDiffOld');
        const newContainer = this.getMigrationElement('migrationDiffNew');

        if (oldContainer) {
            this.renderMigrationDiffColumn(oldContainer, diffLines, 'old');
            oldContainer.scrollTop = 0;
            oldContainer.scrollLeft = 0;
        }
        if (newContainer) {
            this.renderMigrationDiffColumn(newContainer, diffLines, 'new');
            newContainer.scrollTop = 0;
            newContainer.scrollLeft = 0;
        }
    }

    renderMigrationDiffColumn(container, diffLines, variant) {
        container.innerHTML = '';

        diffLines.forEach((entry) => {
            const lineContent = variant === 'new' ? entry.newLine : entry.oldLine;
            if (lineContent === null) {
                return;
            }

            let highlightType = 'unchanged';
            if (entry.type !== 'unchanged') {
                if (variant === 'new' && entry.type === 'added') {
                    highlightType = 'added';
                } else if (variant === 'old' && entry.type === 'removed') {
                    highlightType = 'removed';
                }
            }

            const wrapper = document.createElement('div');
            wrapper.classList.add('diff-line', `diff-line--${highlightType}`);

            const code = document.createElement('code');
            code.textContent = lineContent === '' ? '\u00a0' : lineContent;

            wrapper.appendChild(code);
            container.appendChild(wrapper);
        });
    }

    getCompletionElement(id) {
        if (!this.completionModalRefs) {
            this.completionModalRefs = {};
        }
        const cached = this.completionModalRefs[id];
        if (cached?.isConnected) {
            return cached;
        }
        const element = getOptionalElement(id);
        this.completionModalRefs[id] = element || null;
        return element || null;
    }

    getMigrationElement(id) {
        const cached = this.migrationModalRefs[id];
        if (cached?.isConnected) {
            return cached;
        }
        const element = getOptionalElement(id);
        this.migrationModalRefs[id] = element || null;
        return element || null;
    }

    setupPauseModal(handlePauseChoice) {
        if (this.pauseModalInitialized) {
            return;
        }

        const modal = this.getPauseElement('pauseModal');
        if (!modal) {
            return;
        }

        const confirmBtn = this.getPauseElement('pauseConfirmBtn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                const pauseType = this.getPauseElement('pauseUntilDate')?.checked ? 'date' : 'goal';
                let pauseUntil = null;
                let pauseUntilGoalId = null;

                if (pauseType === 'date') {
                    const dateInput = this.getPauseElement('pauseUntilDateInput');
                    if (dateInput?.value) {
                        // Parse date in local timezone to avoid off-by-one-day errors
                        pauseUntil = new Date(dateInput.value + 'T00:00:00');
                    }
                } else {
                    const goalSelect = this.getPauseElement('pauseUntilGoalSelect');
                    if (goalSelect?.value) {
                        pauseUntilGoalId = goalSelect.value;
                    }
                }

                if (pauseType === 'date' && !pauseUntil) {
                    // Date is required for date pause type
                    return;
                }
                if (pauseType === 'goal' && !pauseUntilGoalId) {
                    // Goal is required for goal pause type
                    return;
                }

                handlePauseChoice({
                    pauseUntil,
                    pauseUntilGoalId
                });
            });
        }

        const cancelBtn = this.getPauseElement('pauseCancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.closePauseModal();
            });
        }

        const closeBtn = this.getPauseElement('pauseCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.closePauseModal();
            });
        }

        // Toggle between date and goal options
        const dateRadio = this.getPauseElement('pauseUntilDate');
        const goalRadio = this.getPauseElement('pauseUntilGoal');
        const dateInput = this.getPauseElement('pauseUntilDateInput');
        const goalSelect = this.getPauseElement('pauseUntilGoalSelect');

        if (dateRadio && goalRadio && dateInput && goalSelect) {
            dateRadio.addEventListener('change', () => {
                dateInput.disabled = false;
                goalSelect.disabled = true;
            });
            goalRadio.addEventListener('change', () => {
                dateInput.disabled = true;
                goalSelect.disabled = false;
            });
        }

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                this.closePauseModal();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modal.classList.contains('is-visible')) {
                this.closePauseModal();
            }
        });

        this.pauseModalInitialized = true;
    }

    openPauseModal(goalId) {
        if (!goalId) return;

        const modal = this.getPauseElement('pauseModal');
        if (!modal) return;

        this.pendingPauseGoalId = goalId;

        this._setupPauseDateInput();
        this._populatePauseGoalSelect(goalId);
        this._resetPauseModalState();

        modal.classList.add('is-visible');
        this.languageService.applyTranslations(modal);
    }

    /** @private */
    _setupPauseDateInput() {
        const dateInput = this.getPauseElement('pauseUntilDateInput');
        if (dateInput) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            dateInput.min = today.toISOString().split('T')[0];
            dateInput.value = '';
        }
    }

    /** @private */
    _populatePauseGoalSelect(currentGoalId) {
        const goalSelect = this.getPauseElement('pauseUntilGoalSelect');
        if (!goalSelect) return;

        goalSelect.innerHTML = '<option value="" data-i18n-key="pauseModal.selectGoal">Select a goal...</option>';

        const goals = this.app.goalService.goals.filter(
            g => g.id !== currentGoalId && g.status !== 'completed' && g.status !== 'notCompleted'
        );

        if (goals.length === 0) {
            this._addNoGoalsOption(goalSelect);
        } else {
            goals.forEach(goal => {
                const option = document.createElement('option');
                option.value = goal.id;
                option.textContent = goal.title;
                goalSelect.appendChild(option);
            });
        }
        goalSelect.value = '';
    }

    /** @private */
    _addNoGoalsOption(selectElement) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = this.translate('pauseModal.noGoalsAvailable') || 'No other goals available';
        option.disabled = true;
        selectElement.appendChild(option);
    }

    /** @private */
    _resetPauseModalState() {
        // Reset to date option
        const dateRadio = this.getPauseElement('pauseUntilDate');
        const goalRadio = this.getPauseElement('pauseUntilGoal');
        const dateInput = this.getPauseElement('pauseUntilDateInput');
        const goalSelect = this.getPauseElement('pauseUntilGoalSelect');

        if (dateRadio) dateRadio.checked = true;
        if (goalRadio) goalRadio.checked = false;

        if (dateInput) dateInput.disabled = false;
        if (goalSelect) goalSelect.disabled = true;
    }

    closePauseModal() {
        const modal = this.getPauseElement('pauseModal');
        if (modal) {
            modal.classList.remove('is-visible');
        }
        this.pendingPauseGoalId = null;
    }

    getPendingPauseGoalId() {
        return this.pendingPauseGoalId;
    }

    getPauseElement(id) {
        if (!this.pauseModalRefs) {
            this.pauseModalRefs = {};
        }
        const cached = this.pauseModalRefs[id];
        if (cached?.isConnected) {
            return cached;
        }
        const element = getOptionalElement(id);
        if (element) {
            this.pauseModalRefs[id] = element;
        }
        return element || null;
    }
}

