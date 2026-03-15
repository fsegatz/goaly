# Software Requirements Specification — Goaly v2

**Status:** Draft  
**Date:** 2026-03-14  
**Version:** 0.5  

---

## 1. Introduction

This document defines the requirements for **Goaly v2**, a goal-tracking web application built on Google Tasks. It follows standard SRS guidelines (including IEEE 830/29148) by covering both functional and non-functional requirements. Goaly v2 is a complete rewrite of the original Goaly, rearchitected as a cloud-native, microservices-based application. The purpose of this specification is to describe the product’s scope, features, interfaces, and constraints in detail. Following IEEE recommendations, we first introduce the system purpose, context, and terminology.

### 1.1 Purpose
The Goaly v2 system allows a user to manage personal “Todos” (goals) and subtasks (“Steps”) via a web-based interface. It acts as an overlay on the Google Tasks platform, enforcing additional logic for priorities, recurrence, pausing, and statistics. The SRS covers the software to be built for version 2.0, excluding any legacy storage or external JSON synchronization. The application’s primary goal is to present an easy-to-use task dashboard with ranking and category features, while delegating data storage to Google Tasks. By documenting all requirements clearly, we ensure the development team and stakeholders share a common understanding of the intended features and constraints.

### 1.2 Definitions, Acronyms, and Abbreviations

The following terms are used throughout this document *(Additional acronyms and API names are explained where first used)*:

| Term | Definition |
| :--- | :--- |
| **Todo** | A top-level Google Task representing a user objective (previously called “Goal” in v1). |
| **Step** | A subtask under a Todo (a child task in Google Tasks). |
| **Category** | A named Task List in Google Tasks, used to group related Todos. In Goaly, each Category corresponds to one Task List. |
| **Priority Score** | A numeric value that orders active Todos, computed as: `motivation + (urgency × 10) + deadline bonus`. |
| **Deadline Bonus** | An additional score added when a Todo’s due date approaches or is past (calculated as `max(0, 30 - daysRemaining)`). |
| **Presentation Service** | The web frontend (Angular SPA) that the user interacts with. |
| **Business Logic Service** | The backend microservice implementing Goaly-specific logic (priorities, pausing, stats, recurrence). |
| **Persistence Service** | The microservice responsible for communicating with external data sources (Google Tasks API and Google Drive API for migration). |
| **Active Todo Limit** | Configurable limit (default 3) on the number of active Todos shown. |
| **Pause** | Temporarily suspends a Todo from the active set, either until a specific date or until another Todo is completed. |
| **Recurring Todo** | A Todo that is automatically recreated upon completion, according to user-specified recurrence rules. |

### 1.3 References
* **IEEE Std 830-1998** (Superseded by ISO/IEC/IEEE 29148:2011) – Recommended Practice for Software Requirements Specifications.
* **Pressbooks Requirements Engineering** – “Appendix C: IEEE 830 Template”.
* **TechTarget** – “Software Requirements Specification and IEEE Standards”.
* **Google Tasks API v1** documentation (REST endpoints).
* **Google Drive API v3** documentation (for migration).
* **OAuth 2.0** (Google Identity Platform).
* **Goaly v1 SRS** (previous version, for comparison of removed features).

---

## 2. Overall Description

This section describes the system context, user population, system constraints, and high-level features. It provides the product perspective and product functions overview as recommended by the IEEE SRS template.

### 2.1 Product Perspective
Goaly v2 is a web-based application that integrates with Google Tasks. It is a **new, self-contained product** (not just a replacement for an existing system). It runs as a single-page application (SPA) in the browser, while the backend services are deployed in the cloud. The product consists of three internal components (frontend, business logic, persistence) that communicate via RESTful APIs. Internally, the architecture follows a layered style:

* **Presentation Layer:** Angular-based web interface served via NGINX.
* **Business Layer:** Java-based API server (Spring Boot or similar) that implements Goaly rules.
* **Persistence Layer:** Java-based adapters that call Google’s APIs (no traditional database).

All components run together in one Docker container instance (one for development, one for production) to simplify deployment. *(Typically microservices run in separate containers, but here we collocate them as a deployment convenience.)*

### 2.2 Product Functions (Features)
The major features of Goaly v2 include:

