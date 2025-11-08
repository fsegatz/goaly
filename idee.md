### Goaly - Zielverfolgungs-App

Beschreibung: Hilft dir, deine Ziele zu setzen und zu verfolgen.

Problemstellung und Motivation:
- Viele Menschen haben Schwierigkeiten, ihre Ziele zu verfolgen und zu erreichen.
- Zu viele Ziele gleichzeitig können überwältigend sein.
- Goaly hilft, den Fokus zu behalten und die Motivation aufrechtzuerhalten.

Funktionalität:
1. Ziele definieren
2. Ziele quantifizieren: Motivation und Dringlichkeit (1-5) Deadline (Datum)
3. Wie viele Ziele du gleichzeitig verfolgen willst
4. Dashboard: 
    - Übersicht über aktuelle Ziele
    - Schritte tracken, Resourcen anzeigen, Teilschritte und Bedingungen festlegen
    - Priorisierung basierend auf Motivation und Dringlichkeit
    - Zeigt andere Ziele mit gewisser Frequenz an um Motivation und Dringlichkeit zu überprüfen
        - z.B erstes mal nach 3 Tagen, wenn Dringlichkeit oder Motivation gleich bleiben, dann nach 7 Tagen, dann nach 14 Tagen, dann nach 1 Monat
5. Benachrichtigungen: Erinnerungen und Updates zu Zielen um Nutzer regemäß zu motivieren
6. Webapp damit von überall zugänglich

Implementierung:
    - Option 1:
        - Frontend: Statische Webapp
        - Backend: Hosted server mit API und Datenbank
    - Option 2:
        - Frontend: Statishe Webapp
        - Datenhaltung: Local Storage des Browsers (Cache), User kann Daten exportieren und importieren um sie zu sichern
    - Option 3:
        - Frontend: Statische Webapp
        - Backend: Firebase (Datenbank und Authentifizierung)

Blacklist:
- Streamlit nicht verwenden, weil es keine statische Webapp ist.

Weitere Wünsche:
- Benutzeroberflächenübergreifende UI (Desktop, Mobile, Web)
- Heute nen ersten Prototypen bauen und life gehen -> Set priorities
- Don't overengineer
- No cost / no paid services 
- Project in Packages aufteilen -> Parallel entwicklung
- Zweck: Training von AI-assisted software development

Erste Schritte:
- Recherchiere frameworks und hosting möglichkeiten um ne option zu wählen
