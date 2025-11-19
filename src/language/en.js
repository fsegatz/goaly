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
        settings: 'Settings',
        help: 'Help'
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
        clearFilter: 'Clear filter',
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
        deadlineClickable: 'Click to edit deadline',
        actions: {
            edit: 'Edit',
            complete: 'Complete'
        },
        inline: {
            deadline: 'Deadline',
            motivation: 'Motivation',
            urgency: 'Urgency'
        },
        steps: {
            title: 'Steps',
            add: 'Add step',
            placeholder: 'Enter a step...',
            empty: 'No steps yet',
            delete: 'Delete step'
        },
        resources: {
            title: 'Resources',
            add: 'Add resource',
            placeholder: 'Enter a resource...',
            empty: 'No resources yet',
            delete: 'Delete resource',
            types: {
                general: 'General',
                contact: 'Contact',
                group: 'Group',
                institution: 'Institution',
                knowledge: 'Knowledge',
                financial: 'Financial'
            }
        }
    },
    settingsPanel: {
        maxActiveGoals: 'Maximum active goals:',
        reviewIntervals: 'Review intervals (use d/h/m/s suffixes):',
        reviewIntervalsHelp: 'Examples: 30d, 14d, 12h, 45m, 30s.',
        languageLabel: 'Language',
        dataManagement: 'Data Management',
        dataManagementHelp: 'Export your data for backup or import previously exported data.',
        googleDriveSync: 'Google Drive Sync',
        googleDriveSyncHelp: 'Sync your goal data with Google Drive for backup and multi-device access.',
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
    reviews: {
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
        statusChangeFailed: 'Failed to change the status.',
        titleRequired: 'Title cannot be empty.'
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
            message: '"{{fileName}}" uses version {{fromVersion}}. Migrate it to {{toVersion}} before importing?',
            messageLegacy: '"{{fileName}}" has no version information. Migrate it to {{toVersion}} before importing?',
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
    },
    googleDrive: {
        signIn: 'Sign in with Google',
        signOut: 'Sign out',
        syncNow: 'Sync Now',
        authenticated: 'Authenticated with Google',
        lastSynced: 'Last synced: {{time}}',
        syncing: 'Syncing...',
        syncSuccess: 'Sync completed successfully',
        syncError: 'Sync failed: {{message}}',
        uploadSuccess: 'Data uploaded to Google Drive',
        downloadSuccess: 'Data downloaded from Google Drive',
        conflictDetected: 'Conflict detected: {{message}}',
        conflictNewerRemote: 'Remote data is newer. Download to overwrite local data?',
        conflictOlderVersion: 'Remote data uses an older version. Upload to overwrite remote data?',
        conflictNewerVersion: 'Remote data uses a newer version. Download to update local data?',
        notConfigured: 'Google Drive sync is not configured. Please set GOOGLE_API_KEY and GOOGLE_CLIENT_ID.',
        authError: 'Authentication failed: {{message}}',
        uploadError: 'Upload failed: {{message}}',
        downloadError: 'Download failed: {{message}}',
        testerOnly: 'Google Drive sync is currently only available to testers. Send your Google email account to the developer to grant testing access.',
        noChanges: 'No changes to sync. Everything is up to date.',
        status: {
            buildingLocalPayload: 'Preparing local data for sync…',
            checkingRemote: 'Checking remote data…',
            remoteFound: 'Remote data found. Downloaded successfully.',
            noRemote: 'No remote data found. A new backup will be created.',
            merging: 'Merging changes (local/remote/base)…',
            applying: 'Applying merged data locally…',
            uploading: 'Uploading merged data to Google Drive…'
        }
    },
    help: {
        title: 'Help',
        description: 'Have you found a bug or would you like to request a new feature? We\'d love to hear from you!',
        reportBug: 'Report a Bug',
        reportBugHelp: 'Found something that\'s not working? Let us know!',
        reportBugButton: 'Report Bug',
        requestFeature: 'Request a Feature',
        requestFeatureHelp: 'Have an idea for a new feature? We\'d love to hear it!',
        requestFeatureButton: 'Request Feature'
    }
};

export default en;

