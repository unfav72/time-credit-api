-- ============================================================================
-- MIGRATION 005: SEQUENCE SYNCHRONIZATION & NOTIFICATION SCHEMA SAFEGUARD
-- ============================================================================

DO $$
BEGIN
    -- Ensure columns exist in notifications
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'notification_type') THEN
            ALTER TABLE notifications ADD COLUMN notification_type VARCHAR(50) DEFAULT 'SYSTEM';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'action_url') THEN
            ALTER TABLE notifications ADD COLUMN action_url VARCHAR(255) DEFAULT NULL;
        END IF;
    END IF;

    -- Synchronize all table sequences with existing MAX(id) to prevent duplicate key violations on registration/insert
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'users_id_seq') THEN
        PERFORM setval('users_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM users), 1));
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'skill_categories_id_seq') THEN
        PERFORM setval('skill_categories_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM skill_categories), 1));
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'skills_id_seq') THEN
        PERFORM setval('skills_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM skills), 1));
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'user_skills_id_seq') THEN
        PERFORM setval('user_skills_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM user_skills), 1));
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'service_offers_id_seq') THEN
        PERFORM setval('service_offers_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM service_offers), 1));
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'service_requests_id_seq') THEN
        PERFORM setval('service_requests_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM service_requests), 1));
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sessions_id_seq') THEN
        PERFORM setval('sessions_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM sessions), 1));
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'credit_accounts_id_seq') THEN
        PERFORM setval('credit_accounts_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM credit_accounts), 1));
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'credit_topup_orders_id_seq') THEN
        PERFORM setval('credit_topup_orders_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM credit_topup_orders), 1));
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'credit_transactions_id_seq') THEN
        PERFORM setval('credit_transactions_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM credit_transactions), 1));
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'credit_ledger_entries_id_seq') THEN
        PERFORM setval('credit_ledger_entries_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM credit_ledger_entries), 1));
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'reviews_id_seq') THEN
        PERFORM setval('reviews_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM reviews), 1));
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'notifications_id_seq') THEN
        PERFORM setval('notifications_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM notifications), 1));
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'saved_queries_id_seq') THEN
        PERFORM setval('saved_queries_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM saved_queries), 1));
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'audit_logs_id_seq') THEN
        PERFORM setval('audit_logs_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM audit_logs), 1));
    END IF;
END $$;
