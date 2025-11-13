# Acceptance Tests - Goaly MVP

This checklist summarises the manual verification of the MVP scope. Run the tests locally against the current build. For development runs, shorten the review interval to minutes (or seconds) instead of days.

## Test 1 - Goal CRUD

**Precondition:** Browser open, LocalStorage empty or seeded with temporary data.

**Steps**
1. Create a new goal with title "Test goal A", motivation `3`, urgency `4`, and leave the deadline empty.
2. Confirm the goal appears on the dashboard.
3. Edit the goal, change motivation to `5`, and save.
4. Delete the goal.

**Expected**
- After creation the goal shows immediately.
- After editing the updated values persist across reloads.
- After deletion the goal is removed from all views.

## Test 2 - Active limit and auto activation

**Precondition:** Active goal limit set to `3` (default).

**Steps**
1. Create three active goals.
2. Create a fourth goal and attempt to activate it.

**Expected**
- The app blocks the fourth activation and suggests pausing another goal or increasing the limit.

## Test 3 - Dashboard prioritisation

**Precondition:** At least three active goals with different motivation/urgency values and deadlines.

**Steps**
1. Open the dashboard.
2. Confirm ordering by priority.
3. Adjust motivation or urgency on one goal and observe the resorting.

**Expected**
- The ordering follows the documented priority formula and updates immediately.

## Test 4 - Export / import (JSON)

**Precondition:** At least two goals exist.

**Steps**
1. Export data (JSON download).
2. Clear LocalStorage (or trigger a reset in-app if available).
3. Import the previously exported file.

**Expected**
- All goals return with correct fields (title, motivation, urgency, deadline, status).

## Test 5 - Review reminders (dev simulation)

**Precondition:** At least one active goal and the review interval configurable (set to one minute for the test).

**Steps**
1. Launch the app with the short interval.
2. Wait for the first reminder banner.

**Expected**
- A visible review reminder appears in the UI. Dismissing the reminder hides the banner.

## Test 6 - Review view smoke test

**Precondition:** Local server running (`npx --yes serve -l 8000`), clean browser profile, review intervals set to `30s, 5m, 1h`.

**Steps**
1. Open the Review tab to confirm the view loads.
2. Create two goals (Goal A: motivation 4/urgency 4; Goal B: motivation 2/urgency 5 with deadline tomorrow) and return to the Review tab.
3. When the first review card appears, submit it without changing the ratings.
4. When the confirmation banner appears, ensure it reads “Review completed” and notes the next review time in human-friendly units.
5. For the next due card, change both ratings to 5, submit, wait ~30 seconds, and refresh the Review tab.
6. Reset review intervals to `30d, 14d, 7d`, create a new goal (Goal C), and verify it does not appear immediately in Review.

**Expected**
- Review tab accessible; at least one card appears within ~60 seconds after goal creation.
- Confirmation banner shows “Review completed” with a readable interval (e.g. “about 5 minute(s)” or “about 30 second(s)”).
- Changing ratings triggers the short (30s) cadence and the card reappears accordingly.
- Interval input accepts suffixes without errors.
- With long cadences restored, Goal C does not surface right away.

## Sample import data

```json
{
  "goals": [
    {"id":"1","title":"Test goal A","motivation":3,"urgency":4,"deadline":null,"status":"active"},
    {"id":"2","title":"Test goal B","motivation":5,"urgency":2,"deadline":"2026-04-01","status":"paused"}
  ]
}
```

## Notes

- Use DevTools -> Application/Storage to reset LocalStorage between runs.
- These scenarios can later be automated with frameworks such as Playwright or Cypress.

