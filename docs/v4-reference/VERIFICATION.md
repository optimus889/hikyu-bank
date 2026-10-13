# UUID schema verification

Verified October 6, 2026 on Java 17, Spring Boot 3.5.16 and real PostgreSQL 17.6.
The isolated test runtime uses a test-only Unix identity compatibility shim,
which is not shipped with the app. No H2, mocked database, ORM, cloud SQL query
or user Mac Docker data volume substitutes were used for database testing.

## Results

| Check | Result |
| --- | --- |
| BankApiIntegrationTest | 19 passed |
| PostgresConstraintTest | 12 passed |
| Frontend Node tests | 6 passed |
| Maven package / native UUID JDBC | Passed |
| Existing V1 -> V4 Flyway upgrade | Passed; V1 checksum preserved |
| Fresh V1-V4 migration and seeding | Passed |
| Fresh versus upgrade schema | Columns, constraints, indexes, triggers and Flyway checksums match |
| Orphan foreign-key rows | 0 |
| Inconsistent legacy notification upgrade | V2 aborts, original record and V1 history preserved |
| Three-profile real HTTP workflows | Passed, including email plus PIN |
| Bundled packaged_smoke.py | Passed; restart, inbox/alert CRUD and cross-owner denial |
| Cloud approval guard on a local legacy fixture | Blocks before migrations when approval is absent |
| Restore of the pre-migration backup | Passed; original TEXT schema and records recovered |
| Actual Docker Compose / user Mac database | Not executed in this environment |
| Actual Supabase SQL, backup, migration and cloud tests | Pending; SQL inspection blocked by approval review |

## Data-preservation fixture

The legacy application first seeded 3 users, 9 accounts, 36 transactions,
9 alerts and 3 notifications. The test added an existing UUID loan, a legacy
custom transaction, an alert notification and a direct-account notification.
Immediately before and after migration:

| Entity | Before | After |
| --- | ---: | ---: |
| users | 3 | 3 |
| accounts | 10 | 10 |
| transactions | 37 | 37 |
| alerts | 9 | 9 |
| notifications | 5 | 5 |

The existing UUID, password/PIN hashes, balances and direct-account notification
were preserved. The server was restarted after additional API writes and kept
its stored data. A restored stopped-cluster backup recovered the legacy schema.
This backup was of the isolated fixture, not a backup of your Supabase project.

## Coverage and limits

Tests cover SMS/email PIN, challenge replay/expiry/rate limits, sessions, UUID
JSON/path parsing, owner-scoped JDBC writes/reads, unknown and foreign UUIDs,
duplicate open checking/savings, pending applications, exact decimals, missing
FKs, immutable account ownership, generated UUID defaults, renaming without ID
changes, alert CRUD, linked-notification protections, independent recipient
state/deletion and seed restart behavior. Browser layout, accessibility, actual
Mac/Windows launchers and production load testing are not established by them.

## Reproduce using a dedicated Docker test database

Start Docker Desktop and the project's database. Never use/reset the application
database merely to prepare tests. Create hikyu_bank_test once if it is absent:

```bash
docker compose up -d --wait database
docker compose exec -T database sh -c \
  'psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE hikyu_bank_test;"'
```

Set HIKYU_TEST_DB_URL, HIKYU_TEST_DB_USER and HIKYU_TEST_DB_PASSWORD to the separate
test database and your local credentials. These variables are test-only; they
are not required to switch local/cloud startup modes.

```bash
cd backend
./mvnw clean package
python3 tests/packaged_smoke.py
cd ../frontend
node --test tests/*.test.js
```

The smoke test leaves one pending investment in the disposable test database.
Use an unmodified test fixture for tests that assert initial account counts.
Application startup remains ./start.sh local / ./start.sh cloud; Windows remains
start.cmd local / start.cmd cloud. Follow the root README backup/cutover review
before running a new build against an existing cloud database.
