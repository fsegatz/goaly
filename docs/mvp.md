# MVP — Goaly

## Goal
Deliver a simple, usable web app that demonstrates Goaly’s core value: users can create goals, prioritise them and track progress in the short and medium term.

## Core User Stories
- As a user I can create a goal (title, description, motivation 1-5, urgency 1-5, optional deadline) so I can capture my intent.
- As a user I can limit myself to at most **N** active goals and see a prioritised dashboard, helping me focus on what matters.
- As a user I receive reminders and can export/import my data to stay informed and safeguard my progress.

## MVP Scope
- Goal CRUD with archive / completion.
- Attributes: title, description, motivation, urgency, optional deadline, status (active/paused/completed), timestamps, history.
- Configurable limit for active goals (default 3).
- Dashboard showing active goals ordered by priority (motivation + urgency + deadline bonus) and highlighting due check-ins.
- Reminder loop: browser-based prompts for upcoming deadlines and the 3/7/14/30 day cadence.
- Persistence via LocalStorage plus JSON export/import.
- Responsive static UI (HTML/CSS/JS) with a future option to add a backend.
- Each goal rendered as a card with key information and history.

## Acceptance Criteria
- Goals can be created with all required fields and appear immediately.
- Goals can be activated/deactivated and the active limit is enforced.
- Dashboard reflects the correct priority order and updates after changes.
- Check-in reminders appear according to the schedule.
- Export triggers a JSON download; import restores the previous state.

## Technical Assumptions
- Start as a static web app backed by LocalStorage to minimise costs and go live quickly.
- UX-first delivery; authentication and sync can follow later.

## Success Criteria
- Export/import works reliably without data loss.
- A first prototype is live and usable end to end.

## Next Steps
1. Finalise tech stack (evaluate whether sync/auth is needed later).
2. Build the UI flow with vanilla HTML/CSS/JS.
3. Run lightweight user testing with 5-10 participants.

