// src/ui/desktop/modals-view.js

import { BaseUIController } from './base-ui-controller.js';
import { computeLineDiff } from '../../domain/utils/diff-utils.js';

export class ModalsView extends BaseUIController {
    constructor(app) {
        super(app);
        this.completionModalRefs = {
            completionModal: document.getElementById('completionModal'),
            completionSuccessBtn: document.getElementById('completionSuccessBtn'),
            completionFailureBtn: document.getElementById('completionFailureBtn'),
            completionCancelBtn: document.getElementById('completionCancelBtn'),
            completionCloseBtn: document.getElementById('completionCloseBtn')
        };
        this.pendingCompletionGoalId = null;
        this.completionModalInitialized = false;
        this.migrationModalRefs = {};
        this.migrationDiffData = null;
        this.isSyncingMigrationScroll = false;
        this.migrationScrollBound = false;
        this.pauseModalRefs = {
            pauseModal: document.getElementById('pauseModal'),
            pauseCloseBtn: document.getElementById('pauseCloseBtn'),
            pauseCancelBtn: document.getElementById('pauseCancelBtn'),
            pauseConfirmBtn: document.getElementById('pauseConfirmBtn'),
            pauseUntilDate: document.getElementById('pauseUntilDate'),
            pauseUntilGoal: document.getElementById('pauseUntilGoal'),
            pauseUntilDateInput: document.getElementById('pauseUntilDateInput'),
            pauseUntilGoalSelect: document.getElementById('pauseUntilGoalSelect')
        };
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

        const successBtn = this.getCompletionElement('completionSuccessBtn');
        if (successBtn) {
            successBtn.addEventListener('click', () => handleCompletionChoice('completed'));
        }

        const failureBtn = this.getCompletionElement('completionFailureBtn');
        if (failureBtn) {
            failureBtn.addEventListener('click', () => handleCompletionChoice('abandoned'));
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

    getPendingCompletionGoalId() {
        return this.pendingCompletionGoalId;
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
        if (cached && cached.isConnected) {
            return cached;
        }
        const element = document.getElementById(id);
        this.completionModalRefs[id] = element || null;
        return element || null;
    }

    getMigrationElement(id) {
        const cached = this.migrationModalRefs[id];
        if (cached && cached.isConnected) {
            return cached;
        }
        const element = document.getElementById(id);
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
                    if (dateInput && dateInput.value) {
                        pauseUntil = new Date(dateInput.value);
                    }
                } else {
                    const goalSelect = this.getPauseElement('pauseUntilGoalSelect');
                    if (goalSelect && goalSelect.value) {
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
            cancelBtn.addEventListener('click', () => this.closePauseModal());
        }

        const closeBtn = this.getPauseElement('pauseCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closePauseModal());
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
        if (!goalId) {
            return;
        }
        const modal = this.getPauseElement('pauseModal');
        if (!modal) {
            return;
        }

        this.pendingPauseGoalId = goalId;

        // Set minimum date to today
        const dateInput = this.getPauseElement('pauseUntilDateInput');
        if (dateInput) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            dateInput.min = today.toISOString().split('T')[0];
            dateInput.value = '';
        }

        // Populate goal select with other active/paused goals (excluding the current goal)
        const goalSelect = this.getPauseElement('pauseUntilGoalSelect');
        if (goalSelect) {
            goalSelect.innerHTML = '<option value="" data-i18n-key="pauseModal.selectGoal">Select a goal...</option>';
            const goals = this.app.goalService.goals.filter(
                g => g.id !== goalId && g.status !== 'completed' && g.status !== 'abandoned'
            );
            goals.forEach(goal => {
                const option = document.createElement('option');
                option.value = goal.id;
                option.textContent = goal.title;
                goalSelect.appendChild(option);
            });
            goalSelect.value = '';
        }

        // Reset to date option
        const dateRadio = this.getPauseElement('pauseUntilDate');
        if (dateRadio) {
            dateRadio.checked = true;
        }
        if (dateInput) {
            dateInput.disabled = false;
        }
        if (goalSelect) {
            goalSelect.disabled = true;
        }

        modal.classList.add('is-visible');
        this.languageService.applyTranslations(modal);
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
        if (cached && cached.isConnected) {
            return cached;
        }
        const element = document.getElementById(id);
        if (element) {
            this.pauseModalRefs[id] = element;
        }
        return element || null;
    }
}

