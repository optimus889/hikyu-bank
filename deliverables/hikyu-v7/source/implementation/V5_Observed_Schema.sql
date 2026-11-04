--
-- PostgreSQL database dump
--

\restrict dKwtLwrGTPLwDpGXOYb9ci3F6enldmydmMVTDgvB2mOpU14xfHk3zUD2AvcFenh

-- Dumped from database version 17.11 (Debian 17.11-1.pgdg13+2)
-- Dumped by pg_dump version 17.11 (Debian 17.11-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: hikyu; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA hikyu;


--
-- Name: guard_identity(); Type: FUNCTION; Schema: hikyu; Owner: -
--

CREATE FUNCTION hikyu.guard_identity() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'Entity UUID is immutable' USING ERRCODE = '23514';
    END IF;
    IF TG_TABLE_NAME = 'accounts' THEN
        IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
            RAISE EXCEPTION 'Account owner is immutable' USING ERRCODE = '23514';
        END IF;
    END IF;
    IF TG_TABLE_NAME = 'alerts' THEN
        IF NEW.account_id IS DISTINCT FROM OLD.account_id AND EXISTS (
            SELECT 1 FROM hikyu.notifications WHERE alert_id = OLD.id
        ) THEN
            RAISE EXCEPTION 'Alert account is in use by notifications' USING ERRCODE = '23514';
        END IF;
    END IF;
    IF TG_TABLE_NAME = 'notifications' THEN
        IF NEW.alert_id IS DISTINCT FROM OLD.alert_id THEN
            RAISE EXCEPTION 'Notification alert subject is immutable' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END $$;


--
-- Name: guard_subject(); Type: FUNCTION; Schema: hikyu; Owner: -
--

CREATE FUNCTION hikyu.guard_subject() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN
    -- Lock parents so a concurrent subject change cannot bypass ownership checks.
    IF TG_TABLE_NAME = 'notification_recipients' THEN
        PERFORM 1 FROM hikyu.alerts a
            JOIN hikyu.notifications n ON n.alert_id = a.id
            WHERE n.id = NEW.notification_id FOR UPDATE OF a;
        PERFORM 1 FROM hikyu.notifications WHERE id = NEW.notification_id FOR UPDATE;
        IF EXISTS (
            SELECT 1 FROM hikyu.notifications n
            JOIN hikyu.alerts a ON a.id = n.alert_id
            JOIN hikyu.accounts acc ON acc.id = a.account_id
            WHERE n.id = NEW.notification_id AND acc.user_id <> NEW.user_id
        ) OR EXISTS (
            SELECT 1 FROM hikyu.notification_account_links l
            JOIN hikyu.accounts acc ON acc.id = l.account_id
            WHERE l.notification_id = NEW.notification_id AND acc.user_id <> NEW.user_id
        ) THEN
            RAISE EXCEPTION 'Notification recipient does not own its subject' USING ERRCODE = '23514';
        END IF;
    ELSE
        PERFORM 1 FROM hikyu.notifications WHERE id = NEW.notification_id FOR UPDATE;
        IF EXISTS (
            SELECT 1 FROM hikyu.notifications
            WHERE id = NEW.notification_id AND alert_id IS NOT NULL
        ) OR EXISTS (
            SELECT 1 FROM hikyu.notification_recipients r
            JOIN hikyu.accounts acc ON acc.id = NEW.account_id
            WHERE r.notification_id = NEW.notification_id AND r.user_id <> acc.user_id
        ) THEN
            RAISE EXCEPTION 'Invalid direct notification account link' USING ERRCODE = '23514';
        END IF;
        IF TG_OP = 'UPDATE' AND NEW.account_id IS DISTINCT FROM OLD.account_id THEN
            RAISE EXCEPTION 'Notification account subject is immutable' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: hikyu; Owner: -
--

CREATE TABLE hikyu.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type character varying(20) NOT NULL,
    name character varying(60) NOT NULL,
    suffix character(4) NOT NULL,
    balance numeric(19,2) DEFAULT 0 NOT NULL,
    status character varying(20) NOT NULL,
    credit_limit numeric(19,2),
    minimum_due numeric(19,2),
    due_date date,
    CONSTRAINT accounts_balance_check CHECK ((balance >= (0)::numeric)),
    CONSTRAINT accounts_credit_limit_check CHECK ((credit_limit >= (0)::numeric)),
    CONSTRAINT accounts_finite_money CHECK (((balance <> 'NaN'::numeric) AND ((credit_limit IS NULL) OR (credit_limit <> 'NaN'::numeric)) AND ((minimum_due IS NULL) OR (minimum_due <> 'NaN'::numeric)))),
    CONSTRAINT accounts_minimum_due_check CHECK ((minimum_due >= (0)::numeric)),
    CONSTRAINT accounts_name_check CHECK ((length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT accounts_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'pending'::character varying, 'closed'::character varying])::text[]))),
    CONSTRAINT accounts_suffix_check CHECK ((suffix ~ '^[0-9]{4}$'::text)),
    CONSTRAINT accounts_type_check CHECK (((type)::text = ANY ((ARRAY['checking'::character varying, 'savings'::character varying, 'credit'::character varying, 'loan'::character varying, 'investment'::character varying])::text[])))
);


