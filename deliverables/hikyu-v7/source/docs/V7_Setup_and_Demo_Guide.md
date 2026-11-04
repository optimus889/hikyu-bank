# V7 Setup and Demo Guide

Status: local application verified; Google relay/private Zaps not deployed from this session. All UI labels and Zap names below are English. Use newly created synthetic resources only. Never send passwords, API keys, signed request bodies or connection secrets through chat.

## 1. Start the independent application

Requirements: Docker with Compose, trusted JDK 17+ with compiler, Node.js (the tested environment uses Node 24), npm, Python 3 and package-registry access. Browser verification additionally requires Chromium and Playwright. The current tested JDK is 21. The Saltcorn lockfile is retained; setup uses `npm ci --legacy-peer-deps` for its supplied peer-dependency lock behavior.

Extract the V7 delivery to its own directory. Do not install over V6. From the new root:

```bash
python3 implementation/prepare_v7.py --check
V6_DB_PORT=55476 python3 implementation/prepare_v7.py
```

The inherited variable name `V6_DB_PORT` is retained by the preparation helper; it selects the new V7 PostgreSQL port. Preparation creates a path-specific Docker Compose project, a fresh database and new random role/session/account secrets. It does not reset a database. The inherited helper and filenames still contain V6 labels where compatibility is useful. Defaults are Saltcorn `http://127.0.0.1:8197`, Flowable `http://127.0.0.1:8196`, and loopback PostgreSQL 55476. Keep those ports free. Application pages: `/page/support-inbox`, `/page/support-requests`, `/page/case-synchronization`.

On subsequent starts:

```bash
python3 implementation/prepare_v7.py --start-only
```

If an existing V7 Saltcorn process predates the plugin installation, restart only that installation's Saltcorn process group recorded in `private/service-pids.json`, then run `implementation/start-services.py`. Do not stop another project. Setup and local tests ran in the current environment; a separate clean-machine installation has not been tested.

Read generated test credentials only in your private terminal from `private/saltcorn-accounts.json`. Do not include this file in a submission or screenshot. Role keys are `builder`, `requester`, `other_requester`, `service_agent`, `reviewer`, `supervisor`. Each is a distinct account; one person switching them is role simulation. Newly generated banking authorization codes stay in private files. Integration does not need to execute a transfer or change a balance.

## 2. Create new Google resources and relay

In your own Google account, create a new standalone Apps Script project named **Hikyu V7 Integration Relay**. Copy `implementation/v7/relay/Code.gs` into it. Enable the manifest view and copy `appsscript.json`. Review its Forms, Sheets and trigger permissions, then run `bootstrapV7` once and authorize it through Google's secure UI. It creates one new synthetic Form, one spreadsheet and an installable form-submission trigger. The script prints only the new Form and spreadsheet URLs. Do not rerun bootstrap on an initialized project.

The spreadsheet contains `SourceEvents`, `IntakeQueue`, `OutcomeQueue`, `Receipts`, `Nonces`, `Audit` and `ExternalCases`. Keep it private; share only with actual authorized test participants. `ExternalCases` is the external outcome table. Do not edit queue/nonce/receipt rows manually during normal operation.

In Script Properties, configure:

| Property | Value source |
|---|---|
| `SPREADSHEET_ID` | Set by bootstrap |
| `FORM_ID` | Set by bootstrap |
| `APP_SECRET` | New local `private/v7-integration.json` field `relay_app_secret` |
| `ZAPIER_SECRET` | New local config field `relay_zapier_secret`; a different secret |

Copy secrets directly between secure configuration interfaces. Deploy this script as a Web App executed as the owner, accessible to external requests if the account permits. **Only this relay** is a public HTTPS endpoint; all operations require HMAC authentication. Never deploy the database or the entire banking app. If organizational policy forbids this relay deployment, stop and record Blocked; do not weaken authentication. The ordinary `/exec` URL is not a signed secret URL. Keep authentication material out of URLs.

