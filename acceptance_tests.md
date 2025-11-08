# Akzeptanztests — Goaly (MVP)

Anleitung
--------
Diese Tests sind für die manuelle Ausführung der MVP-Akzeptanzkriterien konzipiert. Führe sie lokal in der aktuellen Webapp-Version aus. Für Dev-Tests können Intervalle (z. B. Check-ins) auf Minuten statt Tage gestellt werden.

Test 1 — Goal CRUD
-------------------
Precondition: App geöffnet, lokaler Speicher leer oder mit Testdaten.

Schritte:
1. Neues Ziel anlegen mit: Titel="Testziel A", Motivation=3, Dringlichkeit=4, Deadline= (optional).
2. Prüfe, ob das Ziel in der Liste erscheint.
3. Editiere das Ziel (ändere Motivation auf 5) und speichere.
4. Lösche das Ziel.

Erwartetes Ergebnis:
- Nach Schritt 1: Ziel erscheint sofort in der Liste.
- Nach Schritt 3: Änderungen sind sichtbar und persistent (bei Reload weiterhin vorhanden).
- Nach Schritt 4: Ziel ist entfernt und nicht mehr sichtbar.

Test 2 — Limit & Aktivierung
----------------------------
Precondition: Limit für aktive Ziele = 3 (Default).

Schritte:
1. Erstelle 3 aktive Ziele.
2. Erstelle ein 4. Ziel und versuche, es aktiv zu schalten (oder aktiviere es, falls Standard inaktiv).

Erwartetes Ergebnis:
- App verhindert die Aktivierung des 4. Ziels und zeigt einen Hinweis / Vorschlag an (z. B. ein anderes Ziel pausieren oder Limit erhöhen).

Test 3 — Priorisierung / Dashboard
----------------------------------
Precondition: Mindestens 3 aktive Ziele mit unterschiedlichen Motivations-/Dringlichkeits-Werten und Deadlines.

Schritte:
1. Öffne Dashboard.
2. Prüfe Reihenfolge der angezeigten Ziele.
3. Ändere die Motivation oder Dringlichkeit eines Ziels und beobachte die Neusortierung.

Erwartetes Ergebnis:
- Dashboard sortiert nach Priorität (Formel dokumentiert oder nachvollziehbar) und aktualisiert live nach Änderungen.

Test 4 — Export / Import (JSON)
-------------------------------
Precondition: Mindestens 2 Ziele vorhanden.

Schritte:
1. Exportiere die Daten (Download einer JSON-Datei).
2. Leere den LocalStorage (oder nutze die App-Funktion 'Reset').
3. Importiere die zuvor exportierte JSON-Datei.

Erwartetes Ergebnis:
- Nach Import sind alle Ziele wiederhergestellt mit korrekten Attributen (Titel, Motivation, Dringlichkeit, Deadline, Status).

Test 5 — Erinnerungen / Check-ins (Dev-simuliert)
------------------------------------------------
Precondition: Mindestens ein aktives Ziel und Check-in-Mechanismus konfigurierbar (für Dev: Intervall auf 1 Minute setzen).

Schritte:
1. Starte die App mit einem Test-Checkin Intervall (z. B. T+1 minute für Entwicklertest).
2. Warte auf das erste Check-in.

Erwartetes Ergebnis:
- Check-in wird in der UI angezeigt (oder als Browser-Notification, falls implementiert). Für MVP reicht sichtbare Anzeige in der App.

Testdaten-Beispiel für Import (JSON)
-----------------------------------
{
  "goals": [
    {"id":"1","title":"Testziel A","motivation":3,"urgency":4,"deadline":null,"status":"active"},
    {"id":"2","title":"Testziel B","motivation":5,"urgency":2,"deadline":"2026-04-01","status":"paused"}
  ]
}

Hinweise / Ablauf
------------------
- Für manuelle Tests: Nutze Entwicklertools (LocalStorage) um Daten schnell zurückzusetzen.
- Für automatisierte Tests später: Diese Testfälle lassen sich als UI-Tests (z. B. Playwright / Cypress) abbilden.
