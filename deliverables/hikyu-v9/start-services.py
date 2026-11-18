#!/usr/bin/env python3
import argparse
import json
import os
import pathlib
import signal
import socket
import subprocess
import time
import urllib.request

parser = argparse.ArgumentParser(description="Start the local demo services.")
parser.add_argument("--restart-web", action="store_true", help="restart this project's Saltcorn")
args = parser.parse_args()

ROOT = pathlib.Path(__file__).resolve().parent.parent
PRIVATE = ROOT / "private"
PRIVATE.mkdir(exist_ok=True)
runtime_file = PRIVATE / "v8-runtime.json"
runtime = json.loads(runtime_file.read_text()) if runtime_file.exists() else {}
app_port = runtime.get("app_port", 8197)
workflow_port = runtime.get("workflow_port", 8196)
service_env = {
    **os.environ,
    "V6_ROOT": str(ROOT),
    "HIKYU_WORKFLOW_PORT": str(workflow_port),
    "HIKYU_WORKFLOW_URL": f"http://127.0.0.1:{workflow_port}",
    "HIKYU_EVIDENCE_DIR": str(ROOT / "evidence/v8/runtime"),
}
(ROOT / "evidence/v8/runtime").mkdir(parents=True, exist_ok=True)
v9 = (ROOT / "backend/v9/transactions.cjs").is_file()
pid_file = PRIVATE / "service-pids.json"
local_http = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def verify_v9_database():
    # Use the same SDK and environment as the local web process, via the host port.
    for name in ("DATABASE_URL", "SQLITE_FILEPATH", "FORCE_SQLITE", "NO_DB_CONNECTION"):
        service_env.pop(name, None)
    probe = """
        const { db } = require('./backend/saltcorn/sdk.cjs');
        db.query('SELECT 1 FROM public._sc_tables LIMIT 1')
          .catch((error) => { process.exitCode = error.code === '28P01' ? 3 : 1; })
          .finally(() => db.close());
    """
    try:
        result = subprocess.run(
            ["node", "-e", probe], cwd=ROOT, env=service_env, capture_output=True, timeout=12
        )
    except subprocess.TimeoutExpired:
        raise SystemExit("Saltcorn database check timed out. Check the configured PostgreSQL port.")
    if result.returncode == 3:
        raise SystemExit(
            "Saltcorn cannot authenticate to PostgreSQL through the host port (28P01). "
            "Check that the configured port belongs to this V9 Compose database."
        )
    if result.returncode:
        raise SystemExit(
            "Saltcorn could not query the local V9 database. Check that Docker is running "
            "and this installation has completed setup."
        )
    print("Saltcorn database: verified through the host port.", flush=True)


def web_port_in_use():
    try:
        with socket.create_connection(("127.0.0.1", app_port), timeout=1):
            return True
    except ConnectionRefusedError:
        return False


def owns_web_process(pid, cmd):
    if not isinstance(pid, int) or pid <= 1:
        return False
    try:
        if os.getpgid(pid) != pid:
            return False
    except ProcessLookupError:
        return False
    listing = subprocess.run(
        ["ps", "-ww", "-p", str(pid), "-o", "command="], capture_output=True, text=True
    )
    # ps prints the argv joined with spaces, including any spaces in the project path.
    command = listing.stdout.strip()
    suffix = " " + " ".join(cmd[1:])
    executable = pathlib.Path(command[: -len(suffix)])
    return command.endswith(suffix) and (
        str(executable) == "node"
        or (executable.is_absolute() and executable.name == "node" and executable.is_file())
    )


def tracked_web_pid(cmd):
    pid = json.loads(pid_file.read_text()).get("saltcorn") if pid_file.exists() else None
    if not owns_web_process(pid, cmd):
        raise SystemExit(
            f"Port {app_port} is in use, but this project's Saltcorn process could not be "
            f"verified. Inspect the listener with lsof -nP -iTCP:{app_port} -sTCP:LISTEN."
        )
    return pid


