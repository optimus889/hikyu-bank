-- Run in a maintenance window after a verified backup. V1 remains unchanged.
CREATE SCHEMA hikyu_migration;
REVOKE ALL ON SCHEMA hikyu_migration FROM PUBLIC;

CREATE TABLE hikyu_migration.id_map (
    entity_type VARCHAR(30) NOT NULL,
    legacy_id TEXT NOT NULL,
    new_id UUID NOT NULL,
    PRIMARY KEY (entity_type, legacy_id),
    UNIQUE (entity_type, new_id)
);

-- Preserve existing UUID values; allocate each legacy identity exactly once.
DO $$
DECLARE
    entity TEXT;
    bad_id TEXT;
BEGIN
    FOREACH entity IN ARRAY ARRAY['users', 'accounts', 'transactions', 'alerts', 'notifications']
    LOOP
        EXECUTE format($q$
            INSERT INTO hikyu_migration.id_map (entity_type, legacy_id, new_id)
            SELECT %L, id,
                CASE WHEN id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN id::UUID ELSE gen_random_uuid() END
            FROM hikyu.%I
        $q$, entity, entity);
    END LOOP;

    SELECT problems.entity || ':' || problems.id INTO bad_id FROM (
        SELECT 'accounts' AS entity, a.id
        FROM hikyu.accounts a LEFT JOIN hikyu.users u ON u.id = a.user_id
        WHERE u.id IS NULL
        UNION ALL
        SELECT 'transactions', t.id FROM hikyu.transactions t
        LEFT JOIN hikyu.accounts a ON a.id = t.account_id
        WHERE a.id IS NULL OR a.user_id IS DISTINCT FROM t.user_id
        UNION ALL
        SELECT 'alerts', r.id FROM hikyu.alerts r
        LEFT JOIN hikyu.accounts a ON a.id = r.account_id
        WHERE a.id IS NULL OR a.user_id IS DISTINCT FROM r.user_id
        UNION ALL
        SELECT 'notifications', n.id FROM hikyu.notifications n
        LEFT JOIN hikyu.users u ON u.id = n.user_id
        LEFT JOIN hikyu.accounts a ON a.id = n.account_id
        LEFT JOIN hikyu.alerts r ON r.id = n.alert_id
        WHERE u.id IS NULL
            OR (n.account_id IS NOT NULL AND (a.id IS NULL OR a.user_id IS DISTINCT FROM n.user_id))
            OR (n.alert_id IS NOT NULL AND (r.id IS NULL OR r.user_id IS DISTINCT FROM n.user_id))
    ) problems LIMIT 1;
    IF bad_id IS NOT NULL THEN
        RAISE EXCEPTION 'Invalid ownership or orphan row %; review before migration', bad_id;
    END IF;

    SELECT id INTO bad_id FROM hikyu.accounts
    WHERE balance = 'NaN'::NUMERIC OR credit_limit = 'NaN'::NUMERIC
        OR minimum_due = 'NaN'::NUMERIC LIMIT 1;
    IF bad_id IS NOT NULL THEN
        RAISE EXCEPTION 'Account % has NaN money; review before migration', bad_id;
    END IF;
    SELECT id INTO bad_id FROM hikyu.transactions WHERE amount = 'NaN'::NUMERIC LIMIT 1;
    IF bad_id IS NOT NULL THEN
        RAISE EXCEPTION 'Transaction % has NaN money; review before migration', bad_id;
    END IF;
    SELECT id INTO bad_id FROM hikyu.alerts WHERE amount = 'NaN'::NUMERIC LIMIT 1;
    IF bad_id IS NOT NULL THEN
        RAISE EXCEPTION 'Alert % has NaN money; review before migration', bad_id;
    END IF;

    SELECT n.id INTO bad_id
    FROM hikyu.notifications n
    JOIN hikyu.alerts a ON a.id = n.alert_id
    WHERE n.account_id IS NOT NULL AND n.account_id <> a.account_id
    LIMIT 1;
    IF bad_id IS NOT NULL THEN
        RAISE EXCEPTION 'Notification % references a different account than its alert', bad_id;
    END IF;

    SELECT id INTO bad_id FROM hikyu.notifications
    WHERE resolved AND NOT is_read LIMIT 1;
    IF bad_id IS NOT NULL THEN
        RAISE EXCEPTION 'Notification % is resolved but unread; review before migration', bad_id;
    END IF;
END $$;
