# V8 Test Results

Final native browser run: `2026-11-10T16:32:18.063Z`. V8 results are newly executed in this independent installation; historical V7 reports are not used as current passes.

## Preconditions and scope

Fresh private Saltcorn/PostgreSQL configuration and role accounts; dedicated loopback application/workflow/database; actual Chromium. One operator switches separate native accounts. Unit tests, actual local browser tests, controlled network responses, persisted display fixtures, actual Flowable branches and emulated external contracts are explicitly separated. No real Zapier/Google run was executed.

## Final browser cases

### B01 — Source content is escaped and metadata is readable

- Status: **Pass**.
- Scope: Actual local native browser + PostgreSQL/Flowable, synthetic accounts, one-person role simulation.
- Steps: Persist a claimed synthetic draft with markup; open native Inbox.
- Expected: Text is displayed without executing markup; source/status/time/labels present.
- Actual: {"draft_id": 23, "case_id": "v6-2091bf98-9e15-4704-b67f-222aaec83c62"}.
- Evidence: `evidence/v8/final/browser-results.json`, case 1; `evidence/v8/browser-final.log`.

### B02 — Draft required and trimmed-length validation is linked and server-consistent

- Status: **Pass**.
- Scope: Actual local native browser + PostgreSQL/Flowable, synthetic accounts, one-person role simulation.
- Steps: Submit empty transaction, blank text, 2/3/2000/2001 trimmed characters; observe POST count.
- Expected: Invalid fields have associated errors; valid boundaries reach API; invalid values create no POST.
- Actual: "Assertions satisfied".
- Evidence: `evidence/v8/final/browser-results.json`, case 2; `evidence/v8/browser-final.log`.

### B03 — API failure keeps edited inputs and displays a readable English error

- Status: **Pass**.
- Scope: Actual browser with deliberately intercepted HTTP 500; no real external failure.
- Steps: Inject one HTTP 500 after entering synthetic values.
- Expected: Inputs remain unchanged and the pending state clears with error feedback.
- Actual: "Assertions satisfied".
- Evidence: `evidence/v8/final/browser-results.json`, case 3; `evidence/v8/browser-final.log`.

### B04 — Repeated enhancement binding produces one POST and no polling

- Status: **Pass**.
- Scope: Actual local native browser + PostgreSQL/Flowable, synthetic accounts, one-person role simulation.
- Steps: Execute controller three extra times, submit once against a 409 fixture, then wait idle.
- Expected: One request only; no controller-generated background polling.
- Actual: "Assertions satisfied".
- Evidence: `evidence/v8/final/browser-results.json`, case 4; `evidence/v8/browser-final.log`.

### B05 — Pending draft blocks duplicate clicks and submits to actual Flowable

- Status: **Pass**.
- Scope: Actual local native browser + PostgreSQL/Flowable, synthetic accounts, one-person role simulation.
- Steps: Delay one actual POST, attempt a second native form submit, then let server complete.
- Expected: One POST, disabled pending controls, one persisted support link and refreshed SUBMITTED card.
- Actual: {"case_id": "v6-2091bf98-9e15-4704-b67f-222aaec83c62", "process_instance_id": "7902"}.
- Evidence: `evidence/v8/final/browser-results.json`, case 5; `evidence/v8/browser-final.log`.

### B06 — Native permissions, transaction ownership and CSRF remain enforced

- Status: **Pass**.
- Scope: Actual local native browser + PostgreSQL/Flowable, synthetic accounts, one-person role simulation.
- Steps: Use another account and forged posts for assignment, foreign transaction and missing CSRF.
- Expected: Other user cannot see draft; backend rejects 403; CSRF omission rejected.
- Actual: "Assertions satisfied".
- Evidence: `evidence/v8/final/browser-results.json`, case 6; `evidence/v8/browser-final.log`.

### B07 — Progress reflects real return and rejection branches after refresh

- Status: **Pass**.
- Scope: Actual local native browser + PostgreSQL/Flowable, synthetic accounts, one-person role simulation.
- Steps: Agent returns the real case; requester resubmits; agent rejects; reload each stage.
- Expected: RETURNED and REJECTED appear as persisted states with no invented intermediate history.
- Actual: {"case_id": "v6-2091bf98-9e15-4704-b67f-222aaec83c62", "kind": "Actual Flowable return/resubmission/rejection, one-person role simulation"}.
- Evidence: `evidence/v8/final/browser-results.json`, case 7; `evidence/v8/browser-final.log`.

### B08 — All branch states, unknown state and missing history render safely in native browser

- Status: **Pass**.
- Scope: Actual native browser with explicit persisted UI fixtures; these fixtures do not claim engine branch execution.
- Steps: Insert clearly labelled display-only persisted fixtures for all state codes plus unknown; read native page.
- Expected: Eight states and unknown handled; no fake history, dates or universal linear path; unknown is not final.
- Actual: "Assertions satisfied".
- Evidence: `evidence/v8/final/browser-results.json`, case 8; `evidence/v8/browser-final.log`.

### B09 — Synchronization filters and counts are limited to authorized loaded records

