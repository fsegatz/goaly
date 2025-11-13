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
        checkIn: 'Review',
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
        checkIn: 'Review',
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
        reviewIntervals: 'Review intervals (use d/h/m/s suffixes):',
        reviewIntervalsHelp: 'Examples: 30d, 14d, 12h, 45m, 30s.',
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
        prompt: 'Time for a review on "{{title}}". Please confirm motivation and urgency.',
        emptyState: 'All goals are up to date. Come back later for the next review.',
        sequence: 'Goal {{current}} of {{total}}',
        fields: {
            motivation: 'Motivation',
            urgency: 'Urgency'
        },
        status: {
            stable: 'Stable rating'
        },
        due: {
            unknown: 'Review scheduled',
            today: 'Due today',
            overdue: 'Overdue by {{count}} days'
        },
        feedback: {
            stable: 'Stable ratings confirmed for "{{title}}". Next review in {{interval}}.',
            updated: 'Ratings updated for "{{title}}". Next review in {{interval}}.'
        },
        actions: {
            done: 'Review completed',
            edit: 'Edit goal'
        },
        interval: {
            unknown: 'soon',
            days: 'about {{count}} day(s)',
            hours: 'about {{count}} hour(s)',
            minutes: 'about {{count}} minute(s)',
            seconds: 'about {{count}} second(s)'
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
        error: 'Import failed: {{message}}',
        invalidJson: 'Import failed: The selected file is not valid JSON.',
        invalidStructure: 'Import failed: The file format is not compatible.',
        invalidVersionFormat: 'Import failed: Unknown version "{{version}}".',
        versionTooNew: 'Import blocked: file version {{fileVersion}} is newer than supported version {{currentVersion}}.',
        incompatible: 'Import failed: The file is not compatible with this version of Goaly.',
        migrationCancelled: 'Import cancelled. The file was not migrated.'
    },
    migration: {
        prompt: {
            title: 'Migration required',
            message: '“{{fileName}}” uses version {{fromVersion}}. Migrate it to {{toVersion}} before importing?',
            messageLegacy: '“{{fileName}}” has no version information. Migrate it to {{toVersion}} before importing?',
            reviewCta: 'Review changes',
            cancel: 'Cancel',
            unnamedFile: 'Untitled export',
            legacyVersion: 'an older format'
        },
        diff: {
            title: 'Migration preview for {{fileName}}',
            subtitle: 'Comparing {{fromVersion}} → {{toVersion}}',
            originalLabel: 'Original',
            updatedLabel: 'Migrated',
            applyCta: 'Apply migration',
            cancel: 'Cancel'
        }
    }
};

export default en;

