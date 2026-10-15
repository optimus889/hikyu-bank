# V5 Migration and Compatibility

The initial extension is `V5__banking_extensions.sql`; this revision adds V6 and V7 without changing V1–V5. V1–V4 match the supplied ZIP byte for byte. Existing core rows and UUIDs are preserved. New objects:

| Object | Purpose |
|---|---|
| users.auth_version | Persistent credential generation for session/challenge revocation |
| users.pin_initialized | Initialize built-in PIN defaults once, retain later chosen PINs |
| accounts_owner_key | Composite account/owner FK support |
| transfers | Immutable business history, owner, source/target, amount, note and idempotency key |
| transactions.kind/note/transfer_id | Preserve original transaction fields while identifying transfer legs |
| user_preferences | Per-user automatic inbox notification switches |
| alert_events | Unique transfer/rule trigger record, retains deduplication after inbox deletion |

Existing transaction kinds are inferred from amount sign. The transfer service locks the user row to serialize persistent idempotency, then both accounts in UUID order; debits, credits, two legs and notifications are one database transaction. Transfer records use composite foreign keys to prevent linking accounts across owners. The user lock deliberately favors simplicity over high per-user throughput.

On the first V5 start, the three built-in users get distinct fixed hashed PIN defaults: Lee 1037, David 5842, Fan 9061. Other pre-existing profiles retain their existing PIN hash; new registrations always use the user-selected PIN and are already initialized. Later restarts do not change PINs. Password/PIN changes invalidate existing sessions on subsequent requests.

The application guard blocks V5 on an existing V4 database unless HIKYU_EXTENSION_MIGRATION_APPROVED=true is explicitly supplied. This guard is application-level; independently running Flyway tools can bypass it. Do not operate the V4 binary on an upgraded database. Retain a backup and test a restored copy before an intended upgrade. Validation in this delivery used an isolated V4 database built from the uploaded source, not the live Docker volume or Supabase.

No migration was applied to the user's existing local or cloud database. Default production Compose remains bound to the original external volume; compose.test.yaml uses a separate named test volume and port.


## Additive payment migrations

- `V6__person_to_person_payments.sql`: peer receipts with sender/recipient ownership FKs, unique sender/request keys, linked `peer_transfer` ledger legs, wider kind column and unique peer-alert events. Existing internal transfer and original income/expense rows remain valid.
- `V7__payment_verification.sql`: session/payload/code hashes, five-minute expiration, failed-attempt counter and consumed flag. No plaintext PIN/code is stored. Issuance counters are database-backed and survive backend restarts.

A seeded independent V5 database is upgraded to V7 during delivery validation; core UUIDs, balances and credentials must remain unchanged. New V6/V7 rows are additive. Never edit historical applied migration SQL or use Flyway repair to bypass a checksum conflict. No existing Docker volume or live Supabase database was touched for this change. The old V5 client transfer request must now obtain and include a payment code; the packaged frontend and Postman collection are updated together.


## V8 — second banking batch

`V8__banking_batch_two.sql` adds saved_payees (owned soft-deleted peer/biller references), card_controls, budgets, financial_operations and financial_alert_events. It adds transactions.operation_id and credit_payment kind plus leg uniqueness and owner/date indexes. Composite owner/account and owner/payee foreign keys prevent cross-user financial linkage. Credit repayment references must have a target; bill operations must have an owned payee.

Existing V1–V7 files are byte-identical to the uploaded baseline. V8 changes no existing balances, users, credentials, transactions, alerts or notifications; new card controls begin unlocked. No data volume/cloud project is modified during delivery testing. Test an independently restored V7 copy and retain a backup before normal startup applies V8. Existing V4 extension approval and UUID migration safeguards remain. Do not run an older client against an intentionally upgraded database; do not modify or repair historical SQL checksums.

A seeded V7 database was upgraded to V8 with identical core snapshots: 3 users, 9 accounts, 36 transactions, 9 alerts and 3 notifications. The test comparison included UUIDs, credential hashes/generation, balances and existing ledger/reminder/inbox rows.
