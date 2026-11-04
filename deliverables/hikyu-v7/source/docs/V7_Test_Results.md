# V7 Test Results

Run time: 2026-11-04T23:18:20.819Z. Fresh evidence from the uploaded-V6-derived independent V7 installation. **17 local checks Pass; real Zapier/Google end-to-end tests are Blocked.** No old V6 result is counted.

## Prerequisites and scope

Fresh private database/accounts, actual local Saltcorn 1.6.2, PostgreSQL, Flowable and local classifier; one operator switches distinct synthetic role accounts. The local relay executes the delivered Apps Script source with explicitly emulated Google APIs/storage. The private Zapier source functions use intercepted HTTP transport. These are neither Zap editor tests nor cloud runs. The test restores the disabled external configuration. Test-only remote state stays in private files.

## Executed V7 checks

### T01 — Relay authentication, client scope and signed-envelope replay protection

- Status: **Pass**.
- Scope: Local Apps Script contract emulator; no Google or Zapier execution.
- Prerequisites: Emulated relay running with distinct fresh app/Zapier keys.
- Steps: Send missing authentication, replay a valid envelope, and call an app-only operation with the Zapier key.
- Expected: 401, replay conflict and 403; no unauthorized queue access.
- Actual: Assertions satisfied.
- Evidence: `evidence/v7/results.json` result 1; `evidence/v7-tests.log`; relevant native screenshots/audit below.

### T02 — Actual loopback transport outage is logged and recovers without creating a draft

- Status: **Pass**.
- Scope: Real local HTTP connection failure; external services emulated.
- Prerequisites: Local HTTP relay endpoint initially running.
- Steps: Stop its actual listening socket, run the worker and monitor, restart it, retry.
- Expected: Network failure is retryable and audited; monitor recovers to READY.
- Actual: Assertions satisfied.
- Evidence: `evidence/v7/results.json` result 2; `evidence/v7-tests.log`; relevant native screenshots/audit below.

### T03 — Mapped normalized intake creates exactly one durable unverified draft

- Status: **Pass**.
- Scope: Real local PostgreSQL write through app worker + emulated relay; not Zapier intake E2E.
- Prerequisites: Fresh source event, new form namespace; native PostgreSQL running.
- Steps: Stage mapped synthetic input, run worker, query persisted draft.
- Expected: One trimmed NEW draft, canonical timestamp, no transaction or support/process link.
- Actual: Assertions satisfied. {"draft_id": 13, "case_id": "v6-64d6a6fd-ee3b-47d5-baf8-66e7c8a230b6", "source_event_id": "synthetic-response-1793834296281"}
- Evidence: `evidence/v7/results.json` result 3; `evidence/v7-tests.log`; relevant native screenshots/audit below.

### T04 — Delivered Zapier action and polling functions execute their mapped contracts

- Status: **Pass**.
- Scope: Local Zapier source-function execution with intercepted HTTP transport; not a Zap editor or cloud run.
- Prerequisites: Delivered private integration source loaded; HTTP explicitly intercepted to local emulator.
- Steps: Execute authentication, stage action and polling functions; submit invalid calendar date.
- Expected: Connection and mappings work locally; invalid date rejected before transmission.
- Actual: Assertions satisfied.
- Evidence: `evidence/v7/results.json` result 4; `evidence/v7-tests.log`; relevant native screenshots/audit below.

### T05 — Duplicate source event is idempotent; changed payload conflicts

- Status: **Pass**.
- Scope: Local Saltcorn/PostgreSQL/Flowable test; one-person role simulation.
- Prerequisites: Same stable source event already persisted.
- Steps: Stage/import identical event and stage a changed subject with the same ID.
- Expected: One draft; identical event idempotent, changed content conflicts.
- Actual: Assertions satisfied.
- Evidence: `evidence/v7/results.json` result 5; `evidence/v7-tests.log`; relevant native screenshots/audit below.

### T06 — Blank/missing required fields, invalid dates and external identity binding are rejected

- Status: **Pass**.
- Scope: Local Saltcorn/PostgreSQL/Flowable test; one-person role simulation.
- Prerequisites: No invalid event imported.
- Steps: Try blank subject/body, malformed date, impossible February date and supplied owner_id.
- Expected: 422 semantics; no invalid second draft.
- Actual: Assertions satisfied.
- Evidence: `evidence/v7/results.json` result 6; `evidence/v7-tests.log`; relevant native screenshots/audit below.

