# V5 API Contracts

Base path: `/api/v1`. Use JSON, session cookies and `X-Hikyu-Request: web` for writes. Unknown JSON fields are rejected. UUIDs are opaque identifiers; all business resources are scoped to the authenticated user. Errors use `{code,message}`.

| Method | Path | Input / result |
|---|---|---|
| POST | /auth/register | username, firstName, lastName, password, pin → userId/username/message; 201 |
| POST | /auth/login | username/password → challengeId |
| POST | /auth/code | challengeId/method sms or email → simulated demoCode |
| POST | /auth/verify | challengeId/method/code → authenticated session; permanent card PIN required for both SMS and email |
| GET | /accounts | Current user's accounts; legacy response preserved |
| PATCH | /accounts/{id}/nickname | name → updated account |
| POST | /transfers | sourceAccountId, targetAccountId, amount, note, idempotencyKey, challengeId, verificationCode → completed receipt; 201 |
| GET | /transfers | Most recent 100 owned receipts |
| GET | /transactions | Legacy owned array, optional accountId |
| GET | /transactions/search | Filtered page: items/total/page/size |
| GET | /transactions/{id} | Owned detail with kind, note and transferId |
| GET / PUT | /settings/preferences | lowBalance, largeTransaction booleans |
| POST | /settings/password | currentPassword/newPassword; 204; all old sessions invalidated |
| GET | /settings/security | Information about PIN/session rules; no secrets |
| POST | /settings/security/pin | password/newPin; 200; selected permanent PIN saved; all sessions invalidated |
| POST | /settings/security/logout-all | password; 204; all sessions invalidated |
| GET | /assistant/status | mode/configured/description, never key |
| POST | /assistant/messages | message → reply/mode; rule-based-demo or external-ai |

Existing alerts and notifications CRUD endpoints are retained.

## Registration and Security

Username: 3–30 lowercase letters, digits, dots, underscores or hyphens; starts with letter/digit. Names: nonblank, max 40 chars each. Password: 12–72 characters, includes an ASCII letter and digit, max 72 UTF-8 bytes for BCrypt. PIN: exactly four ASCII digits as a STRING (e.g. `"0073"`), chosen by the user and reused for email login and peer payments. No plaintext PIN/password is returned or persisted. Registration requires no existing session, but still requires the write header, and is limited to 20 attempts per source address/hour per app process.

A new user's two active demo accounts open with synthetic balances; no real identity verification occurs. OTP delivery remains simulated. Password/PIN changes and logout-all increment a persistent credential generation. Old sessions/challenges are rejected on their next request; already-running requests are not retroactively cancelled. Peer-payment PIN failures are limited to five attempts followed by a 30-second cooldown per user/app process. These login/PIN rate counters reset on restart and are not a distributed production anti-abuse system. Payment-code counters use the database and persist across restart.

## Transfer Contract

```json
{"sourceAccountId":"OWNED_CHECKING_UUID","targetAccountId":"OWNED_SAVING_UUID","amount":"25.50","note":"Demo move","idempotencyKey":"NEW_UUID","challengeId":"PAYMENT_CHALLENGE_UUID","verificationCode":"SIX_DIGIT_DEMO_CODE"}
```

Only active checking/savings accounts are eligible, source and target differ, amount is 0.01–1,000,000 with at most two decimal places. Server returns id/sourceAccountId/targetAccountId/amount/note/createdAt/status. Receipt status is completed. Replaying the same successful request key with the same accounts, numeric amount and trimmed note returns the same receipt (201) without new balance changes, transaction legs or notifications. Reusing the key with different fields returns 409 IDEMPOTENCY_CONFLICT. A valid payment code bound to the same session and payload is required on a replay; internal transfers do not require a PIN. Failed transfers do not reserve a key; retrying after failure can execute once conditions permit. No delete or reversal endpoint is provided.

Automatic reminders run in the same transaction. Low balance fires when the post-transfer balance is below the rule threshold. Large transaction fires when the transfer amount is at least the threshold, for each matching source/target account rule. Preferences and rule.enabled must both allow the event. Delivery is always to the site inbox, regardless of the rule's delivery label. No scheduled/email/SMS delivery is implemented.

