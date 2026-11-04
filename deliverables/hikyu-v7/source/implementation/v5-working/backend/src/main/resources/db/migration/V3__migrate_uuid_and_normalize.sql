-- Preserve every old record in a private archive. No DROP/TRUNCATE is used.
-- This changes table namespaces and requires explicit approval on cloud databases.
SET LOCAL lock_timeout = '10s';
LOCK TABLE hikyu.users, hikyu.accounts, hikyu.transactions,
    hikyu.alerts, hikyu.notifications IN ACCESS EXCLUSIVE MODE;
CREATE SCHEMA hikyu_v1_archive;
REVOKE ALL ON SCHEMA hikyu_v1_archive FROM PUBLIC;

-- Refuse to migrate writes that happened after V2 prepared the fixed map.
DO $$
DECLARE entity TEXT;
DECLARE missing_id TEXT;
BEGIN
    FOREACH entity IN ARRAY ARRAY['users', 'accounts', 'transactions', 'alerts', 'notifications']
    LOOP
        EXECUTE format($q$
            SELECT old.id FROM hikyu.%I old
            LEFT JOIN hikyu_migration.id_map m
              ON m.entity_type = %L AND m.legacy_id = old.id
            WHERE m.new_id IS NULL LIMIT 1
        $q$, entity, entity) INTO missing_id;
        IF missing_id IS NOT NULL THEN
            RAISE EXCEPTION 'Unmapped % identity %; stop writers and review the mapping', entity, missing_id;
        END IF;
    END LOOP;
END $$;

ALTER TABLE hikyu.users SET SCHEMA hikyu_v1_archive;
ALTER TABLE hikyu.accounts SET SCHEMA hikyu_v1_archive;
ALTER TABLE hikyu.transactions SET SCHEMA hikyu_v1_archive;
ALTER TABLE hikyu.alerts SET SCHEMA hikyu_v1_archive;
ALTER TABLE hikyu.notifications SET SCHEMA hikyu_v1_archive;

CREATE TABLE hikyu.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    demo_code VARCHAR(80) UNIQUE,
    username VARCHAR(80) NOT NULL UNIQUE,
    first_name VARCHAR(60) NOT NULL,
    last_name VARCHAR(60) NOT NULL,
    display_name VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    masked_phone VARCHAR(80) NOT NULL,
    masked_email VARCHAR(100) NOT NULL
);

CREATE TABLE hikyu.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES hikyu.users(id),
    type VARCHAR(20) NOT NULL CHECK (
        type IN ('checking', 'savings', 'credit', 'loan', 'investment')
    ),
    name VARCHAR(60) NOT NULL CHECK (length(trim(name)) > 0),
    suffix CHAR(4) NOT NULL CHECK (suffix ~ '^[0-9]{4}$'),
    balance NUMERIC(19, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'pending', 'closed')),
    credit_limit NUMERIC(19, 2) CHECK (credit_limit >= 0),
    minimum_due NUMERIC(19, 2) CHECK (minimum_due >= 0),
    due_date DATE
);
CREATE UNIQUE INDEX one_open_account_per_user_type
    ON hikyu.accounts (user_id, type)
    WHERE type IN ('checking', 'savings') AND status IN ('active', 'pending');
CREATE INDEX accounts_owner ON hikyu.accounts (user_id);

CREATE TABLE hikyu.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES hikyu.accounts(id),
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    posted_date DATE NOT NULL,
    amount NUMERIC(19, 2) NOT NULL,
    icon VARCHAR(20) NOT NULL
);
CREATE INDEX transactions_account_date
    ON hikyu.transactions (account_id, posted_date DESC, id);

CREATE TABLE hikyu.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES hikyu.accounts(id),
    type VARCHAR(30) NOT NULL CHECK (
        type IN ('low_balance', 'large_transaction', 'savings_goal', 'payment_due', 'scheduled')
    ),
    title VARCHAR(80) NOT NULL CHECK (length(trim(title)) > 0),
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('Email', 'SMS', 'In-app', 'Calendar')),
    amount NUMERIC(19, 2),
    scheduled_date DATE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    CHECK (
        (type IN ('low_balance', 'large_transaction', 'savings_goal')
            AND amount IS NOT NULL AND amount BETWEEN 0.01 AND 1000000
            AND scheduled_date IS NULL)
        OR (type IN ('payment_due', 'scheduled') AND scheduled_date IS NOT NULL)
    )
);
CREATE INDEX alerts_account ON hikyu.alerts (account_id);

