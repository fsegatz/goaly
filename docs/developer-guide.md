# Developer Guide

## Local Setup
- Install dependencies with `npm install`.
- Serve the static build locally via `npx --yes serve -l 8000` (or use the alternatives listed in the README).
- The browser entry point is `index.html`, which injects `src/app.js`.

## Development Workflow
1. Review existing tests before making changes to understand expected behaviour.
2. Work incrementally and verify changes frequently in the browser.
3. Run `npm test` to execute the Jest suite; add `-- --coverage` for a coverage report.
4. After editing code, run `read_lints` in Cursor for the files you touched.
5. Update documentation whenever functionality changes (see the release checklist).
6. Use English-only identifiers, function names, and terminology across code and docs.

## Manual Verification
- Before releases (or major UI changes), run the smoke checklist in `docs/acceptance_tests.md` (specifically Test 6 – Review view smoke test).
- Record findings (browser/OS, time per section, defects) and share them in the team channel.

## Architecture Overview
- `src/domain`: pure logic (goal, settings, and review services).
- `src/ui/ui-controller.js`: DOM coordination and rendering.
- `styles/styles.css`: global styling with responsive layout.
- `src/i18n`: localisation resources and language service.

## Project Structure
```
goaly/
├── index.html
├── styles/
│   └── styles.css
├── src/
│   ├── app.js
│   ├── domain/
│   │   ├── review-service.js  (review cadence engine)
│   │   ├── goal-service.js
│   │   ├── goal.js
│   │   └── settings-service.js
│   ├── i18n/
│   │   ├── en.js
│   │   ├── de.js
│   │   ├── sv.js
│   │   └── language-service.js
│   └── ui/
│       └── ui-controller.js
├── tests/
│   └── ui-controller.test.js
└── docs/
    └── ...
```

## Release Checklist
- Ensure unit tests pass (`npm test`).
- Confirm documentation updates cover any functional changes.
- Verify `LICENSE.md` and `NOTICE.md` are included in distribution bundles or archives.
- Summarise results clearly in commits or pull requests and call out next steps.
- Raise a PR and hand it off for review when work is complete.

Happy hacking!

