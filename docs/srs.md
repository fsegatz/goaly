# Software Requirements Specification — Goaly v2

> **Status:** Draft  
> **Date:** 2026-03-14  
> **Version:** 0.4

---

## 1. Purpose

Goaly v2 is a complete rewrite of the existing Goaly goal-tracking web application. The new version replaces all custom persistence logic with Google Tasks as its sole data store and presents a purpose-built overlay UI on top of the Google Tasks API.

### 1.1 Definitions

| Term | Definition |
|---|---|
| **Todo** | A top-level Google Task that represents a user objective (previously called "Goal"). |
| **Step** | A subtask (child task) under a Todo in Google Tasks. |
| **Category** | A Google Tasks list used to group related Todos. |
| **Task List** | A named Google Tasks list; each Category corresponds to one Task List. |
| **Priority Score** | A computed numeric value that determines todo ordering: `motivation + (urgency × 10) + deadline bonus`. |
| **Deadline Bonus** | An additive score applied when a todo's due date is ≤ 30 days away: `max(0, 30 − daysRemaining)`. Continues to grow for overdue todos. |
| **Motivation** | A 1–5 integer rating of how personally motivating a todo is. |
| **Urgency** | A 1–5 integer rating of how time-sensitive a todo is. |
| **Active Todo Limit** | The configurable maximum number of todos shown as "active" on the dashboard (default: 3). |
| **Pause** | Temporarily suspend a todo from the active set, either until a specific date or until another todo is completed. |
| **Recurring Todo** | A todo that, upon completion, automatically recreates itself after a configurable period. Managed by Goaly via the `notes` JSON (the Google Tasks API does not expose recurrence fields). |
| **Presentation Service** | An independently deployable microservice responsible for UI rendering. Initially only the Classic variant is implemented. |
| **Orchestration Service** | A microservice implementing business logic (priority, pausing, statistics, recurrence). |
| **Persistence Service** | A microservice that wraps the Google Tasks API, Google Drive API, and OAuth token exchange. |

### 1.2 Background

The original Goaly application stores goal data in browser LocalStorage with optional Google Drive JSON-file synchronization. Features of the original application that are **not** carried forward in v2 include:

- The all-goals table view and associated status filters.
- The periodic review / check-in reminder system.
- Multi-language support (German, Swedish, auto-detect).
- Google Drive JSON-file synchronization.
- Import / export of JSON backup files.
- Developer mode.
- Force-activate goals regardless of priority.

These features are removed in favor of a simpler, more focused tool backed by Google Tasks.

By adopting Google Tasks as the canonical data store, Goaly v2 gains:

- Automatic multi-device sync via Google's infrastructure.
- Interoperability with the native Google Tasks apps (Android, iOS, Gmail sidebar).
- No local caching of user data, eliminating data-mismatch problems.

### 1.3 System Overview

Goaly v2 is implemented as microservices that communicate over REST APIs:

```
Browser
  └─ Classic Presentation Service (nginx / SPA)
       │
       └─ REST API calls ──► Orchestration Service
                                  └─ REST API calls ──► Persistence Service
                                                             ├─ Google Tasks API
                                                             ├─ Google Drive API (migration only)
                                                             └─ Cloud Function (OAuth)
```

- **Classic Presentation Service** — A multi-view SPA served by nginx. Calls the Orchestration Service REST API.
- **Orchestration Service** — Business-logic API server.
- **Persistence Service** — Wraps Google Tasks API, Google Drive API (for migration), and OAuth token exchange.

A **Modern Presentation Service** (single-page design at a separate URL) is planned for a later phase and will use the same Orchestration API.

### 1.4 References

| # | Document | Location |
|---|---|---|
| R1 | Google Tasks API Reference | https://developers.google.com/tasks/reference/rest |
| R2 | Google Drive API v3 Reference | https://developers.google.com/workspace/drive/api/reference/rest/v3 |
| R3 | Google OAuth 2.0 for Web Apps | https://developers.google.com/identity/protocols/oauth2/web-server |

---

## 2. Overall Description

### 2.1 Product Perspective

Goaly v2 is an overlay application that adds priority-based todo management semantics on top of Google Tasks. Todos are organized into categories that map directly to Google Tasks lists.

The existing CI/CD deployment pipeline is retained:

