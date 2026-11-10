# V8 Prompt Log

## Recording method

All prompts below were saved before their corresponding code generation/revision in this session. Their exact text, recorded timestamps and hashes are in `implementation/v8/prompts/session-log.json`. The generator was the coding assistant in this conversation. There was no separate model endpoint, runtime generative feature, hidden-reasoning export or independently invented prompt transcript.

## Source and contract supplied before generation

The uploaded V7 and current repository baseline matched 315 files. Support Inbox and synchronization are in implementation/v7/plugin.cjs; the actual support page is the Saltcorn plugin index.js, while banking-view.js remains financial UI. The prompts name native commands/fields, CSRF, role/ownership checks, 3–2000 trimmed UTF-16 units, versions, frozen retries, loaded-row caps, receipt-origin limits and missing history.

## Actual prompt / output / integration chain

| Use case | Initial prompt and original output | Actual finding | Follow-up and revision | Final verification |
|---|---|---|---|---|
| Draft form | UC1-initial.md; generated/round-1 inbox/common/controller/styles and plugin mapping | Actual keyboard claim lost focus; installed CSRF guard redirects rejected forms instead of returning 403 | UC1-followup.md; context-aware focus and explicit redirect handling | Final browser validation, failure retention, duplicate-click, native security and focus checks Pass |
| Recorded progress | UC2-initial.md; generated/round-1 progress.cjs and native index integration | Review and actual missing-time fixture showed an unconditional creation item even without a sourced creation timestamp | UC2-followup.md; current-stage-only fallback when creation is unavailable, incomplete-history metadata | All known/unknown/missing-time unit and browser checks Pass; actual engine branch evidence separate |
| Synchronization | UC3-initial.md; generated/round-1 monitor/controller/styles | Refresh button lacked focus ID; first browser console showed genuine favicon 404; refresh needed a bounded timeout | UC3-followup.md; stable button ID, real static SVG route and timeout. Round 2 still lost focus because disabled button was sampled too late; UC3-focus-followup.md records that finding before round 3 | Final race, refresh, scope, empty state, mobile, repeat-binding and keyboard checks Pass |

## Iteration results, without rewriting failures

- Initial unit suite: 13 Pass.
- Initial browser attempt: 1 Pass / 15 Fail during incomplete native metadata startup/restart. These are setup/integration failures, not successful UI evidence.
- First integrated browser run: 13 Pass / 3 Fail. An invalid-CSRF assertion expected the wrong HTTP status; a repeated-fixture locator was nondeterministic; native favicon returned 404.
- Initial boundary run: 15 Pass / 3 Fail. It exposed the actual keyboard-focus problem while the wrong CSRF assertion and favicon issue remained.
- Round 2: 17 Pass / 1 Fail. The combined keyboard check still failed.
- Round 3: 18 Pass / 0 Fail.
- Final suite on the final UI: 18 Pass / 0 Fail; pure unit suite: 14 Pass.

Initial and later actual JSON reports are retained under evidence/v8. No defect was deliberately introduced to create a prompt iteration. Tests were corrected when they misrepresented installed Saltcorn behavior; the server protection was not weakened to make a test pass.

## Controlled integration adjustments

The same coding assistant made integration adjustments; no separate human author or user code edit is claimed. Saltcorn copies plugin entry modules, so generated relative imports could not resolve the application root from that copied location. The entry modules use the generated V6_ROOT runtime value. Native page/view metadata required a restart after migration. Runtime paths, private generated scripts, isolated ports and writable npm caching were adjusted for reproducibility, without changing financial behavior or BPMN. These are recorded as integration work, not fictitious UI prompt discoveries.

The first V7 regression attempt also encountered a missing local test dependency after a read-only npm-cache error, and display fixtures filled the FIFO publication window. A writable task cache and deferred display-only outbox fixtures corrected those test prerequisites. They do not establish any external-platform failure/recovery result.