CREATE TABLE hikyu.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID REFERENCES hikyu.alerts(id),
    title VARCHAR(120) NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    source VARCHAR(30) NOT NULL
);
CREATE INDEX notifications_alert ON hikyu.notifications (alert_id);
CREATE INDEX notifications_created ON hikyu.notifications (created_at DESC, id);

CREATE TABLE hikyu.notification_recipients (
    notification_id UUID NOT NULL REFERENCES hikyu.notifications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES hikyu.users(id),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (notification_id, user_id),
    CHECK (NOT resolved OR is_read)
);
CREATE INDEX recipients_owner ON hikyu.notification_recipients (user_id, notification_id);

CREATE TABLE hikyu.notification_account_links (
    notification_id UUID PRIMARY KEY REFERENCES hikyu.notifications(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES hikyu.accounts(id)
);
CREATE INDEX notification_links_account ON hikyu.notification_account_links (account_id);

INSERT INTO hikyu.users
SELECT m.new_id,
    CASE WHEN u.id IN ('user-cl', 'user-mf', 'user-gd') THEN u.id ELSE NULL END,
    u.username, u.first_name, u.last_name,
    NULLIF(u.name, u.first_name || ' ' || u.last_name),
    u.password_hash, u.pin_hash, u.masked_phone, u.masked_email
FROM hikyu_v1_archive.users u
JOIN hikyu_migration.id_map m ON m.entity_type = 'users' AND m.legacy_id = u.id;

INSERT INTO hikyu.accounts
SELECT m.new_id, owner.new_id, a.type, a.name, a.suffix, a.balance,
    a.status, a.credit_limit, a.minimum_due, a.due_date
FROM hikyu_v1_archive.accounts a
JOIN hikyu_migration.id_map m ON m.entity_type = 'accounts' AND m.legacy_id = a.id
JOIN hikyu_migration.id_map owner ON owner.entity_type = 'users' AND owner.legacy_id = a.user_id;

INSERT INTO hikyu.transactions
SELECT m.new_id, account.new_id, t.name, t.category, t.posted_date, t.amount, t.icon
FROM hikyu_v1_archive.transactions t
JOIN hikyu_migration.id_map m ON m.entity_type = 'transactions' AND m.legacy_id = t.id
JOIN hikyu_migration.id_map account ON account.entity_type = 'accounts' AND account.legacy_id = t.account_id;

INSERT INTO hikyu.alerts (id, account_id, type, title, channel, amount, scheduled_date, enabled)
SELECT m.new_id, account.new_id, a.type, a.title, a.channel, a.amount, a.scheduled_date, a.enabled
FROM hikyu_v1_archive.alerts a
JOIN hikyu_migration.id_map m ON m.entity_type = 'alerts' AND m.legacy_id = a.id
JOIN hikyu_migration.id_map account ON account.entity_type = 'accounts' AND account.legacy_id = a.account_id;

INSERT INTO hikyu.notifications
SELECT m.new_id, alert.new_id, n.title, n.body, n.created_at, n.source
FROM hikyu_v1_archive.notifications n
JOIN hikyu_migration.id_map m ON m.entity_type = 'notifications' AND m.legacy_id = n.id
LEFT JOIN hikyu_migration.id_map alert ON alert.entity_type = 'alerts' AND alert.legacy_id = n.alert_id;

INSERT INTO hikyu.notification_recipients
SELECT m.new_id, owner.new_id, n.is_read, n.resolved
FROM hikyu_v1_archive.notifications n
JOIN hikyu_migration.id_map m ON m.entity_type = 'notifications' AND m.legacy_id = n.id
JOIN hikyu_migration.id_map owner ON owner.entity_type = 'users' AND owner.legacy_id = n.user_id;

INSERT INTO hikyu.notification_account_links
SELECT m.new_id, account.new_id
FROM hikyu_v1_archive.notifications n
JOIN hikyu_migration.id_map m ON m.entity_type = 'notifications' AND m.legacy_id = n.id
JOIN hikyu_migration.id_map account ON account.entity_type = 'accounts' AND account.legacy_id = n.account_id
WHERE n.alert_id IS NULL;