| Environment | Trigger | Cloud Run Services | Default Category List |
|---|---|---|---|
| **Dev** | Pull-request opened / updated | `goaly-dev-presentation`, `goaly-dev-orchestration`, `goaly-dev-persistence` | `Goaly Dev` |
| **Prod** | Push to `main` | `goaly-presentation`, `goaly-orchestration`, `goaly-persistence` | `Goaly` |

### 2.2 Design Constraints

| ID | Constraint |
|---|---|
| DC-1 | **English only** — no i18n; all strings are hardcoded in English. |
| DC-2 | **No local data caching by default** — every read/write goes through the Orchestration and Persistence Services to the Google Tasks API. The only exception: an opt-in "Remember me" flag that persists the refresh token in `localStorage`. |
| DC-3 | **Microservice architecture** — strict separation into Presentation, Orchestration, and Persistence services. Communication is exclusively via REST APIs. |
| DC-4 | **Vanilla frontend stack** — HTML, CSS, JavaScript (ES modules). No framework. |
| DC-5 | **Existing CI/CD** — Docker → nginx/node → Cloud Run. GitHub Actions. |
| DC-6 | **Google Tasks API as sole data store** — no secondary persistence. Custom fields (motivation, urgency, pause metadata, recurrence config) are serialized into the task `notes` field as structured JSON. |
| DC-7 | **Jest ≥ 80 % coverage** on statements, branches, functions, and lines. SonarQube quality gate must pass. |
| DC-8 | **Persistence Service mock** — a mock implementation of the entire Persistence Service REST API is checked in with the source code, enabling testing and local development of the Orchestration and Presentation layers without a live Google account. Not used in deployments. |
| DC-9 | **Secrets management** — all CI/CD secrets are stored exclusively as GitHub repository secrets: `GCP_PROJECT_ID`, `GCP_SERVICE_ACCOUNT`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GOOGLE_API_KEY`, `GOOGLE_CLIENT_ID`, `SONAR_TOKEN`. The OAuth client secret is stored in Google Cloud Secret Manager and accessed only by the Cloud Function for token exchange. |

### 2.3 Product Functions

| ID | Function | Description |
|---|---|---|
| PF-1 | Create Todo | Add a new top-level task in a selected Google Tasks list / Category. |
| PF-2 | Add Step | Add a subtask to an existing todo. |
| PF-3 | Set Deadline | Set or update the `due` date on a todo. |
| PF-4 | Pause Todo | Suspend a todo until a date or until another todo is completed. |
| PF-5 | Score Todo | Assign motivation (1–5) and urgency (1–5) ratings. |
| PF-6 | Show Top-N | Display only the highest-priority active todos up to the active todo limit. |
| PF-7 | Recurring Todos | Upon completion, automatically re-create the todo after a configurable period (custom logic in `notes` JSON). |
| PF-8 | Complete Todo | Mark a todo as completed (success or failure outcome). |
| PF-9 | Edit Todo | Update title, scores, deadline, steps, recurrence settings. |
| PF-10 | Delete Todo | Remove a todo and its steps entirely. |
| PF-11 | Statistical Overview | Display aggregated statistics across todos. |
| PF-12 | Categorize Todos | Organize todos into named categories backed by Google Tasks lists. |
| PF-13 | In-App Data Migration | Migrate existing todos from the v1 Google Drive JSON into Google Tasks. |
| PF-14 | External Edit Handling | Detect unparseable `notes` from external edits; fall back to defaults and offer revert. |

### 2.4 User Characteristics

The target user is a single individual who already uses a Google account and wants lightweight, cross-device todo tracking with automatic prioritization. The user may also edit tasks directly in the native Google Tasks app. The application handles unparseable external edits gracefully.

### 2.5 Constraints, Assumptions and Dependencies

| Type | Description |
|---|---|
| **Constraint** | Google Tasks API rate limits (per-user quotas). The app must handle `429 Too Many Requests` gracefully. |
| **Constraint** | Google Tasks subtasks are limited to one nesting level — sufficient for todos → steps. |
| **Constraint** | The `notes` field on a Google Task has a practical length limit. Metadata JSON must remain compact. |
| **Constraint** | The Google Tasks API does **not** expose recurring task fields. Recurrence must be implemented in Goaly's custom `notes` metadata. |
| **Assumption** | The user has a Google account with Google Tasks enabled. |
| **Assumption** | The user's browser supports ES modules and modern JavaScript (Chrome, Firefox, Edge, Safari current-1). |
| **Assumption** | The user may modify todos in the native Google Tasks UI. If the `notes` field is modified to be unparseable, the app falls back to default metadata values. |
| **Dependency** | Google Cloud Functions for OAuth token exchange (client secret stored in Google Cloud Secret Manager). |
| **Dependency** | Google Tasks REST API v1. |
| **Dependency** | Google Drive REST API v3 (for migration only). |
| **Dependency** | SonarCloud for code quality analysis. |
| **Dependency** | GitHub Secrets for CI/CD credential storage. |

---

## 3. Specific Requirements

### 3.1 External Interface Requirements

#### 3.1.1 Google Tasks API Mapping

The Persistence Service provides the `GoogleTasksAPIAdapter` module that encapsulates all Google Tasks API interactions. The following tables document the exact field mappings between the Google Tasks API and Goaly domain objects. Only fields actually present in the Google Tasks REST API (R1) are mapped.

**Task ↔ Todo Mapping**

| Google Tasks API Field | API Direction | Goaly Domain Field | Notes |
|---|---|---|---|
| `id` | Read | `todo.id` | Unique identifier, assigned by Google. |
| `title` | Read/Write | `todo.title` | Max 1024 characters. |
| `status` | Read/Write | `todo.googleStatus` | `needsAction` or `completed`. Internal statuses (active, inactive, paused) are derived by the Orchestration layer. |
| `due` | Read/Write | `todo.deadline` | RFC 3339 date-time. |
| `notes` | Read/Write | `todo.metadata` | Structured JSON (see schema below). |
| `completed` | Read | `todo.completedAt` | RFC 3339 timestamp, set by Google when status → completed. |
| `updated` | Read | `todo.lastUpdated` | Read-only, maintained by Google. Used for external edit detection. |
| `parent` | Read | — | Always `null` for top-level todos. |
| `position` | Read | `todo.position` | String indicating position among siblings. |
| `selfLink` | Read | — | URL to the task resource (internal use only). |
| `webViewLink` | Read | `todo.googleTasksUrl` | Deep-link into the Google Tasks web UI. |
| `deleted` | Read | — | Boolean; hidden from normal listing. |
| `hidden` | Read | — | Boolean; hidden from normal listing. |

**Google Tasks API Methods Used for Todos**

| API Method | HTTP | Goaly Operation |
|---|---|---|
| `tasks.list` | `GET /tasks/v1/lists/{tasklist}/tasks` | Fetch all todos in a category. |
| `tasks.get` | `GET /tasks/v1/lists/{tasklist}/tasks/{task}` | Fetch a single todo by ID. |
| `tasks.insert` | `POST /tasks/v1/lists/{tasklist}/tasks` | Create a new todo. |
| `tasks.patch` | `PATCH /tasks/v1/lists/{tasklist}/tasks/{task}` | Update specific todo fields. |
| `tasks.delete` | `DELETE /tasks/v1/lists/{tasklist}/tasks/{task}` | Delete a todo. |
| `tasks.move` | `POST /tasks/v1/lists/{tasklist}/tasks/{task}/move` | Reorder a todo or change its parent. |
| `tasks.clear` | `POST /tasks/v1/lists/{tasklist}/clear` | Remove all completed todos from a list. |

**Subtask ↔ Step Mapping**

| Google Tasks API Field | API Direction | Goaly Domain Field | Notes |
|---|---|---|---|
| `id` | Read | `step.id` | Assigned by Google. |
| `title` | Read/Write | `step.text` | Step description. |
| `status` | Read/Write | `step.completed` | `needsAction` / `completed`. |
| `parent` | Write (insert/move) | — | Set to the parent todo's `id` when creating. |
| `position` | Read | `step.order` | Ordering within the todo. |

Steps use the same `tasks.*` API methods as todos, with the `parent` query parameter on `tasks.insert` to create them as subtasks.

**Task List ↔ Category Mapping**

| Google Tasks API Field | API Direction | Goaly Domain Field | Notes |
|---|---|---|---|
| `id` | Read | `category.id` | Assigned by Google. |
| `title` | Read/Write | `category.name` | Display name of the category. |
| `updated` | Read | `category.lastUpdated` | Read-only, maintained by Google. |
| `selfLink` | Read | — | URL to the task list resource (internal use only). |

**Google Tasks API Methods Used for Categories**

| API Method | HTTP | Goaly Operation |
|---|---|---|
| `tasklists.list` | `GET /tasks/v1/users/@me/lists` | Fetch all categories. |
| `tasklists.get` | `GET /tasks/v1/users/@me/lists/{tasklist}` | Fetch a single category. |
| `tasklists.insert` | `POST /tasks/v1/users/@me/lists` | Create a new category. |
| `tasklists.patch` | `PATCH /tasks/v1/users/@me/lists/{tasklist}` | Rename a category. |
| `tasklists.delete` | `DELETE /tasks/v1/users/@me/lists/{tasklist}` | Delete a category. |

**Notes JSON Schema (stored in `task.notes`)**

```json
{
  "version": 1,
  "motivation": 3,
  "urgency": 3,
  "pauseUntil": null,
  "pauseUntilTodoId": null,
  "completionOutcome": null,
  "isRecurring": false,
  "recurPeriod": 7,
  "recurPeriodUnit": "days",
  "recurCount": 0,
  "completionCount": 0,
  "notCompletedCount": 0
}
```

#### 3.1.2 Google Drive API Mapping (Migration Only)

The Persistence Service provides the `GoogleDriveAPIAdapter` module that wraps the subset of the Google Drive REST API v3 (R2) needed for reading the legacy v1 `goaly.json` file. This adapter is used exclusively by the migration feature (FR-13).

**Google Drive API Methods Used**

| API Method | HTTP | Goaly Operation | Notes |
|---|---|---|---|
| `files.list` | `GET /drive/v3/files` | Search for the v1 `goaly.json` file. | Uses query parameter `q` to filter by name and MIME type. |
| `files.get` | `GET /drive/v3/files/{fileId}?alt=media` | Download the content of `goaly.json`. | `alt=media` returns file content instead of metadata. |

**Required OAuth Scope for Migration**

- `https://www.googleapis.com/auth/drive.file` — access to files created or opened by the app.