Original generated output is immutable in generated/round-1. Round-2 snapshots and manifests link the follow-ups to revised files. Round-3 retains the changed controller and its hash, with other output inherited from round 2. Final cleanup removes superseded unused helpers from the old plugin and retains the original backend handler. V8_File_Changes.json lists the actual repository change set.

## Exact prompt texts

### UC1-initial.md

Recorded before generation: `2026-11-10T16:04:40.317343+00:00`. SHA-256: `717d73b83d2f52ceb804b9199d123a794aba16512a3bf1582103e08519cf2119`.

```text
Generate dependency-free HTML/CSS/JavaScript for the actual Saltcorn CommonJS view templates in this repository. This prompt is recorded before generation by the coding assistant in the current session; there is no separate model API call. Use English labels and comments. Namespace all styles and delegated events under .hikyu-v8. Escape every untrusted server value; use textContent for client messages. Preserve native CSRF hidden fields, server-side roles, ownership checks, stable IDs, versions, idempotency, Flowable routing and financial logic. No polling, new framework, UI library, fake history, external model call or claimed live Zapier execution. Keep original view names, POST contracts and data attributes used by V7 tests. Record generated output paths and retain a round-1 snapshot before review/iteration. Acceptance requires actual local browser tests with synthetic data, not historical results.

Use case 1 — Enhance the existing Support Inbox in implementation/v7/plugin.cjs, not a replacement application. Its native view is V7_inbox, tableless Hikyu V7 Integrations. Existing commands are assign(id, assigned_user_id, expected_version), claim(id, expected_version), submit_draft(id, expected_version, transaction_id, description). runPost returns {ok:true,result:{id,draft_status,draft_version,case_id,support_request_id,job_status}} or {ok:false,error:{code,message}} with status. Staff: builder/service_agent/supervisor; requesters see assigned/claimed drafts only. Keep these checks and calls to inbox.cjs unchanged. Draft data includes source_type, source_namespace, source_event_id, subject, submitted_at, description, draft_status, draft_version, case_business_id and frozen confirmed details. Query transactions only where owner_id=authenticated user.

Generate clearer source metadata and descriptions, responsive transaction/description fields with unique labels, a blank required transaction choice, server-compatible trimmed JavaScript string length 3–2000, visible counter and linked field errors. Existing service clean() uses trim().length; programmatic overlength must still be rejected despite maxlength. SUBMISSION_FAILED retries use frozen details. Async enhancement must capture native CSRF, prevent duplicate clicks, announce processing, keep input after non-2xx/network errors, insert readable text errors and refresh the affected card only after confirmed success. Preserve a useful no-JavaScript POST fallback. Include visible keyboard focus. Avoid replacing other users' unsaved forms when one card succeeds. Use shared static CSS/controller modules under implementation/v8/ui plus small integration changes to the existing view.
```

### UC2-initial.md

Recorded before generation: `2026-11-10T16:04:40.317343+00:00`. SHA-256: `c6136cb386c9d03ff94b643912f10acea3026aa214c0e09eeb0cdab7e07f4dce`.

```text
Generate dependency-free HTML/CSS/JavaScript for the actual Saltcorn CommonJS view templates in this repository. This prompt is recorded before generation by the coding assistant in the current session; there is no separate model API call. Use English labels and comments. Namespace all styles and delegated events under .hikyu-v8. Escape every untrusted server value; use textContent for client messages. Preserve native CSRF hidden fields, server-side roles, ownership checks, stable IDs, versions, idempotency, Flowable routing and financial logic. No polling, new framework, UI library, fake history, external model call or claimed live Zapier execution. Keep original view names, POST contracts and data attributes used by V7 tests. Record generated output paths and retain a round-1 snapshot before review/iteration. Acceptance requires actual local browser tests with synthetic data, not historical results.

Use case 2 — Render honest support progress inside the actual support-review template in implementation/saltcorn/hikyu-plugin/index.js. banking-view.js renders financial pages and is not the support view. The existing adapter integration.visibleRows(req.user) already enforces role/owner scope. Each support record has business_id, id, state, sequence, created_at, updated_at, current_role, last_comment, process_instance_id and AI fields. WorkflowServer's authenticated status response returns only current stage/version/latest comment/time. There is no exposed reliable stage-history endpoint. Do not query internal Flowable H2 history, invent event times/actors/comments, or infer that every possible branch was visited.

Generate a pure progress renderer with known creation and current stored observation only, explicitly disclose missing stage history. Cover SUBMITTED, MANUAL_TRIAGE, SERVICE_REVIEW, RETURNED, REVIEWER_REVIEW, ESCALATED, COMPLETED and REJECTED. Explain applicable branch possibilities without drawing a compulsory straight-line path. Completed/rejected states may be final, but earlier step completions must not be assumed. Unknown states must be neutral, labelled and never considered completed. Use text plus style; real timestamps only, missing/invalid dates show Not available. Latest role/comment must be labelled latest rather than attributed to imagined stages. Refresh reads persisted native records. Preserve original support submit/decision forms and security unchanged. Use the shared scoped style system and no extra dependency.
```

