# AGENTS Leitfaden

Dieser Leitfaden beschreibt komprimiert, wie AI-Coding-Agents oder neue Teammitglieder produktiv mit dem Projekt `goaly` arbeiten.

## Setup & Entwicklung

- `npm install` einmalig ausführen, um alle Abhängigkeiten zu installieren.
- Für einen lokalen Testserver reicht z. B. `npx --yes serve -l 8000` (siehe `README.md`).
- Das Frontend lebt unter `index.html` mit `src/app.js` als Einstiegspunkt.

## Tests & Qualität

- Unit-Tests laufen via `npm test`; für einen Coverage-Report `npm test -- --coverage`.
- Die bestehende Testabdeckung ist hoch – neue Features sollten mindestens gleichwertige oder bessere Coverage liefern.
- UI-spezifische Logik ist in `tests/ui-controller.test.js` abgedeckt; neue UI-Funktionen benötigen begleitende Tests.

## Architekturüberblick

- `src/domain`: Enthält reine Logik (Goal-, Settings-, Check-In-Services).
- `src/ui/ui-controller.js`: Steuert DOM-Interaktionen; Renderer-Logik gehört hierher.
- `styles/styles.css`: Globale Styles; mobile Responsiveness beachten.

## Arbeitsweise für Agents

1. Vor Änderungen Tests lesen, um gewünschtes Verhalten zu verstehen.
2. Änderungen inkrementell vornehmen; nach jedem größeren Schritt Tests ausführen.
3. Keine bestehenden User-Änderungen überschreiben – Worktree kann „dirty“ sein.
4. Nach Anpassungen `read_lints` (Cursor) für betroffene Dateien prüfen.
5. Ergebnisse im PR/Commit sauber zusammenfassen und nächste Schritte benennen.
6. Nach abgeschlossenen Änderungen einen PR erstellen und zur Review vorstellen.

## Kontaktpunkte

- Produktanforderungen stehen primär im `README.md` sowie in `docs/`.
- Fragen zur Feature-Priorisierung: zuerst vorhandene Docs checken, dann rückfragen.

Happy hacking! 🚀

