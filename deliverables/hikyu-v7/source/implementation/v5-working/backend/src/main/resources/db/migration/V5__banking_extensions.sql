-- Additive V4 extension; legacy migrations are unchanged.
ALTER TABLE hikyu.users ADD COLUMN auth_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE hikyu.accounts ADD CONSTRAINT accounts_owner_key UNIQUE (id, user_id);
CREATE TABLE hikyu.user_preferences (
 user_id UUID PRIMARY KEY REFERENCES hikyu.users(id),
 low_balance BOOLEAN NOT NULL DEFAULT TRUE,
 large_transaction BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE hikyu.transfers (
 id UUID PRIMARY KEY,
 user_id UUID NOT NULL REFERENCES hikyu.users(id),
 source_account_id UUID NOT NULL,
 target_account_id UUID NOT NULL,
 amount NUMERIC(19,2) NOT NULL CHECK (amount > 0),
 note VARCHAR(250) NOT NULL DEFAULT '',
 idempotency_key UUID NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (user_id, idempotency_key),
 CHECK (source_account_id <> target_account_id),
 FOREIGN KEY (source_account_id,user_id) REFERENCES hikyu.accounts(id,user_id),
 FOREIGN KEY (target_account_id,user_id) REFERENCES hikyu.accounts(id,user_id)
);
CREATE INDEX transfers_owner_date ON hikyu.transfers(user_id,created_at DESC,id);
ALTER TABLE hikyu.transactions ADD COLUMN kind VARCHAR(10);
UPDATE hikyu.transactions SET kind = CASE WHEN amount >= 0 THEN 'income' ELSE 'expense' END;
ALTER TABLE hikyu.transactions ALTER COLUMN kind SET NOT NULL;
ALTER TABLE hikyu.transactions ALTER COLUMN kind SET DEFAULT 'expense';
ALTER TABLE hikyu.transactions ADD CONSTRAINT transaction_kind CHECK (kind IN ('income','expense','transfer'));
ALTER TABLE hikyu.transactions ADD COLUMN note VARCHAR(250) NOT NULL DEFAULT '';
ALTER TABLE hikyu.transactions ADD COLUMN transfer_id UUID REFERENCES hikyu.transfers(id);
ALTER TABLE hikyu.transactions ADD CONSTRAINT transfer_subject CHECK ((kind = 'transfer') = (transfer_id IS NOT NULL));
CREATE UNIQUE INDEX one_transfer_leg_per_account ON hikyu.transactions(transfer_id,account_id) WHERE transfer_id IS NOT NULL;
CREATE TABLE hikyu.alert_events (
 event_id UUID NOT NULL REFERENCES hikyu.transfers(id),
 alert_id UUID NOT NULL REFERENCES hikyu.alerts(id) ON DELETE CASCADE,
 notification_id UUID REFERENCES hikyu.notifications(id) ON DELETE SET NULL,
 PRIMARY KEY(event_id,alert_id)
);

ALTER TABLE hikyu.users ADD COLUMN pin_initialized BOOLEAN NOT NULL DEFAULT FALSE;
