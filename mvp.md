# MVP — Goaly

Ziel
----
Schnell eine einfache, nutzbare Webapp liefern, die den Kernnutzen von Goaly zeigt: Nutzer können Ziele anlegen, priorisieren und kurz-/mittelfristig verfolgen.

Kern-User-Stories
------------------
- Als Nutzer möchte ich ein Ziel anlegen können (Titel, Beschreibung, Motivation 1–5, Dringlichkeit 1–5, optionale Deadline), damit ich meine Ziele festhalten kann.
- Als Nutzer möchte ich maximal N aktive Ziele gleichzeitig festlegen und eine priorisierte Liste im Dashboard sehen, damit ich mich auf das Wichtigste konzentriere.
- Als Nutzer möchte ich Erinnerungen (simple Benachrichtigungen / E-Mail optional) und die Möglichkeit, Daten zu exportieren/importieren, damit ich informiert bleibe und meine Daten sichern kann.

Minimal-Feature-Set (Scope MVP)
-------------------------------
- Goal CRUD: Erstellen, Lesen, Aktualisieren, Löschen von Zielen, Archivierung/Abschluss von Zielen.
- Attribute: Titel, kurze Beschreibung, Motivation (1–5), Dringlichkeit (1–5), optionale Deadline, Status (aktiv/pausiert/abgeschlossen), Erstellungsdatum, letztes Update-Datum, Aktivitätshistorie.
- Limit für gleichzeitig verfolgte Ziele (Einstellbar, z.B. default 3).
- Dashboard: Anzeige der aktuell aktiven Ziele, sortiert nach Priorität (einfache Formel aus Motivation und Dringlichkeit + Deadline-Bonus). Anzeigen der Ziele deren Dringlichkeit oder Motivation überprüft werden sollten (Check-ins).
- Erinnerungs-Mechanismus: einfache browser-basierte Erinnerungen (oder E-Mail später) für anstehende Deadlines und regelmäßige Check-ins (z.B. T+3 Tage, 7 Tage, 14 Tage).
- Datenhaltung: lokale Persistenz via LocalStorage für die erste Version; Export/Import (JSON) zur Sicherung.
- Einfaches UI: responsive statische Webapp (HTML/CSS/JS). Backend optional in späteren Schritten.
- Jedes Ziel wird als Karte im Dashboard angezeigt mit den wichtigsten Infos (Titel, Deadline, Status, Schritte, Ressourcen, Logbuch).

Akzeptanzkriterien / Tests
--------------------------
- Nutzer kann ein Ziel mit allen Pflichtfeldern anlegen und in der Liste sehen.
- Nutzer kann Ziele aktivieren/deaktivieren
- Dashboard zeigt aktive Ziele in priorisierter Reihenfolge und maximal N Ziele gleichzeitig an.
- Dashboard zeigt aktive Ziele in erwarteter Prioritätsreihenfolge und aktualisiert nach Änderungen.
- Erinnerungs-Check-ins sind sichtbar (für MVP lokal simuliert).
- Export/Import: JSON-Export erzeugt eine Datei/Download; Import stellt Daten wieder her (lokal).

Technische Annahmen für MVP
---------------------------
- Start als statische Webapp mit LocalStorage (kein Server), um schnell live gehen zu können und keine Kosten zu erzeugen.
- UI-first: Fokus auf einfacher, funktionaler UX; Backend (Auth/Sync) kommt später, falls nötig.

Erfolgskriterien (nach Launch MVP)
---------------------------------
- Technisch: Export/Import funktioniert zuverlässig und es gibt keine Datenverluste bei normalen Aktionen
- Ester Prototyp ist live und nutzbar. 

Nächste Schritte
----------------
1. Tech-Stack finalisieren (falls persistente Auth/Sync nötig)
2. Einfacher Prototyp (HTML/CSS/JS) für UI-Flow bauen
3. Nutzerstudie mit 5–10 Testpersonen