--
-- Name: alert_events; Type: TABLE; Schema: hikyu; Owner: -
--

CREATE TABLE hikyu.alert_events (
    event_id uuid NOT NULL,
    alert_id uuid NOT NULL,
    notification_id uuid
);


--
-- Name: alerts; Type: TABLE; Schema: hikyu; Owner: -
--

CREATE TABLE hikyu.alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    type character varying(30) NOT NULL,
    title character varying(80) NOT NULL,
    channel character varying(20) NOT NULL,
    amount numeric(19,2),
    scheduled_date date,
    enabled boolean DEFAULT true NOT NULL,
    CONSTRAINT alerts_channel_check CHECK (((channel)::text = ANY ((ARRAY['Email'::character varying, 'SMS'::character varying, 'In-app'::character varying, 'Calendar'::character varying])::text[]))),
    CONSTRAINT alerts_check CHECK (((((type)::text = ANY ((ARRAY['low_balance'::character varying, 'large_transaction'::character varying, 'savings_goal'::character varying])::text[])) AND (amount IS NOT NULL) AND ((amount >= 0.01) AND (amount <= (1000000)::numeric)) AND (scheduled_date IS NULL)) OR (((type)::text = ANY ((ARRAY['payment_due'::character varying, 'scheduled'::character varying])::text[])) AND (scheduled_date IS NOT NULL)))),
    CONSTRAINT alerts_finite_money CHECK (((amount IS NULL) OR (amount <> 'NaN'::numeric))),
    CONSTRAINT alerts_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0)),
    CONSTRAINT alerts_type_check CHECK (((type)::text = ANY ((ARRAY['low_balance'::character varying, 'large_transaction'::character varying, 'savings_goal'::character varying, 'payment_due'::character varying, 'scheduled'::character varying])::text[])))
);


--
-- Name: budgets; Type: TABLE; Schema: hikyu; Owner: -
--

CREATE TABLE hikyu.budgets (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    month date NOT NULL,
    category character varying(60) NOT NULL,
    limit_amount numeric(19,2) NOT NULL,
    CONSTRAINT budgets_limit_amount_check CHECK ((limit_amount > (0)::numeric)),
    CONSTRAINT budgets_month_check CHECK ((EXTRACT(day FROM month) = (1)::numeric))
);


--
-- Name: card_controls; Type: TABLE; Schema: hikyu; Owner: -
--

CREATE TABLE hikyu.card_controls (
    account_id uuid NOT NULL,
    locked boolean DEFAULT false NOT NULL
);


--
-- Name: financial_alert_events; Type: TABLE; Schema: hikyu; Owner: -
--

CREATE TABLE hikyu.financial_alert_events (
    operation_id uuid NOT NULL,
    alert_id uuid NOT NULL
);


--
-- Name: financial_operations; Type: TABLE; Schema: hikyu; Owner: -
--

