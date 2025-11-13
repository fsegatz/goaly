const en = {
    language: {
        names: {
            en: 'English',
            de: 'German',
            sv: 'Swedish'
        }
    },
    meta: {
        title: 'Goaly - Goal tracking'
    },
    navigation: {
        dashboard: 'Dashboard',
        allGoals: 'All goals',
        checkIn: 'Check-in',
        settings: 'Settings'
    },
    actions: {
        export: 'Export',
        import: 'Import',
        addGoal: '+ New goal'
    },
    sections: {
        dashboard: 'Dashboard',
        allGoals: 'All goals',
        checkIn: 'Check-in',
        settings: 'Settings'
    },
    common: {
        save: 'Save',
        cancel: 'Cancel'
    },
    filters: {
        statusLabel: 'Status',
        minPriorityLabel: 'Minimum priority',
        sortLabel: 'Sorting',
        includeCompleted: 'Show completed',
        includeAbandoned: 'Show abandoned',
        statusOptions: {
            all: 'All statuses',
            active: 'Active',
            paused: 'Paused',
            completed: 'Completed',
            abandoned: 'Abandoned'
        },
        sortOptions: {
            priorityDesc: 'Priority (high → low)',
            priorityAsc: 'Priority (low → high)',
            updatedDesc: 'Last update (new → old)',
            updatedAsc: 'Last update (old → new)'
        }
    },
    dashboard: {
        noActiveGoals: 'No active goals yet. Create your first goal!'
    },
    goalCard: {
        descriptionAria: 'Edit description',
        descriptionPlaceholder: 'Add a description...',
        priorityLabel: 'Priority',
        deadlinePrefix: '📅 {{deadline}}',
        noDeadline: 'No deadline',
        actions: {
            edit: 'Edit',
            complete: 'Complete'
        },
        inline: {
            deadline: 'Deadline',
            motivation: 'Motivation',
            urgency: 'Urgency'
        }
    },
    settingsPanel: {
        maxActiveGoals: 'Maximum active goals:',
        checkInsEnabled: 'Enable check-ins',
        checkInInterval: 'Check-in interval (minutes for dev testing):',
        languageLabel: 'Language',
        save: 'Save'
    },
    goalModal: {
        titleLabel: 'Title *',
        descriptionLabel: 'Description',
        motivationLabel: 'Motivation (1-5) *',
        urgencyLabel: 'Urgency (1-5) *',
        deadlineLabel: 'Deadline (optional)',
        actions: {
            save: 'Save',
            cancel: 'Cancel',
            delete: 'Delete'
        }
    },
    goalHistory: {
        title: 'History'
    },
    completionModal: {
        title: 'Complete goal',
        question: 'Did you achieve your goal?',
        success: 'Goal completed',
        failure: 'Not completed',
        cancel: 'Cancel'
    },
    deadline: {
        overdue: 'Overdue ({{count}} days)',
        today: 'Today',
        tomorrow: 'Tomorrow',
        inDays: 'In {{count}} days'
    },
    status: {
        active: 'Active',
        paused: 'Paused',
        completed: 'Completed',
        abandoned: 'Abandoned'
    },
    checkIns: {
        prompt: 'Time for a check-in on "{{title}}". Please review motivation and urgency.',
        actions: {
            done: 'Check-in completed',
            edit: 'Edit goal'
        }
    },
    history: {
        empty: 'No changes recorded yet.',
        revertButton: 'Revert to this version',
        confirmRevert: 'Do you really want to revert the goal to this version?',
        fields: {
            title: 'Title',
            description: 'Description',
            motivation: 'Motivation',
            urgency: 'Urgency',
            deadline: 'Deadline',
            status: 'Status',
            priority: 'Priority'
        },
        events: {
            created: 'Created',
            updated: 'Updated',
            statusChanged: 'Status changed',
            rollback: 'Reverted',
            generic: 'Change'
        }
    },
    goalForm: {
        editTitle: 'Edit goal',
        createTitle: 'New goal',
        confirmDelete: 'Do you really want to delete this goal?'
    },
    errors: {
        goalUpdateFailed: 'Updating the goal failed.',
        goalSaveFailed: 'Saving the goal failed.',
        revertNotPossible: 'Unable to revert this goal.',
        goalNotFound: 'Goal not found.',
        statusChangeFailed: 'Failed to change the status.'
    },
    allGoals: {
        openGoalAria: 'Open goal {{title}}'
    },
    tables: {
        allGoals: {
            headers: {
                title: 'Title',
                status: 'Status',
                priority: 'Priority',
                motivation: 'Motivation',
                urgency: 'Urgency',
                deadline: 'Deadline',
                lastUpdated: 'Last updated'
            },
            emptyState: 'No goals match the current filters.'
        }
    },
    import: {
        success: 'Data imported successfully!',
        error: 'Import failed: {{message}}'
    }
};

export default en;

