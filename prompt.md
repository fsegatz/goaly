1. Prompt-Beschreibung (kurz):
Dieses Prompt fordert dich auf, aus den Notizen in `idee.md` ein klares Minimum Viable Product (MVP) zu formulieren und dazu passende, ausführbare Akzeptanzkriterien zu erstellen. Die erzeugten Texte sollen als eigenständige Dateien `MVP.md` und `acceptance_tests.md` im Repository abgelegt werden. Ziel ist eine kompakte, prüfbare Grundlage für die Implementierung einer statischen Webapp (LocalStorage-first).
Hinweise:
- Nutze vorhandene Projektannahmen (UI-first, no-cost, Export/Import via JSON).
- Formuliere User Stories, Minimal-Feature-Set und klar testbare Akzeptanzkriterien.
- Schreibe in Deutsch.

2. Prompt (Quelle für `copilot-instructions.md`):
Erstelle eine Datei `copilot-instructions.md` und eine identische Datei `cursor-instruction.md`, die klare, handlungsorientierte Instruktionen für einen Pair-Programming-Assistant (z. B. Copilot oder Cursor) enthalten. Nutze als Grundlage die vorhandenen Projektdateien (`idee.md`, `MVP.md`, `acceptance_tests.md`) und fasse daraus:
- Projektziel und MVP zusammen (ein Absatz).
- Wichtige Annahmen und Einschränkungen (UI-first, no-cost, LocalStorage-first, kein Streamlit).
- Prioritäten für PRs und Änderungen.
- Konkrete technische Guidelines (Dateistruktur, empfohlene Module wie `storage.js`, Priorisierungslogik kapseln).
- Akzeptanz- und QA-Checks, Commit-/PR-Konventionen und kleine Onboarding-Tasks (z. B. Skeleton-UI, Export/Import).

Vorgaben:
- Schreibe auf Deutsch, präzise und handlungsorientiert.
- Halte die Dateien pragmatisch und fokussiert auf das MVP (keine langen Design-RFCs).
- Ergänze Beispiele für Commit-Messages und minimale Implementierungs-Schritte.


