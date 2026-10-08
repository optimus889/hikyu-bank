-- Local and cloud run the same PostgreSQL constraints and verification.
CREATE FUNCTION hikyu.guard_subject() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
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
CREATE TRIGGER recipient_owner_guard BEFORE INSERT OR UPDATE
    ON hikyu.notification_recipients FOR EACH ROW EXECUTE FUNCTION hikyu.guard_subject();
CREATE TRIGGER notification_link_guard BEFORE INSERT OR UPDATE
    ON hikyu.notification_account_links FOR EACH ROW EXECUTE FUNCTION hikyu.guard_subject();

CREATE FUNCTION hikyu.guard_identity() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
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
CREATE TRIGGER users_identity_guard BEFORE UPDATE ON hikyu.users
    FOR EACH ROW EXECUTE FUNCTION hikyu.guard_identity();
CREATE TRIGGER accounts_identity_guard BEFORE UPDATE ON hikyu.accounts
    FOR EACH ROW EXECUTE FUNCTION hikyu.guard_identity();
CREATE TRIGGER transactions_identity_guard BEFORE UPDATE ON hikyu.transactions
    FOR EACH ROW EXECUTE FUNCTION hikyu.guard_identity();
CREATE TRIGGER alerts_identity_guard BEFORE UPDATE ON hikyu.alerts
    FOR EACH ROW EXECUTE FUNCTION hikyu.guard_identity();
CREATE TRIGGER notifications_identity_guard BEFORE UPDATE ON hikyu.notifications
    FOR EACH ROW EXECUTE FUNCTION hikyu.guard_identity();

ALTER TABLE hikyu.accounts ADD CONSTRAINT accounts_finite_money CHECK (
    balance <> 'NaN'::NUMERIC
    AND (credit_limit IS NULL OR credit_limit <> 'NaN'::NUMERIC)
    AND (minimum_due IS NULL OR minimum_due <> 'NaN'::NUMERIC)
);
ALTER TABLE hikyu.transactions ADD CONSTRAINT transactions_finite_money
    CHECK (amount <> 'NaN'::NUMERIC);
ALTER TABLE hikyu.alerts ADD CONSTRAINT alerts_finite_money
    CHECK (amount IS NULL OR amount <> 'NaN'::NUMERIC);

-- Abort on missing rows, broken ownership or changed monetary values.
DO $$
DECLARE entity TEXT;
DECLARE old_count BIGINT;
DECLARE new_count BIGINT;
BEGIN
    FOREACH entity IN ARRAY ARRAY['users', 'accounts', 'transactions', 'alerts', 'notifications']
    LOOP
        EXECUTE format('SELECT count(*) FROM hikyu_v1_archive.%I', entity) INTO old_count;
        EXECUTE format('SELECT count(*) FROM hikyu.%I', entity) INTO new_count;
        IF old_count <> new_count THEN
            RAISE EXCEPTION 'Row count mismatch in %: old %, new %', entity, old_count, new_count;
        END IF;
    END LOOP;
    IF EXISTS (
        SELECT 1 FROM hikyu_v1_archive.accounts old
        JOIN hikyu_migration.id_map m ON m.entity_type = 'accounts' AND m.legacy_id = old.id
        JOIN hikyu.accounts new ON new.id = m.new_id
        WHERE old.balance IS DISTINCT FROM new.balance
    ) THEN
        RAISE EXCEPTION 'Account balance changed during migration';
    END IF;
    IF EXISTS (
        SELECT 1 FROM hikyu_v1_archive.users old
        JOIN hikyu.users new ON new.username = old.username
        WHERE new.password_hash IS DISTINCT FROM old.password_hash
            OR new.pin_hash IS DISTINCT FROM old.pin_hash
            OR COALESCE(new.display_name, new.first_name || ' ' || new.last_name) <> old.name
    ) THEN
        RAISE EXCEPTION 'User credentials or display name changed during migration';
    END IF;
    IF EXISTS (
        SELECT 1 FROM hikyu_v1_archive.transactions old
        JOIN hikyu_migration.id_map m ON m.entity_type = 'transactions' AND m.legacy_id = old.id
        JOIN hikyu.transactions new ON new.id = m.new_id
        WHERE (to_jsonb(old) - 'id' - 'user_id' - 'account_id')
            IS DISTINCT FROM (to_jsonb(new) - 'id' - 'account_id')
    ) THEN
        RAISE EXCEPTION 'Transaction payload changed during migration';
    END IF;
    IF EXISTS (
        SELECT 1 FROM hikyu_v1_archive.alerts old
        JOIN hikyu_migration.id_map m ON m.entity_type = 'alerts' AND m.legacy_id = old.id
        JOIN hikyu.alerts new ON new.id = m.new_id
        WHERE (to_jsonb(old) - 'id' - 'user_id' - 'account_id')
            IS DISTINCT FROM (to_jsonb(new) - 'id' - 'account_id')
    ) THEN
        RAISE EXCEPTION 'Alert payload changed during migration';
    END IF;
    IF EXISTS (
        SELECT 1 FROM hikyu_v1_archive.notifications old
        JOIN hikyu_migration.id_map m ON m.entity_type = 'notifications' AND m.legacy_id = old.id
        JOIN hikyu.notifications new ON new.id = m.new_id
        JOIN hikyu.notification_recipients recipient ON recipient.notification_id = new.id
        WHERE new.title IS DISTINCT FROM old.title OR new.body IS DISTINCT FROM old.body
            OR new.created_at IS DISTINCT FROM old.created_at OR new.source IS DISTINCT FROM old.source
            OR recipient.is_read IS DISTINCT FROM old.is_read
            OR recipient.resolved IS DISTINCT FROM old.resolved
    ) THEN
        RAISE EXCEPTION 'Notification snapshot or inbox state changed during migration';
    END IF;
    IF EXISTS (
        SELECT 1 FROM hikyu.notification_recipients r
        JOIN hikyu.notifications n ON n.id = r.notification_id
        JOIN hikyu.alerts a ON a.id = n.alert_id
        JOIN hikyu.accounts acc ON acc.id = a.account_id
        WHERE r.user_id <> acc.user_id
    ) THEN
        RAISE EXCEPTION 'Notification ownership mismatch';
    END IF;
END $$;

-- Archived data is a rollback snapshot, never an alternative live write target.
CREATE FUNCTION hikyu_migration.reject_archive_write() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'V1 archive is read-only; use a reviewed recovery procedure';
END $$;
DO $$
DECLARE entity TEXT;
BEGIN
    FOREACH entity IN ARRAY ARRAY['users', 'accounts', 'transactions', 'alerts', 'notifications']
    LOOP
        EXECUTE format(
            'CREATE TRIGGER archive_read_only BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON hikyu_v1_archive.%I '
            'FOR EACH STATEMENT EXECUTE FUNCTION hikyu_migration.reject_archive_write()', entity
        );
    END LOOP;
END $$;
