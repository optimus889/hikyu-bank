# Use case, benefits, challenges and reflection

## Scenario

Gospelhope David signs in, checks his checking balance, creates a low-balance
alert, generates a simulated notification and resolves it. Cheng-Yang Lee and
Mingyu Fan then sign in and see only their own balances, transactions and reminders.
After restarting Spring Boot, Gospelhope signs in again and sees the saved state.

## Compared with the earlier MVP

Browser-only storage could not establish trusted ownership or shared durable
records. The four tiers now separate rendering, workflows, SQL access and stored
data. Server sessions select identity, repositories filter owners, and PostgreSQL
owner-scoped queries and notification triggers reject cross-owner links. Alert CRUD persists across restarts;
transaction boundaries and the partial unique index protect consistency. Adding
another UI screen does not require copying SQL into a frontend component.

## Challenges and limits

The main refactor challenge was preserving the frontend contract while translating
provider fields into SQL columns, defining nullable references and reliable seed
behavior. The explicit Flyway schema avoids a history-table location changing when
a user-named schema appears. Existing users are skipped during seeding, preserving
inbox deletions and user edits. Tests exercise real PostgreSQL constraints instead
of claiming an in-memory substitute has identical behavior.

There is no production identity verification, signup, shared session store or real
OTP delivery. Checking/savings uniqueness works across instances, but competing
updates can still overwrite changes without version checks. Large lists require
pagination; production needs role separation, TLS, backups, observability and
session coordination. Alerts are preferences and simulated tests, not a scheduled
email/SMS delivery engine. No external AI or automation bridge is active.

## Reflection

Separating tiers made persistence replacement largely a repository/configuration
change while retaining UI behavior. Explicit SQL and migrations improved schema
review and repeatable startup. AI helped propose relationships, generate adapters
and identify test cases; reviewing those proposals remained necessary, especially
for same-owner foreign keys, decimal handling and transaction boundaries.

Figma supports the presentation design but does not implement database constraints.
A PostgreSQL-backed LCNC platform can help visualize schema and provide an AI
workflow; its evidence must be captured from actual platform use. This delivery
contains local AI-assisted code and tests, with platform-specific evidence pending.