Set `relay_url` in the private local V7 config to that new `/exec` HTTPS URL and `enabled` to true. Do not enable until the two Zap connections are ready. The current managed environment still needs outbound access to `script.google.com` and the content-service redirect host `script.googleusercontent.com`; request only necessary domains in environment network settings. Current Zapier/Canvas official-page access is also blocked until the saved network configuration is applied by the owner. No environment publication was performed by the assistant.

The relay quotas, anonymous-web-app eligibility and secure owner execution must be checked in the actual Google account. No Google resources have been created by the assistant. Do not share existing unrelated spreadsheets.

## 3. Install the private Zapier integration

The owner reports that this Free account permits private integrations. The source is in `implementation/v7/zapier`. It was locally validated with official SDK/CLI 19.3.0. This is a private app definition, not an importable finished Zap or an already deployed platform export.

On a trusted terminal with Zapier connectivity:

```bash
cd implementation/v7/zapier
npm ci
npx zapier-platform validate --without-style
npx zapier-platform login
npx zapier-platform register
npx zapier-platform push
```

Use the CLI's secure login flow; do not paste its credentials into chat. Register a **new private** integration named **Hikyu Bank V7 Relay**, upload its initial version for your account, and keep it private. Do not promote or publish it publicly, enable a trial, or purchase a plan. Registration/upload could not be performed in this managed environment. If the current CLI asks for information, follow its current prompts; no existing app ID is supplied or reused here. Review official CLI instructions in the connected browser before upload.

Create a connection using the new relay `/exec` URL and `relay_zapier_secret` in its password-type authentication field. The connection test must return authenticated true. These are connection fields, not Code-step inputs. The integration uses the relay owner's authorized script to update the new external sheet; the native Google Sheets trigger separately requires your Google authorization.

## 4. Configure Zap 1 first

Name: **Hikyu V7 - External Support Request Intake**.

1. Trigger: Google Sheets / New Spreadsheet Row. Connect your Google account securely. Select the newly created spreadsheet and `SourceEvents` sheet. Confirm the connector and polling behavior are allowed on your actual Free plan.
2. Action: Hikyu Bank V7 Relay / Stage External Support Draft. Select the new relay connection.
3. Map each column to its identically named field: `source_type`, `source_namespace`, `source_event_id`, `subject`, `description`, `submitted_at`, optional `source_reference`. Do not map owner, email identity, transaction ID or full financial details. No extra Formatter step is needed: the action trims and validates before staging.
4. Submit a new synthetic form response to create a real row and test the action. Then enable the Zap with no trial/upgrade prompt. Record the run ID and time from Zap History, if exposed by your plan. Enable the app worker connection and wait for the authenticated pull; refresh Support Inbox as service_agent.
5. Confirm exactly one NEW draft with the same source event ID. Test sample/editor action alone is not a real trigger-run result. Record both separately.

Synthetic form example: Subject `Card access question`; Description `My synthetic card is locked and purchases are blocked.` No account number, card number, identity details or transaction reference is needed. Form response ID and submitted time are captured by the script; do not invent these for live evidence.

For a duplicate test, append another SourceEvents row with the exact same seven values. The trigger sees a new row, while the stable source event ID allows both relay and V7 to deduplicate. A changed payload using that same identity must conflict. To correct a rejected invalid row that never imported, append a corrected row with the same stable source identity and verify it imports once; do not edit an imported event in place. A new support request needs a new form response ID.

## 5. Configure Zap 2

Name: **Hikyu V7 - Support Case Outcome Synchronization**.

1. Trigger: Hikyu Bank V7 Relay / New Persisted Terminal Support Outcome.
2. Action: Hikyu Bank V7 Relay / Upsert External Support Outcome.
3. Map `delivery_id`, `case_id`, `state_version`, `final_state`, `case_processed_at` directly from the trigger. No body, transaction, owner, AI output or bank fields are mapped.
4. Enable the Zap **before** creating the test terminal outcome. Polling-trigger deduplication can consume existing test IDs. If necessary use the staff Replay outcome safely action to create a new delivery generation with the same stable case number.
5. The action calls the relay's authorized ExternalCases upsert and persists a receipt. The worker pulls it, commits `v7_receipts` and `v7_case_sync`, then acknowledges it. Verify the same case number/version/state/time in the sheet and V7 after a refresh.

