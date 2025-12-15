# Testing Rules

## Tests & Quality
- Execute `npm test` for unit tests.
- **CRITICAL:** Always run `npm test` exactly as-is without any modifications, flags, or piping:
  - Correct: `npm test`
  - Wrong: `npm test -- --coverage`
  - Wrong: `npm test -- sync-manager.test.js`
  - Wrong: `npm test | findstr ...`
  - Wrong: Any other variation of the test command
- **Exception:** When fixing worker process exit issues, you may use `npm test -- --detectOpenHandles` to identify what's preventing graceful shutdown. This is the only exception to the "no flags" rule.
- **Important:** Always run `npm test` directly without piping output through filters (e.g., `findstr`, `grep`) for parsing. This ensures accurate test results and coverage reporting.
- Maintain the existing high coverage; extend tests for new UI behaviour (`tests/ui-controller.test.js`).
- After code changes run `read_lints` in Cursor for touched files.
- Check test coverage threshold (80% for statements, branches, functions, and lines).
- **Important:** Add sufficient tests to meet coverage thresholds. If coverage is below 80%, add additional tests for uncovered code paths, edge cases, and error handling until the threshold is met.
