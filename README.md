# Hikyu Bank V4 — Startup Guide

Spring Boot serves both the web pages and REST API. Start the backend once; no separate frontend server is required.

## Requirements

- JDK 17 or later, including `java` and `javac`.
- Internet access on the first run to download Maven and project dependencies. Maven is provided by the included wrapper.
- **Local mode:** Docker Desktop / Docker Engine with Docker Compose v2 running.
- **Cloud mode:** An existing Supabase PostgreSQL connection configured in `.env.supabase`. Docker is not required.

These instructions use the current UUID version and the already migrated local/cloud databases.

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

Keep `.env.supabase` private. The launcher loads this file and starts Spring Boot without starting Docker. The already migrated UUID database does not require another migration approval setting.

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

The default demo password is **HikyuDemo2026!**. The email verification PIN is **2468**. If credentials were changed in the database, use the current credentials.

After entering the username and password, select SMS or email. The six-digit verification code appears on the demo page. Email verification also requires the PIN. This simulation does not send real SMS messages or emails.

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

Keep the existing Flyway V1–V4 files unchanged: Spring Boot uses them to validate the database version at startup.
