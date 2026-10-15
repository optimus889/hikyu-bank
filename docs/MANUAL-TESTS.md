# Manual Workflow Checklist

1. Start with compose.test.yaml and the isolated backend command in README. Open /login.html.
2. Register with a unique username, strong password and chosen four-digit PIN (try a leading zero). Confirm mismatched confirmation fields are rejected. Login with an SMS or email code AND the permanent card PIN. Test both methods with a missing/wrong PIN: neither may sign in.
3. Open Pay & Transfer. Choose Checking → Everyday Saving, enter 25.50 and a note, review, request/enter an SMS or email payment code and confirm without a PIN. Check updated account balances, linked transaction details and receipt. Refresh: history remains.
4. Try zero/negative/three-decimal amounts, same account, wrong payment code and insufficient funds; peer payments must also reject a wrong PIN. Confirm no extra receipts or changed balances. Do not copy another user's credentials.
5. Create an enabled low-balance rule whose threshold exceeds the expected post-transfer balance. Complete a transfer and check Alert inbox. Disable the rule or preference, transfer again: no new automatic notification for that rule. Manual Test alert remains available.
6. Transactions: exercise date/amount/type/account/category/search filters, sort and page navigation. Click transaction names for details. Check empty/error messages. Internal transfers are explicitly labeled.
7. Settings: change an account nickname and preferences. Refresh or restart: values remain.
8. Open two browser sessions for the same user. Change password in one: the other is rejected on its next API request. Repeat for PIN change and logout-all. PIN is changed only by explicit user action, not by OTP generation or restart.
9. Login as another user: account/transaction/transfer/alert data remain separate.
10. Assistant Demo: ask about spending before/after an internal transfer; spending totals should not increase. Default settings make no provider requests.
11. Optional configuration-only test: OpenAI mode with empty key/model must start and return AI service is not configured. Restore Demo afterwards. Do not add real keys to the shared ZIP.

Use screenshots plus API/database results as evidence; do not capture plaintext passwords/PINs. Automated concurrency/rollback and provider mock tests are included under backend/src/test. Existing V4 reference documents are not claims of V5 validation.


## Pay & Transfer revision acceptance

Use an isolated demo database. Record source/target balances before each case.

1. Internal transfer: choose Checking → Everyday Saving, review, request SMS code, and confirm **without a PIN**. Repeat using email. Check matching debit/credit, receipt and refreshed balances.
2. Peer payment: look up another demo username, verify the displayed name/masked account, review and request SMS or email code. Missing/wrong PIN or code must fail without moving funds. Correct PIN + code must succeed.
3. Retry/double-click the identical confirmed request: one receipt, one debit/credit pair and one inbox receipt per party. A changed amount with the old code must fail.
4. Try self-payment, unknown recipient, another user's source, inactive account, insufficient balance, zero/negative amount or more than two decimals. Confirm no new successful financial entries or notifications.
5. Enter five wrong codes, request another code, then wait over five minutes: locked and expired codes must fail. Codes from login, another session/user or a changed payment must fail.
6. Sign in as the recipient: view incoming receipt and positive `peer_transfer` leg. The sender sees a negative leg. A third user sees neither. Search by type, amount/date and page; own-account transfer legs remain outside income/spending.
7. Refresh, sign out/back in and restart the backend: stored balances, receipts and notifications must agree. Obtain a new payment code after re-login; replay the same completed request key and verify no new debit.
8. At 390px, 768px and desktop widths, check the mobile menu/top Pay & Transfer link, tabs, input labels, PIN/code fields, long notes/UUIDs, confirm/edit buttons and card gutters. All content must remain within its card and be keyboard reachable.

Automated results and unexecuted browser/Windows/external-service checks are listed separately in TEST-RESULTS.md.

## UI correction acceptance

- Transactions: only the name is a clickable, borderless text control; icons/date/category/amount remain noninteractive. Confirm mouse click and keyboard activation open details.
- Set browser language to Chinese, submit an invalid recipient username, empty required fields or an invalid amount/PIN/code: messages remain English and raw regular expressions are not shown.
- Settings: verify navy headings, blue primary/outlined secondary buttons, blue checkboxes, matching field borders and keyboard focus rings.
- Demo login: check Card PIN label and current selected-profile default; no Email Verification Only text. SMS and email both show PIN input and both reject missing/wrong PIN. Changed PIN defaults remain hidden.


## Batch 2 acceptance

Use the separate test database and a built-in demo profile for credit tests.

1. Banking → Simulate purchase: choose Checking, merchant/category/amount/note; review; obtain SMS/email code; require current card PIN + code. Check debit balance, expense leg, receipt and refreshed history. Repeat with credit: debt increases and available limit is enforced.
2. Cards: lock/unlock a card, refresh/re-login/restart and verify state. Locked cards must reject new purchases. Credit repayments and internal/peer transfers remain allowed. A completed replay must not charge again.
3. Credit repayment: use Checking/Saving → own active credit. Check both balances, minimum due, two linked credit_payment legs and no added spending/income/budget usage. Reject overpayment, foreign target, inactive accounts and insufficient funds.
4. Saved recipients: add/edit/delete known peer usernames and demo billers/references. Select a saved peer in Pay & Transfer and still verify the recipient. Other users cannot view/edit/delete it.
5. Bill Pay: choose an owned saved biller/reference, review, PIN + code, pay once. Confirm expense/history/notifications. Delete the payee: financial history remains. Change reference after requesting a code: stale confirmation must fail.
6. Budgets: create/update/delete month/category limits; purchase and bill spending changes progress/remaining. Internal transfers/repayments do not. Test exact limit, exceeded limit, adjacent-month boundaries and empty month.
7. Transactions → Export CSV: select account/date range; compare rows/amounts to filtered transactions. Export empty results, inclusive boundary dates, quoted notes and formula-leading text. Foreign accounts must fail; large exports must ask for narrower dates.
8. Repeat/double-click/retry confirmed requests: one immutable receipt, no duplicate debit or notifications. Run the included concurrency and forced-rollback tests only on hikyu_bank_test.
9. At mobile/tablet/desktop widths check all Banking tabs, card gutters, verification controls, long notes/UUIDs, budget bars, CSV controls and keyboard focus. Browser validation/error text must remain English.

Actual executed checks and unexecuted browser/Windows/external-provider checks are distinguished in TEST-RESULTS.md.
