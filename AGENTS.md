# Agents Handbook

This handbook summarises how coding agents and new contributors collaborate productively on the `goaly` project.

## Setup & Development
- Run `npm install` once to install dependencies.
- Serve the app locally with `npx --yes serve -l 8000` (see `README.md` for alternatives).
- The entry point is `index.html` with `src/app.js`.
- **Windows Note:** On Windows, Cursor should use `cmd` instead of PowerShell for terminal commands. Use `cmd /c <command>` when running commands on Windows.

## Tests & Quality
- Execute `npm test` for unit tests; add `-- --coverage` for a coverage report.
- **Important:** Always run `npm test` directly without piping output through filters (e.g., `findstr`, `grep`) for parsing. This ensures accurate test results and coverage reporting.
- Maintain the existing high coverage; extend tests for new UI behaviour (`tests/ui-controller.test.js`).
- After code changes run `read_lints` in Cursor for touched files.

## Architecture Overview
- `src/domain`: pure logic (goal, settings, review services).
- `src/ui/ui-controller.js`: DOM coordination and rendering logic.
- `styles/styles.css`: global styling with responsive layout.
- `src/i18n`: language resources and localisation service.

## Working Guidelines
1. Review existing tests before implementing changes to understand expected behaviour.
2. Work incrementally; run tests after significant edits.
3. Do **not** overwrite user changes in a dirty worktree.
4. Summarise results clearly in commits/PRs and call out next steps.
5. Update the documentation whenever functionality changes.
6. Raise a PR when work is complete and hand it off for review.
7. **Naming rule:** Use English-only identifiers, function names and terminology across the codebase and documentation. This ensures consistency and simplifies future contributions.

## Reference Material
- Product expectations: `README.md` and the documents in `docs/`.
- Feature priorities: consult project documents first, then ask if unclear.

Happy hacking! 🚀

