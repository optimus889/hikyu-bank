#!/usr/bin/env python3
"""Start the packaged app twice against a dedicated PostgreSQL test database.

Requires HIKYU_TEST_DB_URL ending in /hikyu_bank_test, and a previously built JAR.
Leaves one pending demo investment application in the disposable test database.
No production database, provider stub or third-party Python dependency is used.
"""
import http.cookiejar
import json
import os
import re
import socket
import subprocess
import tempfile
import time
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import HTTPCookieProcessor, Request, build_opener


def main():
    backend = Path(__file__).resolve().parents[1]
    url = os.environ.get("HIKYU_TEST_DB_URL", "")
    if not re.fullmatch(r"jdbc:postgresql://[^/]+/hikyu_bank_test(?:\?.*)?", url):
        raise SystemExit("Set HIKYU_TEST_DB_URL to a dedicated hikyu_bank_test database.")
    env = dict(os.environ)
    env.update(
        HIKYU_DB_URL=url,
        HIKYU_DB_USER=os.environ.get("HIKYU_TEST_DB_USER", "hikyu"),
        HIKYU_DB_PASSWORD=os.environ.get("HIKYU_TEST_DB_PASSWORD", "hikyu_local_demo"),
        HIKYU_SEED_ENABLED="true",
    )
    with socket.socket() as port_socket:
        port_socket.bind(("127.0.0.1", 0))
        port = port_socket.getsockname()[1]
    env["PORT"] = str(port)
    base = f"http://127.0.0.1:{port}"
    client = build_opener(HTTPCookieProcessor(http.cookiejar.CookieJar()))
    process = None

    def request(method, path, payload=None):
        data = None if payload is None else json.dumps(payload).encode()
        req = Request(base + path, data=data, method=method, headers={
            "Content-Type": "application/json", "X-Hikyu-Request": "web"
        })
        with client.open(req, timeout=5) as response:
            body = response.read()
            return json.loads(body) if body else None

    def login(username):
        nonlocal client
        client = build_opener(HTTPCookieProcessor(http.cookiejar.CookieJar()))
        challenge = request("POST", "/api/v1/auth/login", {
            "username": username, "password": "HikyuDemo2026!"
        })
        code = request("POST", "/api/v1/auth/code", {
            "challengeId": challenge["challengeId"], "method": "sms"
        })
        return request("POST", "/api/v1/auth/verify", {
            "challengeId": challenge["challengeId"], "method": "sms",
            "code": code["demoCode"], "pin": ""
        })

    def start(log):
        nonlocal process
        process = subprocess.Popen(
            ["java", "-jar", str(backend / "target/hikyu-bank-4.0.0.jar")],
            env=env, stdout=log, stderr=subprocess.STDOUT
        )
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise RuntimeError("Backend exited; inspect the smoke log.")
            try:
                assert request("GET", "/api/v1/health")["storage"] == "postgresql"
                return
            except (URLError, HTTPError, TimeoutError):
                time.sleep(0.3)
        raise RuntimeError("Backend did not become healthy within 60 seconds.")

    def stop():
        if process and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()

    with tempfile.TemporaryFile() as log:
        try:
            start(log)
            for username, expected in [
                ("chengyang.lee", "Cheng-Yang Lee"),
                ("gospelhope.david", "Gospelhope David"),
                ("mingyu.fan", "Mingyu Fan"),
            ]:
                assert login(username)["user"]["name"] == expected
                assert len(request("GET", "/api/v1/transactions")) == 12
            login("chengyang.lee")
            account = request("POST", "/api/v1/accounts", {
                "type": "investment", "name": "Restart test " + uuid.uuid4().hex[:8]
            })
            checking_id = next(
                item["id"] for item in request("GET", "/api/v1/accounts")
                if item["type"] == "checking"
            )
            alert = request("POST", "/api/v1/alerts", {
                "type": "low_balance", "accountId": checking_id,
                "title": "Persistent alert", "channel": "In-app", "amount": 123.45
            })
            notification = request("POST", "/api/v1/notifications/test", {"alertId": alert["id"]})
            removed = request("POST", "/api/v1/notifications/test", {})
            request("DELETE", "/api/v1/notifications/" + removed["id"])
            request("PATCH", "/api/v1/notifications/" + notification["id"], {"resolved": True})
            stop()
            start(log)
            # Authentication sessions intentionally do not survive backend restarts.
            try:
                request("GET", "/api/v1/accounts")
                raise AssertionError("Old session unexpectedly survived restart.")
            except HTTPError as error:
                assert error.code == 401
            login("chengyang.lee")
            stored = request("GET", "/api/v1/accounts/" + account["id"])
            assert stored["status"] == "pending" and stored["name"] == account["name"]
            alerts = request("GET", "/api/v1/alerts")
            assert any(row["id"] == alert["id"] and row["amount"] == 123.45 for row in alerts)
            notifications = request("GET", "/api/v1/notifications")
            assert not any(row["id"] == removed["id"] for row in notifications)
            assert any(row["id"] == notification["id"] and row["read"] and row["resolved"]
                       for row in notifications)
            login("mingyu.fan")
            try:
                request("GET", "/api/v1/accounts/" + account["id"])
                raise AssertionError("Another user could read the account.")
            except HTTPError as error:
                assert error.code == 404
            with client.open(base + "/login.html") as response:
                assert b"auth/login-page.js" in response.read()
            login("chengyang.lee")
            request("DELETE", "/api/v1/notifications/" + notification["id"])
            request("DELETE", "/api/v1/alerts/" + alert["id"])
            print("PASS: three users, PostgreSQL persistence across restart, alert/inbox CRUD, "
                  "session reset, ownership isolation and bundled UI.")
        except Exception:
            log.seek(0)
            print(log.read().decode(errors="replace")[-6000:])
            raise
        finally:
            stop()


if __name__ == "__main__":
    main()
