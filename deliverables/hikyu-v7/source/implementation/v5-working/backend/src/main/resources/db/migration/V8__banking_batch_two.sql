-- Additive second batch. Existing financial records and applied migrations are unchanged.
CREATE TABLE hikyu.saved_payees (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES hikyu.users(id),
 kind VARCHAR(8) NOT NULL CHECK(kind IN ('peer','biller')), identifier VARCHAR(80) NOT NULL,
 alias VARCHAR(60) NOT NULL, reference VARCHAR(60) NOT NULL DEFAULT '', deleted BOOLEAN NOT NULL DEFAULT FALSE,
 UNIQUE(user_id,kind,identifier), UNIQUE(id,user_id)
);
CREATE INDEX payees_owner_active ON hikyu.saved_payees(user_id,kind) WHERE NOT deleted;
CREATE TABLE hikyu.card_controls (
 account_id UUID PRIMARY KEY REFERENCES hikyu.accounts(id), locked BOOLEAN NOT NULL DEFAULT FALSE
);
INSERT INTO hikyu.card_controls(account_id) SELECT id FROM hikyu.accounts WHERE type IN ('checking','credit');
CREATE TABLE hikyu.budgets (
 id UUID PRIMARY KEY,user_id UUID NOT NULL REFERENCES hikyu.users(id),month DATE NOT NULL,
 category VARCHAR(60) NOT NULL,limit_amount NUMERIC(19,2) NOT NULL CHECK(limit_amount>0),
 CHECK(EXTRACT(DAY FROM month)=1),UNIQUE(user_id,month,category)
);
CREATE TABLE hikyu.financial_operations (
 id UUID PRIMARY KEY,user_id UUID NOT NULL REFERENCES hikyu.users(id),
 kind VARCHAR(12) NOT NULL CHECK(kind IN ('purchase','repayment','bill')),
 source_account_id UUID NOT NULL,target_account_id UUID,payee_id UUID,
 amount NUMERIC(19,2) NOT NULL CHECK(amount>0),merchant VARCHAR(100) NOT NULL,
 category VARCHAR(60) NOT NULL,note VARCHAR(250) NOT NULL DEFAULT '',
 idempotency_key UUID NOT NULL,request_hash CHAR(64) NOT NULL,created_at TIMESTAMPTZ NOT NULL,
 UNIQUE(user_id,idempotency_key),
 FOREIGN KEY(source_account_id,user_id) REFERENCES hikyu.accounts(id,user_id),
 FOREIGN KEY(target_account_id,user_id) REFERENCES hikyu.accounts(id,user_id),
 FOREIGN KEY(payee_id,user_id) REFERENCES hikyu.saved_payees(id,user_id),
 CHECK((kind='repayment')=(target_account_id IS NOT NULL)),CHECK((kind='bill')=(payee_id IS NOT NULL)),
 CHECK(target_account_id IS NULL OR source_account_id<>target_account_id)
);
CREATE INDEX financial_owner_date ON hikyu.financial_operations(user_id,created_at DESC,id);
ALTER TABLE hikyu.transactions DROP CONSTRAINT transaction_kind;
ALTER TABLE hikyu.transactions ADD CONSTRAINT transaction_kind CHECK(kind IN('income','expense','transfer','peer_transfer','credit_payment'));
ALTER TABLE hikyu.transactions ADD COLUMN operation_id UUID REFERENCES hikyu.financial_operations(id);
ALTER TABLE hikyu.transactions ADD CONSTRAINT credit_payment_subject CHECK(kind<>'credit_payment' OR operation_id IS NOT NULL);
CREATE UNIQUE INDEX one_operation_leg_per_account ON hikyu.transactions(operation_id,account_id) WHERE operation_id IS NOT NULL;
CREATE INDEX budget_expense_date ON hikyu.transactions(account_id,posted_date,category) WHERE kind IN('expense','peer_transfer');
CREATE TABLE hikyu.financial_alert_events (
 operation_id UUID NOT NULL REFERENCES hikyu.financial_operations(id),alert_id UUID NOT NULL REFERENCES hikyu.alerts(id) ON DELETE CASCADE,
 PRIMARY KEY(operation_id,alert_id)
);
