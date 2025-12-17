// src/ui/ui-controller.js

import { DashboardView } from './views/dashboard-view.js';
import { AllGoalsView } from './views/all-goals-view.js';
import { SettingsView } from './views/settings-view.js';
import { HelpView } from './views/help-view.js';
import { OverviewView } from './views/overview-view.js';
import { CreateModal } from './modal/create-modal.js';
import { EditModal } from './modal/edit-modal.js';
import { CompletionModal } from './modal/completion-modal.js';
import { MigrationModal } from './modal/migration-modal.js';
import { PauseModal } from './modal/pause-modal.js';
import { MobileAllGoalsView } from './views/mobile/all-goals-view.js';
import { MobileDashboardView } from './views/mobile/dashboard-view.js';
import { isMobileDevice } from '../domain/utils/device-utils.js';
import { getOptionalElement, querySelectorAllSafe, querySelectorSafe } from './utils/dom-utils.js';

class UIController {
    constructor(app) {
        this.app = app;
        this.isMobile = isMobileDevice();
        this.dashboardView = this.isMobile ? new MobileDashboardView(app) : new DashboardView(app);
        this.allGoalsView = this.isMobile ? new MobileAllGoalsView(app) : new AllGoalsView(app);
        this.settingsView = new SettingsView(app);
        this.helpView = new HelpView(app);
        this.overviewView = new OverviewView(app);
        this.createModal = new CreateModal(app);
        this.editModal = new EditModal(app);
        this.completionModal = new CompletionModal(app);
        this.migrationModal = new MigrationModal(app);
        this.pauseModal = new PauseModal(app);

        this.settingsView.initializeLanguageControls();
        this.setupEventListeners();

        // Handle window resize to switch between mobile/desktop views
        window.addEventListener('resize', () => {
            const wasMobile = this.isMobile;
            this.isMobile = isMobileDevice();
            if (wasMobile !== this.isMobile) {
                // Preserve dashboard index if switching from mobile
                const oldDashboardIndex = wasMobile && this.dashboardView.currentIndex !== undefined
                    ? this.dashboardView.currentIndex
                    : undefined;

                // Clean up old dashboard view
                if (this.dashboardView.destroy) {
                    this.dashboardView.destroy();
                }

                // Switch dashboard view
                this.dashboardView = this.isMobile ? new MobileDashboardView(app) : new DashboardView(app);

                // Restore index if applicable
                if (this.isMobile && oldDashboardIndex !== undefined && this.dashboardView.currentIndex !== undefined) {
                    this.dashboardView.currentIndex = oldDashboardIndex;
                }

                // Preserve filter state
                const oldState = this.allGoalsView.allGoalsState;
                this.allGoalsView = this.isMobile ? new MobileAllGoalsView(app) : new AllGoalsView(app);
                if (oldState) {
                    this.allGoalsView.allGoalsState = oldState;
                }
                this.allGoalsView.setupControls((goalId) => this.editModal.open(() => this.renderViews(), goalId));
                this.renderViews();
            }
        });
    }

    applyLanguageUpdates() {
        this.settingsView.updateLanguageOptions();
        this.settingsView.syncSettingsForm();
        this.app.languageService.applyTranslations(document);
        this.renderViews();
    }

    renderViews() {
        this.dashboardView.render(
            (goalId) => this.completionModal.open(goalId),
            (goalId, updates) => this.updateGoalInline(goalId, updates),
            (goalId) => this.editModal.open(() => this.renderViews(), goalId),
            (goalId, ratings, renderViews) => this.handleReviewSubmit(goalId, ratings, renderViews),
            () => this.renderViews(),
            (goalId) => this.pauseModal.open(goalId)
        );
        this.allGoalsView.render((goalId) => this.editModal.open(() => this.renderViews(), goalId));
        this.overviewView.render();
        this.settingsView.syncSettingsForm();
        this.helpView.render();
    }

