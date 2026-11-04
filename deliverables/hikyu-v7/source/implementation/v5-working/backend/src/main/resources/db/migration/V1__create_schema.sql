-- AI-assisted design, reviewed against PostgreSQL constraints and tested on PostgreSQL.
-- A private schema keeps these tables outside the default public Data API schema.
CREATE SCHEMA IF NOT EXISTS hikyu;

CREATE TABLE hikyu.users (
    id TEXT PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    first_name VARCHAR(60) NOT NULL,
    last_name VARCHAR(60) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    pin_hash VARCHAR(100) NOT NULL,
    masked_phone VARCHAR(80) NOT NULL,
    masked_email VARCHAR(100) NOT NULL
);

CREATE TABLE hikyu.accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES hikyu.users(id),
    type VARCHAR(20) NOT NULL CHECK (type IN ('checking', 'savings', 'credit', 'loan', 'investment')),
    name VARCHAR(60) NOT NULL CHECK (length(trim(name)) > 0),
    suffix CHAR(4) NOT NULL CHECK (suffix ~ '^[0-9]{4}$'),
    balance NUMERIC(19, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'pending', 'closed')),
    credit_limit NUMERIC(19, 2) CHECK (credit_limit >= 0),
    minimum_due NUMERIC(19, 2) CHECK (minimum_due >= 0),
    due_date DATE,
    UNIQUE (user_id, id)
);

-- One active/pending checking and savings account per owner, including concurrent requests.
CREATE UNIQUE INDEX one_open_account_per_user_type
    ON hikyu.accounts (user_id, type)
    WHERE type IN ('checking', 'savings') AND status IN ('active', 'pending');

CREATE TABLE hikyu.transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES hikyu.users(id),
    account_id TEXT NOT NULL,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    posted_date DATE NOT NULL,
    amount NUMERIC(19, 2) NOT NULL,
    icon VARCHAR(20) NOT NULL,
    FOREIGN KEY (user_id, account_id) REFERENCES hikyu.accounts(user_id, id)
);
CREATE INDEX transactions_owner_date ON hikyu.transactions (user_id, posted_date DESC);
CREATE INDEX transactions_owner_account ON hikyu.transactions (user_id, account_id);

CREATE TABLE hikyu.alerts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES hikyu.users(id),
    account_id TEXT NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (
        type IN ('low_balance', 'large_transaction', 'savings_goal', 'payment_due', 'scheduled')
    ),
    title VARCHAR(80) NOT NULL CHECK (length(trim(title)) > 0),
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('Email', 'SMS', 'In-app', 'Calendar')),
    amount NUMERIC(19, 2),
    scheduled_date DATE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (user_id, id),
    FOREIGN KEY (user_id, account_id) REFERENCES hikyu.accounts(user_id, id),
    CHECK (
        (type IN ('low_balance', 'large_transaction', 'savings_goal')
            AND amount IS NOT NULL AND amount BETWEEN 0.01 AND 1000000
            AND scheduled_date IS NULL)
        OR (type IN ('payment_due', 'scheduled') AND scheduled_date IS NOT NULL)
    )
);

CREATE TABLE hikyu.notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES hikyu.users(id),
    alert_id TEXT,
    account_id TEXT,
    title VARCHAR(120) NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    source VARCHAR(30) NOT NULL,
    FOREIGN KEY (user_id, account_id) REFERENCES hikyu.accounts(user_id, id),
    FOREIGN KEY (user_id, alert_id) REFERENCES hikyu.alerts(user_id, id)
);
CREATE INDEX notifications_owner_created ON hikyu.notifications (user_id, created_at DESC);
CREATE INDEX alerts_owner ON hikyu.alerts (user_id);