* **Todo Management:** Create, view, edit, and delete Todos. Each Todo has a title, motivation (1–5), urgency (1–5), optional deadline, and optional Category.
* **Step Management:** Add and remove Steps (subtasks) for each Todo. Steps track completion status.
* **Pausing:** Pause or resume Todos; a paused Todo is temporarily excluded from the active set.
* **Prioritization:** Compute and display a Priority Score for each active Todo, based on motivation, urgency, and deadline. The dashboard always shows the top-N active Todos (configurable limit, default 3).
* **Recurrence:** Support for recurring Todos. When a recurring Todo is completed, a new Todo with updated dates is automatically created. Recurrence rules are defined by the user (stored internally in the Todo’s metadata, since Google Tasks itself has no recurrence feature).
* **Categorization:** Assign Todos to Categories (Google Task Lists). Each Category has a name and can be user-created (a new TaskList in Google).
* **Dashboard Views:** A dashboard showing active Todos, along with optional statistics (e.g., count of completed tasks, average scores).
* **Statistics and Reporting:** Provide a simple statistical overview (e.g., recent completed Todos, average motivation/urgency).
* **Migration Tool:** Import existing Goaly v1 data from Google Drive (JSON backup) into Google Tasks format. This is a one-time migration feature, invoked only if the user has old data.
* **Authentication:** Use Google OAuth to authenticate the user. After sign-in, the system accesses the user’s Google Tasks data on behalf of the user.

### 2.3 User Classes
There is essentially one user class: an individual **end user** who uses Goaly to manage personal tasks. We assume:

* Users have a Google account and can grant OAuth permissions to Goaly.
* Users interact via a modern web browser (Chrome, Edge, Safari, etc.).
* Users are moderately tech-savvy (familiar with basic web interfaces).
* No specialized technical users or administrators are considered in this scope. *(For example, all operations are performed under the single signed-in user’s Google account; there is no multi-user or admin role in v2.)*

### 2.4 Operating Environment
The system operates in the following environment:

* **Frontend:** Runs in the user’s web browser. The presentation layer is an Angular SPA (built with recent Angular CLI). It requires an up-to-date browser with JavaScript enabled.
* **Backend:** Deployed as a containerized service (e.g., Google Cloud Run or similar). It requires a Linux environment with Java 11+ (or Java 17 LTS recommended). Docker will be used for containerization, and the container includes the Business and Persistence services (as separate processes).
* **APIs:** The system communicates over HTTPS to Google’s services (Tasks API, Drive API, OAuth endpoints). No inbound hardware interfaces or devices are required.
* **Storage:** There is no separate database server; all task data resides in Google Tasks (and, for legacy migration, a Google Drive JSON file).
* **Concurrency:** Single-user operation; concurrent access conflicts are unlikely. The system must handle typical network latencies and API rate limits from Google (see Performance Requirements).

### 2.5 Design and Implementation Constraints
Several constraints will limit design options:

* **Technology Stack:** The frontend **must use Angular** (version 15+), with TypeScript and an Angular UI library (e.g., Angular Material) for components. The backend **must use Java** (version 11 or higher, preferably 17) with Spring Boot (or similar) for REST services. These choices are fixed by the team’s expertise and environment.
* **Containerization:** All three services (Presentation, Business, Persistence) will be packaged in a single Docker container image, with separate processes for each. One container instance will be deployed for the development environment and another for production.
* **External APIs:** The Persistence service will use the official Google API client libraries (or direct HTTPS calls) to interact with Google Tasks API v1 and Google Drive API v3. The system must conform to Google’s API usage policies and authentication flows (OAuth 2.0).
* **UI Design:** There will be only one presentation variant (the “Classic” multi-view SPA). Any references to an alternate “Modern” UI are for future planning and are not in scope for v2. All interface text is in English (no internationalization).
* **Deployment Platform:** The production container will run on a managed environment (e.g., Cloud Run or Kubernetes). For simplicity, features like service discovery, advanced orchestration, or microservice scaling are not required.
* **Logging and Monitoring:** The system should produce logs accessible from the container environment; we will use standard logging frameworks (e.g., Spring Boot logging) and expose health-check endpoints.
* **Regulatory and Compliance:** No special regulatory requirements (e.g., HIPAA) apply. User data are only simple task descriptions and are stored in the user’s Google account, not in the application’s database. However, standard security of OAuth tokens must be enforced (see Security Requirements).

### 2.6 Assumptions and Dependencies
We assume the following:

* The user has a Google account and can use Google Tasks (including creating Task Lists).
* Google APIs (Tasks, Drive, OAuth) are available and functioning; if Google Tasks is down, the app will not function (Availability requirement).
* No offline mode is required (the app requires network access to Google services).
* The user interface is intended for desktop browsers; mobile support is secondary (responsive UI is a plus but not required for core functionality).
* There are no legacy databases or servers to integrate (Goaly v1 data is only in Google Drive JSON backup, migrated via a one-time process).

