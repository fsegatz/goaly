# Dashboard Card System

## Overview

The dashboard displays two distinct types of cards that coexist in the same view:

1. **Review Cards** - For goals that need to be reviewed
2. **Active Goal Cards** - For active goals being worked on

This unified approach consolidates all goal interactions into a single dashboard view, eliminating the need for a separate Review view.

## Card Types

### Review Cards

Review cards appear when a goal's review is due. They allow users to:
- Update motivation and urgency ratings
- Submit the review to reschedule the next review date
- Edit the goal directly
- See review status (stable/updated)

**Visual Characteristics:**
- Orange border (`#f59e0b`) by default
- Green border when ratings are stable (unchanged from current values)
- Contains form inputs for motivation and urgency (1-5 scale)
- Shows sequence information (e.g., "Goal 1 of 3")
- Displays due date information (today, overdue by X days)
- Includes "Review completed" and "Edit goal" buttons

**Implementation:**
- Class: `check-in-card dashboard-review-card`
- Created by: `DashboardView.createReviewCard()`
- Styled in: `styles/styles.css` (`.dashboard-review-card`)

### Active Goal Cards

Active goal cards display goals that are currently active and within the maximum active goals limit. They allow users to:
- View and edit goal steps
- Edit the deadline
- Complete the goal
- See goal details (title, deadline, steps)

**Visual Characteristics:**
- Blue/purple border for active goals
- Contains goal steps section
- Contains deadline display and editor
- Includes "Complete" button for non-completed goals
- Standard goal card styling

**Implementation:**
- Class: `goal-card active`
- Created by: `DashboardView.createGoalCard()`
- Styled in: `styles/styles.css` (`.goal-card`)

## Card Ordering

Cards are displayed in the following order:

1. **Review cards first** - All review cards appear before active goal cards
2. **Review cards** - Ordered by `nextCheckInAt` (earliest first)
3. **Active goal cards** - Limited by `maxActiveGoals` setting, ordered by priority (highest first)

This ensures that goals requiring attention (reviews) are always visible and prioritized.

## Integration

### Dashboard View

The `DashboardView.render()` method:
- Fetches active goals and review check-ins
- Combines them into a single list
- Renders review cards first, then active goal cards
- Displays feedback messages after review submissions

### Review Submission

When a review is submitted:
1. `UIController.handleCheckInSubmit()` processes the submission
2. Review service records the review and updates the goal
3. Feedback message is displayed in the dashboard
4. Check-ins are refreshed and dashboard is re-rendered

### Feedback Display

A feedback banner appears above the cards when a review is completed:
- Success message when ratings are stable
- Info message when ratings are updated
- Displays the goal title and next review interval
- Automatically hidden when feedback is cleared

**Implementation:**
- Element: `#dashboardFeedback`
- Class: `check-in-feedback`
- Styled in: `styles/styles.css` (`.check-in-feedback`)

## Styling

### Review Cards in Dashboard

Review cards use distinct styling to differentiate them from goal cards:
- Different border color (orange/green)
- Different shadow effects
- Form-based layout with inputs

### Responsive Design

Both card types use the same grid layout:
- Desktop: Responsive grid with minimum 300px columns
- Mobile: Single column layout
- Cards adapt to available space

## Future Enhancements

As noted in the issue requirements, future enhancements could include:
- Filter toggle to hide review cards temporarily
- Sort options for card ordering
- Visual indicators for overdue reviews
- Batch review actions

## Code References

- **Dashboard View**: `src/ui/desktop/dashboard-view.js`
- **UI Controller**: `src/ui/ui-controller.js`
- **Review Service**: `src/domain/services/review-service.js`
- **Styles**: `styles/styles.css`
- **HTML Template**: `index.html`

