// src/ui/ui-controller.js

import { DashboardView } from './desktop/dashboard-view.js';
import { AllGoalsView } from './desktop/all-goals-view.js';
import { SettingsView } from './desktop/settings-view.js';
import { HelpView } from './desktop/help-view.js';
import { GoalFormView } from './desktop/goal-form-view.js';
import { ModalsView } from './desktop/modals-view.js';
import { MobileAllGoalsView } from './mobile/all-goals-view.js';
import { MOBILE_BREAKPOINT_PX } from '../domain/utils/constants.js';
import { getOptionalElement, querySelectorAllSafe, querySelectorSafe } from './utils/dom-utils.js';

class UIController {
    constructor(app) {
        this.app = app;
        this.isMobile = this.detectMobile();
        this.dashboardView = new DashboardView(app);
        this.allGoalsView = this.isMobile ? new MobileAllGoalsView(app) : new AllGoalsView(app);
        this.settingsView = new SettingsView(app);
        this.helpView = new HelpView(app);
        this.goalFormView = new GoalFormView(app);
        this.modalsView = new ModalsView(app);

        this.settingsView.initializeLanguageControls();
        this.setupEventListeners();
        
        // Handle window resize to switch between mobile/desktop views
        window.addEventListener('resize', () => {
            const wasMobile = this.isMobile;
            this.isMobile = this.detectMobile();
            if (wasMobile !== this.isMobile) {
                // Preserve filter state
                const oldState = this.allGoalsView.allGoalsState;
                this.allGoalsView = this.isMobile ? new MobileAllGoalsView(app) : new AllGoalsView(app);
                if (oldState) {
                    this.allGoalsView.allGoalsState = oldState;
                }
                this.allGoalsView.setupControls((goalId) => this.goalFormView.openGoalForm(goalId, () => this.renderViews()));
                this.renderViews();
            }
        });
    }