## Transaction Search

`accountId`, `from`, `to` (inclusive YYYY-MM-DD); `min`, `max` (absolute amount); `kind` all/income/expense/transfer/peer_transfer/credit_payment; `q` case-insensitive literal substring of name/category/note; `category` exact string; `sort` date_desc/date_asc/amount_desc/amount_asc; `page` zero-based, 0–100000; `size` 1–50 (default 10). A UUID tie-breaker makes ordering stable. Count and items use one repeatable-read snapshot. Empty results return an empty items array. Internal transfer and credit repayment legs never contribute to assistant income/expense totals.

## Errors

400 invalid input/PIN/filters/current password; 401 missing or revoked session; 403 missing write header; 404 missing/foreign resource; 409 insufficient funds, reused key with changed input, duplicate username, or database conflict; 429 application rate limits; 503 AI_NOT_CONFIGURED/provider limit/database unavailable; 502 provider rejection/authentication/unreadable response; 504 provider timeout. Provider bodies and credentials are not exposed. No provider retry or silent switch to Demo occurs.

## OpenAI Contract Reference

Official documentation checked for this implementation: https://developers.openai.com/api/reference/resources/chat and https://developers.openai.com/api/docs/guides/production-best-practices . Uses Java 17 HttpClient, Bearer authorization, Chat Completions JSON, store:false and max_completion_tokens. API key/model are blank by default; no real request was tested. Recheck model support and pricing before enabling later.

### Demo Profile Hints

GET `/auth/demo-profiles` is public and limited to the three existing public demo usernames. It returns username/name, defaultPin when it still matches the stored hash, pinChanged, defaultPassword only when it is the public synthetic default and still valid, and passwordChanged. It never returns custom PINs, custom passwords or hashes. Both SMS and email verification reject a missing or incorrect card PIN. No database migration is required for this correction.


## Payment verification and peer payments

All routes require the current login session and the existing write header.

| Method | Route | Purpose |
|---|---|---|
| POST | `/payment-verifications` | Issue a simulated SMS/email payment code |
| POST | `/payments/recipient` | Verify a username; return name and masked eligible Checking account only |
| POST | `/payments` | Pay a different simulation user; requires PIN and payment code |
| GET | `/payments` | Most recent 100 sent/received receipts belonging to the current user |

Code request (200):
```json
{"type":"internal","sourceAccountId":"OWNED_CHECKING_UUID","targetAccountId":"OWNED_SAVING_UUID","amount":"25.00","note":"Demo move","idempotencyKey":"NEW_UUID","method":"sms"}
```
For `type:"peer"`, replace `targetAccountId` with `recipientUsername`. `method` is `sms` or `email`. Response: `challengeId`, `method`, `expiresAt`, `demoCode`, and an explicit simulation message. A login OTP cannot authorize a payment.

Peer payment (201):
```json
{"sourceAccountId":"OWNED_DEPOSIT_UUID","recipientUsername":"gospelhope.david","amount":"25.00","note":"Demo payment","idempotencyKey":"SAME_UUID_AS_CODE_REQUEST","pin":"YOUR_CURRENT_FOUR_DIGIT_PIN","challengeId":"PAYMENT_CHALLENGE_UUID","verificationCode":"SIX_DIGIT_DEMO_CODE"}
```

Internal `/transfers` submission uses the same bound fields and `challengeId`/`verificationCode`, with **no PIN requirement**. Missing/wrong/expired/mismatched code returns 400; five failed codes or ten requests in ten minutes returns 429. Editing accounts, recipient, amount, note or request key requires a new code. Codes are tied to the login session; after re-login issue a new code. Completed identical retries return the same receipt without duplicate debit or inbox notifications.

Peer recipients must have an active Checking account. Sources are current-user active Checking/Saving accounts. Self-payment uses the internal workflow. Both owner rows and both account rows are locked in UUID order. Debit, credit, linked ledger legs, receipt notifications and automatic reminders commit together; any failure rolls them back. Receiver history does not expose the sender's account ID/balance. There is no completed-payment delete endpoint.

`peer_transfer` is distinct from `transfer`. Its negative sender leg counts as spending and its positive receiver leg as income in search/assistant summaries. Internal own-account legs remain excluded from income/spending. The new transaction detail field `peerPaymentId` links a peer leg to its receipt.

