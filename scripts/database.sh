#!/usr/bin/env sh
# Sourced by start.sh. Values are read literally; config files are never executed.
fail() {
    printf '%s\n' "$1" >&2
    exit 1
}

load_settings() {
    settings_file=$1
    [ -f "$settings_file" ] || return 0
    while IFS= read -r setting_line || [ -n "$setting_line" ]; do
        setting_line=$(printf '%s' "$setting_line" | tr -d '\r')
        case "$setting_line" in ''|'#'*) continue ;; esac
        case "$setting_line" in *=*) ;; *) fail "Invalid setting in $settings_file: expected KEY=VALUE." ;; esac
        setting_key=${setting_line%%=*}
        setting_value=${setting_line#*=}
        case "$setting_key" in
            HIKYU_*|SUPABASE_*|PORT|SERVER_ADDRESS) ;;
            *) fail "Unsupported setting name in $settings_file." ;;
        esac
        case "$setting_key" in *[!A-Za-z0-9_]*) fail "Invalid setting name in $settings_file." ;; esac
        # Optional outer quotes are removed, with no expansion of their contents.
        case "$setting_value" in
            \"*\") setting_value=${setting_value#\"}; setting_value=${setting_value%\"} ;;
            \'*\') setting_value=${setting_value#\'}; setting_value=${setting_value%\'} ;;
        esac
        export "$setting_key=$setting_value"
    done < "$settings_file"
}

configure_local() {
    export HIKYU_DB_MODE=local
    # Clear generic credentials inherited from a previous cloud terminal session.
    unset HIKYU_DB_URL HIKYU_DB_USER HIKYU_DB_PASSWORD HIKYU_DB_NAME HIKYU_DB_PORT
    if [ -f .env.local ]; then
        load_settings .env.local
    else
        load_settings .env
    fi
    export HIKYU_DB_NAME="${HIKYU_LOCAL_DB_NAME:-${HIKYU_DB_NAME:-hikyu_bank}}"
    export HIKYU_DB_PORT="${HIKYU_LOCAL_DB_PORT:-${HIKYU_DB_PORT:-5432}}"
    export HIKYU_DB_USER="${HIKYU_LOCAL_DB_USER:-${HIKYU_DB_USER:-hikyu}}"
    export HIKYU_DB_PASSWORD="${HIKYU_LOCAL_DB_PASSWORD:-${HIKYU_DB_PASSWORD:-hikyu_local_demo}}"
    case "$HIKYU_DB_PORT" in ''|*[!0-9]*) fail "Local database port must be numeric." ;; esac
    [ "$HIKYU_DB_PORT" -ge 1 ] && [ "$HIKYU_DB_PORT" -le 65535 ] || fail "Local database port is out of range."
    case "$HIKYU_DB_NAME" in ''|*[!A-Za-z0-9_]*) fail "Local database name must contain letters, numbers or underscores." ;; esac
    export HIKYU_DB_URL="jdbc:postgresql://127.0.0.1:$HIKYU_DB_PORT/$HIKYU_DB_NAME"
    command -v docker >/dev/null 2>&1 || fail "Start/install Docker Desktop for local mode."
    printf '%s\n' 'Database mode: local Docker PostgreSQL'
    # An explicit env file prevents Compose from loading cloud values from .env.
    compose_env=.env.example
    [ ! -f .env ] || compose_env=.env
    [ ! -f .env.local ] || compose_env=.env.local
    docker compose --env-file "$compose_env" up -d --wait database
}

configure_cloud() {
    export HIKYU_DB_MODE=cloud
    load_settings .env.supabase
    if [ -z "${HIKYU_DB_URL:-}" ]; then
        [ -n "${SUPABASE_DB_HOST:-}" ] || fail "Set HIKYU_DB_URL or SUPABASE_DB_HOST in .env.supabase or your terminal."
        HIKYU_DB_URL="jdbc:postgresql://$SUPABASE_DB_HOST:${SUPABASE_DB_PORT:-5432}/${SUPABASE_DB_NAME:-postgres}?sslmode=require"
    fi
    printf '%s' "$HIKYU_DB_URL" | grep -Eq '^jdbc:postgresql://(\[[0-9A-Fa-f:]+\]|[A-Za-z0-9][A-Za-z0-9.-]*)(:[0-9]+)?/[A-Za-z0-9_-]+(\?[^[:space:]]*)?$' ||
        fail "Invalid PostgreSQL JDBC URL. Check the host, port and database; keep credentials in separate settings."
    case "$HIKYU_DB_URL" in
        *sslmode=*)
            printf '%s' "$HIKYU_DB_URL" | grep -Eq '[?&]sslmode=(require|verify-ca|verify-full)(&|$)' ||
                fail "Supabase mode requires sslmode=require, verify-ca or verify-full."
            ;;
        *\?*) HIKYU_DB_URL="$HIKYU_DB_URL&sslmode=require" ;;
        *) HIKYU_DB_URL="$HIKYU_DB_URL?sslmode=require" ;;
    esac
    HIKYU_DB_USER="${SUPABASE_DB_USER:-${HIKYU_DB_USER:-}}"
    HIKYU_DB_PASSWORD="${SUPABASE_DB_PASSWORD:-${HIKYU_DB_PASSWORD:-}}"
    [ -n "$HIKYU_DB_USER" ] || fail "Set HIKYU_DB_USER or SUPABASE_DB_USER for Supabase."
    [ -n "$HIKYU_DB_PASSWORD" ] || fail "Set HIKYU_DB_PASSWORD or SUPABASE_DB_PASSWORD for Supabase."
    export HIKYU_DB_URL HIKYU_DB_USER HIKYU_DB_PASSWORD
    printf '%s\n' 'Database mode: cloud / Supabase PostgreSQL (Docker is not required)'
}
