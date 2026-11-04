# V7 Actual Changes and Requirement Coverage

## Implementation changes

| Location | Actual change |
|---|---|
| `implementation/v7/setup-v7.cjs` | Native schema/index migration, two pages/views, ownership protection and fresh disabled private configuration |
| `implementation/v7/plugin.cjs` | Native draft assignment/claim/own-transaction confirmation and synchronization monitor/replay UI; HTML escaping/native CSRF |
| `implementation/v7/integration/contracts.cjs` | Input allowlists, strict timestamps, minimal outcome schema and signed authentication envelope |
| `implementation/v7/integration/inbox.cjs` | Durable deduplicated drafts, role/ownership/version checks, frozen confirmation and interrupted-submit recovery |
| `implementation/v7/integration/outcomes.cjs` | Committed-terminal capture, durable outbox, bounded publication retry, validated receipts and authorized generation replay |
| `implementation/v7/integration/relay-client.cjs`, `worker.cjs` | Outbound signed transport, durable pull/ack, persistent retry/pause monitoring; external disabled by default |
| `implementation/v7/relay/Code.gs`, `appsscript.json` | Deployable Google Form/source setup and authenticated locked relay, minimal sheet upsert, nonce/receipt persistence and controlled fault injection; **not deployed here** |
| `implementation/v7/zapier/` | Private authenticated app source, mapped validating intake action, terminal polling trigger, external upsert action; official SDK 19.3.0; **not uploaded here** |
| `implementation/v7/tests/` | Actual local browser/DB/Flowable tests and explicitly emulated Google relay services; pinned browser-test dependency |
| `implementation/prepare_v7.py` | Independent installation wrapper and new V7 migration |
| `implementation/start-services.py` | New worker supervision and zombie-process handling, relocated loopback ports |
| `implementation/saltcorn/hikyu-plugin/index.js` | Registers additional V7 native view template; original templates retained |
| Existing runtime/bootstrap files | V7-only path/port relocation, independent database/project labels, new synthetic account identities; corrected Saltcorn peer-install recipe |
| `deliverables/Saltcorn_V7_Integration_Schema.json` | Actual safe structure/page configuration export; not a credential/database backup |
| `docs/`, `evidence/`, `README.md`, `.gitignore` | English documentation, fresh evidence, safe delivery instructions |

Exact added/modified file paths and hashes are in `deliverables/V7_File_Changes.json`. This is compared against the newly uploaded source, not a repository from a previous conversation. Generated dependencies/private stores and old evidence are excluded from this source change inventory.

## Database changes

Five new native tables: support_inbox, v7_case_sync, v7_outbox, v7_receipts, v7_audit. Unique indexes cover source tuple, draft business key, case-sync key, outcome event/delivery and case/version, and receipt ID. Native ownership/write metadata is set by migration. Existing banking schema and original Flowable BPMN are retained. Fresh account and transaction snapshots did not change during V7 support integration tests. Demo seed creation occurs only during independent setup. Native row IDs are local and are not equated with source V5 IDs or external case IDs.

## Zap configuration status

Two named two-step designs and private integration source are delivered. No cloud Zap, Google connection, resource URL or actual platform export has been created here. The only platform capability confirmations are owner-reported Free, Code permission and private-integration availability. See the setup guide for mapping and reproducible owner-side creation, and the test report for missing live evidence.

## Requirement coverage

| Assignment requirement | Implementation location | Verification evidence | Status |
|---|---|---|---|
| Inspect supplied V6 and preserve independent baseline | baseline archive, relocated setup, original BPMN | source-provenance.json; fresh regressions | Complete locally |
| Choose Zapier and verify actual plan limits | Assignment Report Step 1 | owner confirmations; official retrieval 403 log | Partial / official and activation verification Blocked |
| Define two necessary data exchanges | Assignment Report Step 2 | contract/source files | Complete design |
| Import only safe unverified drafts | inbox module, native Support Inbox | V7 T03/T05–T09 | Pass locally; live intake Blocked |
| Stable-source deduplication and validation | contracts, database indexes, relay/action | V7 T03–T06 | Pass locally |
| Authentication and foreign-transaction protection | native plugin and original submit | V7 T01/T07/T08; regression | Pass locally / role simulation |
| Preserve Flowable and actual runtime classifier | existing original engine/adapter | V7 T09/T11; engine/HTTP regressions | Pass locally |
| Synchronize only committed terminal state | captureTerminals, outcome trigger/action | V7 T10/T12 | Pass locally; real Zap Blocked |
| Minimal external case projection and upsert | relay ExternalCases handler | V7 T12/T14/T15 | Pass in emulator; real Google Blocked |
| Separate sync and business state | case-sync table and native UI | V7 T13/T14 screenshots | Pass locally |
| Retry, duplicate and stale-event control | outbox, relay versions, receipt guards | V7 T05/T14–T16 | Pass locally |
| Error monitoring and practical replay | staff monitor, audit, generation replay | V7 T02/T13/T14/T16 | Pass locally; live failed Zap/recovery Blocked |
| Secure credentials and outbound-only local app | scoped HMAC, private config, masked connection | T01; source/config inspection; package secret check | Implemented locally; live auth pending |
| Existing support/permission/write-back regression | retained V6 test suites | 8 native + 9 HTTP + 6 engine tests | Pass locally |
| AI-driven tool role accurately recorded | Assignment Report Step 3 | actual classifier and disclosed coding assistance | Complete; no Zapier AI claimed |
| English reflection >=100 words | V7_Reflection.md | generated word count | Complete |
| Full real triggered chain and failure recovery | owner-side Zaps/Google resources | L01–L07 acceptance rows | Blocked / not tested |
| Real multi-person handoff | future participants | L08 | Not tested; current role simulation only |
| Runnable V7 source, docs, changes and configuration | delivered source/ZIP and docs | archive validation and inventory | Delivered locally; owner cloud setup still required |

## Final submission checklist

- [x] Zapier rationale and actual known limitations recorded; unverified entitlements labelled.
- [x] Both use cases explain fields, endpoints and necessity.
- [ ] Both automations connected and running on actual owner resources.
- [x] Local error/monitor/log evidence and safe replay provided.
- [ ] Real Zapier-triggered full chain and failed/recovered runs verified.
- [x] Reflection exceeds 100 English words and addresses both questions.
- [x] Requirements have evidence/status; incomplete work is not marked Pass.
