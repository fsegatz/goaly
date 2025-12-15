const sv = {
    language: {
        names: {
            en: 'Engelska',
            de: 'Tyska',
            sv: 'Svenska'
        }
    },
    meta: {
        title: 'Goaly - MÃ¥luppfÃ¶ljning'
    },
    navigation: {
        dashboard: 'Dashboard',
        allGoals: 'Alla mÃ¥l',
        checkIn: 'Review',
        settings: 'InstÃ¤llningar',
        help: 'HjÃ¤lp',
        goToDashboard: 'GÃ¥ till Dashboard'
    },
    actions: {
        export: 'Exportera',
        import: 'Importera',
        addGoal: '+ Nytt mÃ¥l'
    },
    sections: {
        dashboard: 'Dashboard',
        allGoals: 'Alla mÃ¥l',
        checkIn: 'Review',
        settings: 'InstÃ¤llningar'
    },
    common: {
        save: 'Spara',
        cancel: 'Avbryt'
    },
    filters: {
        statusLabel: 'Status',
        minPriorityLabel: 'Minsta prioritet',
        sortLabel: 'Sortering',
        includeCompleted: 'Visa slutfÃ¶rda',
        includeAbandoned: 'Visa avbrutna',
        clearFilter: 'Rensa filter',
        statusOptions: {
            all: 'Alla statusar',
            active: 'Aktiv',
            inactive: 'Inaktiv',
            paused: 'Pausad',
            completed: 'SlutfÃ¶rd',
            notCompleted: 'Inte slutförd'
        },
        sortOptions: {
            priorityDesc: 'Prioritet (hÃ¶g â†’ lÃ¥g)',
            priorityAsc: 'Prioritet (lÃ¥g â†’ hÃ¶g)',
            updatedDesc: 'Senaste Ã¤ndring (ny â†’ gammal)',
            updatedAsc: 'Senaste Ã¤ndring (gammal â†’ ny)'
        }
    },
    dashboard: {
        noActiveGoals: 'Inga aktiva mÃ¥l. Skapa ditt fÃ¶rsta mÃ¥l!'
    },
    goalCard: {
        descriptionAria: 'Redigera beskrivning',
        descriptionPlaceholder: 'LÃ¤gg till en beskrivning...',
        priorityLabel: 'Prioritet',
        deadlinePrefix: 'ðŸ“… {{deadline}}',
        noDeadline: 'Ingen deadline',
        actions: {
            edit: 'Redigera',
            complete: 'SlutfÃ¶r',
            pause: 'Pausa'
        },
        paused: {
            untilToday: 'â¸ï¸ Pausad till idag',
            untilTomorrow: 'â¸ï¸ Pausad till imorgon',
            untilDate: 'â¸ï¸ Pausad till {{date}}',
            untilGoal: 'â¸ï¸ Pausad tills "{{goalTitle}}" Ã¤r slutfÃ¶rt'
        },
        inline: {
            deadline: 'Deadline',
            motivation: 'Motivation',
            urgency: 'BrÃ¥dska'
        }
    },
    settingsPanel: {
        maxActiveGoals: 'Maximalt antal aktiva mÃ¥l:',
        reviewIntervals: 'UtvÃ¤rderingsintervall (stÃ¶d fÃ¶r suffix d/h/m/s):',
        reviewIntervalsHelp: 'Exempel: 30d, 14d, 12h, 45m, 30s.',
        languageLabel: 'SprÃ¥k',
        dataManagement: 'Datahantering',
        dataManagementHelp: 'Exportera dina data fÃ¶r sÃ¤kerhetskopiering eller importera tidigare exporterade data.',
        googleDriveSync: 'Google Drive-synkronisering',
        googleDriveSyncHelp: 'Synkronisera dina mÃ¥ldata med Google Drive fÃ¶r sÃ¤kerhetskopiering och flerenhetsÃ¥tkomst.',
        save: 'Spara'
    },
    goalModal: {
        titleLabel: 'Titel *',
        descriptionLabel: 'Beskrivning',
        motivationLabel: 'Motivation (1-5) *',
        urgencyLabel: 'BrÃ¥dska (1-5) *',
        deadlineLabel: 'Deadline (valfritt)',
        actions: {
            save: 'Spara',
            cancel: 'Avbryt',
            delete: 'Ta bort'
        },
        stateManagement: {
            title: 'MÃ¥lstatus',
            complete: 'SlutfÃ¶r',
            abandon: 'Avbryt',
            unpause: 'Ã…teruppta',
            reactivate: 'Ã…teraktivera',
            help: 'Hantera livscykeln fÃ¶r detta mÃ¥l.',
            confirmComplete: 'Markera detta mÃ¥l som slutfÃ¶rt?',
            confirmAbandon: 'Avbryt detta mÃ¥l? Denna Ã¥tgÃ¤rd kan inte Ã¥ngras.'
        }
    },
    goalHistory: {
        title: 'Historik'
    },
    completionModal: {
        title: 'SlutfÃ¶r mÃ¥l',
        question: 'UppnÃ¥dde du mÃ¥let?',
        success: 'MÃ¥l slutfÃ¶rt',
        failure: 'Inte slutfÃ¶rt'
    },
    pauseModal: {
        title: 'Pausa mÃ¥l',
        description: 'VÃ¤lj nÃ¤r detta mÃ¥l ska bli aktivt igen:',
        untilDate: 'Till ett specifikt datum',
        untilGoal: 'Tills ett annat mÃ¥l Ã¤r slutfÃ¶rt',
        selectGoal: 'VÃ¤lj ett mÃ¥l...',
        confirm: 'Pausa',
        cancel: 'Avbryt'
    },
    deadline: {
        overdue: 'FÃ¶rsenad ({{count}} dagar)',
        today: 'Idag',
        tomorrow: 'Imorgon',
        inDays: 'Om {{count}} dagar'
    },
    status: {
        active: 'Aktiv',
        inactive: 'Inaktiv',
        paused: 'Pausad',
        completed: 'SlutfÃ¶rd',
        notCompleted: 'Inte slutförd'
    },
    reviews: {
        prompt: 'Dags fÃ¶r ett review fÃ¶r "{{title}}". BekrÃ¤fta motivation och brÃ¥dska.',
        emptyState: 'Alla mÃ¥l Ã¤r uppdaterade. Titta in igen senare.',
        sequence: 'MÃ¥l {{current}} av {{total}}',
        fields: {
            motivation: 'Motivation',
            urgency: 'BrÃ¥dska'
        },
        status: {
            stable: 'Stabil bedÃ¶mning'
        },
        due: {
            unknown: 'Granskning planerad',
            today: 'FÃ¶rfaller idag',
            overdue: 'FÃ¶rsenad med {{count}} dagar'
        },
        feedback: {
            stable: 'BedÃ¶mningarna fÃ¶r "{{title}}" Ã¤r stabila. NÃ¤sta uppfÃ¶ljning om {{interval}}.',
            updated: 'BedÃ¶mningarna fÃ¶r "{{title}}" har uppdaterats. NÃ¤sta uppfÃ¶ljning om {{interval}}.'
        },
        actions: {
            done: 'Review slutfÃ¶rt',
            edit: 'Redigera mÃ¥l'
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
        empty: 'Inga Ã¤ndringar registrerade Ã¤nnu.',
        revertButton: 'Ã…terstÃ¤ll till den hÃ¤r versionen',
        confirmRevert: 'Vill du verkligen Ã¥terstÃ¤lla mÃ¥let till den hÃ¤r versionen?',
        fields: {
            title: 'Titel',
            description: 'Beskrivning',
            motivation: 'Motivation',
            urgency: 'BrÃ¥dska',
            deadline: 'Deadline',
            status: 'Status',
            priority: 'Prioritet'
        },
        events: {
            created: 'Skapad',
            updated: 'Uppdaterad',
            statusChanged: 'Status Ã¤ndrad',
            rollback: 'Ã…terstÃ¤lld',
            generic: 'Ã„ndring'
        }
    },
    goalForm: {
        editTitle: 'Redigera mÃ¥l',
        createTitle: 'Nytt mÃ¥l',
        confirmDelete: 'Vill du verkligen ta bort det hÃ¤r mÃ¥let?'
    },
    errors: {
        generic: 'Ett fel uppstod: {{message}}',
        goalUpdateFailed: 'Uppdateringen av mÃ¥let misslyckades.',
        goalSaveFailed: 'Det gick inte att spara mÃ¥let.',
        revertNotPossible: 'GÃ¥r inte att Ã¥terstÃ¤lla.',
        goalNotFound: 'MÃ¥let hittades inte.',
        statusChangeFailed: 'StatusÃ¤ndringen misslyckades.',
        titleRequired: 'Titeln fÃ¥r inte vara tom.'
    },
    allGoals: {
        openGoalAria: 'Ã–ppna mÃ¥l {{title}}',
        forceActivate: 'Tvinga aktivering',
        forceActivateAria: 'Tvinga aktivering av mÃ¥l {{title}}',
        forceActivated: 'Tvingad aktiverad',
        forceActivatedAria: 'Detta mÃ¥l tvingades aktiveras'
    },
    tables: {
        allGoals: {
            headers: {
                title: 'Titel',
                status: 'Status',
                priority: 'Prioritet',
                motivation: 'Motivation',
                urgency: 'BrÃ¥dska',
                deadline: 'Deadline',
                lastUpdated: 'Senast uppdaterad',
                actions: 'Ã…tgÃ¤rder'
            },
            emptyState: 'Inga mÃ¥l matchar de aktuella filtren.'
        }
    },
    import: {
        success: 'Data importerades utan problem!',
        error: 'Importen misslyckades: {{message}}',
        invalidJson: 'Importen misslyckades: Filen innehÃ¥ller inte giltig JSON.',
        invalidStructure: 'Importen misslyckades: Filformatet Ã¤r inte kompatibelt.',
        invalidVersionFormat: 'Importen misslyckades: OkÃ¤nd version "{{version}}".',
        versionTooNew: 'Import blockeras: Filversion {{fileVersion}} Ã¤r nyare Ã¤n den stÃ¶dda versionen {{currentVersion}}.',
        incompatible: 'Importen misslyckades: Filen Ã¤r inte kompatibel med denna version av Goaly.',
        migrationCancelled: 'Importen avbrÃ¶ts. Filen migrerades inte.'
    },
    migration: {
        prompt: {
            title: 'Migration krÃ¤vs',
            message: '"{{fileName}}" anvÃ¤nder version {{fromVersion}}. Vill du migrera den till {{toVersion}} innan import?',
            messageLegacy: '"{{fileName}}" saknar versionsinformation. Vill du migrera den till {{toVersion}} innan import?',
            reviewCta: 'Granska Ã¤ndringar',
            cancel: 'Avbryt',
            unnamedFile: 'NamnlÃ¶s export',
            legacyVersion: 'ett Ã¤ldre format'
        },
        diff: {
            title: 'MigrationsÃ¶versikt fÃ¶r {{fileName}}',
            subtitle: 'JÃ¤mfÃ¶r {{fromVersion}} â†’ {{toVersion}}',
            originalLabel: 'Original',
            updatedLabel: 'Migrerad version',
            applyCta: 'AnvÃ¤nd migration',
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
        syncSuccess: 'Synkronisering slutfÃ¶rd',
        syncError: 'Synkronisering misslyckades: {{message}}',
        uploadSuccess: 'Data uppladdad till Google Drive',
        downloadSuccess: 'Data nedladdad frÃ¥n Google Drive',
        conflictDetected: 'Konflikt upptÃ¤ckt: {{message}}',
        conflictNewerRemote: 'FjÃ¤rrdata Ã¤r nyare. Ladda ner fÃ¶r att skriva Ã¶ver lokal data?',
        conflictOlderVersion: 'FjÃ¤rrdata anvÃ¤nder en Ã¤ldre version. Ladda upp fÃ¶r att skriva Ã¶ver fjÃ¤rrdata?',
        conflictNewerVersion: 'FjÃ¤rrdata anvÃ¤nder en nyare version. Ladda ner fÃ¶r att uppdatera lokal data?',
        notConfigured: 'Google Drive-synkronisering Ã¤r inte konfigurerad. VÃ¤nligen ange GOOGLE_API_KEY och GOOGLE_CLIENT_ID.',
        authError: 'Autentisering misslyckades: {{message}}',
        uploadError: 'Uppladdning misslyckades: {{message}}',
        downloadError: 'Nedladdning misslyckades: {{message}}',
        testerOnly: 'Google Drive-synkronisering Ã¤r fÃ¶r nÃ¤rvarande endast tillgÃ¤nglig fÃ¶r testare. Skicka ditt Google-e-postkonto till utvecklaren fÃ¶r att bevilja testÃ¥tkomst.',
        noChanges: 'Inga Ã¤ndringar att synkronisera. Allt Ã¤r uppdaterat.',
        status: {
            buildingLocalPayload: 'FÃ¶rbereder lokal data fÃ¶r synkroniseringâ€¦',
            checkingRemote: 'Kontrollerar fjÃ¤rrdataâ€¦',
            remoteFound: 'FjÃ¤rrdata hittades och har laddats ner.',
            noRemote: 'Ingen fjÃ¤rrdata hittades. En ny sÃ¤kerhetskopia skapas.',
            merging: 'SlÃ¥r samman Ã¤ndringar (lokal/fjÃ¤rr/bas)â€¦',
            applying: 'TillÃ¤mpa sammanslagen data lokaltâ€¦',
            uploading: 'Laddar upp sammanslagen data till Google Driveâ€¦'
        }
    },

    help: {
        title: 'HjÃ¤lp',
        description: 'Har du hittat en bugg eller vill du begÃ¤ra en ny funktion? Vi skulle gÃ¤rna hÃ¶ra frÃ¥n dig!',
        reportBug: 'Rapportera en bugg',
        reportBugHelp: 'Har du hittat nÃ¥got som inte fungerar? LÃ¥t oss veta!',
        reportBugButton: 'Rapportera bugg',
        requestFeature: 'BegÃ¤r en funktion',
        requestFeatureHelp: 'Har du en idÃ© fÃ¶r en ny funktion? Vi skulle gÃ¤rna hÃ¶ra den!',
        requestFeatureButton: 'BegÃ¤r funktion'
    }
};

export default sv;



