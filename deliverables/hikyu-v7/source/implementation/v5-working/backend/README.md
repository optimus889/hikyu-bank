# Spring Boot backend

Java 17+, Spring Boot 3.5, Spring JDBC, PostgreSQL and Flyway. Use the root README
and start.sh for the integrated local demo. No ORM-generated schema or H2 fallback.

- web/: REST controllers, session interceptor, safe HTTP errors.
- application/: DTOs, domain records, authentication and business services.
- dataaccess/repository/: owner-scoped persistence contracts.
- dataaccess/postgresql/: bound-parameter JDBC implementations.
- storage/: one-time, transaction-protected synthetic seed orchestration.
- resources/db/migration/: authoritative PostgreSQL schema (Flyway).

The database user needs ownership/creation permission for the dedicated database
because this local demo runs migrations. Production should separate migration and
runtime roles. Financial records persist; HTTP sessions and OTP challenges are
intentionally process-local. See docs/API.md and docs/VERIFICATION.md.

To build after setting HIKYU_TEST_DB_URL for a separate test database:

```bash
./mvnw package
java -jar target/hikyu-bank-4.0.0.jar
```

For a build without tests: `./mvnw -DskipTests package`. This does not verify runtime.
The packaged app still needs a running PostgreSQL database and connection settings.

Source root: src/main/; production Java package tree: src/main/hikyubank/.
Test Java files are directly under src/test/; Mockito metadata is in
src/test/resources/org.mockito.plugins.MockMaker. Maven maps it to the required
mockito-extensions classpath location. See ../docs/SHORT-PATHS.md.
