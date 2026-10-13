# Pay & Transfer validation — October 13, 2026

This revision extends the latest corrected Hikyu V5 project. Historical V1–V5 migration files were compared byte for byte against that source and remain unchanged. New migrations are V6 and V7. Tests used independently initialized PostgreSQL 17.6 databases; no existing Docker volume or live Supabase database was connected or modified.

| Executed verification | Result |
|---|---|
| Java 17 compile and executable Spring Boot package | PASS |
| Backend automated tests | **73 passed**, no failures/errors/skips |
| New peer-payment/payment-code integration tests | **13 passed** with real PostgreSQL |
| Existing extension/security integration tests | 19 passed |
| Existing API/constraint regression | 22 + 12 passed |
| OpenAI mock-provider tests | 7 passed; no real provider calls |
| Actual packaged-app HTTP checks | **58 passed**, including restart/re-login |
| Updated Postman collection and assertions | **27 passed** via cookie-aware HTTP runner |
| Frontend Node regression | 13 passed |
| Launcher regression with stub Docker/Maven | 14 passed |
| JavaScript syntax checks | 32 modules parsed successfully |
| V5 → V7 upgrade | PASS; IDs, balances, credentials and core rows unchanged |
| Figma composition/visual inspection | Desktop and narrow entry/review screens created with editable nodes and existing tokens; mobile code-only/PIN-plus-code states visually inspected |

The new integration tests cover balanced peer ledger entries, both-party receipts, masked recipient lookup, internal code-only authorization, peer PIN-plus-code authorization, payload/user/session binding, code expiry/lockout/issuance rate, idempotent replay/conflict, concurrent same-key requests, opposing-user payments without deadlock, distinct requests that could overdraw, invalid/foreign/self/unknown requests, forced second-leg rollback, notification deduplication/disabled rules and transaction search isolation.

A deliberately failing database trigger rejected the peer credit leg. Debit, credit, history, notifications and code consumption rolled back together; the same request was successfully retried after removing the trigger. Concurrent distinct $700 requests against $1,000 allowed exactly one payment; the source remained $300. A completed request replay never created additional financial entries or notifications.

Real HTTP checks confirmed internal transfer success without a PIN, rejection of a peer request without/wrong PIN or without/wrong code, shared receipt on retries, isolation from a third user, filtered incoming/outgoing peer legs, expiration of old login sessions after backend restart, persistent balances/history and safe completed replay with a newly issued code after re-login. Both SMS and email login reject missing/wrong card PINs and accept the correct code plus permanent PIN. Payment authorization rules remain unchanged.

Upgrade evidence: 3 users, 9 accounts, 36 transactions, 9 alerts and 3 notifications retained. Snapshot comparison included account UUID/owner/type/status/balance, user credential hashes/generation and pre-existing financial/reminder/inbox rows.

Postman desktop was not used. The exported request bodies, pre-request scripts and assertions were executed using a small compatible JavaScript harness and real HTTP cookie sessions. Browser interaction/DOM layout tests, Windows PowerShell execution, Docker Engine execution, live Supabase migrations, real SMS/email delivery and real OpenAI/payment-provider calls were **not executed**. Figma visual checks verify the design compositions; they do not replace browser layout testing. Manual browser acceptance steps are in MANUAL-TESTS.md.

The ZIP contains source, launchers, migration files, test cases and placeholder configuration. It excludes compiled output, caches and private environment files. AI remains Demo with blank key/model. All balances, transfers, users, OTPs and notifications are simulation data.


## Screenshot UI correction

Transactions now render their names as borderless text controls with transparent backgrounds; only those names open details. Settings shares navy/blue field and button styling, including its secondary sign-out action. Demo hints use Card PIN and no longer show Email Verification Only. Both SMS/email verification pages show the same required card PIN field.

API validation errors are explicitly English and never expose localized validator strings or raw regular expressions. A Chinese-locale MockMvc request verified the recipient-username error; four frontend tests cover English required, numeric, pattern/PIN/code and length/range messages without using browser validationMessage text. Native validation popups are prevented; inline errors retain keyboard focus and aria-invalid indicators.

Figma login/verification desktop and narrow frames were updated; Settings desktop/narrow frames were added using the existing tokens and controls. Mobile Settings wrapping and verification labels were inspected visually after fixing text sizing. This confirms design compositions; a real browser interaction test was not performed.

All V1–V7 SQL bytes remain unchanged from the preceding delivered revision. No new migration or PIN reset is needed for these UI/login corrections. Actual HTTP checks total 58; updated Postman collection requests/assertions total 27. Existing user data and credentials were preserved in an independent V5-to-V7 upgrade fixture; live data volumes/cloud databases were not accessed.