- Status: **Pass**.
- Scope: Actual browser/DB with explicitly synthetic sync-display fixtures; not external synchronization evidence.
- Steps: Create 104 local display fixtures with separate owners and varied sync states; inspect staff and requester views.
- Expected: Staff loads 100 maximum, sums equal loaded count; requester cannot see other owner records; filtering/empty states work.
- Actual: {"staff_loaded": 100, "scope": "At most 100 authorized rows; local fixture statuses, no external runs"}.
- Evidence: `evidence/v8/final/browser-results.json`, case 9; `evidence/v8/browser-final.log`.

### B10 — Replay authorization and backend failure keep real business state

- Status: **Pass**.
- Scope: Actual local native browser + PostgreSQL/Flowable, synthetic accounts, one-person role simulation.
- Steps: Ordinary user forges replay; staff action receives injected 503.
- Expected: Backend denies ordinary user and staff sees an error without changing terminal business state.
- Actual: "Assertions satisfied".
- Evidence: `evidence/v8/final/browser-results.json`, case 10; `evidence/v8/browser-final.log`.

### B11 — Refresh failure is visible and preserves the current monitor

- Status: **Pass**.
- Scope: Actual browser with explicit local HTTP failure injection.
- Steps: Fail one user-requested page refresh while records are loaded.
- Expected: Failure feedback shown; existing cards and filters retained.
- Actual: "Assertions satisfied".
- Evidence: `evidence/v8/final/browser-results.json`, case 11; `evidence/v8/browser-final.log`.

### B12 — Stale refresh cannot overwrite a newer replay result

- Status: **Pass**.
- Scope: Actual local native browser + PostgreSQL/Flowable, synthetic accounts, one-person role simulation.
- Steps: Hold an old real GET response, replay the failed case, then release old response.
- Expected: One replay; latest card remains PENDING; stale response cannot restore FAILED.
- Actual: "Assertions satisfied".
- Evidence: `evidence/v8/final/browser-results.json`, case 12; `evidence/v8/browser-final.log`.

### B13 — Desktop/mobile, long content and keyboard focus are usable

- Status: **Pass**.
- Scope: Actual local native browser + PostgreSQL/Flowable, synthetic accounts, one-person role simulation.
- Steps: Inspect a fresh claimed draft and long monitor data at 375px and desktop; tab through controls.
- Expected: No page horizontal overflow, labels/errors associated, visible keyboard focus, scoped audit scrolling.
- Actual: "Assertions satisfied".
- Evidence: `evidence/v8/final/browser-results.json`, case 13; `evidence/v8/browser-final.log`.

### B14 — Keyboard focus is retained after a successful claim and monitor refresh

- Status: **Pass**.
- Scope: Actual local native browser + PostgreSQL/Flowable, synthetic accounts, one-person role simulation.
- Steps: Claim an assigned draft with the keyboard, then activate monitor refresh.
- Expected: Focus moves to the updated card or its first editable field; refreshed monitor retains refresh control focus.
- Actual: "Assertions satisfied".
- Evidence: `evidence/v8/final/browser-results.json`, case 14; `evidence/v8/browser-final.log`.

### B15 — Support progress remains within a narrow mobile viewport

- Status: **Pass**.
- Scope: Actual local native browser + PostgreSQL/Flowable, synthetic accounts, one-person role simulation.
- Steps: Open persisted progress records at 375px.
- Expected: Case identifiers and progress metadata wrap without document-wide horizontal scrolling.
- Actual: "Assertions satisfied".
- Evidence: `evidence/v8/final/browser-results.json`, case 15; `evidence/v8/browser-final.log`.

### B16 — Manual refresh keeps filter/search selections and shows truthful receipt provenance

- Status: **Pass**.
- Scope: Actual local native browser + PostgreSQL/Flowable, synthetic accounts, one-person role simulation.
- Steps: Filter to SYNCED, refresh actual native view, inspect recorded-receipt note.
- Expected: Selections persist; records do not claim verified live Zapier/Google execution.
- Actual: "Assertions satisfied".
- Evidence: `evidence/v8/final/browser-results.json`, case 16; `evidence/v8/browser-final.log`.

### B17 — Repeated page entry produces no unhandled JavaScript errors

- Status: **Pass**.
- Scope: Actual local native browser + PostgreSQL/Flowable, synthetic accounts, one-person role simulation.
- Steps: Enter each integrated page repeatedly in authenticated sessions.
- Expected: Zero pageerror events and no unexpected non-injected console errors.
- Actual: {"page_errors": 0, "expected_fault_injection_console_errors": 9}.
- Evidence: `evidence/v8/final/browser-results.json`, case 17; `evidence/v8/browser-final.log`.

### B18 — Financial records are unchanged by all support UI operations

- Status: **Pass**.
- Scope: Actual local native browser + PostgreSQL/Flowable, synthetic accounts, one-person role simulation.
- Steps: Compare original account and transaction rows after all cases.
- Expected: Every original account balance and transaction value is identical.
- Actual: "Assertions satisfied".
- Evidence: `evidence/v8/final/browser-results.json`, case 18; `evidence/v8/browser-final.log`.

