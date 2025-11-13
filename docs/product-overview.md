# Product Overview

Goaly helps you manage a focused set of goals by combining priority scoring, recurring reviews, and lightweight data storage that stays in the browser.

## Core Features
- **Goal CRUD**: create, edit, archive, and delete goals.
- **Priority scoring**: combines motivation, urgency, and deadline bonus.
- **Active goal limit**: enforces a configurable maximum (default: 3).
- **Review reminders**: prompts periodic reassessment of goals.
- **Export and import**: JSON-based backups and restores.
- **Responsive UI**: optimised for desktop and mobile devices.
- **Language selection**: English, German, and Swedish with browser auto-detect.

## Priority Formula
- Base score: `motivation + (urgency * 10)` (range 11-55).
- Deadline bonus:
  - More than 30 days remaining: `+0`.
  - 30 days remaining or fewer: `+ (30 - daysRemaining)`.
- The bonus continues to increase for overdue goals (e.g. one day overdue adds 31).
- There is no upper cap; priority can exceed 55 as deadlines near or pass.

## Usage Notes
- All data lives in LocalStorage; no backend or signup is required.
- Use JSON export/import for manual backups.
- For development, you can shorten the review interval to one minute (or even seconds with suffixes); production usage typically uses days.

## Post-MVP Ideas
- Multi-device sync via backend integration.
- Authentication and user management.
- Email or push notifications.
- Extended analytics and visualisations.
- Dedicated mobile app experience.