    detectMobile() {
        return window.innerWidth <= MOBILE_BREAKPOINT_PX || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    applyLanguageUpdates() {
        this.settingsView.updateLanguageOptions();
        this.settingsView.syncSettingsForm();
        this.app.languageService.applyTranslations(document);
        this.renderViews();
    }

    renderViews() {
        this.dashboardView.render(
            (goalId) => this.modalsView.openCompletionModal(goalId),
            (goalId, updates) => this.updateGoalInline(goalId, updates),
            (goalId) => this.goalFormView.openGoalForm(goalId, () => this.renderViews()),
            (goalId, ratings, renderViews) => this.handleReviewSubmit(goalId, ratings, renderViews),
            () => this.renderViews(),
            (goalId) => this.modalsView.openPauseModal(goalId)
        );
        this.allGoalsView.render((goalId) => this.goalFormView.openGoalForm(goalId, () => this.renderViews()));
        this.settingsView.syncSettingsForm();
        this.helpView.render();
    }

    setupEventListeners() {
        const addGoalBtn = getOptionalElement('addGoalBtn');
        const addGoalBtnDesktop = getOptionalElement('addGoalBtnDesktop');
        const handleAddGoal = (e) => {
            e.stopPropagation();
            this.goalFormView.openGoalForm(null, () => this.renderViews());
        };
        if (addGoalBtn) {
            addGoalBtn.addEventListener('click', handleAddGoal);
        }
        if (addGoalBtnDesktop) {
            addGoalBtnDesktop.addEventListener('click', handleAddGoal);
        }

        this.goalFormView.setupEventListeners(
            () => this.goalFormView.handleGoalSubmit(() => this.renderViews()),
            () => this.goalFormView.handleDelete(() => this.renderViews()),
            () => this.renderViews()
        );

        this.settingsView.setupEventListeners(
            () => this.renderViews(),
            () => this.app.startReviewTimer()
        );

        this.modalsView.setupCompletionModal((status) => this.handleCompletionChoice(status));
        this.modalsView.setupPauseModal((pauseData) => this.handlePauseChoice(pauseData));
        this.modalsView.setupMigrationModals(
            () => this.app.cancelMigration(),
            () => this.app.handleMigrationReviewRequest(),
            () => this.app.completeMigration()
        );

        this.allGoalsView.setupControls((goalId) => this.goalFormView.openGoalForm(goalId, () => this.renderViews()));

        // Logo click handler - navigate to dashboard
        const goalyLogo = getOptionalElement('goalyLogo');
        if (goalyLogo) {
            const navigateToDashboard = () => {
                this.switchView('dashboard');
            };
            goalyLogo.addEventListener('click', navigateToDashboard);
            // Keyboard accessibility (Enter and Space)
            goalyLogo.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigateToDashboard();
                }
            });
        }

        // Desktop menu
        querySelectorAllSafe('.desktop-menu .menu-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchView(btn.dataset.view);
            });
        });

        // Mobile menu
        const mobileMenuToggle = getOptionalElement('mobileMenuToggle');
        const mobileMenuDropdown = getOptionalElement('mobileMenuDropdown');
        
        if (mobileMenuToggle && mobileMenuDropdown) {
            const updateDropdownPosition = () => {
                const toggleRect = mobileMenuToggle.getBoundingClientRect();
                const headerRect = mobileMenuToggle.closest('header').getBoundingClientRect();
                mobileMenuDropdown.style.top = `${headerRect.bottom + 10}px`;
                mobileMenuDropdown.style.right = `${window.innerWidth - toggleRect.right}px`;
                mobileMenuDropdown.style.left = 'auto';
            };

            mobileMenuToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const isExpanded = mobileMenuToggle.getAttribute('aria-expanded') === 'true';
                mobileMenuToggle.setAttribute('aria-expanded', !isExpanded);
                mobileMenuDropdown.setAttribute('aria-hidden', isExpanded);
                if (!isExpanded) {
                    updateDropdownPosition();
                }
            });

            // Update position on resize and scroll
            window.addEventListener('resize', updateDropdownPosition);
            window.addEventListener('scroll', () => {
                if (mobileMenuDropdown.getAttribute('aria-hidden') === 'false') {
                    updateDropdownPosition();
                }
            });

            // Close mobile menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!mobileMenuToggle.contains(e.target) && !mobileMenuDropdown.contains(e.target)) {
                    mobileMenuToggle.setAttribute('aria-expanded', 'false');
                    mobileMenuDropdown.setAttribute('aria-hidden', 'true');
                }
            });

            // Mobile menu buttons
            querySelectorAllSafe('.mobile-menu-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.switchView(btn.dataset.view);
                    mobileMenuToggle.setAttribute('aria-expanded', 'false');
                    mobileMenuDropdown.setAttribute('aria-hidden', 'true');
                });
            });
        }
    }

    switchView(viewName) {
        // Update desktop menu
        querySelectorAllSafe('.desktop-menu .menu-btn').forEach(b => b.classList.remove('active'));
        const desktopBtn = querySelectorSafe(`.desktop-menu .menu-btn[data-view="${viewName}"]`);
        if (desktopBtn) {
            desktopBtn.classList.add('active');
        }

        // Update mobile menu
        querySelectorAllSafe('.mobile-menu-btn').forEach(b => b.classList.remove('active'));
        const mobileBtn = querySelectorSafe(`.mobile-menu-btn[data-view="${viewName}"]`);
        if (mobileBtn) {
            mobileBtn.classList.add('active');
        }

        // Switch views
        querySelectorAllSafe('.view').forEach(content => {
            content.classList.remove('active');
        });
        const targetView = getOptionalElement(`${viewName}View`);
        if (targetView) {
            targetView.classList.add('active');
        }
    }

    handleCompletionChoice(status) {
        const goalId = this.modalsView.getPendingCompletionGoalId();
        if (!goalId) {
            return;
        }
        this.changeGoalStatus(goalId, status);
        this.modalsView.closeCompletionModal();
    }

    handlePauseChoice(pauseData) {
        const goalId = this.modalsView.getPendingPauseGoalId();
        if (!goalId) {
            return;
        }
        this.modalsView.closePauseModal();
        const { maxActiveGoals } = this.app.settingsService.getSettings();
        this.app.goalService.pauseGoal(goalId, pauseData, maxActiveGoals);
        this.app.reviews = this.app.reviewService.getReviews();
        this.renderViews();
    }

    changeGoalStatus(goalId, newStatus) {
        if (!goalId || !newStatus) {
            return;
        }

        try {
            const { maxActiveGoals } = this.app.settingsService.getSettings();
            const updatedGoal = this.app.goalService.setGoalStatus(goalId, newStatus, maxActiveGoals);
            if (!updatedGoal) {
                this.app.errorHandler.error('errors.goalNotFound');
                return;
            }

            this.app.reviews = this.app.reviewService.getReviews();
            this.renderViews();
        } catch (error) {
            this.app.errorHandler.error('errors.statusChangeFailed', { message: error?.message || '' }, error);
        }
    }

    updateGoalInline(goalId, updates) {
        try {
            const { maxActiveGoals } = this.app.settingsService.getSettings();
            this.app.goalService.updateGoal(goalId, updates, maxActiveGoals);
            this.dashboardView.invalidatePriorityCache();
            this.allGoalsView.invalidatePriorityCache();
            this.renderViews();
        } catch (error) {
            this.app.errorHandler.error('errors.goalUpdateFailed', { message: error?.message || '' }, error);
            this.renderViews();
        }
    }

    handleReviewSubmit(goalId, ratings, renderViews) {
        try {
            const result = this.app.reviewService.recordReview(goalId, ratings);
            if (!result) {
                this.app.errorHandler.error('errors.goalNotFound');
                return;
            }

            const intervals = this.app.settingsService.getReviewIntervals?.() || this.app.settingsService.getSettings().reviewIntervals;
            const intervalDays = Array.isArray(intervals) && intervals.length > 0
                ? intervals[result.goal.reviewIntervalIndex] ?? intervals[0]
                : null;
            const formattedInterval = this.dashboardView.formatReviewIntervalDisplay(intervalDays);

            this.dashboardView.latestReviewFeedback = {
                messageKey: result.ratingsMatch ? 'reviews.feedback.stable' : 'reviews.feedback.updated',
                messageArgs: {
                    title: result.goal.title,
                    interval: formattedInterval
                },
                type: result.ratingsMatch ? 'success' : 'info'
            };

            if (!result.ratingsMatch) {
                this.dashboardView.invalidatePriorityCache();
            }

            this.app.reviews = this.app.reviewService.getReviews();
            renderViews();
        } catch (error) {
            this.app.errorHandler.error('errors.goalUpdateFailed', { message: error?.message || '' }, error);
        }
    }

    openGoalForm(goalId = null) {
        this.goalFormView.openGoalForm(goalId, () => this.renderViews());
    }

    openCompletionModal(goalId) {
        this.modalsView.openCompletionModal(goalId);
    }

    openMigrationPrompt({ fromVersion, toVersion, fileName }) {
        this.modalsView.openMigrationPrompt({ fromVersion, toVersion, fileName });
    }

    openMigrationDiff({ fromVersion, toVersion, originalString, migratedString, fileName }) {
        this.modalsView.openMigrationDiff({ fromVersion, toVersion, originalString, migratedString, fileName });
    }

    closeMigrationModals() {
        this.modalsView.closeMigrationModals();
    }
}

export default UIController;
