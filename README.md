# Goaly MVP - Goal Tracking App

Goaly is a lightweight goal management web application that blends priority scoring with recurring check-ins. It helps you focus on the most impactful goals while keeping everything entirely in the browser.

## 🚀 Quick Start

```bash
# Install dependencies (one-time)
npm install

# Launch a static dev server
npx --yes serve -l 8000

# The app is now available at http://localhost:8000
```

Alternatives for local hosting: `python -m http.server 8000` or `php -S localhost:8000`.

## 📋 Core Features

- ✅ **Goal CRUD** - create, edit, archive and delete goals
- ✅ **Priority scoring** - combines motivation, urgency and deadline bonus
- ✅ **Active goal limit** - auto-manages a configurable maximum (default: 3)
- ✅ **Check-in system** - nudges you to re-evaluate motivation and urgency
- ✅ **Export & import** - JSON-based backups and restores
- ✅ **Responsive UI** - optimised for desktop and mobile devices
- ✅ **Language selection** - English (default), German and Swedish with browser auto-detect

## 🧪 Acceptance Tests

### Preparation

1. Open the app in your browser.
2. Open DevTools (F12) to access LocalStorage if required.
3. Optionally reduce the check-in interval to one minute in settings for faster feedback.

### Test 1 - Goal CRUD

**Steps**
1. Click `+ New goal`.
2. Complete the form:
   - Title: `Test goal A`
   - Motivation: `3`
   - Urgency: `4`
   - Deadline: *(optional) leave empty*
3. Save the form.
4. Verify the goal appears on the dashboard.
5. Click `Edit`, change motivation to `5`, save.
6. Reload the page and confirm the change persists.
7. Delete the goal via `Edit → Delete` and confirm it disappears.

**Expected outcome:** All CRUD operations behave correctly.

### Test 2 - Automatic activation by priority

**Steps**
1. Ensure the active goal limit is `3`.
2. Create four goals with varying priority:
   - Goal 1: Motivation `3`, Urgency `4`
   - Goal 2: Motivation `4`, Urgency `3`
   - Goal 3: Motivation `5`, Urgency `2`
   - Goal 4: Motivation `2`, Urgency `1`
3. Confirm the three highest priorities (3, 2, 1) are active and goal 4 is paused.
4. Increase goal 4’s motivation to `10`; it should become active and another goal pause.
5. Lower the active limit to `2`; only the top two priorities remain active.

**Expected outcome:** Automatic activation reacts to both priority and limit changes.

### Test 3 - Dashboard prioritisation

**Steps**
1. Create three active goals:
   - Goal A: Motivation `5`, Urgency `5`, Deadline in 7 days
   - Goal B: Motivation `3`, Urgency `4`, no deadline
   - Goal C: Motivation `4`, Urgency `3`, Deadline in 30 days
2. Open the dashboard and confirm ordering by priority (Goal A first).
3. Edit Goal B, set motivation to `5`, save and confirm the ordering updates.

**Priority formula**
- Base score: `motivation + (urgency * 10)` (range 11-55)
- Deadline bonus:
  - > 30 days remaining: `+0`
  - ≤ 30 days remaining: `+ (30 - daysRemaining)`
- Notes:
  - The deadline bonus keeps increasing for overdue goals (e.g. 1 day overdue adds 31).
  - No upper cap is enforced; priority can exceed 55 when a deadline is near or overdue.

### Test 4 - Export & import

**Steps**
1. Create at least two diverse goals.
2. Click `Export` and ensure a JSON file downloads.
3. Clear LocalStorage (`goaly_*` keys) and reload - the goals should disappear.
4. Click `Import`, choose the backup file and confirm the goals return with correct data.

**Expected outcome:** Export produces valid JSON, import restores all data.

### Test 5 - Check-in reminders

**Preparation**
1. Open settings.
2. Set the check-in interval to one minute.
3. Save.

**Steps**
1. Create a new goal (e.g. *Check-in test* with motivation `3`, urgency `4`).
2. Wait one minute (or fast-forward browser time).
3. A check-in banner should appear with the goal and reminder text.
4. Option A: click `Check-in completed` - the banner disappears.
5. Option B: click `Edit goal`, adjust values, save - the banner clears once completed.

**Expected outcome:** Check-ins trigger after the configured intervals (3, 7, 14, 30 units; minutes in dev mode, days in production).

## 🔧 Developer Notes

- Use English-only identifiers and terminology throughout the codebase.
- The project uses Jest for unit tests:

```bash
npm install          # install dependencies
npm test             # run full test suite
npm test -- --coverage  # add coverage report
```

- Reset browser data via DevTools → Application/Storage → Local Storage → remove `goaly_*`.
- For speedy testing, keep the check-in interval at one minute; real usage should prefer days.
- Browser requirements: modern browsers with ES6+, LocalStorage, CSS Grid/Flexbox support.

## 📁 Project Structure

```
goaly/
├── index.html
├── styles/
│   └── styles.css
├── src/
│   ├── app.js
│   ├── domain/
│   │   ├── check-in-service.js
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
    ├── acceptance_tests.md
    ├── cache_management.md
    ├── idee.md
    ├── mvp.md
    └── prompt.md
```

## 🎯 Post-MVP Ideas

- Multi-device sync via backend integration
- Authentication and user management
- Email or push notifications
- Extended analytics and visualisations
- Dedicated mobile app experience

## 📝 Notes

- All data lives in the browser (LocalStorage); no server or signup required.
- Use JSON export/import for manual backups.
- The application is responsive and works well on both desktop and mobile.

