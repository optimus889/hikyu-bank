#!/usr/bin/env sh
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$project_dir"
. "$project_dir/scripts/database.sh"

[ "$#" -le 1 ] || fail "Usage: ./start.sh [local|cloud]"
mode=${1:-}
if [ -z "$mode" ]; then
    if [ -t 0 ]; then
        printf '1) Local Docker\n2) Cloud (Supabase)\nSelect database [1]: '
        IFS= read -r selection || selection=1
        case "$selection" in ''|1) mode=local ;; 2) mode=cloud ;; *) fail "Choose 1 or 2." ;; esac
    elif [ -n "${HIKYU_DB_URL:-}" ]; then
        mode=cloud
    else
        mode=local
    fi
fi
case "$mode" in
    local) configure_local ;;
    cloud|supabase) configure_cloud ;;
    -h|--help) printf '%s\n' 'Usage: ./start.sh [local|cloud]'; exit 0 ;;
    *) fail "Unknown mode. Use local or cloud." ;;
esac
printf '%s\n' "Web app: http://localhost:${PORT:-8080}/login.html"
cd "$project_dir/backend"
exec ./mvnw spring-boot:run