### T07 — Staff assignment, cross-user isolation and requester claim use native authenticated sessions

- Status: **Pass**.
- Scope: Local Saltcorn/PostgreSQL/Flowable test; one-person role simulation.
- Prerequisites: Fresh draft, distinct native staff/requester/other-requester sessions.
- Steps: Staff assign; other requester inspects page and attempts claim; assigned requester claims; refresh.
- Expected: Staff-only assignment, foreign user denial and persistent CLAIMED status.
- Actual: Assertions satisfied.
- Evidence: `evidence/v7/results.json` result 7; `evidence/v7-tests.log`; relevant native screenshots/audit below.

### T08 — Only own transaction can be bound; a stale draft version is rejected

- Status: **Pass**.
- Scope: Local Saltcorn/PostgreSQL/Flowable test; one-person role simulation.
- Prerequisites: Claimed draft and another user's transaction.
- Steps: Submit foreign transaction and a stale expected draft version.
- Expected: 403 ownership rejection, 409 stale version, no support link created.
- Actual: Assertions satisfied.
- Evidence: `evidence/v7/results.json` result 8; `evidence/v7-tests.log`; relevant native screenshots/audit below.

### T09 — Claimed draft submits to original Flowable and actual runtime classifier

- Status: **Pass**.
- Scope: Local Saltcorn/PostgreSQL/Flowable test; one-person role simulation.
- Prerequisites: Assigned requester has claimed the draft and owns selected transaction.
- Steps: Confirm description/own transaction through native post handler, retry same submission.
- Expected: One support record; actual Flowable starts; actual classifier suggests card_access.
- Actual: Assertions satisfied. {"case_id": "v6-64d6a6fd-ee3b-47d5-baf8-66e7c8a230b6", "process_instance_id": "648", "ai_category": "card_access"}
- Evidence: `evidence/v7/results.json` result 9; `evidence/v7-tests.log`; relevant native screenshots/audit below.

### T10 — Nonterminal records cannot publish outcomes

- Status: **Pass**.
- Scope: Local Saltcorn/PostgreSQL/Flowable test; one-person role simulation.
- Prerequisites: Business case still SERVICE_REVIEW.
- Steps: Capture terminal outbox and try a nonterminal contract.
- Expected: No outbox for this case; nonterminal state rejected.
- Actual: Assertions satisfied.
- Evidence: `evidence/v7/results.json` result 10; `evidence/v7-tests.log`; relevant native screenshots/audit below.

### T11 — Service-agent to reviewer handoff and terminal write-back survive browser refresh

- Status: **Pass**.
- Scope: Local Saltcorn/PostgreSQL/Flowable test; one-person role simulation.
- Prerequisites: Native agent and reviewer sessions; original Flowable process waiting.
- Steps: Agent continues; reviewer completes; requester refreshes same case.
- Expected: Actual handoff and committed COMPLETED state on the same business key.
- Actual: Assertions satisfied. {"case_id": "v6-64d6a6fd-ee3b-47d5-baf8-66e7c8a230b6", "state": "COMPLETED", "sequence": 6}
- Evidence: `evidence/v7/results.json` result 11; `evidence/v7-tests.log`; relevant native screenshots/audit below.

### T12 — Persisted terminal outcome publishes a minimal durable event only once

- Status: **Pass**.
- Scope: Local Saltcorn/PostgreSQL/Flowable test; one-person role simulation.
- Prerequisites: Committed terminal case/version.
- Steps: Run worker, rescan, inspect minimal event and relay poll.
- Expected: One terminal outbox entry; WAITING_ZAPIER only; no sensitive fields.
- Actual: Assertions satisfied.
- Evidence: `evidence/v7/results.json` result 12; `evidence/v7-tests.log`; relevant native screenshots/audit below.

### T13 — External write failure is visible while business state remains completed

