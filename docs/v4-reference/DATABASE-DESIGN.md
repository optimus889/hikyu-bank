# UUID-based PostgreSQL design

Schema authority: `backend/src/main/resources/db/migration/V1__create_schema.sql`
through `V4__validate_uuid_integrity.sql`. V1 stays byte-for-byte unchanged.
Runtime: PostgreSQL 17, Spring JDBC and `java.util.UUID`. No ORM is introduced.

## Entity relationship summary

- users 1 -> many accounts
- accounts 1 -> many transactions and alerts
- alerts 1 -> many notifications (optional alert reference)
- users many <-> many notifications through notification_recipients
- notifications 1 -> zero/one notification_account_links
- accounts 1 -> many notification_account_links

Alert notification accounts are derived from alerts. A direct account link is
allowed only when a notification has no alert. Current account notifications
can be delivered only to their owner; general system content can have multiple
recipients. The present API still creates one recipient per demo notification.

## Tables and fields

All fields are NOT NULL unless marked optional. Five entity IDs default to
`gen_random_uuid()`. All entity foreign keys use UUID too.

| Table | Fields | Keys and constraints |
| --- | --- | --- |
| users | id UUID; demo_code VARCHAR(80) optional; username VARCHAR(80); first_name/last_name VARCHAR(60); display_name VARCHAR(100) optional; password_hash/pin_hash VARCHAR(255); masked_phone VARCHAR(80); masked_email VARCHAR(100) | PK id; UNIQUE username and demo_code; hashes remain server-side |
| accounts | id UUID; user_id UUID; type VARCHAR(20); name VARCHAR(60); suffix CHAR(4); balance NUMERIC(19,2); status VARCHAR(20); credit_limit/minimum_due NUMERIC(19,2) optional; due_date DATE optional | PK id; FK user_id -> users; valid type/status, nonempty nickname, four-digit suffix and nonnegative finite money |
| transactions | id UUID; account_id UUID; name VARCHAR(100); category VARCHAR(50); posted_date DATE; amount NUMERIC(19,2); icon VARCHAR(20) | PK id; FK account_id -> accounts; finite signed amount; no redundant user_id |
| alerts | id UUID; account_id UUID; type VARCHAR(30); title VARCHAR(80); channel VARCHAR(20); amount NUMERIC(19,2) optional; scheduled_date DATE optional; enabled BOOLEAN | PK id; FK account_id -> accounts; valid type/channel, title and amount/date rules; no redundant user_id |
| notifications | id UUID; alert_id UUID optional; title VARCHAR(120); body TEXT; created_at TIMESTAMPTZ; source VARCHAR(30) | PK id; FK alert_id -> alerts; immutable identity/subject; title/body are historical snapshots |
| notification_recipients | notification_id UUID; user_id UUID; is_read/resolved BOOLEAN | PK(notification_id,user_id); FKs -> notifications/users; CHECK(NOT resolved OR is_read); ownership trigger |
| notification_account_links | notification_id UUID; account_id UUID | PK notification_id; FKs -> notifications/accounts; exclusivity and ownership trigger |

The existing `one_open_account_per_user_type` partial unique index remains:
(user_id,type) is unique for active/pending checking and savings. Credit, loan
and investment are not given an unsupported uniqueness restriction. Last-four
suffixes are display data and are not unique identifiers.

All parent deletes default to NO ACTION/RESTRICT. Deleting a notification
cascades its recipients/direct link only. Deleting one user's inbox entry does
not remove another recipient's entry; content is pruned only when no recipient
remains. Linked alert deletion remains protected by FK and application checks.

Indexes: accounts(user_id), transactions(account_id,posted_date DESC,id),
alerts(account_id), notifications(alert_id), notifications(created_at DESC,id),
recipients(user_id,notification_id), direct links(account_id). Business list
ordering does not rely on UUID lexical order.

## Normal forms and intentional state

1NF: scalar values, no comma-separated recipient collections. 2NF: non-key inbox
state depends on the full notification-and-user key. 3NF: transactions/alerts
no longer store the account owner's ID; notification content no longer repeats
an alert's account and owner; recipient state belongs to the delivery relation.
The independent display alias is optional. API `name` is otherwise computed
from first_name and last_name. Stored notification text is an immutable event
snapshot, not a live copy of an alert's current title.

Password/PIN hashes depend directly on the user and therefore remain in users.
The five fixed account types and scalar category values do not require lookup
tables for 3NF. Credit-specific nullable fields also depend on the account, so
they remain in accounts. New credential/type/category tables would increase
scope without resolving another current functional dependency.

Accounts.balance is a current snapshot. Demo transactions are a partial history,
not a complete ledger; their sum must not overwrite that snapshot. This API has
no transaction create/update financial workflow. Repository transaction saving
is bootstrap/import infrastructure, not a payment endpoint. Any future ledger
write must define opening balance and debt sign rules, then atomically update
ledger/balance with account locking and idempotency. No financial transfers are
added by this refactor.

Alert amount is a threshold for amount-type rules, and optional planned amount
for date-type rules. Existing scheduled amounts are copied unchanged and are
preserved by the date-editing UI. Switching rule types still clears irrelevant
fields. Amount/date semantics do not require another table.

## Identity migration

V2 creates private hikyu_migration.id_map with PK(entity_type,legacy_id) and
UNIQUE(entity_type,new_id). Existing canonical UUID values are preserved;
non-UUID identities are allocated once. Equivalent UUID spellings cannot collide.
V3 refuses unmapped writes between preparation and cutover, archives all old
records in hikyu_v1_archive, and copies complete records using that fixed map.
V4 verifies counts, monetary preservation, constraints and notification ownership.
Archives are guarded against writes and are never a second live persistence layer.

users.demo_code retains user-cl/user-gd/user-mf for demo identification. Accounts
never infer ownership from mf-/gd- prefixes. JSON serializes resource UUIDs as
strings; username, type, status, category, channel, source and template keys stay
strings. Fresh databases execute V1-V4 before UUID bootstrap; existing usernames
are skipped, preserving hashes and edits. Private schemas are not granted to
PUBLIC or added to Supabase's exposed Data API schemas by this project.

## Security boundary and cloud status

Spring sessions derive the authenticated UUID. All JDBC reads/writes remain
owner-scoped; transactions/alerts use account joins. Native UUID parameters use
ResultSet.getObject(..., UUID.class) and bound JDBC objects. Malformed resource
IDs return 400; valid unknown/foreign UUIDs return 404. No user ID supplied by a
browser can override the authenticated owner.

Cloud migration was not performed. Automatic approval review rejected SQL
inspection under the earlier no-Supabase-connection restriction. The source ZIP
contains no actual cloud config or database backups. The cloud migration guard
blocks an existing TEXT-ID cutover until explicitly approved in private config.