    setupEventListeners() {
        const addGoalBtn = getOptionalElement('addGoalBtn');
        const addGoalBtnDesktop = getOptionalElement('addGoalBtnDesktop');
        const handleAddGoal = (e) => {
            e.stopPropagation();
            this.createModal.open(() => this.renderViews());
        };
        if (addGoalBtn) {
            addGoalBtn.addEventListener('click', handleAddGoal);
        }
        if (addGoalBtnDesktop) {
            addGoalBtnDesktop.addEventListener('click', handleAddGoal);
        }

        // Setup CreateModal Listeners
        this.createModal.setupEventListeners();

        // Setup EditModal Listeners
        // EditModal extends CreateModal, so we need careful setup to not conflict or double bind if they share elements.
        // However, EditModal and CreateModal share the SAME dom ID 'goalForm'.
        // This means adding listeners to 'goalForm' in both classes is redundant/conflict-prone if initialized on same DOM.
        // But setupEventListeners adds them. If both run, we verify if they overwrite or stack.
        // addEventListener stacks.
        // So hitting Submit would trigger BOTH create and edit handlers if both attached.

        // FIX: EditModal setupEventListeners calls super.setupEventListeners().
        // If we call createModal.setupEventListeners() AND editModal.setupEventListeners(), we attach TWICE.
        // Since they share the DOM form, we should only call setupEventListeners on ONE active controller or handle differently?
        // Actually, CreateModal is just for Create. EditModal is for Edit.
        // But they operate on the SAME HTML form `#goalForm`.
        // If we attach 'submit' listener from CreateModal, it calls `createGoal`.
        // If we attach 'submit' listener from EditModal, it calls `updateGoal`.
        // If both are attached, submitting the form will try to Create AND Update.

        // Solution: Only attach listeners via the current modal mode? No, event listeners are persistent.
        // Better: Attach a SINGLE listener to the form that delegating based on state?
        // OR: `EditModal` is the ONLY class we instantiate? NO, user asked for separation.

        // Re-reading user request: "split up the create modal from the edit modal and make the edit modal and extention to the create modal".
        // If `EditModal` extends `CreateModal`, `EditModal` IS A `CreateModal`.

        // If we want two instances `createModal` and `editModal` co-existing and sharing the same DOM `#goalForm`:
        // We must ensure they don't fight over the event listener.
        // When `createModal.open()` is called, it should perhaps attach its "submit for create" logic.
        // When `editModal.open()` is called, it should attach its "submit for edit" logic.
        // OR simpler: `EditModal` handles EVERYTHING if it extends `CreateModal`?
        // No, user specifically asked to SPLIT them.

        // Design:
        // `CreateModal` holds the basic "Open/Setup/Close" for creation.
        // `EditModal` extends it.
        // Since they share the DOM, maybe `UIController` shouldn't instantiate both if they bind to the same static DOM at startup.
        // But we have `this.createModal` and `this.editModal`.

        // Approach:
        // Use `EditModal` instance for EVERYTHING? 
        // If `EditModal` extends `CreateModal`, it has all the capabilities. 
        // `editModal.open()` (defaults to CreateMode if no ID passed in original code, but we changed `open(id)`).

        // If strict separation is required:
        // They share `goalForm`.
        // We can't have two permanent 'submit' listeners on the same form.
        // We should attach the specific submit handler when the modal OPENS.
        // And remove it when CLOSES.
        // But `setupEventListeners` is typically one-time setup.

        // Let's modify `CreateModal` and `EditModal` to attach the heavy logic in `open`? 
        // Or keep it simple: `EditModal` instance CAN handle creation if we used the old logic.
        // But the refactor forces separation.

        // Let's use `createModal` instance for `handleAddGoal`.
        // Let's use `editModal` instance for `edit`.
        // ISSUE: Event Listener collision on #goalForm.

        // HACK/FIX:
        // Only `EditModal` needs to be instantiated if it covers both cases?
        // User asked: "split up the create modal from the edit modal". 
        // If I instantiate both, I have the collision.
        // If I use `EditModal` for everything, did I really split them? Yes, class-wise.
        // `CreateModal` class exists. `EditModal` class exists.
        // In the app, do I need two INSTANCES?
        // If `EditModal` extends `CreateModal`, it inherits `open(renderViews)`.
        // But `EditModal.open` overrides it to require `goalId`.

        // Let's check `EditModal` code again.
        // `open(renderViews, goalId)` calls `super.open(renderViews)`.
        // `super.open` sets up Create Mode (resets form).
        // Then `EditModal.open` continues to setup Edit Mode.

        // So `EditModal` instance could technically handle Create if we add a `openCreate()` method or let `open` handle null?
        // But `EditModal` forces `goalId` check.

        // To support two instances sharing the DOM:
        // We need `setupEventListeners` to NOT attach the submit handler permanently, OR make the handle dynamic.
        // In `CreateModal`, `setupEventListeners` attaches `this.handleGoalSubmit()`.
        // In `EditModal`, it overrides `setupEventListeners`? No, it calls super.

        // I will assume for now that I should clean up the event listeners or use one instance.
        // But the request implies separate USAGE.
        // "make the edit modal and extention to the create modal".

        // If I only instantiate `CreateModal` for `addGoalBtn` and `EditModal` for edits...
        // `setupEventListeners` call order:
        // `createModal.setup(...)` -> adds listener A to #goalForm.
        // `editModal.setup(...)` -> adds listener B to #goalForm.
        // Submit -> A runs (Create) AND B runs (Edit). Chaos.

        // Real Fix: 
        // Move the checking logic to a shared handler or delegate?
        // OR:
        // Only attach the submit listener in `open()`, remove in `close()`.
        // This is safe for modal pattern.

        // Let's modify `CreateModal.js` to attach/detach on open/close?
        // That is a significant change to the pattern used elsewhere.

        // Alternative:
        // `UIController` assigns a `onsubmit` property to the form wrapper?
        // Use `goalForm.onsubmit = ...` instead of `addEventListener`?
        // That would ensure only ONE handler exists at a time (the last one assigned).
        // This is strictly better for this "Shared DOM, Multiple Controllers" scenario.

        // I will modify `CreateModal` and `EditModal` to use `goalForm.onsubmit = ...`.

        this.createModal.setupEventListeners();
        this.editModal.setupEventListeners((goalId) => this.openCompletionModal(goalId));

        this.settingsView.setupEventListeners(
            () => this.renderViews(),
            () => this.app.startReviewTimer()
        );

        this.completionModal.setup((status, recurrenceData) => this.handleCompletionChoice(status, recurrenceData));
        this.pauseModal.setup((pauseData) => this.handlePauseChoice(pauseData));
        this.migrationModal.setup(
            () => this.app.cancelMigration(),
            () => this.app.handleMigrationReviewRequest(),
            () => this.app.completeMigration()
        );

        this.allGoalsView.setupControls((goalId) => this.editModal.open(() => this.renderViews(), goalId));

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

    handleCompletionChoice(status, recurrenceData = null) {
        const goalId = this.completionModal.getPendingGoalId();
        if (!goalId) {
            return;
        }

        // Check if the goal modal is currently open for this goal
        const goalModal = getOptionalElement('goalModal');
        const goalIdInput = getOptionalElement('goalId');
        const isGoalModalOpen = goalModal && goalModal.classList.contains('is-visible') &&
            goalIdInput && goalIdInput.value === goalId;

        // Handle recurring goals
        if (recurrenceData?.isRecurring && recurrenceData.recurrenceDate) {
            this.handleRecurringGoalCompletion(goalId, status, recurrenceData.recurrenceDate);
        } else {
            // Normal completion flow
            this.changeGoalStatus(goalId, status);
        }

        this.completionModal.close();

        // If the goal form was open, refresh it to show the updated status
        if (isGoalModalOpen) {
            this.editModal.open(() => this.renderViews(), goalId);
        }
    }

    handleRecurringGoalCompletion(goalId, status, recurrenceDate) {
        try {
            const { maxActiveGoals } = this.app.settingsService.getSettings();
            const goal = this.app.goalService.goals.find(g => g.id === goalId);

            if (!goal) {
                this.app.errorHandler.error('errors.goalNotFound');
                return;
            }

            // Mark goal as recurring if not already
            if (!goal.isRecurring) {
                goal.isRecurring = true;
            }

            // Increment appropriate counter
            if (status === 'completed') {
                goal.completionCount++;
            } else if (status === 'notCompleted') {
                goal.notCompletedCount++;
            }

            // Increment recurrence counter
            goal.recurCount++;

            // Update deadline to the user-provided recurrence date
            goal.deadline = recurrenceDate;

            // Pause the goal until the recurrence date
            this.app.goalService.pauseGoal(goalId, { pauseUntil: recurrenceDate }, maxActiveGoals);

            this.app.reviews = this.app.reviewService.getReviews();
            this.renderViews();
        } catch (error) {
            this.app.errorHandler.error('errors.statusChangeFailed', { message: error?.message || '' }, error);
        }
    }

    handlePauseChoice(pauseData) {
        const goalId = this.pauseModal.getPendingGoalId();
        if (!goalId) {
            return;
        }
        this.pauseModal.close();
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
            // Cache is automatically invalidated by GoalService
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

            // Cache is automatically invalidated by GoalService when ratings change
            this.app.reviews = this.app.reviewService.getReviews();
            renderViews();
        } catch (error) {
            this.app.errorHandler.error('errors.goalUpdateFailed', { message: error?.message || '' }, error);
        }
    }

    openMigrationPrompt({ fromVersion, toVersion, fileName }) {
        this.migrationModal.openPrompt({ fromVersion, toVersion, fileName });
    }

    openMigrationDiff({ fromVersion, toVersion, originalString, migratedString, fileName }) {
        this.migrationModal.openDiff({ fromVersion, toVersion, originalString, migratedString, fileName });
    }

    closeMigrationModals() {
        this.migrationModal.closeAll();
    }

    openCompletionModal(goalId) {
        this.completionModal.open(goalId);
    }
}

export default UIController;

