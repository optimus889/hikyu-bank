-- Peer payments are synthetic transfers between application users.
CREATE TABLE hikyu.peer_payments (
 id UUID PRIMARY KEY,
 sender_id UUID NOT NULL REFERENCES hikyu.users(id),
 recipient_id UUID NOT NULL REFERENCES hikyu.users(id),
 source_account_id UUID NOT NULL,
 target_account_id UUID NOT NULL,
 amount NUMERIC(19,2) NOT NULL CHECK (amount > 0),
 note VARCHAR(250) NOT NULL DEFAULT '',
 idempotency_key UUID NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK (sender_id <> recipient_id),
 UNIQUE(sender_id,idempotency_key),
 FOREIGN KEY(source_account_id,sender_id) REFERENCES hikyu.accounts(id,user_id),
 FOREIGN KEY(target_account_id,recipient_id) REFERENCES hikyu.accounts(id,user_id)
);
CREATE INDEX peer_sender_date ON hikyu.peer_payments(sender_id,created_at DESC,id);
CREATE INDEX peer_recipient_date ON hikyu.peer_payments(recipient_id,created_at DESC,id);
ALTER TABLE hikyu.transactions ALTER COLUMN kind TYPE VARCHAR(20);
ALTER TABLE hikyu.transactions DROP CONSTRAINT transaction_kind;
ALTER TABLE hikyu.transactions ADD CONSTRAINT transaction_kind CHECK (kind IN ('income','expense','transfer','peer_transfer'));
ALTER TABLE hikyu.transactions ADD COLUMN peer_payment_id UUID REFERENCES hikyu.peer_payments(id);
ALTER TABLE hikyu.transactions ADD CONSTRAINT peer_payment_subject CHECK ((kind='peer_transfer')=(peer_payment_id IS NOT NULL));
CREATE UNIQUE INDEX one_peer_leg_per_account ON hikyu.transactions(peer_payment_id,account_id) WHERE peer_payment_id IS NOT NULL;
CREATE TABLE hikyu.peer_alert_events (
 payment_id UUID NOT NULL REFERENCES hikyu.peer_payments(id),
 alert_id UUID NOT NULL REFERENCES hikyu.alerts(id) ON DELETE CASCADE,
 notification_id UUID REFERENCES hikyu.notifications(id) ON DELETE SET NULL,
 PRIMARY KEY(payment_id,alert_id)
);