---

## 3. System Architecture

Goaly v2 is built as a three-layer architecture (Presentation, Business, Persistence) implemented with three cooperating microservices. The simplified architecture diagram is shown below (solid arrows indicate runtime calls):

```text
┌──────────────────────────────────┐
│   Classic Presentation Service   │
│   (Angular SPA, served via NGINX)│
└──────────────┬───────────────────┘
               │ (HTTP/JSON calls)
               ▼
┌──────────────────────────────────┐
│  Business Logic Service (Java)   │
│  – Implements all application    │
│    rules (priorities, pausing,   │
│    recurrence, stats)            │
└──────────────┬───────────────────┘
               │ (HTTP/JSON calls)
               ▼
┌──────────────────────────────────┐
│   Persistence Service (Java)     │
│ – Wraps Google Tasks API,        │
│   Google Drive API (migration),  │
│   OAuth token exchange           │
└──────────────────────────────────┘

```

**Deployment:** A single Docker container image includes all three services. The container is configured to run all services (e.g., via a process manager or multiple entrypoints). We deploy one copy for dev and one for prod. *(Note: Typical microservice practice is one service per container, but here we combine them for simplicity; this decision can be revisited if scaling or isolation becomes an issue.)*

**Internal Interfaces:** The Presentation calls the Business service over RESTful HTTP (JSON) for all operations (e.g., `GET /todos`, `POST /todos`, etc.). The Business service in turn calls the Persistence service via REST to fetch/save data. Finally, the Persistence service makes outbound calls to Google APIs (Tasks/Drive) using HTTPS. All inter-service communication is stateless and secured (see Security Requirements).

**Service Interfaces:** The REST APIs between services are defined as follows:

* **Presentation → Business:** JSON over HTTPS. Endpoints include (for example) `/api/todos`, `/api/todos/{id}/steps`, `/api/categories`, `/api/stats`, etc. The Business service exposes these endpoints and enforces business logic.
* **Business → Persistence:** JSON over HTTPS (could be on localhost since same container, but logically an HTTP service). Endpoints include `/internal/tasks`, `/internal/tasklists`, etc. These adapt Business requests to Google API calls.
* **Persistence → Google:** Uses the official Google Tasks REST API (e.g., `GET https://tasks.googleapis.com/tasks/v1/lists`, `POST /tasks`, etc.) and Google Drive API for importing the migration JSON. Details of field mappings are described in Section 3.3.

*(All inter-service APIs use JSON; each request must include authentication/authorization headers as described in the Security section.)*

---

## 4. Interface Requirements

### 4.1 External System Interfaces

* **Google Tasks API:** The system uses Google Tasks API v1 for all data persistence. The Persistence Service performs standard operations: listing TaskLists, listing tasks in a list, creating/updating/deleting tasks and subtasks. (The user’s Google TaskList acts as the “Category” for Todos.) Required endpoints include `tasks/v1/users/@me/lists` and `tasks/v1/lists/{listId}/tasks`. Only the fields actually needed by Goaly are used; for example, a Task from Google maps to a Todo in Goaly. *(The detailed field mappings are specified in Section 5.3.)*
* **Google Drive API (Migration):** For importing legacy data, the Persistence Service reads a JSON backup stored in the user’s Google Drive. It uses the Drive API v3 (`files.get`) to retrieve the backup file. This is only invoked if the user requests a data migration.
* **OAuth 2.0:** The system integrates with Google’s OAuth 2.0 for user authentication. The Presentation Service directs the user to Google’s OAuth consent screen; on callback, the Business Service obtains and stores access/refresh tokens (only in memory) to use Google APIs. The OAuth client ID/secret are kept in secure storage (not in source code).
* **Browser Frontend:** The user interacts via the Presentation Service UI. No special browser plugins are required. The UI sends/receives JSON to the Business API via HTTPS.

### 4.2 Software Interfaces (Inter-Service APIs)

The internal APIs between the three Goaly services are defined as follows:

* **Classic Presentation → Business Service:** The frontend issues HTTPS requests to the Business API. For example, creating a Todo uses `POST /api/todos` with JSON body `{ "title": "...", "motivation": 3, ... }`. The Business API responds with JSON Todo objects. All such endpoints return HTTP status codes (200/201 on success, 4xx for client errors, etc.). Error handling is performed by the Presentation (e.g., show user an error message on non-2xx responses).
* **Business Service → Persistence Service:** The Business logic calls the Persistence service (e.g., `GET /internal/tasklists`, `GET /internal/lists/{id}/tasks`) to retrieve or store raw data. These internal endpoints are also JSON-over-HTTPS. The Persistence layer provides a mapping between domain objects (Todo, Step, Category) and Google API calls. (For example, to fetch all Todos, Business might call `GET /internal/tasklists/{categoryId}/tasks`.)
* **Data Formats:** All service-to-service communication uses JSON. We define data transfer objects (DTOs) for Todos, Steps, and Categories. These correspond closely to the Goaly domain model (see 5.3).

*(Interfaces are further detailed in the API documentation, including expected JSON schemas. Each microservice will have automated tests for its API endpoints to ensure conformance.)*

---

## 5. Specific Requirements

This section enumerates the specific requirements of the Goaly system, organized by category. The IEEE SRS template recommends separate sections for functional and non-functional requirements. Below we list Functional Requirements (what the system must do) in Section 5.1, and Non-functional Requirements (quality attributes and constraints) in Section 5.2 and 5.3.

### 5.1 Functional Requirements

Each functional requirement is uniquely identified and stated in “shall” form. For brevity, we summarize major use cases below:

* **FR-1: Create Todo.** The user can create a new Todo by submitting a form. **Trigger:** User completes the Todo creation form and submits. **Behavior:** The system shall add a new Todo with the given title, motivation (1–5), urgency (1–5), optional deadline (date), and category. The new Todo is posted to Google Tasks (via the Persistence Service). The Business layer shall compute its initial priority score. (Preconditions: Title, motivation, and urgency must be provided.)
* **FR-2: Add Step to Todo.** The user can add a Step to an existing Todo. **Trigger:** In the UI, the user selects “Add Step” on a Todo and enters a step title. **Behavior:** The system shall create a new subtask under the corresponding Google Task. The Business layer updates its in-memory model so the UI shows the new Step under that Todo.
* **FR-3: Set or Change Deadline.** The user can assign a due date to a Todo or modify an existing due date. **Behavior:** The system shall update the Todo’s deadline field and sync this change to Google Tasks. Future calculations of priority score shall incorporate the updated deadline (e.g., by adjusting the deadline bonus).
* **FR-4: Pause Todo.** The user can pause (suspend) or resume a Todo. **Behavior:** When a Todo is paused, it is excluded from the active set of Todos shown in the dashboard. The system shall record a paused Todo’s state (e.g., by setting a flag in its metadata JSON). A paused Todo remains in Google Tasks but is ignored by the Business logic until resumed. The user may also resume a paused Todo, at which point it becomes active again.
* **FR-5: Motivation & Urgency Scores.** Each Todo has two user-provided scores: motivation and urgency (each 1–5). When creating or editing a Todo, the UI shall allow the user to set these scores. The Business logic shall use these scores to compute the Todo’s priority (along with the deadline bonus).
* **FR-6: Display Top-N Active Todos.** On the dashboard, show the highest-priority Todos up to the active limit (default N=3). **Behavior:** The system shall sort all non-completed, non-paused Todos by their priority score and display the top N. If fewer than N active Todos exist, show all active Todos. When a Todo is marked completed or paused, the next-highest Todo enters the active set.
* **FR-7: Recurring Todos.** The user can mark a Todo as recurring (specifying daily/weekly intervals, etc.). **Behavior:** When a recurring Todo is completed, the system shall automatically create a new Todo with the same title, motivation, urgency, and category, but with its deadline advanced by the recurrence interval. Recurrence rules are stored in the Todo’s metadata JSON because Google Tasks has no native recurrence.
* **FR-8: Complete Todo.** The user can mark a Todo as completed (e.g., by checking a checkbox). **Behavior:** The system shall update the Todo’s status in Google Tasks to `completed` (via the API) and record the completion date. If the Todo is recurring, immediately create the next recurrence (see FR-7). Completed Todos move out of the active set and can be viewed in history.
* **FR-9: Edit Todo.** The user can edit a Todo’s attributes (title, motivation, urgency, deadline, category, or recurrence settings). **Behavior:** The system shall apply changes to the Todo and sync updates to Google Tasks. If category is changed, the Todo moves to the corresponding Google TaskList.
* **FR-10: Delete Todo.** The user can delete a Todo. **Behavior:** The system shall remove the Todo from Google Tasks (permanently delete). This also deletes any associated Steps (subtasks).
* **FR-11: Statistical Overview.** The user can view basic statistics (e.g., number of completed Todos, average motivation/urgency, tasks per category). **Behavior:** The system shall compute simple metrics from the data and display them on a “Statistics” view.
* **FR-12: Categorize Todos.** The user can create, rename, and delete Categories. **Behavior:** Creating a Category creates a new Google TaskList. Renaming or deleting a TaskList applies to that Category. Deleting a Category should prompt the user to either move or delete its Todos.
* **FR-13: In-App Data Migration.** If the user has a Goaly v1 backup, they can import it. **Behavior:** The system shall read the JSON file from Google Drive, parse Goaly v1 tasks, and recreate them in Google Tasks under the current Goaly TaskList. This is a one-time operation with progress feedback.
* **FR-14: Handle External Edits.** If the user edits tasks directly in Google Tasks (outside Goaly), the system must handle it gracefully. **Behavior:** When syncing, the system shall detect if a Todo’s data in Google has been changed (e.g., via Google web or another device) and update the Goaly view accordingly. Inconsistencies (e.g., malformed metadata) shall trigger an informative error message to the user.