This scope is requested only when the user initiates migration. The primary scope (`https://www.googleapis.com/auth/tasks`) is always requested at login.

#### 3.1.3 OAuth 2.0 Interface

The existing OAuth flow (Authorization Code Flow via Cloud Function) is retained. The `GoogleOAuthAdapter` module in the Persistence Service wraps all token exchange interactions.

**Scopes:**

| Scope | When Requested |
|---|---|
| `https://www.googleapis.com/auth/tasks` | Always (at login). |
| `https://www.googleapis.com/auth/drive.file` | On-demand (when user initiates migration). |

The Cloud Function (`exchangeToken`) retrieves the OAuth client secret from Google Cloud Secret Manager and handles both initial code exchange and refresh-token-based token renewal.

#### 3.1.4 User Interface

The Classic Presentation Service is the initial implementation. A Modern Presentation Service (single-page design at a separate URL) is planned for a later phase and will use the same Orchestration REST API.

**Classic Presentation Service Views:**

| View | Purpose |
|---|---|
| **Dashboard** | Top-N active todos ordered by priority; pause and complete actions. |
| **Statistics** | Aggregated todo statistics (see FR-11). |
| **Settings** | Active todo limit; "Remember me" toggle. |
| **Migration** | In-app migration from v1 Google Drive data (see FR-13). |

