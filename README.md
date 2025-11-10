# Goaly MVP - Zielverfolgungs-App

Eine einfache, funktionale Webapp zur Zielverfolgung mit Priorisierung und Check-in-System.

## 🚀 Schnellstart

```bash
# Installiere Dependencies (einmalig)
npm install

# Starte lokalen Server
npx --yes serve -l 8000

# App erreichbar unter: http://localhost:8000
```

Alternativen: `python -m http.server 8000` oder `php -S localhost:8000`

## 📋 Features

- ✅ **Goal CRUD**: Ziele erstellen, bearbeiten, löschen und archivieren
- ✅ **Priorisierung**: Automatische Sortierung nach Motivation, Dringlichkeit und Deadline
- ✅ **Limit-Management**: Maximale Anzahl aktiver Ziele (Standard: 3)
- ✅ **Check-in-System**: Erinnerungen zur Überprüfung von Motivation und Dringlichkeit
- ✅ **Export/Import**: JSON-basierte Datensicherung
- ✅ **Responsive Design**: Funktioniert auf Desktop und Mobile

## 🧪 Akzeptanztests durchführen

### Vorbereitung

1. Öffne die App in einem Browser
2. Öffne die Entwicklertools (F12) für den Zugriff auf LocalStorage
3. Optional: Setze das Check-in-Intervall in den Einstellungen auf 1 Minute für schnelle Tests

### Test 1: Goal CRUD

**Schritte:**
1. Klicke auf "+ Neues Ziel"
2. Fülle das Formular aus:
   - Titel: "Testziel A"
   - Motivation: 3
   - Dringlichkeit: 4
   - Deadline: (optional leer lassen)
   - Status: Aktiv
3. Klicke "Speichern"
4. Prüfe: Ziel erscheint im Dashboard
5. Klicke "Bearbeiten" am Ziel
6. Ändere Motivation auf 5
7. Speichere
8. Prüfe: Änderung ist sichtbar
9. Lade die Seite neu (F5)
10. Prüfe: Änderung ist persistent
11. Klicke "Bearbeiten" → "Löschen"
12. Prüfe: Ziel ist entfernt

**Erwartetes Ergebnis:** ✅ Alle CRUD-Operationen funktionieren korrekt

### Test 2: Automatische Aktivierung basierend auf Priorität

**Schritte:**
1. Stelle sicher, dass das Limit auf 3 steht (Einstellungen → ⚙️)
2. Erstelle 4 Ziele mit unterschiedlichen Prioritäten:
   - Ziel 1: Motivation 3, Dringlichkeit 4
   - Ziel 2: Motivation 4, Dringlichkeit 3
   - Ziel 3: Motivation 5, Dringlichkeit 2
   - Ziel 4: Motivation 2, Dringlichkeit 1
3. Prüfe: Die 3 Ziele mit höchster Priorität (Ziel 3, 2, 1) sind automatisch aktiv
4. Prüfe: Ziel 4 ist automatisch pausiert

**Erwartetes Ergebnis:** ✅ System aktiviert automatisch die N Ziele mit höchster Priorität

**Weitere Schritte:**
5. Erhöhe die Motivation von Ziel 4 auf 10
6. Prüfe: Ziel 4 wird automatisch aktiviert, ein anderes Ziel wird pausiert
7. Ändere das Limit in den Einstellungen auf 2
8. Prüfe: Nur die 2 Ziele mit höchster Priorität bleiben aktiv

**Erwartetes Ergebnis:** ✅ Automatische Reaktivierung bei Prioritätsänderungen und Limit-Änderungen

### Test 3: Priorisierung / Dashboard

**Schritte:**
1. Erstelle 3 aktive Ziele mit unterschiedlichen Werten:
   - Ziel A: Motivation 5, Dringlichkeit 5, Deadline: heute + 7 Tage
   - Ziel B: Motivation 3, Dringlichkeit 4, keine Deadline
   - Ziel C: Motivation 4, Dringlichkeit 3, Deadline: heute + 30 Tage
2. Öffne das Dashboard
3. Prüfe die Reihenfolge der Ziele
4. Erwartung: Höchste Priorität zuerst (Ziel A sollte oben sein)
5. Bearbeite Ziel B: Ändere Motivation auf 5
6. Speichere
7. Prüfe: Dashboard sortiert neu

**Erwartetes Ergebnis:** ✅ Ziele werden nach Priorität sortiert (Motivation + Dringlichkeit + Deadline-Bonus)

**Prioritätsformel:**
- Basis: Motivation + Dringlichkeit (max 10)
- Deadline-Bonus: 
  - ≤ 30 Tage: + (30 - Tage) / 10 (max +3)
  - Überfällig: +5

### Test 4: Export / Import (JSON)

