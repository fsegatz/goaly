// src/ui/modal/migration-modal.js

/**
 * @module MigrationModal
 * @description Modal handling version migration prompts and diff reviews.
 * Displays version mismatch warnings and diff views for data migration.
 */

import { getOptionalElement } from '../utils/dom-utils.js';
import { BaseModal } from '../base-modal.js';
import { computeLineDiff } from '../../domain/utils/diff-utils.js';

/**
 * Modal controller for data migration.
 * @class
 * @extends BaseModal
 */
export class MigrationModal extends BaseModal {
    /**
     * @param {Object} app - The main application instance
     */
    constructor(app) {
        super(app);
        this.migrationModalRefs = {};
        this.migrationDiffData = null;
        this.isSyncingMigrationScroll = false;
        this.migrationScrollBound = false;
    }

    /**
     * Sets up migration modal handlers.
     * @param {Function} cancelMigration - Callback to cancel migration
     * @param {Function} handleMigrationReviewRequest - Callback to review changes
     * @param {Function} completeMigration - Callback to apply changes
     */
    setup(cancelMigration, handleMigrationReviewRequest, completeMigration) {
        this._setupPromptHandlers(cancelMigration, handleMigrationReviewRequest);
        this._setupDiffHandlers(cancelMigration, completeMigration);
    }

    _setupPromptHandlers(cancelMigration, handleMigrationReviewRequest) {
        const promptModal = this.getElement('migrationPromptModal');
        if (!promptModal) return;

        const reviewBtn = this.getElement('migrationReviewBtn');
        if (reviewBtn) {
            reviewBtn.addEventListener('click', (event) => {
                event.preventDefault();
                this.closePrompt();
                handleMigrationReviewRequest();
            });
        }

        const promptCancel = this.getElement('migrationPromptCancelBtn');
        if (promptCancel) {
            promptCancel.addEventListener('click', (event) => {
                event.preventDefault();
                this.closeAll();
                cancelMigration();
            });
        }

        const promptClose = this.getElement('migrationPromptClose');
        if (promptClose) {
            promptClose.addEventListener('click', () => {
                this.closeAll();
                cancelMigration();
            });
        }
    }

    _setupDiffHandlers(cancelMigration, completeMigration) {
        const diffModal = this.getElement('migrationDiffModal');
        if (!diffModal) return;

        const diffClose = this.getElement('migrationDiffClose');
        if (diffClose) {
            diffClose.addEventListener('click', () => {
                this.closeAll();
                cancelMigration();
            });
        }

        const diffCancel = this.getElement('migrationCancelBtn');
        if (diffCancel) {
            diffCancel.addEventListener('click', (event) => {
                event.preventDefault();
                this.closeAll();
                cancelMigration();
            });
        }

        const diffApply = this.getElement('migrationApplyBtn');
        if (diffApply) {
            diffApply.addEventListener('click', (event) => {
                event.preventDefault();
                completeMigration();
            });
        }

        this._setupScrollSync();
    }

    _setupScrollSync() {
        if (this.migrationScrollBound) return;

        const oldView = this.getElement('migrationDiffOld');
        const newView = this.getElement('migrationDiffNew');

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

    /**
     * Opens the migration prompt modal.
     * @param {Object} options - Prompt options (versions, filename)
     */
    openPrompt({ fromVersion, toVersion, fileName }) {
        const modal = this.getElement('migrationPromptModal');
        if (!modal) {
            return;
        }

        const title = this.getElement('migrationPromptTitle');
        if (title) {
            title.textContent = this.translate('migration.prompt.title');
        }

        const messageElement = this.getElement('migrationPromptMessage');
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

    /**
     * Opens the diff review modal.
     * @param {Object} options - Diff options (versions, strings, filename)
     */
    openDiff({ fromVersion, toVersion, originalString, migratedString, fileName }) {
        const promptModal = this.getElement('migrationPromptModal');
        if (promptModal) {
            promptModal.classList.remove('is-visible');
        }

        const modal = this.getElement('migrationDiffModal');
        if (!modal) {
            return;
        }

        const title = this.getElement('migrationDiffTitle');
        if (title) {
            title.textContent = this.translate('migration.diff.title', {
                fileName: fileName ?? this.translate('migration.prompt.unnamedFile')
            });
        }

        const subtitle = this.getElement('migrationDiffSubtitle');
        if (subtitle) {
            subtitle.textContent = this.translate('migration.diff.subtitle', {
                fromVersion: fromVersion ?? this.translate('migration.prompt.legacyVersion'),
                toVersion
            });
        }

        const oldLabel = this.getElement('migrationDiffOldLabel');
        if (oldLabel) {
            oldLabel.textContent = this.translate('migration.diff.originalLabel');
        }

        const newLabel = this.getElement('migrationDiffNewLabel');
        if (newLabel) {
            newLabel.textContent = this.translate('migration.diff.updatedLabel');
        }

        this.renderDiff(originalString, migratedString);

        modal.classList.add('is-visible');
        this.languageService.applyTranslations(modal);
    }

    closePrompt() {
        const modal = this.getElement('migrationPromptModal');
        if (modal) {
            modal.classList.remove('is-visible');
        }
    }

    closeDiff() {
        const modal = this.getElement('migrationDiffModal');
        if (modal) {
            modal.classList.remove('is-visible');
        }
        this.migrationDiffData = null;
        this.isSyncingMigrationScroll = false;
    }

    closeAll() {
        this.closePrompt();
        this.closeDiff();
    }

    /**
     * Renders the line-by-line diff.
     * @param {string} originalString - Original content
     * @param {string} migratedString - Migrated content
     */
    renderDiff(originalString, migratedString) {
        const diffLines = computeLineDiff(originalString, migratedString);
        this.migrationDiffData = diffLines;

        const oldContainer = this.getElement('migrationDiffOld');
        const newContainer = this.getElement('migrationDiffNew');

        if (oldContainer) {
            this.renderDiffColumn(oldContainer, diffLines, 'old');
            oldContainer.scrollTop = 0;
            oldContainer.scrollLeft = 0;
        }
        if (newContainer) {
            this.renderDiffColumn(newContainer, diffLines, 'new');
            newContainer.scrollTop = 0;
            newContainer.scrollLeft = 0;
        }
    }

    renderDiffColumn(container, diffLines, variant) {
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

    getElement(id) {
        return this.getCachedElement(this.migrationModalRefs, id, getOptionalElement);
    }
}