**Modals:**

| Modal | Purpose |
|---|---|
| **Todo Form** | Create / edit a todo (title, motivation, urgency, deadline, category, recurrence). |
| **Pause Modal** | Pause a todo until a date or until another todo is completed. |
| **Completion Modal** | Mark a todo as completed (success or failure). |

### 3.2 Performance Requirements

| ID | Requirement |
|---|---|
| PERF-1 | Dashboard load time ≤ 2 seconds after authentication under normal network conditions. |
| PERF-2 | Save operations must provide visual feedback within 200 ms; the corresponding API call must complete within 5 seconds. |
| PERF-3 | The app must gracefully degrade when offline with a clear user notification. |
| PERF-4 | API calls must be sequenced to avoid exceeding Google Tasks rate limits; `429` responses must trigger exponential back-off. |

### 3.3 Logical Database Requirement

Google Tasks is the sole database. The data model is:

```
TaskList (Category: "Goaly Dev" / "Goaly" / user-created)
 └─ Task (Todo)
     ├─ title         string
     ├─ due           RFC 3339 date (deadline)
     ├─ status        "needsAction" | "completed"
     └─ notes         JSON string (metadata schema, see §3.1.1)
     └─ Subtask (Step)
         ├─ title     string
         └─ status    "needsAction" | "completed"
```