Validation errors use explicit English API messages instead of locale-dependent validator strings or raw regular expressions. Frontend native validation popups are suppressed in favor of English inline messages.


## Batch 2 REST API

All routes require the existing authenticated session. Writes require X-Hikyu-Request: web. Unknown JSON properties are rejected. Currency is USD; amounts are positive, up to 1,000,000 and at most two decimals.

| Method | Route | Contract |
|---|---|---|
| GET | /banking/catalog | Simulation spending categories and mock billers |
| POST | /banking/verifications | OperationInput plus method sms/email → five-minute bound demo code |
| POST | /banking/operations | OperationInput plus pin/challengeId/verificationCode → completed receipt; 201 |
| GET | /banking/operations | Current user's most recent 100 immutable receipts |
| GET/POST | /payees | List / create or revive an owned saved recipient; POST 201 |
| PATCH/DELETE | /payees/{id} | Edit alias/reference / soft-delete; DELETE 204 |
| GET | /cards | Owned debit/credit card controls; creates missing controls for new accounts |
| PATCH | /cards/{accountId} | {locked:true/false}; owned active card only |
| GET | /budgets?month=YYYY-MM | Owned budgets with spent/remaining/exceeded |
| POST | /budgets | Create or update same month/category; 201 |
| PUT/DELETE | /budgets/{id} | Edit owned budget / delete; DELETE 204 |
| GET | /statements.csv?from=YYYY-MM-DD&to=YYYY-MM-DD&accountId=UUID | UTF-8 CSV attachment; accountId optional; owner-scoped repeatable snapshot |

Purchase code request:
```json
{"type":"purchase","sourceAccountId":"OWN_CARD_ACCOUNT_UUID","merchant":"Demo grocery","category":"Groceries","amount":"25.00","note":"Demo purchase","idempotencyKey":"NEW_UUID","method":"sms"}
```
Submit the same fields to /banking/operations with `pin`, `challengeId` and `verificationCode` from the code response. Repayment replaces merchant/category with `targetAccountId` (own active credit account). Bill payment replaces merchant/category with `payeeId` and `payeeReference` copied from the current saved biller. Do not include fields belonging to another workflow.

Payee request:
```json
{"kind":"peer","identifier":"gospelhope.david","alias":"David","reference":""}
```
For kind=biller choose identifier from catalog: electric, internet, water or rent, and provide a nonblank simulation-only reference. Payee identifiers/kinds cannot be reassigned through PATCH. A changed bill reference invalidates a pending confirmation. Deletion preserves the historical payee row and financial receipts.

Budget request:
```json
{"month":"2026-10","category":"Groceries","limit":"400.00"}
```
Supported categories are the catalog categories plus Peer transfer. Month must be 1970–2100. Spending sums negative expense/peer_transfer legs within [month start, next month start); credit repayments and own transfers are excluded. Remaining may be negative. No scheduled budget notifications are claimed.

Purchase sources are Checking debit or credit accounts. Credit purchase increases debt and must stay within credit_limit. Repayment sources are Checking/Saving; amount cannot exceed debt or available deposit funds. Card locking blocks new purchases, never credit repayments. Bill Pay debits a deposit account to a synthetic biller; no real routing/account network is used.

New error codes include CARD_LOCKED, CREDIT_LIMIT_EXCEEDED, OVERPAYMENT, PAYEE_CHANGED, PAYEE_NOT_FOUND, BUDGET_NOT_FOUND and EXPORT_TOO_LARGE. Existing code/PIN/ownership/idempotency errors apply. Keys are unique per user across purchase/repayment/bill operations; changed requests return 409. A completed identical replay can return its original receipt even if the card was later locked; no new charge is made. Failed operations do not consume the code or reserve the request key.

Transaction details add operationId for these financial receipts. credit_payment is separately searchable and never classified as income/expense. CSV includes transaction/account/date/name/type/category/amount/note/reference; text fields are quoted and formula-leading text is prefixed with an apostrophe. Numeric amounts preserve their sign. More than 10,000 rows returns 413; narrow the dates rather than silently truncating.