*(Each requirement above is necessary for core functionality and is stated in “shall” form for clarity. Together, they cover all major features summarized in Section 2.2.)*

### 5.2 Non-functional Requirements

These requirements specify quality attributes (reliability, performance, security, etc.) of the system.

#### 5.2.1 Performance

* **PERF-1:** Dashboard load time shall be ≤ 2 seconds after authentication (on a typical broadband connection). This includes fetching active Todos via API and rendering the UI.
* **PERF-2:** All REST API calls between services (Presentation→Business→Persistence) shall complete within 1 second under normal conditions. Bulk operations (e.g., initial migration of many tasks) may take longer but should show progress.
* **Rationale:** Good responsiveness is required so the user perceives the app as fast (ISO/IEC/IEEE 29148 emphasizes performance requirements in SRS).

#### 5.2.2 Reliability

* **REL-1:** All calls to external APIs (Google Tasks/Drive) must use retry logic (e.g., exponential back-off, up to 3 attempts) to handle transient errors.
* **REL-2:** On any failed operation that cannot be retried (e.g., network or API error), the system shall display a clear error message to the user. No operation should fail silently.
* **REL-3:** The application shall never silently lose user data. Any local state in Progress (e.g., new Todos not yet synced) must be preserved (or recovered) if a recoverable error occurs.

#### 5.2.3 Availability

* **AVL-1:** The application’s availability depends on Google Tasks availability. (No separate SLA is promised.) If Google Tasks is down, Goaly cannot function.
* **AVL-2:** The system should be stateless enough to allow zero-downtime deployments. The container can scale down to 0 instances when idle (cold start is acceptable for this personal-app use case).

#### 5.2.4 Security

* **SEC-1:** OAuth client credentials (client ID/secret) and API keys must be stored securely (e.g., in environment variables or a secrets manager), and never in source control. Developer/test tokens must likewise be secured.
* **SEC-2:** Access tokens and refresh tokens obtained via OAuth shall be kept in memory only (they are not persisted to disk). Refresh tokens in memory shall only be used if the user has explicitly opted into offline access.
* **SEC-3:** All inter-service communication shall occur over HTTPS. Internal API endpoints should be protected (e.g., by using a secret token or mutual TLS within the container). The frontend must authenticate with the Business API (e.g., using a session cookie or JWT obtained after OAuth).
* **SEC-4:** The application shall follow the principle of least privilege. For example, the OAuth token’s scope is limited to only the Google Tasks and Drive permissions needed (no wide Google account access).

*(These security requirements ensure that user data (Google Tasks) remains protected and that the system complies with best practices for handling credentials and tokens.)*

#### 5.2.5 Modifiability and Extensibility

The system is designed with separation of concerns: the Business logic is separate from the persistence layer (data access). This allows changes (e.g., a new data store) without rewriting the entire logic layer. Likewise, the UI is separate from backend logic. Each service has a well-defined interface (REST API), facilitating independent development and testing.

The use of standard frameworks (Angular, Spring Boot) and containerization (Docker) ensures the system can be updated or migrated to new infrastructure with minimal change. The data model uses versioned metadata (see 5.3) to allow future schema evolution.

#### 5.2.6 Observability and Maintenance