**Schritte:**
1. Erstelle mindestens 2 Ziele mit verschiedenen Attributen:
   - Ziel 1: Titel "Testziel A", Motivation 3, Dringlichkeit 4
   - Ziel 2: Titel "Testziel B", Motivation 5, Dringlichkeit 2, Deadline: 2026-04-01
2. Klicke auf "Export"
3. Prüfe: JSON-Datei wird heruntergeladen
4. Öffne die Entwicklertools (F12) → Application → Local Storage
5. Lösche alle `goaly_*` Einträge (oder nutze die Reset-Funktion im Browser)
6. Lade die Seite neu
7. Prüfe: Alle Ziele sind weg
8. Klicke auf "Import"
9. Wähle die zuvor exportierte JSON-Datei
10. Prüfe: Alle Ziele sind wiederhergestellt mit korrekten Attributen

**Erwartetes Ergebnis:** ✅ Export erzeugt valide JSON-Datei, Import stellt alle Daten korrekt wieder her

**Testdaten-Beispiel für Import:**
```json
{
  "goals": [
    {
      "id": "1",
      "title": "Testziel A",
      "motivation": 3,
      "urgency": 4,
      "deadline": null
    },
    {
      "id": "2",
      "title": "Testziel B",
      "motivation": 5,
      "urgency": 2,
      "deadline": "2026-04-01T00:00:00.000Z"
    }
  ]
}
```

### Test 5: Erinnerungen / Check-ins

**Vorbereitung:**
1. Gehe zu Einstellungen (⚙️)
2. Setze "Check-in Intervall" auf 1 Minute (für schnelle Tests)
3. Speichere

**Schritte:**
1. Erstelle ein neues Ziel:
   - Titel: "Check-in Test"
   - Motivation: 3
   - Dringlichkeit: 4
   - (Wird automatisch aktiviert, wenn Priorität hoch genug ist)
2. Warte 1 Minute (oder ändere die Systemzeit im Browser)
3. Prüfe: Check-in-Panel erscheint automatisch oben auf der Seite
4. Prüfe: Check-in zeigt das Ziel an mit Nachricht zur Überprüfung
5. Option A: Klicke "Check-in durchgeführt"
   - Prüfe: Check-in verschwindet
6. Option B: Klicke "Ziel bearbeiten"
   - Prüfe: Zielformular öffnet sich
   - Ändere Motivation oder Dringlichkeit
   - Speichere
   - Prüfe: Check-in verschwindet nach Durchführung

**Erwartetes Ergebnis:** ✅ Check-ins werden angezeigt nach konfiguriertem Intervall (3, 7, 14, 30 Tage bzw. Minuten im Dev-Modus)

**Check-in-Intervalle:**
- T+3 Tage/Minuten
- T+7 Tage/Minuten  
- T+14 Tage/Minuten
- T+30 Tage/Minuten

## 🔧 Entwickler-Hinweise

### Tests ausführen

Die App verwendet Jest für Unit-Tests:

```bash
# Installiere Dependencies (einmalig)
npm install

# Führe alle Tests aus
npm test

# Tests mit Coverage-Report
npm test -- --coverage
```

**Aktuelle Test-Coverage:**
- Statements: 97.77% | Branches: 80.89% | Functions: 97.18% | Lines: 98.97%

### LocalStorage zurücksetzen

1. Öffne Entwicklertools (F12)
2. Gehe zu "Application" (Chrome) oder "Storage" (Firefox)
3. Wähle "Local Storage" → deine Domain
4. Lösche alle Einträge mit Präfix `goaly_`

### Check-in-Intervalle für Tests

Für schnelle Tests kannst du das Check-in-Intervall in den Einstellungen auf 1 Minute setzen. In Produktion sollten die Intervalle auf Tage gesetzt werden (3, 7, 14, 30 Tage).

### Browser-Kompatibilität

Die App nutzt:
- LocalStorage (alle modernen Browser)
- ES6+ JavaScript (Chrome, Firefox, Safari, Edge - aktuelle Versionen)
- CSS Grid & Flexbox (alle modernen Browser)

## 📁 Projektstruktur

```
goaly/
├── index.html      # Haupt-HTML-Struktur
├── styles.css      # Styling und responsive Design
├── app.js          # Hauptanwendungslogik
├── mvp.md          # MVP-Spezifikation
├── acceptance_tests.md  # Detaillierte Akzeptanztests
└── README.md       # Diese Datei
```

## 🎯 Nächste Schritte (Post-MVP)

- Backend-Integration für Multi-Device-Sync
- Authentifizierung
- E-Mail-Benachrichtigungen
- Erweiterte Statistiken und Visualisierungen
- Mobile App

## 📝 Notizen

- Alle Daten werden lokal im Browser gespeichert (LocalStorage)
- Keine Server-Kosten, keine Registrierung nötig
- Export-Funktion für Datensicherung
- Responsive Design für Desktop und Mobile

