# Acceptance Tests — Goaly MVP

This checklist summarises the manual verification of the MVP scope. Run the tests locally against the current build. For development runs, shorten the check-in interval to minutes instead of days.

## Test 1 — Goal CRUD

**Precondition:** Browser open, LocalStorage empty or seeded with temporary data.

**Steps**
1. Create a new goal with title “Test goal A”, motivation `3`, urgency `4`, and leave the deadline empty.
2. Confirm the goal appears on the dashboard.
3. Edit the goal, change motivation to `5`, and save.
4. Delete the goal.

**Expected**
- After creation the goal shows immediately.
- After editing the updated values persist across reloads.
- After deletion the goal is removed from all views.

## Test 2 — Active limit & auto activation

**Precondition:** Active goal limit set to `3` (default).

**Steps**
1. Create three active goals.
2. Create a fourth goal and attempt to activate it.

**Expected**
- The app blocks the fourth activation and suggests pausing another goal or increasing the limit.

## Test 3 — Dashboard prioritisation

**Precondition:** At least three active goals with different motivation/urgency values and deadlines.

**Steps**
1. Open the dashboard.
2. Confirm ordering by priority.
3. Adjust motivation or urgency on one goal and observe the resorting.

**Expected**
- The ordering follows the documented priority formula and updates immediately.

## Test 4 — Export / import (JSON)

**Precondition:** At least two goals exist.

**Steps**
1. Export data (JSON download).
2. Clear LocalStorage (or trigger a reset in-app if available).
3. Import the previously exported file.

**Expected**
- All goals return with correct fields (title, motivation, urgency, deadline, status).

## Test 5 — Check-in reminders (dev simulation)

**Precondition:** At least one active goal and the check-in interval configurable (set to one minute for the test).

**Steps**
1. Launch the app with the short interval.
2. Wait for the first reminder banner.

**Expected**
- A visible check-in appears in the UI. Dismissing the reminder hides the banner.

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

- Use DevTools → Application/Storage to reset LocalStorage between runs.
- These scenarios can later be automated with frameworks such as Playwright or Cypress.

