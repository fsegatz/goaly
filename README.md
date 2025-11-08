# Goaly MVP - Zielverfolgungs-App

Eine einfache, funktionale Webapp zur Zielverfolgung mit Priorisierung und Check-in-System.

## 🚀 Schnellstart

1. **App öffnen**: Öffne `index.html` in einem modernen Webbrowser (Chrome, Firefox, Safari, Edge)
2. **Keine Installation nötig**: Die App läuft komplett lokal im Browser mit LocalStorage

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

### Test 2: Limit & Aktivierung

**Schritte:**
1. Stelle sicher, dass das Limit auf 3 steht (Einstellungen → ⚙️)
2. Erstelle 3 aktive Ziele:
   - Ziel 1: Motivation 3, Dringlichkeit 4, Status: Aktiv
   - Ziel 2: Motivation 4, Dringlichkeit 3, Status: Aktiv
   - Ziel 3: Motivation 5, Dringlichkeit 2, Status: Aktiv
3. Versuche ein 4. Ziel zu erstellen mit Status: Aktiv

**Erwartetes Ergebnis:** ✅ Fehlermeldung erscheint: "Maximale Anzahl aktiver Ziele erreicht (3). Bitte ein anderes Ziel pausieren oder das Limit erhöhen."

**Weitere Schritte:**
4. Pausiere eines der ersten 3 Ziele
5. Erstelle jetzt das 4. Ziel als aktiv
6. Prüfe: Ziel wird erfolgreich erstellt

**Erwartetes Ergebnis:** ✅ Aktivierung funktioniert nach Pausieren eines anderen Ziels

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
   - Ziel 1: Titel "Testziel A", Motivation 3, Dringlichkeit 4, Status: Aktiv
   - Ziel 2: Titel "Testziel B", Motivation 5, Dringlichkeit 2, Deadline: 2026-04-01, Status: Pausiert
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
      "deadline": null,
      "status": "active"
    },
    {
      "id": "2",
      "title": "Testziel B",
      "motivation": 5,
      "urgency": 2,
      "deadline": "2026-04-01T00:00:00.000Z",
      "status": "paused"
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
1. Erstelle ein neues aktives Ziel:
   - Titel: "Check-in Test"
   - Motivation: 3
   - Dringlichkeit: 4
   - Status: Aktiv
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

