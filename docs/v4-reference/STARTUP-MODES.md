# Database startup modes

Both modes use the same Spring Boot/JDBC application and original Flyway schema.
The frontend stays bundled in Java; no browser database credentials are added.

| Mode | Config | Docker | Database |
| --- | --- | --- | --- |
| local | .env.local (or legacy .env) | Start database service and wait for health | Local named volume |
| cloud | .env.supabase + existing terminal settings | No Docker calls | Existing cloud PostgreSQL |

## Configuration precedence

Local: clear inherited generic HIKYU_DB_* connection settings; load .env.local
(or .env); local-only HIKYU_LOCAL_DB_* override its matching generic values;
otherwise use the original local defaults. Compose and Java receive the same
values. An explicit Compose env file keeps cloud .env settings from being loaded
implicitly. Local cloud URL variables cannot redirect the backend.

Cloud: inherited terminal values, then matching values from .env.supabase.
SUPABASE_DB_USER/PASSWORD override generic HIKYU_DB_USER/PASSWORD. When no JDBC URL
exists, SUPABASE_DB_HOST plus optional PORT/NAME constructs it. A malformed
supplied URL is rejected rather than silently falling back to Docker. SSL is
required. Secrets are never printed by the launcher.

## Existing cloud setup

The upload contains no private Supabase config. Reuse the existing exported
settings in the same terminal, or fill .env.supabase with the actual values.
There is no database copy, synchronization, re-import or cloud project creation.
Keep the existing schema/migration history. New schema migrations follow the
unchanged application's Flyway behavior.

## Stop and switch

Ctrl+C stops the app. docker compose stop database stops only local PostgreSQL
and preserves the volume. Cloud mode does not stop a cloud project. Restart the
app with the other explicit mode to change databases; each stores independent
records. Existing local volumes retain their original credentials.

Supabase connection reference:
https://supabase.com/docs/guides/database/connecting-to-postgres

The public mode name is `cloud`; its provider is Supabase. The legacy
`supabase` argument remains an alias for `cloud`. The provider config filename
stays `.env.supabase`.
