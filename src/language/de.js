const de = {
    language: {
        names: {
            en: 'Englisch',
            de: 'Deutsch',
            sv: 'Schwedisch'
        }
    },
    meta: {
        title: 'Goaly - Zielverfolgung'
    },
    navigation: {
        dashboard: 'Dashboard',
        allGoals: 'Alle Ziele',
        checkIn: 'Check-in',
        settings: 'Einstellungen'
    },
    actions: {
        export: 'Export',
        import: 'Import',
        addGoal: '+ Neues Ziel'
    },
    sections: {
        dashboard: 'Dashboard',
        allGoals: 'Alle Ziele',
        checkIn: 'Check-in',
        settings: 'Einstellungen'
    },
    common: {
        save: 'Speichern',
        cancel: 'Abbrechen'
    },
    filters: {
        statusLabel: 'Status',
        minPriorityLabel: 'Mindestpriorität',
        sortLabel: 'Sortierung',
        includeCompleted: 'Erreichte anzeigen',
        includeAbandoned: 'Nicht erreichte anzeigen',
        statusOptions: {
            all: 'Alle Status',
            active: 'Aktiv',
            paused: 'Pausiert',
            completed: 'Erreicht',
            abandoned: 'Nicht erreicht'
        },
        sortOptions: {
            priorityDesc: 'Priorität (hoch → niedrig)',
            priorityAsc: 'Priorität (niedrig → hoch)',
            updatedDesc: 'Letzte Änderung (neu → alt)',
            updatedAsc: 'Letzte Änderung (alt → neu)'
        }
    },
    dashboard: {
        noActiveGoals: 'Keine aktiven Ziele. Erstelle dein erstes Ziel!'
    },
    goalCard: {
        descriptionAria: 'Beschreibung bearbeiten',
        descriptionPlaceholder: 'Beschreibung hinzufügen...',
        priorityLabel: 'Priorität',
        deadlinePrefix: '📅 {{deadline}}',
        noDeadline: 'Keine Deadline',
        actions: {
            edit: 'Bearbeiten',
            complete: 'Abschließen'
        },
        inline: {
            deadline: 'Deadline',
            motivation: 'Motivation',
            urgency: 'Dringlichkeit'
        }
    },
    settingsPanel: {
        maxActiveGoals: 'Maximale aktive Ziele:',
        checkInsEnabled: 'Check-ins aktivieren',
        checkInInterval: 'Check-in Intervall (Minuten für Dev-Tests):',
        languageLabel: 'Sprache',
        save: 'Speichern'
    },
    goalModal: {
        titleLabel: 'Titel *',
        descriptionLabel: 'Beschreibung',
        motivationLabel: 'Motivation (1-5) *',
        urgencyLabel: 'Dringlichkeit (1-5) *',
        deadlineLabel: 'Deadline (optional)',
        actions: {
            save: 'Speichern',
            cancel: 'Abbrechen',
            delete: 'Löschen'
        }
    },
    goalHistory: {
        title: 'Historie'
    },
    completionModal: {
        title: 'Ziel abschließen',
        question: 'Hast du dein Ziel erreicht?',
        success: 'Ziel erreicht',
        failure: 'Nicht erreicht',
        cancel: 'Abbrechen'
    },
    deadline: {
        overdue: 'Überfällig ({{count}} Tage)',
        today: 'Heute',
        tomorrow: 'Morgen',
        inDays: 'In {{count}} Tagen'
    },
    status: {
        active: 'Aktiv',
        paused: 'Pausiert',
        completed: 'Erreicht',
        abandoned: 'Nicht erreicht'
    },
    checkIns: {
        prompt: 'Zeit für einen Check-in zu "{{title}}". Bitte überprüfe Motivation und Dringlichkeit.',
        actions: {
            done: 'Check-in durchgeführt',
            edit: 'Ziel bearbeiten'
        }
    },
    history: {
        empty: 'Noch keine Änderungen protokolliert.',
        revertButton: 'Auf diese Version zurücksetzen',
        confirmRevert: 'Möchtest du dieses Ziel wirklich auf diese Version zurücksetzen?',
        fields: {
            title: 'Titel',
            description: 'Beschreibung',
            motivation: 'Motivation',
            urgency: 'Dringlichkeit',
            deadline: 'Deadline',
            status: 'Status',
            priority: 'Priorität'
        },
        events: {
            created: 'Erstellt',
            updated: 'Aktualisiert',
            statusChanged: 'Status angepasst',
            rollback: 'Zurückgesetzt',
            generic: 'Änderung'
        }
    },
    goalForm: {
        editTitle: 'Ziel bearbeiten',
        createTitle: 'Neues Ziel',
        confirmDelete: 'Möchtest du dieses Ziel wirklich löschen?'
    },
    errors: {
        goalUpdateFailed: 'Aktualisierung des Ziels fehlgeschlagen.',
        goalSaveFailed: 'Speichern des Ziels fehlgeschlagen.',
        revertNotPossible: 'Zurücksetzen nicht möglich.',
        goalNotFound: 'Ziel nicht gefunden.',
        statusChangeFailed: 'Statusänderung fehlgeschlagen.'
    },
    allGoals: {
        openGoalAria: 'Ziel {{title}} öffnen'
    },
    tables: {
        allGoals: {
            headers: {
                title: 'Titel',
                status: 'Status',
                priority: 'Priorität',
                motivation: 'Motivation',
                urgency: 'Dringlichkeit',
                deadline: 'Deadline',
                lastUpdated: 'Letzte Änderung'
            },
            emptyState: 'Keine Ziele vorhanden, die den aktuellen Filtern entsprechen.'
        }
    },
    import: {
        success: 'Daten erfolgreich importiert!',
        error: 'Fehler beim Importieren: {{message}}'
    }
};

export default de;

