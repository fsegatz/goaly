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

Nutzungsszenario:
- Nutzer definiert drei Ziele: 
    - Marathon trainieren (Motivation 2, Dringlichkeit 4, Deadline in 3 Monaten), 
    - Spanisch lernen (Motivation 4, Dringlichkeit 3, keine Deadline), 
    - ein Buch schreiben (Motivation 3, Dringlichkeit 2, keine Deadline).
    - Sixpack bekommen (Motivation 3, Dringlichkeit 5, 6 Monate)
- Nutzer entscheidet, nur zwei Ziele gleichzeitig zu verfolgen.
- Im Dashboard sieht der Nutzer die Fortschritte beim Marathontraining und Sixpack bekommen da diese Zeile höchste Dringlichkeit haben. 
- Nach 3 Tagen wird der Nutzer gefragt, ob die Motivation und Dringlichkeit für das Spanisch lernen noch aktuell sind.
- Der Nutzer passt die Motivation für das Spanisch lernen auf 5 an, da er kürzlich eine Reise nach Spanien geplant hat
- Das Dashboard aktualisiert sich und zeigt nun Spanisch lernen anstatt Marathon trainieren, da die Dringlichkeit gleich ist bleibt, aber die Motivation für Spanisch lernen höher ist.
- Der Nutzer verwendet Goaly täglich für 10 Minuten morgens um seine Fortschritte zu überprüfen und anzupassen.

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