Recurring configuration is stored in the `notes` JSON (`isRecurring`, `recurPeriod`, `recurPeriodUnit`) because the Google Tasks API does not expose recurrence fields.

#### Data Integrity Rules

- If `notes` cannot be parsed as valid JSON, the todo defaults to `motivation: 3`, `urgency: 3`, all flags `false`/`null`. The user is shown an informational message (see FR-14).
- The `version` field in `notes` enables forward-compatible schema evolution.
- Todos are identified by Google-assigned `id`; no client-generated identifiers are stored.

### 3.4 Software System Attributes

#### 3.4.1 Reliability

| ID | Requirement |
|---|---|
| REL-1 | All Google Tasks API calls must include error handling with retry logic (exponential back-off, max 3 retries). |
| REL-2 | Failed writes must surface a user-visible error notification. |
| REL-3 | The application must never silently lose user data. |

#### 3.4.2 Availability

| ID | Requirement |
|---|---|
| AVL-1 | The application is available when the Google Tasks API is available. No independent SLA is stated. |
| AVL-2 | Cloud Run min-instances = 0; cold start is acceptable for this personal-use app. |

#### 3.4.3 Security

| ID | Requirement |
|---|---|
| SEC-1 | CI/CD secrets are stored exclusively as GitHub repository secrets: `GCP_PROJECT_ID`, `GCP_SERVICE_ACCOUNT`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GOOGLE_API_KEY`, `GOOGLE_CLIENT_ID`, `SONAR_TOKEN`. |
| SEC-2 | The OAuth client secret is stored in Google Cloud Secret Manager and accessed only by the Cloud Function. It is never exposed to the frontend or any other service. |
| SEC-3 | Access tokens are kept in memory only; never persisted to storage. |
| SEC-4 | Refresh tokens are stored in memory only by default. If the user enables **"Remember me"** at login, the refresh token may be stored in `localStorage` so the user remains authenticated across page refreshes. This is opt-in and clearly disclosed. |
| SEC-5 | CORS on services is restricted to the allowed deployment URLs. |
| SEC-6 | All traffic is HTTPS only. |

#### 3.4.4 Maintainability

| ID | Requirement |
|---|---|
| MNT-1 | Microservice architecture (Presentation, Orchestration, Persistence) with versioned REST API contracts. |
| MNT-2 | All Google Tasks field translations are isolated in `GoogleTasksAPIAdapter`; all Google Drive interactions in `GoogleDriveAPIAdapter`; all OAuth token operations in `GoogleOAuthAdapter`. All with full JSDoc. |
| MNT-3 | Jest test coverage ≥ 80 % (statements, branches, functions, lines) across all services. |
| MNT-4 | SonarQube quality gate must pass on every pull request. |
| MNT-5 | All modules use ES module `import`/`export` syntax. |

#### 3.4.5 Portability

| ID | Requirement |
|---|---|
| PRT-1 | The app runs on the latest two major versions of Chrome, Firefox, Edge, and Safari. |
| PRT-2 | Responsive layout from 360 px (mobile) to 1920 px (desktop). |
| PRT-3 | Each microservice is independently containerized (Docker) and deployable to any container runtime. |

### 3.5 Functional Requirements

#### 3.5.1 Functional Partitioning

```
┌─────────────────────────────────────────────────────────────────────┐
│                 Classic Presentation Service                        │
│                                                                     │
│  DashboardView   StatisticsView   SettingsView   MigrationView     │
│  TodoFormModal   PauseModal       CompletionModal                  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ REST API
┌──────────────────────────▼──────────────────────────────────────────┐
│                    Orchestration Service                             │
│                                                                     │
│  TodoService          PriorityService      PauseService             │
│  RecurrenceService    StatisticsService    CategoryService          │
│  MigrationService     SettingsService      AuthService              │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ REST API
┌──────────────────────────▼──────────────────────────────────────────┐
│                     Persistence Service                              │
│                                                                     │
│  GoogleTasksAPIAdapter    GoogleDriveAPIAdapter   GoogleOAuthAdapter │
└─────────────────────────────────────────────────────────────────────┘
```

**Naming convention:**

- Orchestration layer modules: suffix `Service` (e.g., `TodoService`, `PriorityService`).
- Persistence layer modules: suffix `Adapter` (e.g., `GoogleTasksAPIAdapter`, `GoogleOAuthAdapter`).
- Presentation modules: named by view or component type (e.g., `DashboardView`, `TodoFormModal`).

#### 3.5.2 Functional Description

##### FR-1 — Create Todo

| Attribute | Value |
|---|---|
| **Trigger** | User submits the Todo Form. |
| **Input** | Title (required), motivation (1–5, required), urgency (1–5, required), category (required, defaults to default list), deadline (optional), recurrence settings (optional). |
| **Processing** | 1. `TodoService` validates input. 2. `GoogleTasksAPIAdapter` calls `tasks.insert`. Metadata JSON is written to `notes`. `due` is set if deadline provided. 3. `PriorityService` re-evaluates the active set. |
| **Output** | New todo appears in the correct priority position. Dashboard refreshes. |
| **Error** | API failure → user-visible error; no partial state saved. |

##### FR-2 — Add Step to Todo

| Attribute | Value |
|---|---|
| **Trigger** | User adds a step in the Todo Form. |
| **Input** | Step text (required), parent todo ID. |
| **Processing** | `GoogleTasksAPIAdapter` calls `tasks.insert` with `parent` set to the todo's `id`. |
| **Output** | Step appears under the todo. |

##### FR-3 — Set Deadline

| Attribute | Value |
|---|---|
| **Trigger** | User sets or clears the deadline in the Todo Form. |
| **Input** | Date value or null. |
| **Processing** | `GoogleTasksAPIAdapter` calls `tasks.patch` to update `due`. `PriorityService` recalculates. |
| **Output** | Updated priority; dashboard re-orders. |

##### FR-4 — Pause Todo

| Attribute | Value |
|---|---|
| **Trigger** | User selects "Pause" on a todo. |
| **Input** | Either a date (`pauseUntil`) or a todo ID (`pauseUntilTodoId`). |
| **Processing** | 1. `PauseService` writes pause metadata to `notes` via `GoogleTasksAPIAdapter`. 2. Paused todo excluded from active set. 3. On each dashboard load, `PauseService` checks and clears expired pause conditions automatically. |
| **Output** | Todo shows "paused" status. Dashboard re-orders. |

##### FR-5 — Motivation & Urgency Scores

| Attribute | Value |
|---|---|
| **Trigger** | User sets scores during todo creation or editing. |
| **Input** | Motivation (integer 1–5), urgency (integer 1–5). |
| **Processing** | Stored in `notes` JSON via `GoogleTasksAPIAdapter`. `PriorityService` recalculates. |
| **Output** | Dashboard re-orders based on new priority. |

##### FR-6 — Show Top-N Active Todos

| Attribute | Value |
|---|---|
| **Trigger** | Dashboard load or any todo state change. |
| **Input** | All todos fetched via `GoogleTasksAPIAdapter`; active limit from `SettingsService`. |
| **Processing** | 1. Fetch all tasks from selected category via `tasks.list`. 2. Parse `notes` JSON. 3. Exclude paused and completed todos. 4. `PriorityService` calculates priority for each. 5. Sort descending (tie-break: older first). 6. Display top N. |
| **Output** | Dashboard shows exactly min(N, eligible count) todos. |

##### FR-7 — Recurring Todos

The Google Tasks API does **not** expose recurring task fields. Recurrence is therefore implemented as custom application logic using the `notes` JSON metadata.

| Attribute | Value |
|---|---|
| **Trigger** | User completes a todo that has `isRecurring: true` in its metadata. |
| **Input** | Recurrence settings from `notes`: `recurPeriod`, `recurPeriodUnit` (days/weeks/months). |
| **Processing** | 1. `GoogleTasksAPIAdapter` sets current todo's `status: "completed"`. 2. `RecurrenceService` creates a new todo (via `GoogleTasksAPIAdapter` → `tasks.insert`) with the same title, scores, and recurrence config. 3. New todo's deadline = `now + recurPeriod × recurPeriodUnit`. 4. `recurCount` and `completionCount` are incremented in the new todo's metadata. |
| **Output** | Completed todo remains in history; new todo appears in the active set. |

##### FR-8 — Complete Todo

| Attribute | Value |
|---|---|
| **Trigger** | User clicks "Complete" on a todo. |
| **Input** | Todo ID; completion outcome (success / failure). |
| **Processing** | 1. Completion modal is shown. 2. In **both** cases (success and failure), `GoogleTasksAPIAdapter` calls `tasks.patch` with `status: "completed"`. The outcome (`"success"` or `"failure"`) is written to `completionOutcome` in `notes`. If failure, `notCompletedCount` is also incremented. 3. If `isRecurring`, trigger FR-7. 4. Todo removed from active set. |
| **Output** | Todo marked completed. Dashboard re-orders. Statistics updated. |

##### FR-9 — Edit Todo

| Attribute | Value |
|---|---|
| **Trigger** | User opens an existing todo in the Todo Form. |
| **Input** | Any combination of title, motivation, urgency, deadline, steps, recurrence settings. |
| **Processing** | `GoogleTasksAPIAdapter` calls `tasks.patch`. If priority-relevant fields change, `PriorityService` recalculates. |
| **Output** | Updated todo; dashboard re-ordered if priority changed. |

##### FR-10 — Delete Todo

| Attribute | Value |
|---|---|
| **Trigger** | User clicks "Delete" in the Todo Form. |
| **Input** | Todo ID. |
| **Processing** | `GoogleTasksAPIAdapter` calls `tasks.delete`. `TodoService` re-evaluates active set. |
| **Output** | Todo removed from all views. |

##### FR-11 — Statistical Overview

| Attribute | Value |
|---|---|
| **Trigger** | User navigates to the Statistics view. |
| **Processing** | `StatisticsService` aggregates data fetched via `GoogleTasksAPIAdapter`: total todos, active/paused/completed counts, completion rate (success vs. failure), priority distribution, todos by category. |
| **Output** | Statistics view renders aggregated charts/counts. |

##### FR-12 — Categorize Todos

| Attribute | Value |
|---|---|
| **Trigger** | User selects or creates a category when creating/editing a todo, or manages categories in Settings. |
| **Processing** | `GoogleTasksAPIAdapter` wraps `tasklists.list`, `tasklists.insert`, `tasklists.patch`, and `tasklists.delete`. `CategoryService` exposes CRUD operations. Dashboard can be filtered by category. |
| **Output** | Todos organized by category. |

##### FR-13 — In-App Data Migration

| Attribute | Value |
|---|---|
| **Trigger** | User navigates to the Migration view and initiates migration. |
| **Input** | The v1 `goaly.json` file stored in Google Drive. |
| **Processing** | 1. `GoogleDriveAPIAdapter` calls `files.list` to locate `goaly.json`, then `files.get` with `alt=media` to download its content. 2. `MigrationService` parses the v1 payload, maps v1 goal fields to v2 domain fields (title, motivation, urgency, deadline, steps, recurrence, pause metadata). 3. `GoogleTasksAPIAdapter` creates corresponding todos and steps via `tasks.insert`. 4. Results (success count, skipped, errors) are displayed. |
| **Output** | V1 goals appear as todos in Google Tasks. |
| **OAuth** | Requests the additional `drive.file` scope if not already granted. |
| **Testing** | End-to-end tests cover the full migration flow using the Persistence Service mock (DC-8). |

##### FR-14 — External Edit Handling

| Attribute | Value |
|---|---|
| **Trigger** | `GoogleTasksAPIAdapter` fetches a todo whose `notes` field cannot be parsed as valid metadata JSON. |
| **Processing** | 1. The todo is displayed with default metadata values (motivation: 3, urgency: 3, all flags false/null). 2. An informational banner is shown on the todo: *"This todo was modified in Google Tasks. Custom fields have been reset to defaults because the metadata could not be read."* 3. The user is given a **"Restore Goaly metadata"** action that overwrites the `notes` field with a valid default metadata JSON, making fields editable again. |
| **Output** | Todo is always displayable. User can optionally restore metadata editability. |

#### 3.5.3 Control Description

**Priority Calculation (implemented in `PriorityService`)**

```
calculatePriority(todo):
    baseScore = todo.motivation + (todo.urgency × 10)

    if todo.deadline:
        daysRemaining = ceil((deadline − now) / oneDay)
        deadlineBonus = daysRemaining > 30 ? 0 : max(0, 30 − daysRemaining)
    else:
        deadlineBonus = 0

    return baseScore + deadlineBonus