Both Zaps have one trigger and one action. This intentionally avoids an extra Code or Formatter step and a webhook dependency. Free-plan task allowance, polling interval, current connector access, history retention and replay features remain to be confirmed in the actual account. Stop at an upgrade prompt and record it; do not turn on a trial. Background worker polling does not execute Zapier tasks by itself, while actual Zap actions may consume the account allowance. Do not claim an exact allowance until it is observed.

## 6. Full demonstration and failure recovery

Start only with the new synthetic resources and accounts. Previously generated local emulator cases and their SYNCED values are **not live evidence**. Record new source/run/case IDs for this demonstration.

1. Submit the synthetic Google Form. Record its real response ID from SourceEvents, Zap 1 history and the one V7 draft.
2. As service_agent, assign the draft to requester. As requester in a separate session, claim it, select one of that account's seeded synthetic transactions and confirm. External content cannot select the transaction automatically.
3. Open Transaction Support Review. Confirm actual AI category and Flowable process ID. As service_agent, continue with a synthetic comment; as reviewer, complete. These actions simulate roles if one person performs them.
4. Refresh the requester page and check the case is COMPLETED. The outbox must contain the same committed case/version and WAITING_ZAPIER is not a success receipt.
5. Wait for Zap 2. Compare ExternalCases case ID, final state and processing time with the native V7 record. Refresh Outcome Synchronization and require SYNCED plus receipt time. Save actual run IDs and credential-free screenshots.
6. For a new synthetic case, run `injectOneSyntheticWriteFailure` in the relay's Apps Script editor before the outcome action. The next write fails with EXTERNAL_WRITE_FAILED. Inspect the actual failed Zap step, relay Audit and V7 FAILED state; business state must remain terminal. This live fault injection is not yet performed here.
7. As staff, click Replay outcome safely. A fresh delivery generation is polled by Zap 2 without depending on a paid replay button. After recovery verify only one ExternalCases row for that case and a matching V7 receipt. A repeated action for the original failed delivery requests replay from V7 rather than falsely reporting success.
8. Test duplicate, invalid, anonymous/foreign-owner and stale-version cases. Never manually fabricate a higher business version in the live queues to force success. Separate interface tests from genuine platform-trigger runs.

Monitoring: V7 staff synchronization page shows outbox counts, safe audit events and relay transport state. Zap History shows individual failed steps where your plan permits. Relay Audit includes correlation, operation, result and time. Secrets and full payloads must not appear in screenshots. Private server logs and `private/v7-transport-state.json` remain local. Correct a paused configuration/authentication error, or resume explicitly after fixing the cause:

```bash
node implementation/v7/integration/worker.cjs --resume --once
```

Do not start two long-running workers for one installation. The normal supervisor starts one worker, identified by `private/v7-worker.pid`. The circuit-breaker file pauses automatic permanent-error attempts; changing the private config also clears that pause on the next loop. Outbox failures are replayed by authorized staff; business state is never reset to replay an external action.

## 7. Reproduce local verification

Install the pinned browser-test package and use system Chromium (`/usr/bin/chromium` in the tested environment). Install Chromium through your trusted OS/package source if absent.

```bash
npm ci --prefix implementation/v7/tests
npm ci --prefix implementation/v7/zapier
export NODE_PATH="$PWD/implementation/v7/tests/node_modules"
node implementation/saltcorn/test_e2e.cjs
python3 implementation/test_workflow_http.py
```

The isolated V7 suite temporarily uses a loopback relay emulator and restores the private connection configuration. Stop only this installation's V7 worker before it, then restart the service supervisor after it. The suite never connects to Google or Zapier. It executes the delivered Apps Script with emulated Google APIs and the actual local banking/workflow stack:

```bash
node implementation/v7/tests/run.cjs
node implementation/v7/collect-evidence.cjs
python3 implementation/start-services.py
```

Results are written under `evidence/v7/`. Do not label them Zapier end-to-end passes. The baseline helper's engine build also runs six Flowable tests. The supplied V6 native pack is retained only as baseline reference; install V7 through the preparation/migration source rather than importing native numeric IDs between databases.
