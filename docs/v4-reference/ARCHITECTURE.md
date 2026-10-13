# Four-tier architecture — PostgreSQL edition

![Architecture](architecture.svg)

## Presentation tier

frontend/ contains HTML, CSS and ES modules. API clients fetch same-origin JSON;
components render accounts, transactions, profile initials, alert forms and inbox
states. The credentials page and OTP/PIN page remain separate. REST controllers
are HTTP presentation adapters: they validate request DTOs, choose response status
and pass the trusted user identity to application services. They do not issue SQL.
The session interceptor obtains identity from verified server session state and
sets the request attribute. A submitted userId cannot override the current owner.

## Application logic tier

AuthService owns password, OTP, PIN, expiry and authentication workflow. AccountService
applies product rules; AlertService validates thresholds/dates and reference changes;
NotificationService controls read/resolved/delete transitions. TransactionService
validates account filters and AssistantService supplies only owned data to the
rule-based assistant. These services depend on repository interfaces and immutable
models, not a browser, JDBC connection, servlet request or provider record ID.

Spring transactions protect account creation, alert/inbox workflows and bulk
mark-all-read. The partial unique index also protects checking/savings restrictions
across concurrent backend instances; Java synchronization alone is not the guarantee.
An alert with linked notifications cannot be removed or moved to another account
until those notifications are removed. Services explain this as a 409 conflict;
foreign keys independently prevent dangling references. Multi-instance updates can
still require optimistic versioning/row locks in future work; not every write is a
serializable transaction and there is currently no distributed session store.

## Data access tier

Repository interfaces define find/save/delete operations with explicit owner IDs.
The PostgreSQL adapters bind SQL values with JdbcTemplate, map date/timestamp and
NUMERIC columns into domain records, and include user_id in all financial reads,
updates and deletes. Upserts refuse to transfer a row to another owner. There is
no SQL concatenation of user input. A small Hikari connection pool is configured.
Database errors are converted into stable HTTP messages without leaking raw SQL.

Business logic is independent of SQL column names. Replacing these adapters later
would preserve the API contract but require reviewing consistency and transaction
semantics. This implementation uses JDBC for clear, reviewable schema/query behavior.

## Database tier

PostgreSQL stores seven business tables in schema hikyu: users, accounts, transactions,
alerts, notifications, notification_recipients and notification_account_links.
Flyway tracks the V1-V4 migration sequence in the same explicit
schema; it does not rely on the connection's changing default search path. A Docker
named volume persists data across app/database restarts. Keys, owner-scoped joins and notification
ownership guards, CHECK constraints and a partial unique index enforce structural rules.
NUMERIC(19,2) preserves exact financial decimals; DATE represents dates and TIMESTAMPTZ
represents inbox instants. BCrypt hashes are stored instead of plaintext passwords/PINs.

DemoDataSeeder holds a transaction-scoped advisory lock and seeds an entire missing
profile atomically. Existing users are skipped, so edited/deleted records are not
restored on launch. Startup failure rolls back the batch. The JSON seed template
is initial sample input; runtime financial records are queried from PostgreSQL.

## Requests, scalability and deployment

GET /accounts: browser → session interceptor/controller → AccountService →
AccountRepository → owner-filtered JDBC SELECT → PostgreSQL. Domain records return
through service/controller as JSON; the component renders them.

POST /alerts: validate DTO → derive owner → verify the account and threshold/date →
start service transaction → repository INSERT → database constraints → commit → 201.
PUT preserves the business ID. DELETE verifies ownership/references and commits removal.
On a constraint failure the transaction rolls back and the API returns a safe conflict.
No browser communicates directly with PostgreSQL or carries a database password.

One backend serves both UI and REST for simple local operation; PostgreSQL is a
separate process. The frontend can be deployed separately with deliberate origin,
authentication and cookie configuration later. Database pooling and owner/date
indexes support moderate growth, while migrations make deployments reproducible.
For multiple backend instances, shared sessions, write conflict handling, monitoring,
backup/restore, managed credentials and capacity planning need further implementation.

## AI and LCNC boundaries

Code, SQL and documentation are AI-assisted; constraints are verified on PostgreSQL.
PostgreSQL itself does not provide an embedded conversational schema assistant.
Supabase is an optional PostgreSQL-backed platform for the assignment's AI/visual
schema workflow; see database/AI-WORKFLOW.md. No Supabase project or platform AI
execution is claimed here. Figma is the UI reference; this database task does not
edit Figma. Bubble/Zapier/WordPress remain integration plans, not working connections.
