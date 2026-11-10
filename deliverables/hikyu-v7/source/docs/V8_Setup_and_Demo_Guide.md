# Hikyu Bank V8 Setup and Demo Guide

## Source location and safety

In the repository, the incrementally maintained application is `deliverables/hikyu-v7/source/`. Its directory name is retained for history; the new version is V8. The repository's root Spring Boot application and original V7 ZIP are preserved. A full V8 ZIP extracts a self-contained `Hikyu_Bank_V8/` application root with README, implementation, lockfiles, safe configuration templates, docs and evidence. The changes ZIP is **not** a complete application.

Use a separate extraction/worktree and synthetic data. Never copy previous private configuration or credentials. Setup refuses to automatically adopt existing V7 private configuration when starting a fresh V8 instance. There is no destructive V8 business migration.

## Prepare and run

Requirements: Node.js 22+ (tested Node 24), Python 3, a trusted JDK 17+ with javac (tested JDK 21), Docker/Compose and package-registry access. Chromium is needed for browser tests; the tested path is `/usr/bin/chromium`. Keep certificate verification and the environment's proxy/CA configuration enabled.

From the application root:

```bash
python3 implementation/prepare_v8.py --check
V6_DB_PORT=55586 python3 implementation/prepare_v8.py
```

`--check` validates source presence only. Full preparation installs the existing pinned Saltcorn package with its existing peer-lock option, generates private random credentials, creates a dedicated path-specific PostgreSQL project/database, configures native pages, trains the retained local model, builds Flowable and starts the services. Saltcorn's local plugin installer copies its entry modules; the generated runtime environment supplies the correct source root. Native metadata is reloaded by restarting only this installation's Saltcorn service.

Default addresses:

- Saltcorn: `http://127.0.0.1:8297/page/support-inbox`
- Original support workflow page: `http://127.0.0.1:8297/page/support-requests`
- Synchronization page: `http://127.0.0.1:8297/page/case-synchronization`
- Flowable health: `http://127.0.0.1:8296/health`
- PostgreSQL loopback mapping: 55586

These are local addresses, not public deployments or Zapier endpoints. After first preparation, restart with:

```bash
python3 implementation/prepare_v8.py --start-only
```

Optional supported shell settings are documented in `.env.example`; that file is not automatically loaded. `V6_DB_PORT` is a retained compatibility variable name. The new private runtime file selects application/workflow ports. For a second independent instance, create only its new `private/v8-runtime.json` with unused ports before first preparation and choose a different V6_DB_PORT. Never reuse another installation's private directory.

Generated account credentials are in `private/saltcorn-accounts.json`; role keys are requester, other_requester, service_agent, reviewer, supervisor and builder. Read them only in your secure local terminal. Legacy `.v7@example.invalid` labels identify freshly generated synthetic accounts, not reused accounts. Passwords, role tokens, PINs and configuration must not be shared or committed. The external relay defaults to disabled.

## Demonstrate the three use cases

### 1. Draft form

For a new synthetic local draft, the helper below stages directly through the retained application adapter. This is a local demo, not a Google Form or Zapier run:

```bash
node implementation/v8/tests/seed-demo.cjs
```

As service_agent, open Support Inbox and assign the new draft to requester. In a separate authenticated requester session, claim it. Check source metadata, a blank transaction choice, the edited description's trimmed character count, and associated validation errors. Select one of the requester's own seeded transactions and submit. Pending controls prevent duplicate clicks. Success refreshes only that card and moves focus to its next useful element; the original Flowable workflow receives the case. A missing CSRF/session may redirect and must not be interpreted as success.

Use the automated suite for deliberately injected failure, overlength and duplicate-click examples; it labels those injections and retains input. Do not break a real external service to manufacture evidence. SUBMISSION_FAILED retries use previously frozen details and existing version checks.

### 2. Recorded progress

