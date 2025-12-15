# Architecture Overview

## Project Structure
- `src/domain`: pure logic (goal, settings, review services).
- `src/ui/ui-controller.js`: DOM coordination and rendering logic.
- `styles/styles.css`: global styling with responsive layout.
- `src/language`: language resources and localisation service.

## Entry Points
- The entry point is `index.html` with `src/app.js`.

## Setup & Development
- Run `npm install` once to install dependencies.
- Serve the app locally with `npx --yes serve -l 8000` (see `README.md` for alternatives).
