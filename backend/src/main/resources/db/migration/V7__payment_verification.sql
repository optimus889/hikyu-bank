-- Separate from login challenges. Never stores a PIN or a plaintext verification code.
CREATE TABLE hikyu.payment_verifications (
 id UUID PRIMARY KEY,
 user_id UUID NOT NULL REFERENCES hikyu.users(id),
 session_hash CHAR(64) NOT NULL,
 payload_hash CHAR(64) NOT NULL,
 code_hash CHAR(64) NOT NULL,
 method VARCHAR(5) NOT NULL CHECK (method IN ('sms','email')),
 created_at TIMESTAMPTZ NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 consumed BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX payment_verification_rate ON hikyu.payment_verifications(user_id,created_at);