### UC3-initial.md

Recorded before generation: `2026-11-10T16:04:40.317343+00:00`. SHA-256: `0961879662d9c1418085de02ab072ccdeba1145b8cdf38019356f837117e60c4`.

```text
Generate dependency-free HTML/CSS/JavaScript for the actual Saltcorn CommonJS view templates in this repository. This prompt is recorded before generation by the coding assistant in the current session; there is no separate model API call. Use English labels and comments. Namespace all styles and delegated events under .hikyu-v8. Escape every untrusted server value; use textContent for client messages. Preserve native CSRF hidden fields, server-side roles, ownership checks, stable IDs, versions, idempotency, Flowable routing and financial logic. No polling, new framework, UI library, fake history, external model call or claimed live Zapier execution. Keep original view names, POST contracts and data attributes used by V7 tests. Record generated output paths and retain a round-1 snapshot before review/iteration. Acceptance requires actual local browser tests with synthetic data, not historical results.

Use case 3 — Enhance existing Outcome Synchronization in implementation/v7/plugin.cjs. O.visible(req.user) returns at most 100 authorized rows, with staff all rows and requesters own records only. Columns include case_id, business_state, state_version, sync_status, last_attempt_at, synced_at, external_record_id, error_code, outbox_id and job_status. Business state and sync status are independent. Staff replay uses command=replay,id=outbox_id; server O.replay verifies roles and rejects finalized/superseded jobs. Keep this handler and stable .v7-sync/.sync-state selectors.

Generate loaded-record summary counts, sync-status and case search filters, explicit up-to-100 authorized-record scope, no-results feedback, readable safe error summaries, real dates/external IDs, manual refresh with loading/success/error feedback and no polling. Preserve staff-only replay; disable duplicate clicks while pending and handle backend 403/409/network failure rather than assuming hidden buttons are authorization. Refresh/replay responses must not overwrite newer UI state. Long case IDs/errors and audit tables must fit a 375px viewport with readable overflow. Original staff global queue totals may remain only with an explicit separate scope label. Client filtering counts only loaded rows and never represents global database totals.

Important provenance limit: V7 receipts do not store verified external execution origin. Even persisted SYNCED does not independently prove a real Zapier/Google run. Keep raw SYNCED text for compatibility but label it as a recorded receipt with environment not independently verified; prominently flag currently configured local emulator and never promote old emulator receipts to live-success claims when relay configuration changes. Reuse the existing database/worker/outbox mechanisms without changing financial data or adding a migration.
```

### UC1-followup.md

Recorded before generation: `2026-11-10T16:22:16.879330+00:00`. SHA-256: `0ff11ac4883f12fd4d7e0ef68ce9b001bdfee2b883c5e8f1f517c902881b53ef`.

