const sv = {
    language: {
        names: {
            en: 'Engelska',
            de: 'Tyska',
            sv: 'Svenska'
        }
    },
    meta: {
        title: 'Goaly - Måluppföljning'
    },
    navigation: {
        dashboard: 'Dashboard',
        allGoals: 'Alla mål',
        checkIn: 'Check-in',
        settings: 'Inställningar'
    },
    actions: {
        export: 'Exportera',
        import: 'Importera',
        addGoal: '+ Nytt mål'
    },
    sections: {
        dashboard: 'Dashboard',
        allGoals: 'Alla mål',
        checkIn: 'Check-in',
        settings: 'Inställningar'
    },
    common: {
        save: 'Spara',
        cancel: 'Avbryt'
    },
    filters: {
        statusLabel: 'Status',
        minPriorityLabel: 'Minsta prioritet',
        sortLabel: 'Sortering',
        includeCompleted: 'Visa slutförda',
        includeAbandoned: 'Visa avbrutna',
        statusOptions: {
            all: 'Alla statusar',
            active: 'Aktiv',
            paused: 'Pausad',
            completed: 'Slutförd',
            abandoned: 'Avbruten'
        },
        sortOptions: {
            priorityDesc: 'Prioritet (hög → låg)',
            priorityAsc: 'Prioritet (låg → hög)',
            updatedDesc: 'Senaste ändring (ny → gammal)',
            updatedAsc: 'Senaste ändring (gammal → ny)'
        }
    },
    dashboard: {
        noActiveGoals: 'Inga aktiva mål. Skapa ditt första mål!'
    },
    goalCard: {
        descriptionAria: 'Redigera beskrivning',
        descriptionPlaceholder: 'Lägg till en beskrivning...',
        priorityLabel: 'Prioritet',
        deadlinePrefix: '📅 {{deadline}}',
        noDeadline: 'Ingen deadline',
        actions: {
            edit: 'Redigera',
            complete: 'Slutför'
        },
        inline: {
            deadline: 'Deadline',
            motivation: 'Motivation',
            urgency: 'Brådska'
        }
    },
    settingsPanel: {
        maxActiveGoals: 'Maximalt antal aktiva mål:',
        checkInsEnabled: 'Aktivera check-ins',
        checkInInterval: 'Check-in-intervall (minuter för dev-test):',
        languageLabel: 'Språk',
        save: 'Spara'
    },
    goalModal: {
        titleLabel: 'Titel *',
        descriptionLabel: 'Beskrivning',
        motivationLabel: 'Motivation (1-5) *',
        urgencyLabel: 'Brådska (1-5) *',
        deadlineLabel: 'Deadline (valfritt)',
        actions: {
            save: 'Spara',
            cancel: 'Avbryt',
            delete: 'Ta bort'
        }
    },
    goalHistory: {
        title: 'Historik'
    },
    completionModal: {
        title: 'Slutför mål',
        question: 'Uppnådde du målet?',
        success: 'Mål slutfört',
        failure: 'Inte slutfört',
        cancel: 'Avbryt'
    },
    deadline: {
        overdue: 'Försenad ({{count}} dagar)',
        today: 'Idag',
        tomorrow: 'Imorgon',
        inDays: 'Om {{count}} dagar'
    },
    status: {
        active: 'Aktiv',
        paused: 'Pausad',
        completed: 'Slutförd',
        abandoned: 'Avbruten'
    },
    checkIns: {
        prompt: 'Dags för en check-in för "{{title}}". Granska motivation och brådska.',
        actions: {
            done: 'Check-in slutförd',
            edit: 'Redigera mål'
        }
    },
    history: {
        empty: 'Inga ändringar registrerade ännu.',
        revertButton: 'Återställ till den här versionen',
        confirmRevert: 'Vill du verkligen återställa målet till den här versionen?',
        fields: {
            title: 'Titel',
            description: 'Beskrivning',
            motivation: 'Motivation',
            urgency: 'Brådska',
            deadline: 'Deadline',
            status: 'Status',
            priority: 'Prioritet'
        },
        events: {
            created: 'Skapad',
            updated: 'Uppdaterad',
            statusChanged: 'Status ändrad',
            rollback: 'Återställd',
            generic: 'Ändring'
        }
    },
    goalForm: {
        editTitle: 'Redigera mål',
        createTitle: 'Nytt mål',
        confirmDelete: 'Vill du verkligen ta bort det här målet?'
    },
    errors: {
        goalUpdateFailed: 'Uppdateringen av målet misslyckades.',
        goalSaveFailed: 'Det gick inte att spara målet.',
        revertNotPossible: 'Går inte att återställa.',
        goalNotFound: 'Målet hittades inte.',
        statusChangeFailed: 'Statusändringen misslyckades.'
    },
    allGoals: {
        openGoalAria: 'Öppna mål {{title}}'
    },
    tables: {
        allGoals: {
            headers: {
                title: 'Titel',
                status: 'Status',
                priority: 'Prioritet',
                motivation: 'Motivation',
                urgency: 'Brådska',
                deadline: 'Deadline',
                lastUpdated: 'Senast uppdaterad'
            },
            emptyState: 'Inga mål matchar de aktuella filtren.'
        }
    },
    import: {
        success: 'Data importerades utan problem!',
        error: 'Importen misslyckades: {{message}}'
    }
};

export default sv;