CREATE TABLE hikyu.financial_operations (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    kind character varying(12) NOT NULL,
    source_account_id uuid NOT NULL,
    target_account_id uuid,
    payee_id uuid,
    amount numeric(19,2) NOT NULL,
    merchant character varying(100) NOT NULL,
    category character varying(60) NOT NULL,
    note character varying(250) DEFAULT ''::character varying NOT NULL,
    idempotency_key uuid NOT NULL,
    request_hash character(64) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT financial_operations_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT financial_operations_check CHECK ((((kind)::text = 'repayment'::text) = (target_account_id IS NOT NULL))),
    CONSTRAINT financial_operations_check1 CHECK ((((kind)::text = 'bill'::text) = (payee_id IS NOT NULL))),
    CONSTRAINT financial_operations_check2 CHECK (((target_account_id IS NULL) OR (source_account_id <> target_account_id))),
    CONSTRAINT financial_operations_kind_check CHECK (((kind)::text = ANY ((ARRAY['purchase'::character varying, 'repayment'::character varying, 'bill'::character varying])::text[])))
);


--
-- Name: flyway_schema_history; Type: TABLE; Schema: hikyu; Owner: -
--

CREATE TABLE hikyu.flyway_schema_history (
    installed_rank integer NOT NULL,
    version character varying(50),
    description character varying(200) NOT NULL,
    type character varying(20) NOT NULL,
    script character varying(1000) NOT NULL,
    checksum integer,
    installed_by character varying(100) NOT NULL,
    installed_on timestamp without time zone DEFAULT now() NOT NULL,
    execution_time integer NOT NULL,
    success boolean NOT NULL
);


--
-- Name: notification_account_links; Type: TABLE; Schema: hikyu; Owner: -
--

CREATE TABLE hikyu.notification_account_links (
    notification_id uuid NOT NULL,
    account_id uuid NOT NULL
);


--
-- Name: notification_recipients; Type: TABLE; Schema: hikyu; Owner: -
--

CREATE TABLE hikyu.notification_recipients (
    notification_id uuid NOT NULL,
    user_id uuid NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    resolved boolean DEFAULT false NOT NULL,
    CONSTRAINT notification_recipients_check CHECK (((NOT resolved) OR is_read))
);


--
-- Name: notifications; Type: TABLE; Schema: hikyu; Owner: -
--

CREATE TABLE hikyu.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alert_id uuid,
    title character varying(120) NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    source character varying(30) NOT NULL
);


--
-- Name: payment_verifications; Type: TABLE; Schema: hikyu; Owner: -
--

CREATE TABLE hikyu.payment_verifications (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    session_hash character(64) NOT NULL,
    payload_hash character(64) NOT NULL,
    code_hash character(64) NOT NULL,
    method character varying(5) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    consumed boolean DEFAULT false NOT NULL,
    CONSTRAINT payment_verifications_method_check CHECK (((method)::text = ANY ((ARRAY['sms'::character varying, 'email'::character varying])::text[])))
);


--
-- Name: peer_alert_events; Type: TABLE; Schema: hikyu; Owner: -
--

CREATE TABLE hikyu.peer_alert_events (
    payment_id uuid NOT NULL,
    alert_id uuid NOT NULL,
    notification_id uuid
);


--
-- Name: peer_payments; Type: TABLE; Schema: hikyu; Owner: -
--

CREATE TABLE hikyu.peer_payments (
    id uuid NOT NULL,
    sender_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    source_account_id uuid NOT NULL,
    target_account_id uuid NOT NULL,
    amount numeric(19,2) NOT NULL,
    note character varying(250) DEFAULT ''::character varying NOT NULL,
    idempotency_key uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT peer_payments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT peer_payments_check CHECK ((sender_id <> recipient_id))
);


--
-- Name: saved_payees; Type: TABLE; Schema: hikyu; Owner: -
--

CREATE TABLE hikyu.saved_payees (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    kind character varying(8) NOT NULL,
    identifier character varying(80) NOT NULL,
    alias character varying(60) NOT NULL,
    reference character varying(60) DEFAULT ''::character varying NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    CONSTRAINT saved_payees_kind_check CHECK (((kind)::text = ANY ((ARRAY['peer'::character varying, 'biller'::character varying])::text[])))
);