## Additional actual checks

| Check | Status | Actual evidence / limit |
|---|---|---|
| Pure V8 renderer/state/accessibility-contract unit tests | Pass, 14 tests | evidence/v8/unit-final.log |
| Actual malformed classifier output -> manual triage -> service review | Pass | branches/results.json; manual-triage.png; controlled failure injection in real child process, not successful AI output |
| Actual PT2S review timer -> supervisor -> completed native projection | Pass | branches/results.json; timeout-escalated.png; completed-after-escalation.png; normal defaults restored |
| Native V7-related support/classifier/role/persistence regression | Pass, 8 checks | v7-ui-regression.log; regression/lcnc-e2e.json |
| Retained workflow HTTP regression | Pass, 9 tests | v7-http-regression.log; regression/workflow-http-events.json |
| V7 relay integration regression | Pass, 17 checks | v7-integration-regression.log; regression/v7-results.json; uses explicit Google-service emulator |
| Fresh Flowable build/engine tests | Pass, 6 tests | workflow-engine-tests.xml |
| Retained Zap definition structural validation | Pass locally | zapier-configuration-validation.log; not a Zap run |
| Actual Google Form -> Zapier -> native draft | Not tested / Blocked | Existing V7 owner-side external setup was not completed |
| Actual terminal outcome -> Zapier -> Google Sheet -> receipt | Not tested / Blocked | No real external execution ID or cloud screenshot exists |
| Actual Zap cloud failure/recovery | Not tested | Local errors/emulator recovery are not cloud proof |
| Real multiple people performing handoffs | Not tested | All local role switching is one-person simulation |
| Original V8 length-unit wording | Not independently verified | Owner supplied reflection topic; English reflection deliberately 100–200 words |
| GitHub PR/API access | Blocked at initial probe | Actual request to api.github.com returned Forbidden; Git transport worked; final disposition is in delivery provenance |

## Scope, data and failure interpretation

Known/unknown UI state fixtures test rendering only and do not claim Flowable executed those paths. Actual return/resubmit/reject, manual triage and timeout escalation are separately tested through the real engine. Display-only outbox events are deferred from transport. Account and transaction snapshots remain identical after the V8 support UI suite.

Saltcorn 1.6.2 rejects invalid CSRF with a redirect before the action. Browser fetch follows that redirect to HTML 200; the successful security assertion verifies redirect and no support mutation, not a fabricated 403. Role/ownership denial is separately verified as 403.

The final browser suite records zero unhandled JavaScript page errors. Browser console messages caused by intentional HTTP 403/409/500/503 tests are expected and counted separately. There are no unexpected console errors after fixing the real missing favicon route.

## Prompt iteration evidence

| Run | Actual results | Interpretation |
|---|---|---|
| round-1 | 1 Pass, 15 Fail | Native page-cache/setup/restart was incomplete; retained as failed integration attempt |
| round-1-integrated | 13 Pass, 3 Fail | Incorrect CSRF test assumption, repeated-fixture strict locator, favicon 404 |
| round-1-boundaries | 15 Pass, 3 Fail | Actual focus defect plus existing CSRF assertion and favicon issues |
| round-2 | 17 Pass, 1 Fail | Refresh focus was still captured after disabling the focused button |
| round-3 | 18 Pass, 0 Fail | Corrected focus timing; prompt evidence retained |
| final | 18 Pass, 0 Fail | Final integrated UI plus explicit display-fixture isolation |

Unit initial: 13 Pass; after missing-history refinement: 14 Pass. Earlier failures were not deleted or relabelled. Each saved prompt predates its corresponding generated snapshot. No timing result is claimed as a performance improvement.

## Evidence index

- `final/inbox-card-desktop.png`, `final/inbox-form-mobile.png`: actual native form with a newly generated synthetic draft.
- `final/02-input-retained-after-error.png`: actual browser after explicit HTTP 500 injection.
- `final/03-persisted-rejected-progress.png`, `final/04-unknown-progress-fallback.png`: actual native progress; unknown state is an explicitly labelled display fixture.
- `final/05-sync-monitor-desktop.png`, `final/06-replay-refresh-race.png`, `final/08-sync-mobile-long-content.png`: actual local monitor and controlled race/failure scenarios.
- `branches/manual-triage.png`, `branches/timeout-escalated.png`, `branches/completed-after-escalation.png`: actual engine branches in native UI.
- `preservation.json`: unchanged BPMN and scope of runtime-only adjustments.
- `baseline-provenance.json`, `baseline-comparison.json`: current upload hash, baseline commit and 315 matching files.
- `reflection-length.json`: actual English-word count; original unit unverified.
- `final/capture-metadata.json`: screenshot provenance; capturing screenshots adds no test count.

All paths above are under evidence/v8. ZIP/source-commit checks and any fresh extraction/startup verification are recorded in delivery manifests. Final remote merge status must be verified from GitHub; a pushed feature branch or a prefilled compare URL is not a created or merged PR.
