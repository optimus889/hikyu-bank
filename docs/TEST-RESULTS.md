# Batch 2 validation — 2026-10-15 UTC

The sole application source was the newly uploaded Hikyu-Bank-Project-V5(1).zip. Existing V1–V7 SQL bytes were compared directly to the ZIP and remain unchanged. Tests used an independent PostgreSQL 17.6 instance on a separate local port and dedicated databases. No existing Docker data volume or live Supabase project was accessed.

| Executed verification | Result |
|---|---|
| Java 17 compile and executable package | PASS |
| Backend automated tests | **93 passed**, no failures/errors/skips |
| New second-batch integration tests | **20 passed**, real PostgreSQL |
| Existing V5 regression/provider tests | 73 passed, including 7 provider mocks |
| Frontend Node tests | **18 passed** |
| Launcher tests with stub Docker/Maven | 14 passed |
| JavaScript syntax checks | 34 modules parsed |
| Actual packaged-app HTTP checks | **54 passed**, including restart/re-login consistency |
| Updated Postman requests/assertions | **55 passed** through a cookie-aware HTTP/JavaScript harness |
| V7 → V8 upgrade | PASS; core snapshots unchanged |
| Figma design checks | 14 editable Banking desktop/narrow frames plus 2 CSV export panels; representative desktop/mobile/review/export compositions visually inspected |

New tests cover debit and credit purchases, credit limits, card lock/unlock and persistence, repayment while locked, reduction of deposit funds/debt/minimum due, overpayment/insufficient funds, balanced repayment legs, correct income/spending exclusion, simulated bill payment, retained history after payee deletion, stale bill-reference rejection, recipient CRUD and ownership, invalid/foreign requests, same-key replay/conflict, twelve concurrent identical requests, competing overdraw requests, card-lock/purchase races, forced second-leg rollback, enabled/disabled reminder deduplication, monthly budgets, exact-limit/month-boundary behavior, owner isolation and CSV escaping/date/account validation.

The deliberate second-leg failure rolled back financial operation, balances, transaction legs, notifications and code consumption together. Retry after removing the test trigger succeeded. Credit repayment pairs are separate credit_payment entries and do not count as income or spending. Concurrent distinct $700 purchases against $1,000 allowed exactly one charge; the account stayed nonnegative. Card-lock races either complete the already-serialized purchase or reject it, with a consistent final locked state.

The packaged-app HTTP checks exercised login code+PIN, purchase code/PIN rejection and success, idempotent receipt replay, locks, credit purchase/repayment, peer and biller CRUD, immediate Bill Pay, deleted-payee history, budgets, CSV formula-leading text, transaction-kind filters, third-user isolation and backend restart. Test assertions use decimal amounts for financial comparisons. Restart preserved balances, credit lock, operation history and budgets.

The V7 fixture upgraded to V8 without changing existing user/account/transaction/alert/notification snapshots. Counts retained: 3 users, 9 accounts, 36 transactions, 9 alerts, 3 notifications. UUIDs, balances and credential hashes/generation were compared. New card controls begin unlocked. V8 adds schema/features without resetting PINs or seeding over existing business data.

Postman desktop was not used: the exported bodies, pre-request scripts and assertions were run with a small compatible JavaScript harness and real HTTP cookie sessions. A real-browser DOM interaction/layout test, Windows PowerShell execution, Docker Engine execution, live Supabase upgrade, real OpenAI call, payment network and SMS/email delivery were **not executed**. Figma mock-state visual inspection is separate from browser layout testing. Manual acceptance steps remain in MANUAL-TESTS.md.

All financial services use simulated USD amounts. Provider key/model remain blank and AI remains Demo. No scheduled bill payments, scheduled reminders, interest/billing-cycle processing or PDF statements are claimed. The ZIP excludes private environment files, compiled output and caches.