```text
Observed evidence: evidence/v8/round-1-boundaries/browser-results.json contains a failed keyboard-focus test: after Claim succeeds and the affected card is replaced, focus is outside that card. Initial controller.js replaces the card without moving focus. Other actual initial checks passed normal submit, 3/2000 trimmed boundaries, injected HTTP failure/input retention and duplicate POST prevention. Also inspected the installed Saltcorn 1.6.2 CSRF middleware: invalid CSRF requests redirect to /, so fetch follows to an HTML 200; this is protection, not an authorized action.

Revise the previously generated controller. After a confirmed card replacement, move keyboard focus to the first meaningful editable field, or a labelled card heading if there is no form; retain visible focus styling. Do not steal focus if a different form/input was intentionally focused while the request was pending. Recognize redirected non-JSON form responses as unconfirmed/rejected actions, keep input and show a clear English session/form-token message. Keep server CSRF and role/ownership/version enforcement unchanged. Add actual browser assertions for retained focus and verify invalid-CSRF redirect causes no mutation; do not incorrectly require a 403 from Saltcorn's redirect handler. Save revised output separately and retest.
```

### UC2-followup.md

Recorded before generation: `2026-11-10T16:22:16.879330+00:00`. SHA-256: `60e346f8d60a8f1220e885b7eeefe21d2a4c02f3e2aeafa9cdb0b94f5da37f26`.

```text
Observed review of the saved round-1 progress renderer and actual missing-history fixture: render() always adds a Request created timeline item even when created_at is null or invalid. The browser correctly shows no invented time, but the visual item can imply an observed earlier stage despite missing evidence. The request explicitly prefers current-stage-only rendering when history is unavailable.

Refine progress.cjs so an unavailable/invalid creation timestamp produces only the latest stored stage observation, with an explicit missing-creation/history notice. If creation time is actually present, it may be shown as a recorded fact; do not infer reviewer/return/manual/timer visits. Keep every original known/unknown state mapping and strict unknown-is-not-final behavior. Add an explicit data attribute marking that complete history is unavailable. Update tests to expect one observed item for missing creation and two only for reliable creation; include valid creation with absent latest-update time. Preserve native role filtering and all original support forms. No new endpoint, database history or migration.
```

### UC3-followup.md

Recorded before generation: `2026-11-10T16:22:16.879330+00:00`. SHA-256: `7313f0046a58f7c5b312e6e55a028ee1b60eb31c39c0b54d28528a9b17ada1a8`.

```text
Observed browser/code review: manual monitor refresh preserves filters and correctly prevents a stale GET from overwriting a newer replay, but refresh restores focus only by element ID and its own refresh button has no ID. Add a stable scoped ID and test keyboard refresh focus. Current filters/counters are explicitly limited to 100 loaded authorized rows; retain that scope and all staff-only replay checks.

The actual initial browser console also reports GET /favicon.ico 404. Resolve the missing static application icon through a minimal read-only plugin route serving a real local SVG asset, not by suppressing console errors or editing dependencies. Keep UI styles scoped and no financial page changes. Bound user-requested refresh with a timeout and explicit retry feedback; there must still be no polling. Add screenshot evidence and repeat navigation/mount checks. Existing SYNCED must remain a recorded receipt of unverified execution origin. Save revisions and retest real local pages; no real Zapier claim.
```

### UC3-focus-followup.md

Recorded before generation: `2026-11-10T16:25:10.627886+00:00`. SHA-256: `6c16dffff927bf2bf0c5423d22c0d23d00a5e1e4ad820e147a09049ff271d472`.

```text
Actual round-2 browser result: 17 checks passed and the combined keyboard-focus check still failed. Code review of refresh() explains a remaining defect: it disables the focused refresh button before it captures document.activeElement at completion, so the newly added button ID alone cannot restore focus. The initial source captures focus too late.

Revise the existing controller to remember the active element ID before disabling refresh. At completion, prefer any newer intentionally focused field inside the view; use the original ID only when focus fell back to document.body. Do not steal focus from outside the view. Keep cancellation/generation checks, input/filter preservation, no polling, timeouts and all authorization unchanged. Label claim versus monitor focus assertions separately so a failure points to the correct operation. Preserve this prompt before revision and rerun the actual native browser suite.
```
