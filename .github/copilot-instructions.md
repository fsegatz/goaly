# Copilot / Cursor Instructions — Goaly (Deutsch)

Kurzbeschreibung
-----------------
Diese Datei enthält klare, handlungsorientierte Instruktionen für automatisierte Pair-Programming-Assistants (z. B. GitHub Copilot, Cursor), um im `goaly`-Repo zielgerichtet und sicher zu arbeiten. Die Anweisungen basieren auf den vorhandenen Projektdateien (`idee.md`, `MVP.md`, `acceptance_tests.md`) und den Projektprinzipien (UI-first, no-cost, statische Webapp, LocalStorage-first).

Ziel des Projekts
-----------------
Goaly ist eine einfache Zielverfolgungs-Webapp. MVP: Nutzer können Ziele anlegen, priorisieren, kurz-/mittelfristig verfolgen, Export/Import (JSON) und lokale Persistenz via LocalStorage. Fokus: schnell nutzbar, low-cost, responsive statische Webapp (HTML/CSS/JS).

Wichtige Annahmen / Einschränkungen
-----------------------------------
- Start als statische Webapp (kein Backend zwingend für MVP).  
- Keine kostenpflichtigen Dienste verwenden (no paid services).  
- Streamlit vermeiden (Projekt soll statisch und frontend-first sein).  
- Persistenz initial über LocalStorage, Export/Import via JSON.  
- Keep it simple: keine Über-Engineering-Lösungen im MVP.

Prioritäten für Änderungen und PRs
--------------------------------
1. Niemals die MVP-Akzeptanzkriterien brechen: neue Features müssen die bestehenden Acceptance Tests unterstützen oder erweitern.  
2. Kleine, isolierte PRs (max. 1 Feature / Bugfix pro PR).  
3. Dokumentation aktualisieren (README, MVP.md, acceptance_tests.md) bei jeder funktionalen Änderung.  
4. Tests: manuelle Akzeptanzschritte in `acceptance_tests.md` in automatisierbare Tests (Playwright/Cypress) überführen, sobald UI stabil ist.

Arbeitsweise / Verhalten der Assistants
--------------------------------------
- Befolge die User Stories und das Minimal-Feature-Set in `MVP.md`.  
- Implementiere Features in kleinen, geprüften Schritten. Erzeuge minimalen, lauffähigen Code (z. B. `index.html`, eine kleine `app.js`, `styles.css`) und verifiziere lokal.  
- Schreibe einfache, reproduzierbare Manual-Tests und/oder Unit-Tests für kritische Logik (Priorisierungsformel, Export/Import, Aktiv-Limit).  
- Wenn Design-Entscheidungen fehlen, treffe maximal 1–2 vernünftige Annahmen (z. B. Default-Limit=3, Prioritätsformel = motivation*2 + urgency + deadlineBonus) und dokumentiere die Annahme klar in PR-Description.
- Bei unsicherer Aufgabenstellung kurz nachfragen (eine präzise Frage). Wenn nicht blockierend, führe eine vernünftige Annahme aus und dokumentiere sie.

Technische Guidelines
---------------------
- Sprache: HTML / CSS / JavaScript (ES6+). Keine große Runtime-deps fürs MVP.  
- Struktur (empfohlen):
  - `public/` oder root: `index.html` (statische UI)
  - `src/` oder `js/`: `app.js`, `storage.js`, `ui.js`
  - `styles/`: `main.css`
  - `docs/`: `MVP.md`, `acceptance_tests.md`, `idee.md`
- Persistenz-Modul: zentrale Abstraktion `storage.js` mit Methoden `loadAll()`, `saveAll(data)`, `exportJSON()`, `importJSON(json)` (impl. für LocalStorage).  
- Priorisierungslogik: kapseln und unit-testen. Dokumentiere die Formel in Kommentaren und in `docs/`.
- Accessibility & Responsiveness: Basis-Responsiveness und semantische HTML-Elemente verwenden.

Akzeptanz- / QA-Checks bei PR
----------------------------
- Implementierte Funktion entspricht einem oder mehreren Acceptance Tests in `acceptance_tests.md`.  
- Lokaler Smoke-Test: App öffnet, Ziele anlegbar, Änderungen persistent (LocalStorage), Export/Import funktioniert.  
- Code-Dokumentation: kurze README-Abschnitte, Kommentare bei nicht-trivialer Logik.  
- Keine externen, kostenpflichtigen Dienste, keine Streamlit-Nutzung.

Onboarding & kleine Tasks
-------------------------
- Aufgabe: Erstelle ein minimales, funktionales Skeleton (static `index.html`, `app.js`, `styles.css`) das Goal-CRUD in LocalStorage demonstriert.  
  - Verifiziere mit manuellem Durchlauf aus `acceptance_tests.md` (Test 1).  
- Aufgabe: Implementiere Export/Import JSON (Test 4).  
- Aufgabe: Implementiere Limit-Check für aktive Ziele (Test 2).

Kommunikation / Commit Messages
-------------------------------
- Commit-Format: kurze, prägnante Messages. Beispiel: `feat(goal): add create / save to LocalStorage` oder `fix(storage): persist deadline correctly`.  
- PR-Description: Beschreibe kurz die gemachten Annahmen, welche Acceptance Tests abgedeckt wurden und wie man manuell testet.

Weitere Hinweise
----------------
- Wenn eine längere oder riskante Änderung nötig ist (z. B. Backend-Integration, Auth), erstelle eine RFC-Notiz in `docs/` oder `designs/` und diskutiere kurz die Optionen.  
- Automatisiere UI-Tests erst ab stabiler UI (Ziel: Playwright/Cypress-Suite für Acceptance Tests).

Kontaktpunkt
-------------
Bei Unklarheiten: kurze, gezielte Fragen im PR oder Issue; dokumentiere Annahmen klar in PR-Text.

---
Diese Datei ist absichtlich pragmatisch: sie soll Assistants erlauben, schnell anzufangen, wiederholbare PRs zu liefern und das MVP nicht aus den Augen zu verlieren.