```

Priority range: 11 minimum to 55+ (unbounded by overdue deadlines).

**Auto-Activation (implemented in `TodoService`)**

```
autoActivate(todos, maxActive):
    eligible = todos
        .filter(t => t.googleStatus ≠ "completed" AND NOT isPaused(t))
        .sort(by priority DESC, then createdAt ASC)

    activate top `maxActive` eligible todos
    set remaining eligible todos to inactive
```

**Pause Resolution (implemented in `PauseService`)**

```
checkPauses(todos):
    for each todo:
        if todo.pauseUntil ≤ today:   clear pauseUntil
        if todo.pauseUntilTodoId refers to a completed todo:   clear pauseUntilTodoId
    persist changes via GoogleTasksAPIAdapter
```

### 3.6 Environment Characteristics

#### 3.6.1 Hardware

No specific hardware requirements. The application runs in a browser on any device with network connectivity.

**Server-side (each microservice):**

- Google Cloud Run (container-based, auto-scaling 0–10 instances).
- Resources per instance: 256 Mi memory, 1 vCPU.

#### 3.6.2 Peripherals

- Standard web browser with network access.
- Keyboard and pointing device (desktop) or touch screen (mobile).

#### 3.6.3 Users

Single-user application. The authenticated Google account determines which Google Tasks data is accessed. No roles or multi-user features.

### 3.7 Other

#### 3.7.1 Persistence Service Mock

A mock implementation of the entire Persistence Service REST API is checked in alongside the source code. It simulates all endpoints exposed by `GoogleTasksAPIAdapter`, `GoogleDriveAPIAdapter`, and `GoogleOAuthAdapter`, enabling the Orchestration Service and Presentation Service to be tested and developed locally without a live Google account. The mock is never referenced by any deployment configuration.

#### 3.7.2 Observability

- All Persistence Service API calls log method name, HTTP status, and latency in a structured format.
- Errors are surfaced to the user via an in-app notification bar (non-blocking).

#### 3.7.3 Google Tasks List Management

On first authentication, `GoogleTasksAPIAdapter`:

1. Calls `tasklists.list` to check if the default list exists.
2. If not found, calls `tasklists.insert` to create it.
3. Caches the list ID in memory for the session only.

#### 3.7.4 Secrets Management

| Store | Secrets | Purpose |
|---|---|---|
| **GitHub repository secrets** | `GCP_PROJECT_ID`, `GCP_SERVICE_ACCOUNT`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GOOGLE_API_KEY`, `GOOGLE_CLIENT_ID`, `SONAR_TOKEN` | Injected at build/deploy time via GitHub Actions workflows. |
| **Google Cloud Secret Manager** | OAuth client secret (`GOOGLE_CLIENT_SECRET`) | Accessed only by the Cloud Function (`exchangeToken`) for OAuth token exchange. Never exposed to the frontend or any other service. |

No secrets are stored in any other location.

#### 3.7.5 REST API Contracts Between Services

Each service exposes a versioned REST API (prefix `/api/v1/`). API contracts (OpenAPI or equivalent) are defined and maintained alongside the source code. The Presentation Service communicates only with the Orchestration Service; the Orchestration Service communicates only with the Persistence Service.

#### 3.7.6 Repository Cleanup

All existing source files, tests, documentation, and configuration files from the v1 application that are not planned for use in v2 must be removed before implementation begins. This includes all existing `src/`, `tests/`, `docs/`, `.agent/`, and related files. Only CI/CD workflows, `Dockerfile`, `sonar-project.properties`, `AGENTS.md`, and this SRS are retained and adapted.

#### 3.7.7 Future: Modern Presentation Service

A second Presentation Service with a modern single-page design is planned for a later phase. It will be deployed at a separate URL, share no source code with the Classic service, and interact with the same Orchestration Service REST API. No implementation of the Modern service is in scope for the initial release.