--
-- Name: transactions; Type: TABLE; Schema: hikyu; Owner: -
--

CREATE TABLE hikyu.transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    category character varying(50) NOT NULL,
    posted_date date NOT NULL,
    amount numeric(19,2) NOT NULL,
    icon character varying(20) NOT NULL,
    kind character varying(20) DEFAULT 'expense'::character varying NOT NULL,
    note character varying(250) DEFAULT ''::character varying NOT NULL,
    transfer_id uuid,
    peer_payment_id uuid,
    operation_id uuid,
    CONSTRAINT credit_payment_subject CHECK ((((kind)::text <> 'credit_payment'::text) OR (operation_id IS NOT NULL))),
    CONSTRAINT peer_payment_subject CHECK ((((kind)::text = 'peer_transfer'::text) = (peer_payment_id IS NOT NULL))),
    CONSTRAINT transaction_kind CHECK (((kind)::text = ANY ((ARRAY['income'::character varying, 'expense'::character varying, 'transfer'::character varying, 'peer_transfer'::character varying, 'credit_payment'::character varying])::text[]))),
    CONSTRAINT transactions_finite_money CHECK ((amount <> 'NaN'::numeric)),
    CONSTRAINT transfer_subject CHECK ((((kind)::text = 'transfer'::text) = (transfer_id IS NOT NULL)))
);


--
-- Name: transfers; Type: TABLE; Schema: hikyu; Owner: -
--

CREATE TABLE hikyu.transfers (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    source_account_id uuid NOT NULL,
    target_account_id uuid NOT NULL,
    amount numeric(19,2) NOT NULL,
    note character varying(250) DEFAULT ''::character varying NOT NULL,
    idempotency_key uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT transfers_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT transfers_check CHECK ((source_account_id <> target_account_id))
);


--
-- Name: user_preferences; Type: TABLE; Schema: hikyu; Owner: -
--

CREATE TABLE hikyu.user_preferences (
    user_id uuid NOT NULL,
    low_balance boolean DEFAULT true NOT NULL,
    large_transaction boolean DEFAULT true NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: hikyu; Owner: -
--

CREATE TABLE hikyu.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    demo_code character varying(80),
    username character varying(80) NOT NULL,
    first_name character varying(60) NOT NULL,
    last_name character varying(60) NOT NULL,
    display_name character varying(100),
    password_hash character varying(255) NOT NULL,
    pin_hash character varying(255) NOT NULL,
    masked_phone character varying(80) NOT NULL,
    masked_email character varying(100) NOT NULL,
    auth_version bigint DEFAULT 0 NOT NULL,
    pin_initialized boolean DEFAULT false NOT NULL
);