def stop_web(cmd):
    if not web_port_in_use():
        return
    pid = tracked_web_pid(cmd)
    try:
        os.killpg(pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    for _ in range(40):
        if not web_port_in_use():
            print("saltcorn: stopped the tracked process.", flush=True)
            return
        time.sleep(0.25)
    raise SystemExit(f"Port {app_port} is still in use after stopping Saltcorn.")


def ready(url):
    try:
        with local_http.open(url, timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


jobs = [
    (
        "workflow",
        ["bash", str(ROOT / "private/start-workflow.sh")],
        f"http://127.0.0.1:{workflow_port}/health",
    ),
    (
        "saltcorn",
        [
            "node",
            str(ROOT / "backend/saltcorn/run.cjs"),
            "serve",
            "-h",
            "127.0.0.1",
            "-p",
            str(app_port),
        ],
        f"http://127.0.0.1:{app_port}/auth/login",
    ),
]
if v9:
    verify_v9_database()
if args.restart_web:
    stop_web(jobs[1][1])
pids = {}
for name, cmd, url in jobs:
    running = ready(url)
    if v9 and name == "saltcorn" and web_port_in_use():
        if running:
            tracked_web_pid(cmd)
        else:
            stop_web(cmd)
    if not running:
        log_path = PRIVATE / (name + "-server.log")
        print(f"{name}: starting (log: {log_path.relative_to(ROOT)}).", flush=True)
        with log_path.open("ab") as log:
            p = subprocess.Popen(
                cmd,
                stdin=subprocess.DEVNULL,
                stdout=log,
                stderr=subprocess.STDOUT,
                start_new_session=True,
                env=service_env,
            )
            pids[name] = p.pid
        for _ in range(30):
            if p.poll() is not None:
                raise SystemExit(
                    f"{name} exited during startup. Inspect {log_path.relative_to(ROOT)}."
                )
            if ready(url):
                break
            time.sleep(0.5)
        if not ready(url):
            raise SystemExit(
                f"{name} readiness timed out. Inspect {log_path.relative_to(ROOT)}."
            )
    print(name + ": ready")
syncPid = PRIVATE / "sync.pid"
alive = False
if syncPid.exists():
    try:
        os.kill(int(syncPid.read_text()), 0)
        alive = (
            not pathlib.Path("/proc").exists()
            or pathlib.Path("/proc", syncPid.read_text().strip(), "stat").read_text().split()[2]
            != "Z"
        )
    except (ProcessLookupError, ValueError, FileNotFoundError):
        pass
if not alive:
    with (PRIVATE / "lcnc-sync.log").open("ab") as log:
        p = subprocess.Popen(
            ["node", str(ROOT / "backend/saltcorn/sync.cjs")],
            stdin=subprocess.DEVNULL,
            stdout=log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
            env=service_env,
        )
    syncPid.write_text(str(p.pid))
    pids["sync"] = p.pid
if pids:
    previous = json.loads(pid_file.read_text()) if pid_file.exists() else {}
    pid_file.write_text(json.dumps({**previous, **pids}, indent=2))
workerPid = PRIVATE / "v7-worker.pid"
alive = False
if workerPid.exists():
    try:
        os.kill(int(workerPid.read_text()), 0)
        alive = (
            not pathlib.Path("/proc").exists()
            or pathlib.Path("/proc", workerPid.read_text().strip(), "stat")
            .read_text()
            .split()[2]
            != "Z"
        )
    except (ProcessLookupError, ValueError, FileNotFoundError):
        pass
if not alive:
    with (PRIVATE / "v7-worker.log").open("ab") as log:
        p = subprocess.Popen(
            ["node", str(ROOT / "backend/v7/integration/worker.cjs")],
            stdin=subprocess.DEVNULL,
            stdout=log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
            env=service_env,
        )
    workerPid.write_text(str(p.pid))
print("LCNC workflow reconciliation and V7 integration worker: started or retained")
