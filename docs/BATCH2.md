# Batch 2 implementation and scope

The sole application source is the newly uploaded Hikyu-Bank-Project-V5(1).zip. The previous upload and live local/cloud databases are not modified. Private environment files, macOS metadata and compiled output are excluded from delivery.

Seven features are included: simulated debit/credit purchase, credit repayment, immediate Bill Pay, monthly budgets, CSV statement export, virtual card lock/unlock and saved peer/biller management. The six Banking tabs plus the existing Transactions/Pay & Transfer views expose them. Card PIN + a payment-specific SMS/email demo code authorize purchase/repayment/bill operations. Login still requires code + PIN for either delivery method. Existing internal transfers remain code-only; peer payments remain PIN + code.

Four layers remain: HTML/CSS/ES-module UI; BankingService/controller application workflows; BankingRepository parameterized JDBC; PostgreSQL constraints and V8 migration. PaymentAuthorizationService retains the existing persistent challenge rate/attempt/session binding and now issues purpose-bound challenges for financial operations. User row then account UUID-order locks serialize funds/idempotency/card controls. A financial operation and all its balance/ledger/inbox/reminder changes are one transaction. Challenge consumption commits with the successful operation; failures roll back it too.

Saved bill references are included in the authorized request. Changing/deleting a saved biller after code issuance prevents a new payment using stale details. Saved peer recipients are still verified by the original peer-payment API; no recipient balance/contact/password data is exposed. Soft deletion avoids breaking completed bill history.

Credit balances represent debt, not available cash. Purchases increase debt; repayment decreases both deposit funds and debt, reducing unpaid minimum due without going negative. Repayment ledger pairs are economically different from income/expense. Budget/assistant calculations exclude both credit_payment and internal transfer. Credit billing cycles, interest and statement generation are not implemented.

Cards are virtual controls tied to Checking or credit account IDs. The existing user-selected permanent PIN is retained; no random PIN reset or physical card network is introduced. Card locks are persistent and checked inside the purchase transaction. Repayments/transfers are intentionally available while a card is locked.

Budgets are owner/month/category records. Reports use UTC posting dates and actual expense/negative peer legs. There are no scheduled jobs, real bill payments, SMS/email deliveries or OpenAI calls in this batch. OpenAI stays Demo with blank key/model; only the aggregate filtering changed. PDF statements and scheduled payment/reminder features remain future work.

Tests run on a separately initialized PostgreSQL 17.6 instance. The reproducible Docker test configuration and Maven/Node/launcher tests are included; live Docker/Supabase data was not accessed. Figma mock frames are editable native nodes/components, not flattened screenshots.
