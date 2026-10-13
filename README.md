# Hikyu Bank V5 — Startup Guide

Spring Boot serves both the web pages and REST API. Start the backend once; no separate frontend server is required.

**For first-run testing, use [the separate demo database](#start-safely-with-a-separate-demo-database). The normal local/cloud launchers retain your existing database destinations and require approval before upgrading V4.**

## Requirements

- JDK 17 or later, including `java` and `javac`.
- Internet access on the first run to download Maven and project dependencies. Maven is provided by the included wrapper.
- **Local mode:** Docker Desktop / Docker Engine with Docker Compose v2 running.
- **Cloud mode:** An existing Supabase PostgreSQL connection configured in `.env.supabase`. Docker is not required.

This V5 revision includes additive V5–V7 migrations. Existing V4 databases are guarded against an accidental upgrade; read the V5 database instructions below before using them.

## Quick Start on macOS / Linux

1. Extract the project ZIP and open Terminal in the project root—the directory containing `start.sh`, `compose.yaml`, and `backend/`.
2. Set executable permissions once:

```sh
chmod +x start.sh backend/mvnw
```

3. Choose one database mode:

```sh
# Local Docker PostgreSQL
./start.sh local
```

```sh
# Supabase PostgreSQL
./start.sh cloud
```

Alternatively, run `./start.sh` and select **1** for local or **2** for cloud.

4. Keep the terminal open. Wait for `Started HikyuBankApplication`, then open:

**http://localhost:8080/login.html**

Both modes run the website on your computer. Cloud mode changes the database destination; it does not publish the website online. Local and cloud data are independent and do not synchronize automatically.

## Local Database Setup

The current `compose.yaml` binds the existing data volume:

```text
hikyu-bank-project_hikyu_postgres_data
```

This is an external volume and must already exist on the computer. Keep this binding to use the local database that was migrated and verified. The current project uses one `compose.yaml`; no `compose.override.yaml` is required.

If you need to configure local credentials and do not already have `.env.local`, copy the example:

```sh
cp .env.local.example .env.local
```

Edit its values to match the existing database:

```dotenv
HIKYU_DB_NAME=hikyu_bank
HIKYU_DB_PORT=5432
HIKYU_DB_USER=hikyu
HIKYU_DB_PASSWORD=YOUR_EXISTING_LOCAL_DATABASE_PASSWORD
```

Without custom settings, the default local password is `hikyu_local_demo`. Changing the settings file does not change the password stored in an existing volume.

`./start.sh local` starts the database service, waits for it to become healthy, and starts Spring Boot.

## Cloud Database Setup

Reuse your configured `.env.supabase`. If it is missing, create it from the template:

```sh
cp .env.supabase.example .env.supabase
```

Replace the placeholders with your existing database connection details:

```dotenv
HIKYU_DB_URL=jdbc:postgresql://YOUR_DATABASE_HOST:5432/postgres?sslmode=require
HIKYU_DB_USER=YOUR_DATABASE_USERNAME
HIKYU_DB_PASSWORD=YOUR_DATABASE_PASSWORD
```

Use the database password, not a Supabase API key. Keep credentials separate from the JDBC URL. Configuration files use literal `KEY=VALUE` lines; do not include `export` or shell variable expressions.

Keep `.env.supabase` private. The launcher loads this file and starts Spring Boot without starting Docker. An existing V4 database requires explicit approval for the new V5 extension migration; see the upgrade instructions below.

## Windows

Open Command Prompt in the project root and choose one mode:

```bat
start.cmd local
```

```bat
start.cmd cloud
```

Run `start.cmd` without an argument to display the selection menu. The launcher requires Windows PowerShell 5.1 or later. In PowerShell, use `.\start.cmd local` or `.\start.cmd cloud`.

Configure `.env.local` / `.env.supabase` as described above. Local mode also requires Docker and the external data volume specified in `compose.yaml`.

## Demo Sign-In

| User | Username |
|---|---|
| Gospelhope David | `gospelhope.david` |
| Cheng-Yang Lee | `chengyang.lee` |
| Mingyu Fan | `mingyu.fan` |

The default demo password is **HikyuDemo2026!**. The fixed default card PINs are **1037** (Cheng-Yang Lee), **5842** (Gospelhope David), and **9061** (Mingyu Fan), unless changed in Settings. If credentials were changed in the database, use the current credentials.

After entering the username and password, select SMS or email. The six-digit verification code appears on the demo page. Both SMS and email verification require the six-digit code AND your permanent four-digit card PIN. This simulation does not send real SMS messages or emails.

## Stop or Switch Modes

Press **Ctrl+C** in the running terminal to stop Spring Boot. To switch databases, stop the backend first, then run the other startup command and sign in again.

To stop the local PostgreSQL container while preserving its data:

```sh
docker compose stop database
```

Stopping cloud-mode Spring Boot closes its connections; it does not pause Supabase.

## Common Startup Problems

| Problem | Action |
|---|---|
| `Permission denied` | Run `chmod +x start.sh backend/mvnw`. |
| Java is missing | Install JDK 17+ and check `java -version` and `javac -version`. |
| Maven download fails | Check Internet access and retry the startup command. |
| Docker is unavailable | Start Docker Desktop before using local mode. |
| External volume is missing | Use the computer containing the existing volume, or configure an intended database before starting. |
| Local database rejects the password | Use the credentials stored in the original data volume. |
| Cloud connection fails | Check `.env.supabase`, the host, database credentials, TLS, and network access. |
| Port 8080 is occupied | Stop the previous backend, or use `PORT=8081 ./start.sh local` / `PORT=8081 ./start.sh cloud` on macOS/Linux. |
| Wrong page or 404 | Open the Spring Boot URL, not Live Server or a separate static server. |
| Old UI is displayed | Stop the previous backend, start this project, and hard-refresh the browser. |

For local database diagnostics:

```sh
docker compose ps database
docker compose logs database
```

Keep all applied Flyway migration files unchanged: Spring Boot uses them to validate the database version at startup.

## V5 Features

- Pay & Transfer: active Checking ↔ Everyday Saving transfers require a simulated SMS or email code. Payments to another Hikyu user require your permanent card PIN plus a simulated SMS or email code. Both provide confirmation, receipts, two linked ledger legs, persistent idempotency, concurrency protection and inbox notifications.
- Transactions: server-side date/absolute amount/type/account/category/search filters, stable sorting, pagination and owned transaction details.
- Settings: account nickname, automatic low-balance/large-transfer preferences, password change, user-selected PIN change and sign-out of all sessions.
- Registration: choose a username, password and permanent four-digit card PIN. Each new demo user receives synthetic opening balances of $1,000 Checking and $200 Saving. These are simulated opening balances, not income transactions.
- Assistant: local rules by default, optional OpenAI adapter disabled without configuration. Internal transfers are excluded from income/spending.

PINs are permanent credentials, not one-time verification codes. Leading zeros are supported. Registration and PIN-change responses do not echo PINs. Only hashes are stored. The three built-in profiles have different fixed defaults; changed PINs survive restarts.

## Start Safely With a Separate Demo Database

This optional test Compose file creates a NEW data volume and binds PostgreSQL to port 55432. It does not mount your V4 volume.

```sh
docker compose -f compose.test.yaml up -d --wait database
cd backend
HIKYU_DB_URL=jdbc:postgresql://127.0.0.1:55432/hikyu_extension_demo \
HIKYU_DB_USER=hikyu HIKYU_DB_PASSWORD=hikyu_test_only ./mvnw spring-boot:run
```

Open http://localhost:8080/login.html. Sign in with a built-in demo profile, or use **Create a demo account**. The initialization script also creates `hikyu_bank_test` for automated tests.

```sh
cd backend
HIKYU_TEST_DB_URL=jdbc:postgresql://127.0.0.1:55432/hikyu_bank_test \
HIKYU_TEST_DB_USER=hikyu HIKYU_TEST_DB_PASSWORD=hikyu_test_only ./mvnw test
cd ../frontend
npm test
cd ..
python3 scripts/tests/test_startup.py
```

Run each command block from the project root in a separate terminal. Tests only accept a database named `hikyu_bank_test`. The integration tests intentionally create synthetic users, exercise concurrent transfers, and temporarily install a rollback-test trigger in that test database. Never point tests at the existing app database.

## Upgrade an Existing V4 Database Later

V1–V4 SQL files are byte-identical to the uploaded source. V5 adds tables and columns and changes the initial PINs of the built-in demo users once. Original users, accounts, transactions, alerts and notification records are retained.

The launcher stops before upgrading an existing V4 database unless `HIKYU_EXTENSION_MIGRATION_APPROVED=true` is explicitly set. Validate a separate restored copy and retain a backup first. For an intended upgrade, copy `.env.extensions.example` to `.env.extensions` and set that approval flag there, then use `./start.sh local` or `./start.sh cloud` (Windows: `start.cmd local` / `start.cmd cloud`). The normal `compose.yaml` still points at your original external volume. Approval is an upgrade choice, not a testing requirement for a fresh database.

After a completed upgrade, V5 starts without reapplying the PIN initialization. Do not run the V4 app against a V5-upgraded database. The separate test database requires no upgrade approval.

## OpenAI Is Reserved and Disabled

Copy `.env.extensions.example` to `.env.extensions` for the launchers. Keep these defaults:

```dotenv
HIKYU_AI_MODE=demo
HIKYU_AI_KEY=
HIKYU_AI_MODEL=
```

Demo mode creates no OpenAI HTTP client and makes no provider calls. To enable later, configure your private server key and an available Chat Completions model, set `HIKYU_AI_MODE=openai`, and restart. Java computes aggregates; OpenAI receives your question and balances/category totals, not stored names, contacts, PINs or account IDs. User-entered question text is forwarded as typed.

The adapter uses `POST /v1/chat/completions`, `model`, `messages`, `store:false`, `max_completion_tokens`, and reads `choices[0].message.content`. Timeout defaults to 10 seconds, output budget to 512 tokens, and application limit to 10 requests/minute/user. Keys and model are deliberately blank. OpenAI mode with missing configuration starts successfully and responds with 503 `AI_NOT_CONFIGURED` when asked. HTTPS is required; local HTTP is an explicit test-only option.

## Documents

- [API contracts](docs/API.md)
- [Database migration and compatibility](docs/MIGRATION.md)
- [Validation results](docs/TEST-RESULTS.md)
- [Manual test checklist](docs/MANUAL-TESTS.md)
- Postman collection/environment: `docs/postman/`
- Original V4 documents are retained under `docs/v4-reference/` and describe the uploaded baseline, not V5 test results.

No real OpenAI call, email, SMS, payment network or live Supabase upgrade was performed. Card purchases, Bill Pay, budgets, exports and card locking remain future work; PIN authorization can be reused when a simulated purchase workflow is implemented.

## Login Correction

SMS and email login both use username/password followed by the six-digit simulated code AND the permanent four-digit card PIN. Internal transfer confirmation requires a payment code only. Payments to other users require both the PIN and a payment code.

The Demo profile selector checks `/api/v1/auth/demo-profiles` and shows only the selected built-in user's still-valid initial credentials. If that PIN or password has been changed, the old default is hidden and the page asks for the current credential. Custom credentials are stored as hashes and cannot be recovered for display. They are never returned by the Demo status endpoint.


## Pay & Transfer walkthrough

1. Sign in and select **Pay & Transfer** in the top navigation (or mobile menu).
2. **Between my accounts:** choose two different active deposit accounts and enter an amount/note. Select **Review transfer**, choose SMS or email, then **Request verification code**. Enter the displayed six-digit demo code and confirm. No card PIN is required for this workflow.
3. **To another person:** select your source account, enter a Hikyu username such as `gospelhope.david`, and select **Verify recipient**. Check the name and masked Checking account. Enter amount/note and select **Review payment**. Enter your current card PIN and request/enter an SMS or email demo code before confirming.
4. The receipt, balances and recent activity are saved in PostgreSQL. The recipient sees the incoming payment after refreshing/signing in; both users receive an inbox receipt. Completed financial entries cannot be deleted.

Payment codes are separate from login codes, valid for five minutes, bound to the current session and exact payment details, and locked after five wrong entries. Issuance is limited to ten codes per user in ten minutes. Editing the payment requires a new code. A retry retains the same request key, and a completed replay only returns its original receipt. Codes are shown in the UI for simulation; no real SMS or email is sent.

Database additions in this revision: **V6** (peer payments/linked transaction kind/event deduplication) and **V7** (payment-code authorization). Existing V1–V5 files are unchanged. Validate a restored copy before directing the normal launchers at an existing database; normal startup applies pending migrations.

Figma updates: [Pay & Transfer desktop](https://www.figma.com/design/qHd626nmXLZRuxvIESJx4b/Hikyu-Bank?node-id=2042-143). Desktop/mobile entry and confirmation screens use the existing Inter typography and navy/blue tokens.


## UI and login correction

Transaction names are interactive text with no button border/background; other row content is informational. Form validation messages are English regardless of browser/server locale. Settings uses the same navy/blue controls as the rest of the app. Demo hints say **Card PIN**; the previous email-only note is removed. Both SMS and email login require a code and card PIN. Internal payments still require a payment code only; peer payments require PIN plus code. No migration or PIN reset is introduced by this correction.