--
-- Name: accounts accounts_owner_key; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.accounts
    ADD CONSTRAINT accounts_owner_key UNIQUE (id, user_id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: alert_events alert_events_pkey; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.alert_events
    ADD CONSTRAINT alert_events_pkey PRIMARY KEY (event_id, alert_id);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- Name: budgets budgets_user_id_month_category_key; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.budgets
    ADD CONSTRAINT budgets_user_id_month_category_key UNIQUE (user_id, month, category);


--
-- Name: card_controls card_controls_pkey; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.card_controls
    ADD CONSTRAINT card_controls_pkey PRIMARY KEY (account_id);


--
-- Name: financial_alert_events financial_alert_events_pkey; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.financial_alert_events
    ADD CONSTRAINT financial_alert_events_pkey PRIMARY KEY (operation_id, alert_id);


--
-- Name: financial_operations financial_operations_pkey; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.financial_operations
    ADD CONSTRAINT financial_operations_pkey PRIMARY KEY (id);


--
-- Name: financial_operations financial_operations_user_id_idempotency_key_key; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.financial_operations
    ADD CONSTRAINT financial_operations_user_id_idempotency_key_key UNIQUE (user_id, idempotency_key);


--
-- Name: flyway_schema_history flyway_schema_history_pk; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.flyway_schema_history
    ADD CONSTRAINT flyway_schema_history_pk PRIMARY KEY (installed_rank);


--
-- Name: notification_account_links notification_account_links_pkey; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.notification_account_links
    ADD CONSTRAINT notification_account_links_pkey PRIMARY KEY (notification_id);


--
-- Name: notification_recipients notification_recipients_pkey; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.notification_recipients
    ADD CONSTRAINT notification_recipients_pkey PRIMARY KEY (notification_id, user_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: payment_verifications payment_verifications_pkey; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.payment_verifications
    ADD CONSTRAINT payment_verifications_pkey PRIMARY KEY (id);


--
-- Name: peer_alert_events peer_alert_events_pkey; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.peer_alert_events
    ADD CONSTRAINT peer_alert_events_pkey PRIMARY KEY (payment_id, alert_id);


--
-- Name: peer_payments peer_payments_pkey; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.peer_payments
    ADD CONSTRAINT peer_payments_pkey PRIMARY KEY (id);


--
-- Name: peer_payments peer_payments_sender_id_idempotency_key_key; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.peer_payments
    ADD CONSTRAINT peer_payments_sender_id_idempotency_key_key UNIQUE (sender_id, idempotency_key);


--
-- Name: saved_payees saved_payees_id_user_id_key; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.saved_payees
    ADD CONSTRAINT saved_payees_id_user_id_key UNIQUE (id, user_id);


--
-- Name: saved_payees saved_payees_pkey; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.saved_payees
    ADD CONSTRAINT saved_payees_pkey PRIMARY KEY (id);


--
-- Name: saved_payees saved_payees_user_id_kind_identifier_key; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.saved_payees
    ADD CONSTRAINT saved_payees_user_id_kind_identifier_key UNIQUE (user_id, kind, identifier);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: transfers transfers_pkey; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.transfers
    ADD CONSTRAINT transfers_pkey PRIMARY KEY (id);


--
-- Name: transfers transfers_user_id_idempotency_key_key; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.transfers
    ADD CONSTRAINT transfers_user_id_idempotency_key_key UNIQUE (user_id, idempotency_key);


--
-- Name: user_preferences user_preferences_pkey; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.user_preferences
    ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: users users_demo_code_key; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.users
    ADD CONSTRAINT users_demo_code_key UNIQUE (demo_code);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: accounts_owner; Type: INDEX; Schema: hikyu; Owner: -
--

CREATE INDEX accounts_owner ON hikyu.accounts USING btree (user_id);


--
-- Name: alerts_account; Type: INDEX; Schema: hikyu; Owner: -
--

CREATE INDEX alerts_account ON hikyu.alerts USING btree (account_id);


--
-- Name: budget_expense_date; Type: INDEX; Schema: hikyu; Owner: -
--

CREATE INDEX budget_expense_date ON hikyu.transactions USING btree (account_id, posted_date, category) WHERE ((kind)::text = ANY ((ARRAY['expense'::character varying, 'peer_transfer'::character varying])::text[]));


--
-- Name: financial_owner_date; Type: INDEX; Schema: hikyu; Owner: -
--

CREATE INDEX financial_owner_date ON hikyu.financial_operations USING btree (user_id, created_at DESC, id);


--
-- Name: flyway_schema_history_s_idx; Type: INDEX; Schema: hikyu; Owner: -
--

CREATE INDEX flyway_schema_history_s_idx ON hikyu.flyway_schema_history USING btree (success);


--
-- Name: notification_links_account; Type: INDEX; Schema: hikyu; Owner: -
--

CREATE INDEX notification_links_account ON hikyu.notification_account_links USING btree (account_id);


--
-- Name: notifications_alert; Type: INDEX; Schema: hikyu; Owner: -
--

CREATE INDEX notifications_alert ON hikyu.notifications USING btree (alert_id);


--
-- Name: notifications_created; Type: INDEX; Schema: hikyu; Owner: -
--

CREATE INDEX notifications_created ON hikyu.notifications USING btree (created_at DESC, id);


--
-- Name: one_open_account_per_user_type; Type: INDEX; Schema: hikyu; Owner: -
--

CREATE UNIQUE INDEX one_open_account_per_user_type ON hikyu.accounts USING btree (user_id, type) WHERE (((type)::text = ANY ((ARRAY['checking'::character varying, 'savings'::character varying])::text[])) AND ((status)::text = ANY ((ARRAY['active'::character varying, 'pending'::character varying])::text[])));


--
-- Name: one_operation_leg_per_account; Type: INDEX; Schema: hikyu; Owner: -
--

CREATE UNIQUE INDEX one_operation_leg_per_account ON hikyu.transactions USING btree (operation_id, account_id) WHERE (operation_id IS NOT NULL);


--
-- Name: one_peer_leg_per_account; Type: INDEX; Schema: hikyu; Owner: -
--

CREATE UNIQUE INDEX one_peer_leg_per_account ON hikyu.transactions USING btree (peer_payment_id, account_id) WHERE (peer_payment_id IS NOT NULL);


--
-- Name: one_transfer_leg_per_account; Type: INDEX; Schema: hikyu; Owner: -
--

CREATE UNIQUE INDEX one_transfer_leg_per_account ON hikyu.transactions USING btree (transfer_id, account_id) WHERE (transfer_id IS NOT NULL);


--
-- Name: payees_owner_active; Type: INDEX; Schema: hikyu; Owner: -
--

CREATE INDEX payees_owner_active ON hikyu.saved_payees USING btree (user_id, kind) WHERE (NOT deleted);


--
-- Name: payment_verification_rate; Type: INDEX; Schema: hikyu; Owner: -
--

CREATE INDEX payment_verification_rate ON hikyu.payment_verifications USING btree (user_id, created_at);


--
-- Name: peer_recipient_date; Type: INDEX; Schema: hikyu; Owner: -
--

CREATE INDEX peer_recipient_date ON hikyu.peer_payments USING btree (recipient_id, created_at DESC, id);


--
-- Name: peer_sender_date; Type: INDEX; Schema: hikyu; Owner: -
--

CREATE INDEX peer_sender_date ON hikyu.peer_payments USING btree (sender_id, created_at DESC, id);


--
-- Name: recipients_owner; Type: INDEX; Schema: hikyu; Owner: -
--

CREATE INDEX recipients_owner ON hikyu.notification_recipients USING btree (user_id, notification_id);


--
-- Name: transactions_account_date; Type: INDEX; Schema: hikyu; Owner: -
--

CREATE INDEX transactions_account_date ON hikyu.transactions USING btree (account_id, posted_date DESC, id);


--
-- Name: transfers_owner_date; Type: INDEX; Schema: hikyu; Owner: -
--

CREATE INDEX transfers_owner_date ON hikyu.transfers USING btree (user_id, created_at DESC, id);


--
-- Name: accounts accounts_identity_guard; Type: TRIGGER; Schema: hikyu; Owner: -
--

CREATE TRIGGER accounts_identity_guard BEFORE UPDATE ON hikyu.accounts FOR EACH ROW EXECUTE FUNCTION hikyu.guard_identity();


--
-- Name: alerts alerts_identity_guard; Type: TRIGGER; Schema: hikyu; Owner: -
--

CREATE TRIGGER alerts_identity_guard BEFORE UPDATE ON hikyu.alerts FOR EACH ROW EXECUTE FUNCTION hikyu.guard_identity();


--
-- Name: notification_account_links notification_link_guard; Type: TRIGGER; Schema: hikyu; Owner: -
--

CREATE TRIGGER notification_link_guard BEFORE INSERT OR UPDATE ON hikyu.notification_account_links FOR EACH ROW EXECUTE FUNCTION hikyu.guard_subject();


--
-- Name: notifications notifications_identity_guard; Type: TRIGGER; Schema: hikyu; Owner: -
--

CREATE TRIGGER notifications_identity_guard BEFORE UPDATE ON hikyu.notifications FOR EACH ROW EXECUTE FUNCTION hikyu.guard_identity();


--
-- Name: notification_recipients recipient_owner_guard; Type: TRIGGER; Schema: hikyu; Owner: -
--

CREATE TRIGGER recipient_owner_guard BEFORE INSERT OR UPDATE ON hikyu.notification_recipients FOR EACH ROW EXECUTE FUNCTION hikyu.guard_subject();


--
-- Name: transactions transactions_identity_guard; Type: TRIGGER; Schema: hikyu; Owner: -
--

CREATE TRIGGER transactions_identity_guard BEFORE UPDATE ON hikyu.transactions FOR EACH ROW EXECUTE FUNCTION hikyu.guard_identity();


--
-- Name: users users_identity_guard; Type: TRIGGER; Schema: hikyu; Owner: -
--

CREATE TRIGGER users_identity_guard BEFORE UPDATE ON hikyu.users FOR EACH ROW EXECUTE FUNCTION hikyu.guard_identity();


--
-- Name: accounts accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.accounts
    ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES hikyu.users(id);


--
-- Name: alert_events alert_events_alert_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.alert_events
    ADD CONSTRAINT alert_events_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES hikyu.alerts(id) ON DELETE CASCADE;


--
-- Name: alert_events alert_events_event_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.alert_events
    ADD CONSTRAINT alert_events_event_id_fkey FOREIGN KEY (event_id) REFERENCES hikyu.transfers(id);


--
-- Name: alert_events alert_events_notification_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.alert_events
    ADD CONSTRAINT alert_events_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES hikyu.notifications(id) ON DELETE SET NULL;


--
-- Name: alerts alerts_account_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.alerts
    ADD CONSTRAINT alerts_account_id_fkey FOREIGN KEY (account_id) REFERENCES hikyu.accounts(id);


--
-- Name: budgets budgets_user_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.budgets
    ADD CONSTRAINT budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES hikyu.users(id);


--
-- Name: card_controls card_controls_account_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.card_controls
    ADD CONSTRAINT card_controls_account_id_fkey FOREIGN KEY (account_id) REFERENCES hikyu.accounts(id);


--
-- Name: financial_alert_events financial_alert_events_alert_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.financial_alert_events
    ADD CONSTRAINT financial_alert_events_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES hikyu.alerts(id) ON DELETE CASCADE;


--
-- Name: financial_alert_events financial_alert_events_operation_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.financial_alert_events
    ADD CONSTRAINT financial_alert_events_operation_id_fkey FOREIGN KEY (operation_id) REFERENCES hikyu.financial_operations(id);


--
-- Name: financial_operations financial_operations_payee_id_user_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.financial_operations
    ADD CONSTRAINT financial_operations_payee_id_user_id_fkey FOREIGN KEY (payee_id, user_id) REFERENCES hikyu.saved_payees(id, user_id);


--
-- Name: financial_operations financial_operations_source_account_id_user_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.financial_operations
    ADD CONSTRAINT financial_operations_source_account_id_user_id_fkey FOREIGN KEY (source_account_id, user_id) REFERENCES hikyu.accounts(id, user_id);


--
-- Name: financial_operations financial_operations_target_account_id_user_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.financial_operations
    ADD CONSTRAINT financial_operations_target_account_id_user_id_fkey FOREIGN KEY (target_account_id, user_id) REFERENCES hikyu.accounts(id, user_id);


--
-- Name: financial_operations financial_operations_user_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.financial_operations
    ADD CONSTRAINT financial_operations_user_id_fkey FOREIGN KEY (user_id) REFERENCES hikyu.users(id);


--
-- Name: notification_account_links notification_account_links_account_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.notification_account_links
    ADD CONSTRAINT notification_account_links_account_id_fkey FOREIGN KEY (account_id) REFERENCES hikyu.accounts(id);


--
-- Name: notification_account_links notification_account_links_notification_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.notification_account_links
    ADD CONSTRAINT notification_account_links_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES hikyu.notifications(id) ON DELETE CASCADE;


--
-- Name: notification_recipients notification_recipients_notification_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.notification_recipients
    ADD CONSTRAINT notification_recipients_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES hikyu.notifications(id) ON DELETE CASCADE;


--
-- Name: notification_recipients notification_recipients_user_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.notification_recipients
    ADD CONSTRAINT notification_recipients_user_id_fkey FOREIGN KEY (user_id) REFERENCES hikyu.users(id);


--
-- Name: notifications notifications_alert_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.notifications
    ADD CONSTRAINT notifications_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES hikyu.alerts(id);


--
-- Name: payment_verifications payment_verifications_user_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.payment_verifications
    ADD CONSTRAINT payment_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES hikyu.users(id);


--
-- Name: peer_alert_events peer_alert_events_alert_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.peer_alert_events
    ADD CONSTRAINT peer_alert_events_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES hikyu.alerts(id) ON DELETE CASCADE;


--
-- Name: peer_alert_events peer_alert_events_notification_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.peer_alert_events
    ADD CONSTRAINT peer_alert_events_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES hikyu.notifications(id) ON DELETE SET NULL;


--
-- Name: peer_alert_events peer_alert_events_payment_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.peer_alert_events
    ADD CONSTRAINT peer_alert_events_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES hikyu.peer_payments(id);


--
-- Name: peer_payments peer_payments_recipient_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.peer_payments
    ADD CONSTRAINT peer_payments_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES hikyu.users(id);


--
-- Name: peer_payments peer_payments_sender_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.peer_payments
    ADD CONSTRAINT peer_payments_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES hikyu.users(id);


--
-- Name: peer_payments peer_payments_source_account_id_sender_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.peer_payments
    ADD CONSTRAINT peer_payments_source_account_id_sender_id_fkey FOREIGN KEY (source_account_id, sender_id) REFERENCES hikyu.accounts(id, user_id);


--
-- Name: peer_payments peer_payments_target_account_id_recipient_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.peer_payments
    ADD CONSTRAINT peer_payments_target_account_id_recipient_id_fkey FOREIGN KEY (target_account_id, recipient_id) REFERENCES hikyu.accounts(id, user_id);


--
-- Name: saved_payees saved_payees_user_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.saved_payees
    ADD CONSTRAINT saved_payees_user_id_fkey FOREIGN KEY (user_id) REFERENCES hikyu.users(id);


--
-- Name: transactions transactions_account_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.transactions
    ADD CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES hikyu.accounts(id);


--
-- Name: transactions transactions_operation_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.transactions
    ADD CONSTRAINT transactions_operation_id_fkey FOREIGN KEY (operation_id) REFERENCES hikyu.financial_operations(id);


--
-- Name: transactions transactions_peer_payment_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.transactions
    ADD CONSTRAINT transactions_peer_payment_id_fkey FOREIGN KEY (peer_payment_id) REFERENCES hikyu.peer_payments(id);


--
-- Name: transactions transactions_transfer_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.transactions
    ADD CONSTRAINT transactions_transfer_id_fkey FOREIGN KEY (transfer_id) REFERENCES hikyu.transfers(id);


--
-- Name: transfers transfers_source_account_id_user_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.transfers
    ADD CONSTRAINT transfers_source_account_id_user_id_fkey FOREIGN KEY (source_account_id, user_id) REFERENCES hikyu.accounts(id, user_id);


--
-- Name: transfers transfers_target_account_id_user_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.transfers
    ADD CONSTRAINT transfers_target_account_id_user_id_fkey FOREIGN KEY (target_account_id, user_id) REFERENCES hikyu.accounts(id, user_id);


--
-- Name: transfers transfers_user_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.transfers
    ADD CONSTRAINT transfers_user_id_fkey FOREIGN KEY (user_id) REFERENCES hikyu.users(id);


--
-- Name: user_preferences user_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: hikyu; Owner: -
--

ALTER TABLE ONLY hikyu.user_preferences
    ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES hikyu.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict dKwtLwrGTPLwDpGXOYb9ci3F6enldmydmMVTDgvB2mOpU14xfHk3zUD2AvcFenh