- Status: **Pass**.
- Scope: Real local app + delivered Apps Script running on emulated Google storage; not external failure proof.
- Prerequisites: Published local outcome ready for action.
- Steps: Inject one write failure in delivered relay code, apply and pull receipt.
- Expected: Sync FAILED/EXTERNAL_WRITE_FAILED; core case remains COMPLETED.
- Actual: Assertions satisfied. {"case_id": "v6-64d6a6fd-ee3b-47d5-baf8-66e7c8a230b6", "business_state": "COMPLETED", "sync_status": "FAILED", "error_code": "EXTERNAL_WRITE_FAILED"}
- Evidence: `evidence/v7/results.json` result 13; `evidence/v7-tests.log`; relevant native screenshots/audit below.

### T14 — Authorized replay recovers with one external row and durable synchronization receipt

- Status: **Pass**.
- Scope: Local Saltcorn/PostgreSQL/Flowable test; one-person role simulation.
- Prerequisites: Failed delivery, authorized native staff and requester sessions.
- Steps: Reject requester replay; staff replay new generation; apply twice, pull/ack, reject late FAILED receipt and refresh.
- Expected: One emulator ExternalCases row; one current receipt confirms SYNCED; no late downgrade.
- Actual: Assertions satisfied. {"case_id": "v6-64d6a6fd-ee3b-47d5-baf8-66e7c8a230b6", "state_version": 6, "synced_at": "2026-11-04T23:18:20.431Z", "external_record_id": "ExternalCases:v6-64d6a6fd-ee3b-47d5-baf8-66e7c8a230b6", "external_system": "LOCAL CONTRACT EMULATOR, not Google Sheets"}
- Evidence: `evidence/v7/results.json` result 14; `evidence/v7-tests.log`; relevant native screenshots/audit below.

### T15 — Stale events cannot overwrite a newer external row; mismatched receipts rejected

- Status: **Pass**.
- Scope: Local Saltcorn/PostgreSQL/Flowable test; one-person role simulation.
- Prerequisites: External emulator row already has newer state version.
- Steps: Publish/apply lower-version delivery; send mismatched receipt correlation.
- Expected: STALE_IGNORED, external newer row retained; bad receipt rejected.
- Actual: Assertions satisfied.
- Evidence: `evidence/v7/results.json` result 15; `evidence/v7-tests.log`; relevant native screenshots/audit below.

### T16 — Only recoverable transport errors schedule retries

- Status: **Pass**.
- Scope: Local Saltcorn/PostgreSQL/Flowable test; one-person role simulation.
- Prerequisites: New synthetic case created and actually rejected by original Flowable adapter during this test.
- Steps: Capture its terminal event; inject retryable 503 and nonretryable 401 into publication error handler.
- Expected: RETRY_PENDING for transient error, FAILED for permanent error; no automatic permanent retry.
- Actual: Assertions satisfied.
- Evidence: `evidence/v7/results.json` result 16; `evidence/v7-tests.log`; relevant native screenshots/audit below.

### T17 — Original transaction and account/balance records remain unchanged

- Status: **Pass**.
- Scope: Local Saltcorn/PostgreSQL/Flowable test; one-person role simulation.
- Prerequisites: Account/transaction snapshots captured before support integration operations.
- Steps: Compare all rows after completion/replay/error operations.
- Expected: All original transaction and account/balance values identical.
- Actual: Assertions satisfied.
- Evidence: `evidence/v7/results.json` result 17; `evidence/v7-tests.log`; relevant native screenshots/audit below.

## Regressions and configuration checks

| Check | Actual result | Evidence |
|---|---|---|
| V6 native support UI/AI/roles/persistence regression before V7 changes | Pass, 8 local checks; one-person role simulation | `evidence/v6-regression-before.log` |
| V6 native support regression after V7 changes | Pass, 8 local checks | `evidence/v6-regression-after.log`, `evidence/lcnc-e2e.json` |
| Workflow HTTP regression after changes | Pass, 9 tests; includes return/reject, stale decision and role isolation | `evidence/workflow-http-regression.log`, `evidence/workflow-http-events.json` |
| Fresh Flowable engine build tests | Pass, 6 tests, zero failures/errors/skips during this installation | `evidence/v7-flowable-engine-tests.xml` |
| Private app structural configuration | Pass, official CLI 19.3.0 `validate --without-style` | `evidence/zapier-local-validation.log` |
| Online Zapier integration checks | Blocked, fetch/network failure | `evidence/zapier-validation.log` |
| Official pricing/Canvas retrieval | Blocked, proxy 403 | `evidence/official-retrieval-current.json` |

