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
        checkIn: 'Review',
        settings: 'Inställningar',
        help: 'Hjälp',
        goToDashboard: 'Gå till Dashboard'
    },
    actions: {
        export: 'Exportera',
        import: 'Importera',
        addGoal: '+ Nytt mål'
    },
    sections: {
        dashboard: 'Dashboard',
        allGoals: 'Alla mål',
        checkIn: 'Review',
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
        clearFilter: 'Rensa filter',
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
            complete: 'Slutför',
            pause: 'Pausa'
        },
        paused: {
            untilToday: '⏸️ Pausad till idag',
            untilTomorrow: '⏸️ Pausad till imorgon',
            untilDate: '⏸️ Pausad till {{date}}',
            untilGoal: '⏸️ Pausad tills "{{goalTitle}}" är slutfört'
        },
        inline: {
            deadline: 'Deadline',
            motivation: 'Motivation',
            urgency: 'Brådska'
        }
    },
    settingsPanel: {
        maxActiveGoals: 'Maximalt antal aktiva mål:',
        reviewIntervals: 'Utvärderingsintervall (stöd för suffix d/h/m/s):',
        reviewIntervalsHelp: 'Exempel: 30d, 14d, 12h, 45m, 30s.',
        languageLabel: 'Språk',
        dataManagement: 'Datahantering',
        dataManagementHelp: 'Exportera dina data för säkerhetskopiering eller importera tidigare exporterade data.',
        googleDriveSync: 'Google Drive-synkronisering',
        googleDriveSyncHelp: 'Synkronisera dina måldata med Google Drive för säkerhetskopiering och flerenhetsåtkomst.',
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
    pauseModal: {
        title: 'Pausa mål',
        description: 'Välj när detta mål ska bli aktivt igen:',
        untilDate: 'Till ett specifikt datum',
        untilGoal: 'Tills ett annat mål är slutfört',
        selectGoal: 'Välj ett mål...',
        confirm: 'Pausa',
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
    reviews: {
        prompt: 'Dags för ett review för "{{title}}". Bekräfta motivation och brådska.',
        emptyState: 'Alla mål är uppdaterade. Titta in igen senare.',
        sequence: 'Mål {{current}} av {{total}}',
        fields: {
            motivation: 'Motivation',
            urgency: 'Brådska'
        },
        status: {
            stable: 'Stabil bedömning'
        },
        due: {
            unknown: 'Granskning planerad',
            today: 'Förfaller idag',
            overdue: 'Försenad med {{count}} dagar'
        },
        feedback: {
            stable: 'Bedömningarna för "{{title}}" är stabila. Nästa uppföljning om {{interval}}.',
            updated: 'Bedömningarna för "{{title}}" har uppdaterats. Nästa uppföljning om {{interval}}.'
        },
        actions: {
            done: 'Review slutfört',
            edit: 'Redigera mål'
        },
        interval: {
            unknown: 'snart',
            days: 'om cirka {{count}} dag(ar)',
            hours: 'om cirka {{count}} timme/timmar',
            minutes: 'om cirka {{count}} minut(er)',
            seconds: 'om cirka {{count}} sekund(er)'
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
        statusChangeFailed: 'Statusändringen misslyckades.',
        titleRequired: 'Titeln får inte vara tom.'
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
        error: 'Importen misslyckades: {{message}}',
        invalidJson: 'Importen misslyckades: Filen innehåller inte giltig JSON.',
        invalidStructure: 'Importen misslyckades: Filformatet är inte kompatibelt.',
        invalidVersionFormat: 'Importen misslyckades: Okänd version "{{version}}".',
        versionTooNew: 'Import blockeras: Filversion {{fileVersion}} är nyare än den stödda versionen {{currentVersion}}.',
        incompatible: 'Importen misslyckades: Filen är inte kompatibel med denna version av Goaly.',
        migrationCancelled: 'Importen avbröts. Filen migrerades inte.'
    },
    migration: {
        prompt: {
            title: 'Migration krävs',
            message: '"{{fileName}}" använder version {{fromVersion}}. Vill du migrera den till {{toVersion}} innan import?',
            messageLegacy: '"{{fileName}}" saknar versionsinformation. Vill du migrera den till {{toVersion}} innan import?',
            reviewCta: 'Granska ändringar',
            cancel: 'Avbryt',
            unnamedFile: 'Namnlös export',
            legacyVersion: 'ett äldre format'
        },
        diff: {
            title: 'Migrationsöversikt för {{fileName}}',
            subtitle: 'Jämför {{fromVersion}} → {{toVersion}}',
            originalLabel: 'Original',
            updatedLabel: 'Migrerad version',
            applyCta: 'Använd migration',
            cancel: 'Avbryt'
        }
    },
    googleDrive: {
        signIn: 'Logga in med Google',
        signOut: 'Logga ut',
        syncNow: 'Synkronisera nu',
        authenticated: 'Autentiserad med Google',
        lastSynced: 'Senast synkroniserad: {{time}}',
        syncing: 'Synkroniserar...',
        syncSuccess: 'Synkronisering slutförd',
        syncError: 'Synkronisering misslyckades: {{message}}',
        uploadSuccess: 'Data uppladdad till Google Drive',
        downloadSuccess: 'Data nedladdad från Google Drive',
        conflictDetected: 'Konflikt upptäckt: {{message}}',
        conflictNewerRemote: 'Fjärrdata är nyare. Ladda ner för att skriva över lokal data?',
        conflictOlderVersion: 'Fjärrdata använder en äldre version. Ladda upp för att skriva över fjärrdata?',
        conflictNewerVersion: 'Fjärrdata använder en nyare version. Ladda ner för att uppdatera lokal data?',
        notConfigured: 'Google Drive-synkronisering är inte konfigurerad. Vänligen ange GOOGLE_API_KEY och GOOGLE_CLIENT_ID.',
        authError: 'Autentisering misslyckades: {{message}}',
        uploadError: 'Uppladdning misslyckades: {{message}}',
        downloadError: 'Nedladdning misslyckades: {{message}}',
        testerOnly: 'Google Drive-synkronisering är för närvarande endast tillgänglig för testare. Skicka ditt Google-e-postkonto till utvecklaren för att bevilja teståtkomst.',
        noChanges: 'Inga ändringar att synkronisera. Allt är uppdaterat.',
        status: {
            buildingLocalPayload: 'Förbereder lokal data för synkronisering…',
            checkingRemote: 'Kontrollerar fjärrdata…',
            remoteFound: 'Fjärrdata hittades och har laddats ner.',
            noRemote: 'Ingen fjärrdata hittades. En ny säkerhetskopia skapas.',
            merging: 'Slår samman ändringar (lokal/fjärr/bas)…',
            applying: 'Tillämpa sammanslagen data lokalt…',
            uploading: 'Laddar upp sammanslagen data till Google Drive…'
        }
    },
    help: {
        title: 'Hjälp',
        description: 'Har du hittat en bugg eller vill du begära en ny funktion? Vi skulle gärna höra från dig!',
        reportBug: 'Rapportera en bugg',
        reportBugHelp: 'Har du hittat något som inte fungerar? Låt oss veta!',
        reportBugButton: 'Rapportera bugg',
        requestFeature: 'Begär en funktion',
        requestFeatureHelp: 'Har du en idé för en ny funktion? Vi skulle gärna höra den!',
        requestFeatureButton: 'Begär funktion'
    }
};

export default sv;

