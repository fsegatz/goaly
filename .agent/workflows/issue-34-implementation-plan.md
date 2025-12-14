---
description: Implementation plan for Issue #34 - Add Support for Recurring Goals
---

# Implementation Plan for Issue #34: Add Support for Recurring Goals

## Overview
This plan implements recurring goal support, allowing users to define goals that repeat over time. Goals can be created as recurring upfront or converted during completion.

## Changes Required

### 1. Data Model Changes (Goal.js)

**File**: `src/domain/models/goal.js`

Add new fields to the Goal model:
- `isRecurring` (boolean): Whether goal is marked as recurring
- `recurCount` (number): Number of times the goal has recurred
- `completionCount` (number): Number of times marked as completed
- `notCompletedCount` (number): Number of times marked as not completed

### 2. Goal Service Changes (goal-service.js)

**File**: `src/domain/services/goal-service.js`

Update `setGoalStatus` method to:
- When completing a goal with recurrence:
  - Move goal to "paused" state instead of "completed" or "abandoned"
  - Set `pauseUntil` to the recurrence date
  - Update the `deadline` to the recurrence date
  - Increment appropriate counters (completionCount or notCompletedCount)
  - Increment recurCount

### 3. UI Changes - Completion Modal

**File**: `index.html` (lines 342-354)

Update the completion modal to include:
- Checkbox: "Make this goal recur"
- Date input for recurrence date (shown when checkbox is checked)
- Update the modal structure to support this new functionality

**File**: `src/ui/desktop/modals-view.js`

Update modal handling:
- Add recurrence checkbox and date input references
- Update `setupCompletionModal` to handle checkbox state changes
- Update `openCompletionModal` to reset recurrence fields
- Pass recurrence data when handling completion choice

### 4. Goal Form Modal Changes

**File**: `index.html` (goal form modal section)

Add checkbox in the goal form to mark a goal as recurring when creating/editing

### 5. UI Changes - Goal Cards

**File**: Search for goal card rendering code

Add visual indicator (tag/badge) for recurring goals showing "Recurring" status

### 6. Status Rename: "Abandoned" → "Not Completed"

**Files to update**:
- `src/language/en.js` - line 48, 169, etc.
- `src/language/de.js` - corresponding lines
- `src/language/sv.js` - corresponding lines
- `index.html` - line 104 (filter option)
- Any UI components that display the status

### 7. Statistics Display

Add UI to display recurring statistics:
- Recur count
- Completion count  
- Not completed count

This can be shown in the goal card or goal detail view.

### 8. UI Controller Updates

**File**: `src/ui/ui-controller.js` or `src/app.js`

Update the `handleCompletionChoice` function to:
- Accept recurrence parameters
- Call the appropriate goal service methods with recurrence data
- Handle the paused state transition for recurring goals

### 9. Testing

Update or create tests for:
- Goal model with new recurring fields
- Goal service recurring completion flow
- UI interactions with recurring checkboxes
- Statistics tracking

## Implementation Order

1. **Data Model** - Add fields to Goal.js
2. **Status Rename** - Update all "Abandoned" to "Not Completed"
3. **Goal Service** - Implement recurring completion logic
4. **Completion Modal UI** - Add recurrence checkbox and date picker
5. **Goal Form UI** - Add recurring checkbox
6. **Goal Card UI** - Add recurring tag/badge
7. **Statistics Display** - Show recurring stats
8. **Integration** - Wire up UI to services
9. **Testing** - Update tests

## Notes

- Recurring metadata must sync correctly across devices
- Consider future extensions (weekly, monthly patterns)
- UI should clearly differentiate paused vs completed vs not completed states
- Ensure recurring behavior works with priority logic and active goal limits
