# Bill Pay modal refinement — delivery and verification

This update builds on the previously delivered V5 UI refactor. Bill Pay remains a tab inside Pay & Transfer. The change is limited to the Bill Pay frontend, biller management, its tests and documentation.

## Resulting workflow

Bill Pay → Add biller (beside Saved billers) → native modal → Save biller → close modal → refresh list → select returned biller UUID → enter amount → Review → existing PIN/code confirmation → receipt.

The modal contains Biller selection, Nickname (optional), Demo bill reference, Cancel and Save biller. The existing backend requires a nonblank alias; when the optional nickname is blank, the client sends the biller's catalog name. The REST contract is unchanged.

Saved billers are listed on Bill Pay with Select, Edit and Delete actions. Editing uses the same modal and PATCH endpoint; deletion uses the existing DELETE endpoint. There is no standalone Add Biller view, Back to Bill Pay control or separate Manage billers page.

Empty lists show one explanation and one Add biller action next to the section heading. The disabled payee dropdown says “Select a biller”, avoiding a second “No saved billers” message. Review is disabled until an eligible source, saved biller and valid positive amount with at most two decimal places are present, and all remaining form constraints are valid. Review stays disabled while biller requests are pending.

The original From account, Bill payee, Amount, Note and Review fields remain. Opening or canceling the modal preserves the payment draft. Adding a biller updates the select options without rebuilding those fields. Successful saves announce “Biller saved and selected.” through a polite live region.

## Failure behavior

- Invalid biller selection, blank/whitespace-only reference and overlong fields produce English guidance and focus the invalid field without sending a POST.
- Save failures keep the modal open with the entered values and retry enabled.
- A successful POST/PATCH followed by a failed GET retains the authoritative response and UUID, selects the saved biller and announces the refresh failure. It does not repeat the create request.
- Duplicate save submissions are blocked. Cancel, close and Escape are disabled only while the save is pending; the dialog returns to normal after a failure.
- Delete failures retain the list. Successful deletion preserves transaction history and returns to the single empty state when appropriate.
- Navigating away closes the owned modal and prevents late asynchronous responses from altering the next page.
- The existing payment failure/retry mechanism retains the same idempotency key.

## Accessibility and layout

Uses the existing native `dialog` helper and `showModal()` for modal semantics and browser-managed keyboard focus containment. The dialog has an accessible title, description and explicit `aria-modal`. Initial focus goes to biller selection (nickname for edit). Cancel/close restore focus to the invoking control; successful save focuses the stable Add biller control. The native cancel event implements Escape dismissal when no save is pending. Focus outlines, responsive width, scrollable height, form spacing and wrapping action rows are scoped to this component.

Actual Tab/Shift+Tab behavior, physical Escape keystrokes and rendered browser layout have not been verified in a real browser in this environment. DOM tests model the native cancel event and verify initial/return focus; they do not substitute for native browser keyboard and visual checks. The optional browser regression now contains modal keyboard checks for later execution.

## Files changed in this update

| File | Change |
| --- | --- |
| `frontend/js/components/billers.js` | Added reusable Bill Pay biller list/modal backed by existing payee API |
| `frontend/js/views/banking-view.js` | Mounted inline biller controls; removed standalone biller entry points; live Review validation; cleanup on unmount |
| `frontend/css/extensions.css` | Scoped list/dialog spacing, button alignment, select treatment, focus and responsive layout |
| `frontend/tests/bill-pay.dom.cjs` | Added targeted modal, validation, API failure and complete payment workflow regressions |
| `frontend/tests/navigation.dom.cjs` | Adapted existing integration fixtures to modal-based biller creation/deletion |
| `frontend/tests/navigation.browser.cjs` | Adapted optional browser flow; added keyboard checks; not executed successfully here |
| `frontend/package.json` | Added optional `test:bill-pay` command |
| `docs/UI-REFACTOR.md` | Points to this current Bill Pay implementation record |
| `docs/BILL-PAY-REFINEMENT.md` | This delivery report |

## Actual verification results

| Executed check | Actual result |
| --- | --- |
| Existing frontend unit tests: `npm test --prefix frontend` | PASS — 18 tests |
| Targeted DOM/HTTP-fixture integration: `node frontend/tests/bill-pay.dom.cjs` with jsdom available | PASS — 12 scenario groups |
| Broader DOM/HTTP-fixture integration: `node frontend/tests/navigation.dom.cjs` with jsdom available | PASS — 12 regression groups |
| JavaScript syntax checks | PASS — all frontend JS/CJS files |
| Byte comparison with the previous delivered ZIP | PASS — no backend, API adapter, database, configuration or startup changes; no original files deleted |
| Browser rendering / actual native keyboard navigation | NOT RUN — no usable browser binary available in this environment; the earlier download attempt was blocked by invalid network responses |
| Live Spring Boot + PostgreSQL / Supabase payment persistence and balances | NOT RUN — no configured backend/database test service |

The 12 targeted groups covered: single empty state; Cancel and draft retention; cancel-event/close focus handling; invalid inputs; save API failure; save/refresh/selection/notification; Review constraints; complete payment with failure retry and receipt; edit UUID preservation; post-save GET failure; delete failure/empty state; duplicate submission and unmount during pending save. Reference and nickname length checks were also executed.

HTTP fixtures exercise the actual frontend API adapters and inspect payloads, including decimal amount strings, server-returned payee IDs/references, PIN/code and idempotency key. The receipt is a fixture response, not evidence of a real persisted financial transaction. No test in this update connected to, synchronized or modified any local or cloud database.

To reproduce DOM checks, make jsdom resolvable (the verification used jsdom 30.1.2 with a compatible Node runtime), then run `npm run test:bill-pay --prefix frontend` and `npm run test:dom --prefix frontend`. The application itself has no new runtime dependency. See the earlier UI report for optional browser-test setup.

No database migration is required. Spring Boot, PostgreSQL, local Docker/Supabase modes, API contracts, payment authorization and processing, UUID relationships and completed transaction history are unchanged in source. Live integration and browser visual verification remain outstanding.
