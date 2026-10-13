# V5 Four-Layer Structure

1. UI: existing HTML/CSS/ES modules, plus Pay & Transfer, Settings and Registration. Views handle form entry, confirmation and API results; they do not apply authoritative financial rules.
2. Application: TransferService, PaymentService, PaymentAuthorizationService, SettingsService, SecurityService and TransactionQueryService validate ownership, amount/PIN rules, preference logic and workflows. Database transactions bound transfer operations.
3. Data access: PostgreSQL repositories own parameterized SQL and row mapping; ExtensionRepository stores transfer/security state, TransactionQueryRepository handles filtered reads; PaymentRepository and PaymentVerificationRepository own peer-payment/code SQL. Existing repositories retain their V4 interfaces.
4. Database: existing UUID schema plus additive V5–V7 migrations. Foreign keys, unique request keys, nonnegative balances and transfer-leg metadata complement service validation.

AuthState carries the credential generation read at login. Every protected API request compares it to users.auth_version; password/PIN changes and logout-all increment that value. OpenAI is behind AssistantGateway and is conditionally selected; default local rules require no network credentials. No AI tools can write SQL or move money.

Payment authorization validates a code in a short transaction so failed-code attempts persist. A separate financial transaction rechecks/locks that challenge, invokes the transfer/payment service, and marks the code consumed only after success. Replays are limited to the same payload and immutable receipt. No PIN or plaintext code is persisted.