## Required live acceptance tests

| ID / test | Preconditions and steps | Expected result | Actual / status | Evidence still needed |
|---|---|---|---|---|
| L01 Real normal intake | Owner deploys relay, authorizes new Google sheet, enables Zap 1; submit new Google Form response and refresh V7 | One correct persistent draft sharing real source ID | **Blocked**; local analogue T03 passes | Actual source row, Zap run ID/time, native draft screenshot |
| L02 Real duplicate / invalid intake | Append duplicate and invalid synthetic SourceEvents rows with Zap 1 active | No duplicate or invalid native row; rejected step identifiable | **Blocked**; local T05/T06 pass | Real Zap history and native record count |
| L03 Real full chain | New form -> enabled Zap 1 -> native claim/own transaction -> actual Flowable -> enabled Zap 2 -> ExternalCases -> receipt | Same case/version/state/processing time and persistent SYNCED | **Blocked**; local T09–T14 pass with emulator | Both real Zap runs, live sheet row, V7 receipt |
| L04 Real external failure and recovery | Inject relay write failure for a new synthetic case; inspect failed Zap step; staff replay | Business remains terminal; recover to one sheet row | **Blocked**; local T13/T14 pass | Failed/recovered cloud run IDs, real ExternalCases row count |
| L05 Live nonterminal/duplicate/stale guards | Run approved contract tests against new deployed relay without manufacturing banking decisions | No nonterminal projection, no duplicate or old overwrite | **Blocked**; local T10/T12/T15 pass | New relay audit, actual sheet evidence |
| L06 Free account entitlement verification | Open current plan, connector, activation, history and retry screens without upgrading | Exact allowance, polling, history/retry controls documented | **Blocked** for independent proof; owner reports Free/private app/Code permitted | Credential-free account capability evidence and official access |
| L07 Zap editor single-step tests | Deploy private app/connect relay; test both trigger/action pairs | Each editor test actually succeeds | **Not tested**; no editor access/session | Actual editor results, separate from L03 |
| L08 Real multiple participants | Independent people use their own newly authorized roles | Actual inter-person handoff confirmed | **Not tested**; local tests use one operator | Participant-approved trace without secrets |
| L09 V7-specific AI timeout/human deadline branches | Controlled local scenario with original engine/classifier | Existing manual/timeout behavior retained | **Not tested** beyond engine/HTTP regression scope | New targeted run evidence if required |

## Evidence index

- Main new source event: `synthetic-response-1793834296281`; native draft ID `13`; case `v6-64d6a6fd-ee3b-47d5-baf8-66e7c8a230b6`.
- Main confirmed local sync version: `6`; time `2026-11-04T23:18:20.431Z`; external identifier `ExternalCases:v6-64d6a6fd-ee3b-47d5-baf8-66e7c8a230b6`. External system was the **local contract emulator**.
- `evidence/v7/01-inbox-claimed.png`: real local Saltcorn native requester page, synthetic draft.
- `evidence/v7/02-flowable-completed.png`: actual Flowable outcome projected to native support page.
- `evidence/v7/03-sync-failure.png`: actual local V7 page after emulated external write failure.
- `evidence/v7/04-sync-recovered-local.png`: actual local V7 page after replay. The UI warning identifies the emulator; this is not Google/Zapier proof.
- `evidence/v7/audit-metadata.json`: actual safe application correlation audit; includes multiple development test runs.
- `evidence/source-provenance.json`: uploaded V6 archive hash and scope.
- `evidence/historical-evidence-separation.json`: separation of uploaded historical evidence from new results.

## Corrections during implementation

The first development attempts found a missing native Page description, a relay response-field mismatch, an incorrect test expectation for the existing AI column name, and a retry test depending on another run's terminal case. These were corrected. The final retry test creates and rejects its own synthetic case, and the final 17-check run passes. A supervisor restart issue caused by zombie worker processes was also corrected. These fixes are not presented as cloud failures or Zapier recovery evidence.

## Acceptance conclusion

Local implementation and the listed regressions pass. Cloud deployment, real Zapier runs, real Google updates and cloud failure/recovery are incomplete. The assignment's full integration acceptance is therefore **not complete**. No live run ID, screenshot or measured efficiency gain is fabricated.
