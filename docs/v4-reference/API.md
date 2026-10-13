# Hikyu Bank REST API — v1

Base URL: `http://localhost:8080/api/v1`.
Content type: `application/json`. Responses use JSON except HTTP 204.
The application is a three-user local demonstration backed by PostgreSQL.
Owner identity always comes from the verified server session, never a request body.
Cross-user and unknown business IDs return 404. Database credentials remain server-side.

## Session and request rules

- Login, code, verify, logout and health are accessible before authentication.
- Other endpoints require a verified server session carried by the `JSESSIONID` cookie.
- Use `credentials: "same-origin"` in frontend fetch calls.
- Every POST, PUT, PATCH and DELETE requires `X-Hikyu-Request: web`.
- No cross-origin access is enabled. Serve the UI through Spring Boot.
- Error format: `{ "code": "ACCOUNT_ALREADY_OPEN", "message": "You have already opened this account." }`.
- 400 = validation/workflow error, 401 = invalid credentials or missing session,
  403 = missing application header, 404 = missing record, 409 = state conflict,
  429 = request/verification limit.

## Endpoints

| Method | Path | Input | Response |
| --- | --- | --- | --- |
| GET | `/health` | None | `{status, storage, demo}` |
| POST | `/auth/login` | `{username, password}` | `{challengeId, expiresAt, methods}` |
| POST | `/auth/code` | `{challengeId, method}` | `{expiresAt, resendAt, demoCode}` |
| POST | `/auth/verify` | `{challengeId, method, code, pin?}` | `{user, expiresAt}` and rotated session cookie |
| GET | `/auth/session` | Cookie | `{user, expiresAt}` or 401 |
| POST | `/auth/logout` | `{}` | 204; session invalidated |
| GET | `/accounts` | None | Account array |
| GET | `/accounts/products` | None | Product array with `alreadyOpen` flags |
| GET | `/accounts/{id}` | Account ID | Account |
| POST | `/accounts` | `{type, name}` | 201 Account; duplicate checking/savings returns 409 |
| GET | `/transactions?accountId=credit` | Optional account filter | Transaction array |
| GET | `/alerts` | None | Owner's alert rule array |
| PUT | `/alerts/{id}` | Full alert input | Updated alert; stable ID |
| DELETE | `/alerts/{id}` | None | 204; 409 if notifications reference the alert |
| POST | `/alerts` | Alert input below | 201 Alert |
| PATCH | `/alerts/{id}` | `{enabled}` | Updated Alert |
| GET | `/notifications` | None | Newest-first notification array |
| POST | `/notifications/test` | `{alertId: null}` or `{alertId}` | 201 simulated notification |
| PATCH | `/notifications/{id}` | `{read?, resolved?}` | Updated notification |
| PATCH | `/notifications/read-all` | `{}` | 204 |
| DELETE | `/notifications/{id}` | None | 204 |
| POST | `/assistant/messages` | `{message}` | `{reply, mode: "rule-based-demo"}` |

Times in authentication responses are Unix milliseconds. Code and PIN must be
strings so leading zeroes are preserved. Email requires a correct four-digit PIN;
SMS does not require a PIN. Codes expire after five minutes, challenges after ten,
and authenticated sessions after thirty. Five incorrect verification attempts
lock the challenge. Logout invalidates the HTTP session.

`demoCode` is intentionally exposed only by this local simulation. There is no
email/SMS provider. Future production delivery must omit this field.

## Account payloads

```json
{
  "type": "loan",
  "name": "Study loan"
}
```

Allowed types: `checking`, `savings`, `credit`, `loan`, `investment`.
Names must be nonblank and at most 60 characters. Checking and savings are limited
to one open account of each type, regardless of nickname. Credit, loan and
investment applications remain pending; balances start at zero.

Account responses include `id`, `type`, `name`, `suffix`, `balance` and `status`.
Credit seed records also include `limit`, `minimumDue` and `dueDate`.
The profile is supplied by the auth session: `id`, `name`, `username`, `firstName`,
`lastName`. The UI derives avatar initials from those fields.

## Alert input

```json
{
  "type": "low_balance",
  "accountId": "checking",
  "title": "Low checking balance",
  "channel": "In-app",
  "amount": 100
}
```

- Amount types: `low_balance`, `large_transaction`, `savings_goal`.
- Date types: `payment_due`, `scheduled`; use a valid ISO date such as `2026-10-01`.
- Amount must be between 0.01 and 1,000,000, with at most two decimals.
- Channel: `Email`, `SMS`, `In-app` or `Calendar`.
- Title: nonblank, at most 80 characters; accountId must identify an existing account.
- The backend stores the preference; external delivery and scheduling are not implemented.

## Inbox behavior

Alert rules and notifications have separate IDs. Creating a test requires an
enabled rule, or a null alertId for a welcome message. Disabling a rule does not
remove existing notifications. Resolving a notification automatically marks it
read; reopening changes its resolved state. Updates and deletion use stable IDs.
The frontend emits local refresh events after successful writes. There is no
WebSocket, server push or automatic cross-tab refresh.

## curl example

```bash
curl -c cookies.txt -b cookies.txt \
  -H 'Content-Type: application/json' -H 'X-Hikyu-Request: web' \
  -d '{"username":"chengyang.lee","password":"HikyuDemo2026!"}' \
  http://localhost:8080/api/v1/auth/login
```

Use the returned challengeId in `/auth/code`, then use the returned demoCode in
`/auth/verify`. Send `-b cookies.txt -c cookies.txt` on each step so the rotated
session cookie is retained. After verification:

```bash
curl -b cookies.txt http://localhost:8080/api/v1/accounts
```

## Backend extension points

- PostgreSQL JDBC adapters implement the repository interfaces; alternative providers can replace them.
- Replace `RuleBasedAssistantGateway` with an external REST AI adapter.
- Add delivery/scheduling adapters before claiming Zapier or provider integration.
- Keep provider keys in server environment/configuration, never frontend source.
- Preserve response fields/error codes or version the API when changing contracts.

The current repositories store three demo users with owner-scoped queries.
There is no public signup. Adding it would require credential registration,
contact verification, anti-abuse controls and user lifecycle rules.

## Database errors and consistency

- 409 `ACCOUNT_ALREADY_OPEN`: duplicate open checking/savings, including index conflicts.
- 409 `ALERT_IN_USE`: remove linked notifications before alert deletion/account change.
- 409 `DATA_CONFLICT`: a write violates a database integrity rule.
- 503 `DATABASE_UNAVAILABLE`: database/query failure; no raw SQL is returned.
- Health storage is `postgresql`; it performs a database connectivity query.
- Existing profiles are not reseeded; writes/deletions survive startup.
- Mark-all-read runs inside a database transaction.
- Data owner always comes from the authenticated session. There are no RLS policies.

## Resource identity contract

Entity id/accountId/alertId values are canonical UUID strings returned by the API.
Do not construct IDs from usernames or account types. Existing endpoint paths
remain unchanged. Malformed UUIDs return 400 INVALID_RESOURCE_ID (or INVALID_JSON
for malformed JSON UUID fields); valid missing/foreign UUIDs return 404.
Notification read/resolved values represent the signed-in recipient's state.
