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
        overview: 'Übersicht',
        checkIn: 'Review',
        settings: 'Einstellungen',
        help: 'Hilfe',
        goToDashboard: 'Zum Dashboard'
    },
    actions: {
        export: 'Export',
        import: 'Import',
        addGoal: '+ Neues Ziel'
    },
    sections: {
        dashboard: 'Dashboard',
        allGoals: 'Alle Ziele',
        checkIn: 'Review',
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
        includeNotCompleted: 'Nicht erreichte anzeigen',
        clearFilter: 'Filter zurücksetzen',
        statusOptions: {
            all: 'Alle Status',
            active: 'Aktiv',
            inactive: 'Inaktiv',
            paused: 'Pausiert',
            completed: 'Erreicht',
            notCompleted: 'Nicht erreicht'
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
        deadlineClickable: 'Klicken, um die Deadline zu bearbeiten',
        actions: {
            edit: 'Bearbeiten',
            complete: 'Abschließen',
            pause: 'Pausieren'
        },
        paused: {
            untilToday: '⏸️ Pausiert bis heute',
            untilTomorrow: '⏸️ Pausiert bis morgen',
            untilDate: '⏸️ Pausiert bis {{date}}',
            untilGoal: '⏸️ Pausiert bis "{{goalTitle}}" abgeschlossen ist'
        },
        inline: {
            deadline: 'Deadline',
            motivation: 'Motivation',
            urgency: 'Dringlichkeit'
        },
        steps: {
            title: 'Schritte',
            add: 'Schritt hinzufügen',
            placeholder: 'Schritt eingeben...',
            empty: 'Noch keine Schritte',
            delete: 'Schritt löschen'
        },
        resources: {
            title: 'Ressourcen',
            add: 'Ressource hinzufügen',
            placeholder: 'Ressource eingeben...',
            empty: 'Noch keine Ressourcen',
            delete: 'Ressource löschen',
            types: {
                general: 'Allgemein',
                contact: 'Kontakt',
                group: 'Gruppe',
                institution: 'Institution',
                knowledge: 'Wissen',
                financial: 'Finanziell'
            }
        },
        recurring: {
            badge: 'Wiederkehrend',
            stats: 'Wiederholungen: {{recurCount}} | Erreicht: {{completionCount}} | Nicht erreicht: {{notCompletedCount}}'
        }
    },
    settingsPanel: {
        maxActiveGoals: 'Maximale aktive Ziele:',
        reviewIntervals: 'Review-Intervalle (Suffixe d/h/m/s erlaubt):',
        reviewIntervalsHelp: 'Beispiele: 30d, 14d, 12h, 45m, 30s.',
        languageLabel: 'Sprache',
        dataManagement: 'Datenverwaltung',
        dataManagementHelp: 'Exportieren Sie Ihre Daten zur Sicherung oder importieren Sie zuvor exportierte Daten.',
        googleDriveSync: 'Google Drive Synchronisation',
        googleDriveSyncHelp: 'Synchronisieren Sie Ihre Zieldaten mit Google Drive für Backup und Multi-Device-Zugriff.',
        save: 'Speichern'
    },
    goalModal: {
        titleLabel: 'Titel *',
        descriptionLabel: 'Beschreibung',
        motivationLabel: 'Motivation (1-5) *',
        urgencyLabel: 'Dringlichkeit (1-5) *',
        deadlineLabel: 'Deadline (optional)',
        recurringLabel: 'Wiederkehrendes Ziel',
        recurringHelp: 'Dieses Ziel wiederholt sich nach Abschluss',
        recurPeriodLabel: 'Wiederholungszeitraum',
        recurPeriodHelp: 'Das Ziel wiederholt sich nach dieser Anzahl von Perioden',
        periodUnits: {
            days: 'Tage',
            weeks: 'Wochen',
            months: 'Monate'
        },
        actions: {
            save: 'Speichern',
            cancel: 'Abbrechen',
            delete: 'Löschen'
        },
        stateManagement: {
            title: 'Ziel-Status',
            complete: 'Abschließen',
            notComplete: 'Nicht erreicht',
            unpause: 'Fortsetzen',
            reactivate: 'Reaktivieren',
            help: 'Verwalte den Lebenszyklus dieses Ziels.',
            confirmComplete: 'Dieses Ziel als abgeschlossen markieren?',
            confirmNotComplete: 'Dieses Ziel als nicht erreicht markieren?'
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
        makeRecurring: 'Dieses Ziel wiederholen',
        recurDate: 'Wiederholungsdatum',
        recurDateRequired: 'Bitte wähle ein Wiederholungsdatum',
        nextRecurrence: 'Nächste Wiederholung:'
    },
    pauseModal: {
        title: 'Ziel pausieren',
        description: 'Wähle, wann dieses Ziel wieder aktiv werden soll:',
        untilDate: 'Bis zu einem bestimmten Datum',
        untilGoal: 'Bis ein anderes Ziel abgeschlossen ist',
        selectGoal: 'Wähle ein Ziel...',
        noGoalsAvailable: 'Keine anderen Ziele verfügbar',
        confirm: 'Pausieren',
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
        inactive: 'Inaktiv',
        paused: 'Pausiert',
        completed: 'Erreicht',
        notCompleted: 'Nicht erreicht'
    },
    reviews: {
        prompt: 'Zeit für ein Review zu "{{title}}". Bitte bestätige Motivation und Dringlichkeit.',
        emptyState: 'Alle Ziele sind auf dem neuesten Stand. Schau später noch einmal vorbei.',
        sequence: 'Ziel {{current}} von {{total}}',
        fields: {
            motivation: 'Motivation',
            urgency: 'Dringlichkeit'
        },
        status: {
            stable: 'Bewertung stabil'
        },
        due: {
            unknown: 'Review geplant',
            today: 'Heute fällig',
            overdue: 'Überfällig seit {{count}} Tagen'
        },
        feedback: {
            stable: 'Bewertungen für "{{title}}" bleiben stabil. Nächstes Review in {{interval}}.',
            updated: 'Bewertungen für "{{title}}" aktualisiert. Nächstes Review in {{interval}}.'
        },
        actions: {
            done: 'Review abgeschlossen',
            edit: 'Ziel bearbeiten'
        },
        interval: {
            unknown: 'bald',
            days: 'in etwa {{count}} Tag(en)',
            hours: 'in etwa {{count}} Stunde(n)',
            minutes: 'in etwa {{count}} Minute(n)',
            seconds: 'in etwa {{count}} Sekunde(n)'
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
        generic: 'Ein Fehler ist aufgetreten: {{message}}',
        goalUpdateFailed: 'Aktualisierung des Ziels fehlgeschlagen.',
        goalSaveFailed: 'Speichern des Ziels fehlgeschlagen.',
        revertNotPossible: 'Zurücksetzen nicht möglich.',
        goalNotFound: 'Ziel nicht gefunden.',
        statusChangeFailed: 'Statusänderung fehlgeschlagen.',
        titleRequired: 'Der Titel darf nicht leer sein.'
    },
    allGoals: {
        openGoalAria: 'Ziel {{title}} öffnen',
        forceActivate: 'Erzwingen aktivieren',
        forceActivateAria: 'Ziel {{title}} erzwingen aktivieren',
        forceActivated: 'Erzwungen aktiviert',
        forceActivatedAria: 'Dieses Ziel wurde erzwungen aktiviert'
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
                lastUpdated: 'Letzte Änderung',
                actions: 'Aktionen'
            },
            emptyState: 'Keine Ziele vorhanden, die den aktuellen Filtern entsprechen.'
        }
    },
    import: {
        success: 'Daten erfolgreich importiert!',
        error: 'Fehler beim Importieren: {{message}}',
        invalidJson: 'Import fehlgeschlagen: Die Datei enthält kein gültiges JSON.',
        invalidStructure: 'Import fehlgeschlagen: Das Dateiformat ist nicht kompatibel.',
        invalidVersionFormat: 'Import fehlgeschlagen: Unbekannte Version "{{version}}".',
        versionTooNew: 'Import blockiert: Die Datei-Version {{fileVersion}} ist neuer als die unterstützte Version {{currentVersion}}.',
        incompatible: 'Import fehlgeschlagen: Die Datei ist mit dieser Goaly-Version nicht kompatibel.',
        migrationCancelled: 'Import abgebrochen. Die Datei wurde nicht migriert.'
    },
    migration: {
        prompt: {
            title: 'Migration erforderlich',
            message: '„{{fileName}}“ verwendet Version {{fromVersion}}. Soll die Datei vor dem Import auf {{toVersion}} migriert werden?',
            messageLegacy: '„{{fileName}}" enthält keine Versionsinformation. Soll die Datei vor dem Import auf {{toVersion}} migriert werden?',
            reviewCta: 'Änderungen prüfen',
            cancel: 'Abbrechen',
            unnamedFile: 'Unbenannter Export',
            legacyVersion: 'einem älteren Format'
        },
        diff: {
            title: 'Migrationsvorschau für {{fileName}}',
            subtitle: 'Vergleich {{fromVersion}} → {{toVersion}}',
            originalLabel: 'Original',
            updatedLabel: 'Migrierte Version',
            applyCta: 'Migration anwenden',
            cancel: 'Abbrechen'
        }
    },
    googleDrive: {
        signIn: 'Mit Google anmelden',
        signOut: 'Abmelden',
        syncNow: 'Jetzt synchronisieren',
        authenticated: 'Mit Google authentifiziert',
        lastSynced: 'Zuletzt synchronisiert: {{time}}',
        syncing: 'Synchronisiere...',
        syncSuccess: 'Synchronisation erfolgreich abgeschlossen',
        syncError: 'Synchronisation fehlgeschlagen: {{message}}',
        uploadSuccess: 'Daten zu Google Drive hochgeladen',
        downloadSuccess: 'Daten von Google Drive heruntergeladen',
        conflictDetected: 'Konflikt erkannt: {{message}}',
        conflictNewerRemote: 'Remote-Daten sind neuer. Herunterladen, um lokale Daten zu überschreiben?',
        conflictOlderVersion: 'Remote-Daten verwenden eine ältere Version. Hochladen, um Remote-Daten zu überschreiben?',
        conflictNewerVersion: 'Remote-Daten verwenden eine neuere Version. Herunterladen, um lokale Daten zu aktualisieren?',
        notConfigured: 'Google Drive Synchronisation ist nicht konfiguriert. Bitte GOOGLE_API_KEY und GOOGLE_CLIENT_ID setzen.',
        authError: 'Authentifizierung fehlgeschlagen: {{message}}',
        uploadError: 'Upload fehlgeschlagen: {{message}}',
        downloadError: 'Download fehlgeschlagen: {{message}}',
        testerOnly: 'Google Drive Synchronisation ist derzeit nur für Tester verfügbar. Senden Sie Ihr Google-E-Mail-Konto an den Entwickler, um Testzugang zu erhalten.',
        noChanges: 'Keine Änderungen zum Synchronisieren. Alles ist auf dem neuesten Stand.',
        status: {
            buildingLocalPayload: 'Lokale Daten für die Synchronisation werden vorbereitet…',
            checkingRemote: 'Remote-Daten werden geprüft…',
            remoteFound: 'Remote-Daten gefunden und erfolgreich heruntergeladen.',
            noRemote: 'Keine Remote-Daten gefunden. Es wird eine neue Sicherung erstellt.',
            merging: 'Änderungen werden zusammengeführt (lokal/remote/basis)…',
            applying: 'Zusammengeführte Daten werden lokal angewendet…',
            uploading: 'Zusammengeführte Daten werden zu Google Drive hochgeladen…'
        }
    },

    help: {
        title: 'Hilfe',
        description: 'Hast du einen Fehler gefunden oder möchtest du ein neues Feature anfragen? Wir würden uns über dein Feedback freuen!',
        reportBug: 'Fehler melden',
        reportBugHelp: 'Hast du etwas gefunden, das nicht funktioniert? Lass es uns wissen!',
        reportBugButton: 'Fehler melden',
        requestFeature: 'Feature anfragen',
        requestFeatureHelp: 'Hast du eine Idee für ein neues Feature? Wir würden sie gerne hören!',
        requestFeatureButton: 'Feature anfragen'
    },

    overview: {
        title: 'Übersicht',
        periodSelector: {
            week: 'Woche',
            month: 'Monat',
            year: 'Jahr'
        },
        charts: {
            goalsOverTime: 'Ziele im Zeitverlauf',
            statusDistribution: 'Statusverteilung',
            created: 'Erstellt',
            completed: 'Erreicht',
            notCompleted: 'Nicht erreicht'
        },
        stats: {
            totalGoals: 'Gesamtziele',
            completedGoals: 'Erreicht',
            completionRate: 'Erfolgsquote',
            avgPerPeriod: 'Ø pro {{period}}'
        },
        empty: 'Noch keine Ziele zum Analysieren. Erstelle dein erstes Ziel!'
    }
};

export default de;