Open Transaction Support Review. An actual service agent can continue, return for information or reject; a returned requester can resubmit; an independent reviewer can complete/reject. The native role and owner rules are unchanged. Progress reads the same persisted record after refresh.

The UI shows creation only when its time exists, plus the current/latest stored stage. It explicitly says that complete history/previous branch visits are unavailable. Current role and latest comment are not attributed to invented earlier actors. Unknown states stay neutral. No diagram claims that every branch occurred.

The controlled branch test actually executes malformed-classifier handling and a short review timer. It restores normal settings and does not replace the classifier with successful fake AI output:

```bash
NODE_PATH="$PWD/implementation/v7/tests/node_modules" node implementation/v8/tests/engine-branches.cjs
```

Run it only against this independent local test installation. It restarts only its recorded workflow process group, temporarily injects a private malformed-output script and PT2S timer, then restores normal classifier/PT24H defaults. A single person switching roles must be described as role simulation.

### 3. Synchronization monitor

Open Outcome Synchronization. Business state and delivery/receipt state are separate. Summary and filtering cover only the up-to-100 authorized records loaded. Staff-wide queue totals are separately labelled. Search a case number and select a status; an unmatched search produces an explicit empty state. Refresh retains filters and keyboard focus.

Only staff see replay controls. A forged requester POST still fails on the server. Replay prevents repeat clicks and shows actual results or a readable error. A pending refresh is canceled when a newer replay begins. Long IDs/errors wrap, and the audit table scrolls inside a labelled keyboard-focusable region.

A SYNCED label confirms a stored receipt, not independently verified Zapier/Google execution. Emulator and unverified-origin notices must remain visible. Actual external integration requires the original V7 owner-side authorization and real runs; it was not completed by V8.

## Reproduce verification

Install the existing browser test dependency and retained private app SDK. A writable npm cache can be selected in restricted environments:

```bash
npm ci --cache /tmp/hikyu-v8-npm-cache --prefix implementation/v7/tests
npm ci --cache /tmp/hikyu-v8-npm-cache --prefix implementation/v7/zapier --ignore-scripts
export NODE_PATH="$PWD/implementation/v7/tests/node_modules${NODE_PATH:+:$NODE_PATH}"
node --test implementation/v8/tests/unit.cjs
V8_TEST_ROUND=final node implementation/v8/tests/browser.cjs
node implementation/v8/tests/engine-branches.cjs
node implementation/saltcorn/test_e2e.cjs
python3 implementation/test_workflow_http.py
```

The browser suite runs actual local native pages, with labelled HTTP failures/delays and display-only persisted fixtures. It does not claim cloud execution. Display-only outbox events are deferred from transport and all financial rows are checked unchanged. Do not run controlled timer/restart tests concurrently with another workflow suite.

Before running the retained V7 relay suite, stop **only this installation's V7 worker**, whose PID is in its own private/v7-worker.pid. This prevents a live worker from reading the suite's temporary emulator connection. Leave unrelated services alone:

```bash
node implementation/v7/tests/run.cjs
python3 implementation/start-services.py
```

That suite restores the private external configuration and explicitly emulates Google services; its passes are not Zapier passes. Stop no Docker volume or unrelated project. After testing, ensure external transport is disabled unless intentionally and securely configured. Regenerate evidence with capture.cjs if needed; screenshot generation does not add test cases.

## Prompt and package provenance

Initial prompts, follow-ups and original generated outputs are in `implementation/v8/prompts/`. `V8_Prompt_Log.md` explains which changes followed actual findings. Do not describe these as independent API model transcripts.

The full ZIP is generated from the validated application's Git source commit, excluding private data, installed modules, old archives and build outputs. Its PROVENANCE.json records the source SHA and included-file hashes. The changes pack records the baseline SHA, target SHA, repo-relative file contents and deletion list; apply it only to that confirmed baseline, preserving local changes. The delivery manifest records SHA-256 and CRC checks. Compare active source hashes after any eventual PR merge before claiming package equivalence.
