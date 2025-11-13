### Goaly - Goal Tracking Concept

**Description:** A focused web application that helps you define, prioritise and follow through on your goals.

#### Problem & Motivation
- People often lose track of their goals or attempt to juggle too many at once.
- Clear prioritisation makes it easier to stay motivated without feeling overwhelmed.
- Goaly keeps you focused on the most impactful goals and reminds you to reassess their relevance.

#### Core Functionality
1. Define goals with title, description and optional deadline.
2. Capture motivation and urgency on a 1-5 scale to quantify intent.
3. Configure how many goals may remain active simultaneously.
4. Dashboard
   - Overview of the currently active goals.
   - Prioritisation driven by motivation, urgency and deadline bonus.
   - Gentle reminders to revisit dormant goals (after 3, 7, 14 and 30 days by default).
5. Notifications / reminders to keep motivation high.
6. Runs as a browser-based web app - accessible from anywhere.

#### Usage Scenario
- A user defines four goals:
  - Train for a marathon (motivation 2, urgency 4, deadline in 3 months)
  - Learn Spanish (motivation 4, urgency 3, no deadline)
  - Write a book (motivation 3, urgency 2, no deadline)
  - Get a six-pack (motivation 3, urgency 5, deadline in 6 months)
- The user limits the active goals to two. The dashboard highlights “Marathon training” and “Get a six-pack” because they have the highest urgency.
- After three days, Goaly checks in about “Learn Spanish”. The user raises motivation to 5 due to an upcoming trip.
- The dashboard reorders to show “Learn Spanish” instead of “Marathon training”.
- The user spends ten minutes every morning reviewing progress and adjusting priorities.

#### Implementation Options
- **Option 1**
  - Frontend: static web app
  - Backend: hosted API with database
- **Option 2 (current MVP)**
  - Frontend: static web app
  - Data storage: browser LocalStorage with manual export/import for backups
- **Option 3**
  - Frontend: static web app
  - Backend: Firebase (database + authentication)

#### Constraints & Wishes
- No Streamlit (requires a running Python backend).
- UI should work on desktop and mobile.
- Build a working prototype quickly; iterate without overengineering.
- Zero cost infrastructure; avoid paid services.
- Structure work into modular packages to enable parallel development.
- Primary objective: practise AI-assisted software development.