* **Logs:** All services shall log relevant information (errors, key events) in a standardized format (e.g., JSON logging). Logs should include timestamps and context to aid debugging.
* **Metrics:** The Business and Persistence services shall expose a health-check endpoint (e.g., `/health`) and optionally simple metrics (e.g., number of API calls). These are primarily for internal monitoring.
* **Failure Handling:** The system should fail gracefully. For example, if the Persistence Service cannot reach Google, the UI should indicate that data is unavailable rather than crash.

### 5.3 Logical Database (Data) Requirements

There is no separate relational database. Google Tasks (and TaskLists) **is** the data store. However, we describe the conceptual data model and mappings to Google’s model:

```text
TaskList (Category)
 └─ Task (Todo)
     ├─ title       (string)
     ├─ due         (RFC 3339 date-time, optional)
     ├─ status      ("needsAction" or "completed")
     ├─ notes       (string, containing JSON metadata)
     └─ Subtask (Step)
         ├─ title   (string)
         └─ status  ("needsAction" or "completed")

```

**Mappings:**

* A **Category** in Goaly corresponds to a Google **TaskList**. TaskList names include “Goaly Dev”, “Goaly” (default), or any user-named lists.
* A **Todo** in Goaly corresponds to a Google **Task** within a TaskList. The mapping of fields is as follows:
* `Todo.title` ⇄ Google Task’s `title`.
* `Todo.deadline` ⇄ Google Task’s `due` (the RFC3339 due date).
* `Todo.googleStatus` ⇄ Google Task’s `status` (`needsAction` vs `completed`). The Business layer additionally interprets a status=“completed” as finished. Active/paused state is tracked in `notes`.
* `Todo.notes` ⇄ Google Task’s `notes`. Goaly uses this field to store structured JSON (e.g., `{ "paused": true, "isRecurring": true, ... }`), since Google Tasks has no dedicated fields for those concepts.


* A **Step** in Goaly corresponds to a Google **Subtask** (a Task whose parent is the Todo). Only `title` and `status` are relevant for a Step. Completed steps have `status=completed`.

Recurrence and Pause flags are **not** native in Google Tasks, so they are stored in the JSON in `notes`. When a recurring Todo is completed, the Business service reads the `isRecurring` flag and creates a new Task accordingly.

**Data Integrity Rules:**

* If the JSON in `notes` is malformed or cannot be parsed, the system treats the Todo conservatively (e.g., defaults to not paused, not recurring). The user should see an informational error (see FR-14).
* The `notes` JSON includes a `version` field. This enables forward-compatible changes to the metadata schema. On upgrade, the Business layer will handle older versions gracefully.
* Each Todo is uniquely identified by its Google-assigned `id` (no separate ID field is generated).
* If a Category (TaskList) is deleted via the UI, all its Todos and Steps are deleted in Google Tasks as per normal API behavior.

*(These mappings ensure that the logical data requirements of Goaly are fully supported by Google Tasks. By treating Google Tasks as the “sole database,” we simplify the design, but we handle its limitations via metadata and Business logic.)*

### 5.4 Software System Attributes (Other Quality Requirements)

In addition to the above, we note the following system attributes:

* **Maintainability:** The codebase uses modern frameworks with broad community support. The layering (Angular frontend, Java backend) and the use of clear interfaces make the system maintainable and testable. Following SRS practice, requirements are written clearly and modularly (see Section 5).
* **Portability:** The application is platform-independent beyond requiring Docker/Java/Node runtime. Developers can run the system locally on any platform supported by Docker.
* **Scalability:** Although intended for individual use, the microservice design allows (if needed) deploying multiple instances. In practice, we rely on Cloud Run’s auto-scaling (e.g., scaling down to zero when idle) for cost efficiency.
* **Usability:** The UI shall be intuitive, following standard web conventions (e.g., consistent navigation). Detailed UI standards are documented separately in the UI style guide.
* **Language:** All user-visible text is in English only.

### 5.5 Future Considerations (Out of Scope for v2)

* A **Modern Single-Page Application** (SPA) redesign is planned for a later version and is not covered here.
* Native mobile applications or offline mode are not supported in this version.
* Integration with other calendaring or task systems is not included.
* Any advanced features not mentioned above (e.g., collaboration, extensive reporting) are out of scope.

---

*This SRS has been prepared in accordance with standard software engineering practice. All requirements are stated explicitly to serve as a contract between stakeholders and developers. Where relevant, requirements are stated in "shall" form and are testable and verifiable. Any future changes or additions to requirements should follow a formal review process to maintain consistency and traceability.*