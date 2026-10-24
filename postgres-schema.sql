-- ============================================================================
-- TIMECREDIT LIVE: POSTGRESQL PRODUCTION DATABASE SCHEMA
-- Compatible with Neon Serverless PostgreSQL (https://neon.tech), Supabase & standard PostgreSQL 14+
-- Demonstrates: 3NF/BCNF Normalization, Constraints, Cascades, Indexes,
--               Triggers, Views, Stored Procedures, and Double-Entry Ledger.
-- ============================================================================

-- Drop views in reverse dependency order if resetting
DROP VIEW IF EXISTS v_popular_skills CASCADE;
DROP VIEW IF EXISTS v_teacher_leaderboard CASCADE;
DROP VIEW IF EXISTS v_active_sessions CASCADE;
DROP VIEW IF EXISTS v_user_credit_summary CASCADE;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS query_history CASCADE;
DROP TABLE IF EXISTS saved_queries CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS payment_webhook_events CASCADE;
DROP TABLE IF EXISTS credit_ledger_entries CASCADE;
DROP TABLE IF EXISTS credit_transactions CASCADE;
DROP TABLE IF EXISTS credit_topup_orders CASCADE;
DROP TABLE IF EXISTS credit_accounts CASCADE;
DROP TABLE IF EXISTS session_participants CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS service_requests CASCADE;
DROP TABLE IF EXISTS service_offers CASCADE;
DROP TABLE IF EXISTS user_skills CASCADE;
DROP TABLE IF EXISTS skills CASCADE;
DROP TABLE IF EXISTS skill_categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ----------------------------------------------------------------------------
-- TRIGGER FUNCTION: Universal timestamp updater for updated_at columns
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 1. USERS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
    bio TEXT DEFAULT NULL,
    avatar_url VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. SKILL CATEGORIES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE skill_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255) DEFAULT NULL,
    icon VARCHAR(50) DEFAULT 'book-open',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 3. SKILLS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE skills (
    id SERIAL PRIMARY KEY,
    category_id INT NOT NULL REFERENCES skill_categories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    name VARCHAR(120) NOT NULL UNIQUE,
    description TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_skills_category ON skills(category_id);
CREATE INDEX idx_skills_name ON skills(name);

-- ----------------------------------------------------------------------------
-- 4. USER SKILLS (Many-to-Many Bridge Table)
-- ----------------------------------------------------------------------------
CREATE TABLE user_skills (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    skill_id INT NOT NULL REFERENCES skills(id) ON DELETE CASCADE ON UPDATE CASCADE,
    skill_type VARCHAR(10) NOT NULL CHECK (skill_type IN ('OFFER', 'WANT')),
    experience_level VARCHAR(20) NOT NULL DEFAULT 'intermediate' CHECK (experience_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_user_skill_type UNIQUE (user_id, skill_id, skill_type)
);
CREATE INDEX idx_user_skills_type ON user_skills(skill_type);

-- ----------------------------------------------------------------------------
-- 5. SERVICE OFFERS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE service_offers (
    id SERIAL PRIMARY KEY,
    teacher_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    skill_id INT NOT NULL REFERENCES skills(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 60,
    credit_rate NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
    experience_level VARCHAR(20) NOT NULL DEFAULT 'intermediate' CHECK (experience_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    language VARCHAR(50) NOT NULL DEFAULT 'English',
    mode VARCHAR(20) NOT NULL DEFAULT 'online' CHECK (mode IN ('online', 'in-person')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_offers_status ON service_offers(status);
CREATE INDEX idx_offers_skill ON service_offers(skill_id);
CREATE TRIGGER trg_service_offers_updated_at BEFORE UPDATE ON service_offers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. SERVICE REQUESTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE service_requests (
    id SERIAL PRIMARY KEY,
    offer_id INT NOT NULL REFERENCES service_offers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    learner_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    teacher_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    proposed_start_at TIMESTAMP NOT NULL,
    requested_duration_minutes INT NOT NULL DEFAULT 60,
    message TEXT DEFAULT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Rejected', 'Cancelled', 'Scheduled', 'Completed', 'Disputed')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_requests_status ON service_requests(status);
CREATE INDEX idx_requests_learner ON service_requests(learner_id);
CREATE INDEX idx_requests_teacher ON service_requests(teacher_id);
CREATE TRIGGER trg_service_requests_updated_at BEFORE UPDATE ON service_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- 7. SESSIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    request_id INT NOT NULL UNIQUE REFERENCES service_requests(id) ON DELETE CASCADE ON UPDATE CASCADE,
    teacher_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    learner_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    scheduled_start_at TIMESTAMP NOT NULL,
    scheduled_end_at TIMESTAMP NOT NULL,
    actual_start_at TIMESTAMP DEFAULT NULL,
    actual_end_at TIMESTAMP DEFAULT NULL,
    eligible_duration_minutes INT NOT NULL DEFAULT 0,
    meeting_room_id VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_scheduled_start ON sessions(scheduled_start_at);
CREATE TRIGGER trg_sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- 8. SESSION PARTICIPANTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE session_participants (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    joined_at TIMESTAMP NOT NULL,
    left_at TIMESTAMP DEFAULT NULL,
    eligible_duration_minutes INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_participants_session ON session_participants(session_id);

-- ----------------------------------------------------------------------------
-- 9. CREDIT ACCOUNTS TABLE (Wallet Ledger Balance)
-- ----------------------------------------------------------------------------
CREATE TABLE credit_accounts (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    balance NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0.00),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER trg_credit_accounts_updated_at BEFORE UPDATE ON credit_accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- 10. CREDIT TOP-UP ORDERS TABLE (Razorpay Payment Integration)
-- ----------------------------------------------------------------------------
CREATE TABLE credit_topup_orders (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    package_id VARCHAR(50) NOT NULL,
    credits NUMERIC(10, 2) NOT NULL,
    amount_paise INT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    razorpay_order_id VARCHAR(100) NOT NULL UNIQUE,
    razorpay_payment_id VARCHAR(100) DEFAULT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP DEFAULT NULL,
    fulfilled_at TIMESTAMP DEFAULT NULL
);
CREATE INDEX idx_topup_user ON credit_topup_orders(user_id);
CREATE INDEX idx_topup_status ON credit_topup_orders(status);
CREATE INDEX idx_topup_payment ON credit_topup_orders(razorpay_payment_id);

-- ----------------------------------------------------------------------------
-- 11. PAYMENT WEBHOOK EVENTS TABLE (Duplicate Prevention)
-- ----------------------------------------------------------------------------
CREATE TABLE payment_webhook_events (
    id SERIAL PRIMARY KEY,
    provider_event_id VARCHAR(150) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    processing_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (processing_status IN ('PENDING', 'PROCESSED', 'FAILED', 'IGNORED')),
    payload JSONB DEFAULT NULL,
    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP DEFAULT NULL
);
CREATE INDEX idx_webhook_event_type ON payment_webhook_events(event_type);
CREATE INDEX idx_webhook_status ON payment_webhook_events(processing_status);

-- ----------------------------------------------------------------------------
-- 12. CREDIT TRANSACTIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE credit_transactions (
    id SERIAL PRIMARY KEY,
    session_id INT DEFAULT NULL REFERENCES sessions(id) ON DELETE SET NULL ON UPDATE CASCADE,
    topup_order_id INT DEFAULT NULL REFERENCES credit_topup_orders(id) ON DELETE SET NULL ON UPDATE CASCADE,
    idempotency_key VARCHAR(120) NOT NULL UNIQUE,
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('SESSION_SETTLEMENT', 'SIGNUP_BONUS', 'ADMIN_ADJUSTMENT', 'REFUND', 'PURCHASE')),
    status VARCHAR(20) NOT NULL DEFAULT 'COMMITTED' CHECK (status IN ('PENDING', 'COMMITTED', 'FAILED', 'REVERSED')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX idx_transactions_topup ON credit_transactions(topup_order_id);
CREATE INDEX idx_transactions_created ON credit_transactions(created_at);

-- ----------------------------------------------------------------------------
-- 13. CREDIT LEDGER ENTRIES (Double-entry accounting)
-- ----------------------------------------------------------------------------
CREATE TABLE credit_ledger_entries (
    id SERIAL PRIMARY KEY,
    transaction_id INT NOT NULL REFERENCES credit_transactions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    account_id INT NOT NULL REFERENCES credit_accounts(id) ON DELETE CASCADE ON UPDATE CASCADE,
    entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT')),
    amount NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_ledger_account ON credit_ledger_entries(account_id);
CREATE INDEX idx_ledger_transaction ON credit_ledger_entries(transaction_id);

-- ----------------------------------------------------------------------------
-- 14. REVIEWS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    reviewer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    reviewed_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_session_reviewer UNIQUE (session_id, reviewer_id)
);

-- ----------------------------------------------------------------------------
-- 15. NOTIFICATIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    read_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read_at);

-- ----------------------------------------------------------------------------
-- 16. CHAT MESSAGES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_chat_session ON chat_messages(session_id);

-- ----------------------------------------------------------------------------
-- 17. SAVED QUERIES (SQL Query Lab)
-- ----------------------------------------------------------------------------
CREATE TABLE saved_queries (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    title VARCHAR(150) NOT NULL,
    sql_text TEXT NOT NULL,
    description VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_saved_queries_user ON saved_queries(user_id);
CREATE TRIGGER trg_saved_queries_updated_at BEFORE UPDATE ON saved_queries FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- 18. QUERY HISTORY (Audit & Analytics)
-- ----------------------------------------------------------------------------
CREATE TABLE query_history (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    query_text TEXT NOT NULL,
    query_type VARCHAR(30) NOT NULL,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    rows_affected INT NOT NULL DEFAULT 0,
    execution_time_ms NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    error_message TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_query_history_user ON query_history(user_id);
CREATE INDEX idx_query_history_created ON query_history(created_at);

-- ----------------------------------------------------------------------------
-- 19. AUDIT LOGS
-- ----------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    actor_id INT DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT DEFAULT NULL,
    reason TEXT DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);


-- ============================================================================
-- VIEWS (DBMS Demonstration)
-- ============================================================================

-- 1. Popular Skills View: Aggregates offers, requests, and teacher ratings
CREATE VIEW v_popular_skills AS
SELECT 
    s.id AS skill_id,
    s.name AS skill_name,
    c.name AS category_name,
    COUNT(DISTINCT so.id) AS total_offers,
    COUNT(DISTINCT sr.id) AS total_requests,
    ROUND(AVG(r.rating)::numeric, 2) AS average_rating,
    COUNT(DISTINCT r.id) AS total_reviews
FROM skills s
JOIN skill_categories c ON s.category_id = c.id
LEFT JOIN service_offers so ON s.id = so.skill_id AND so.status = 'active'
LEFT JOIN service_requests sr ON so.id = sr.offer_id
LEFT JOIN sessions sess ON sr.id = sess.request_id AND sess.status = 'COMPLETED'
LEFT JOIN reviews r ON sess.id = r.session_id
GROUP BY s.id, s.name, c.name;

-- 2. Teacher Leaderboard View: Top instructors ranked by completed sessions & hours
CREATE VIEW v_teacher_leaderboard AS
SELECT 
    u.id AS teacher_id,
    u.full_name AS teacher_name,
    u.email AS teacher_email,
    COUNT(DISTINCT s.id) AS completed_sessions,
    ROUND(COALESCE(SUM(s.eligible_duration_minutes) / 60.0, 0)::numeric, 2) AS total_teaching_hours,
    ROUND(AVG(r.rating)::numeric, 2) AS average_rating,
    ca.balance AS current_time_credits
FROM users u
LEFT JOIN sessions s ON u.id = s.teacher_id AND s.status = 'COMPLETED'
LEFT JOIN reviews r ON s.id = r.session_id AND r.reviewed_user_id = u.id
LEFT JOIN credit_accounts ca ON u.id = ca.user_id
GROUP BY u.id, u.full_name, u.email, ca.balance
ORDER BY completed_sessions DESC, average_rating DESC NULLS LAST;

-- 3. Active Sessions View
CREATE VIEW v_active_sessions AS
SELECT 
    s.id AS session_id,
    s.meeting_room_id,
    s.status,
    s.scheduled_start_at,
    s.scheduled_end_at,
    t.full_name AS teacher_name,
    t.email AS teacher_email,
    l.full_name AS learner_id_name,
    l.email AS learner_email,
    so.title AS session_title,
    sk.name AS skill_name
FROM sessions s
JOIN service_requests sr ON s.request_id = sr.id
JOIN service_offers so ON sr.offer_id = so.id
JOIN skills sk ON so.skill_id = sk.id
JOIN users t ON s.teacher_id = t.id
JOIN users l ON s.learner_id = l.id
WHERE s.status IN ('SCHEDULED', 'IN_PROGRESS');

-- 4. User Credit Summary View
CREATE VIEW v_user_credit_summary AS
SELECT 
    u.id AS user_id,
    u.full_name,
    ca.balance AS available_balance,
    COALESCE(SUM(CASE WHEN le.entry_type = 'CREDIT' THEN le.amount ELSE 0 END), 0) AS total_credits_earned,
    COALESCE(SUM(CASE WHEN le.entry_type = 'DEBIT' THEN le.amount ELSE 0 END), 0) AS total_credits_spent,
    COUNT(le.id) AS total_ledger_entries
FROM users u
JOIN credit_accounts ca ON u.id = ca.user_id
LEFT JOIN credit_ledger_entries le ON ca.id = le.account_id
GROUP BY u.id, u.full_name, ca.balance;


-- ============================================================================
-- TRIGGERS & PROCEDURES (PostgreSQL Implementation)
-- ============================================================================

-- Trigger 1: Automatically initialize credit account with 2.0 bonus credits upon registration
CREATE OR REPLACE FUNCTION trg_after_user_insert_func()
RETURNS TRIGGER AS $$
DECLARE
    v_txn_id INT;
    v_acc_id INT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM credit_accounts WHERE user_id = NEW.id) THEN
        INSERT INTO credit_accounts (user_id, balance, updated_at)
        VALUES (NEW.id, 2.00, CURRENT_TIMESTAMP)
        RETURNING id INTO v_acc_id;

        INSERT INTO credit_transactions (session_id, topup_order_id, idempotency_key, transaction_type, status, created_at)
        VALUES (NULL, NULL, 'SIGNUP_BONUS_' || NEW.id || '_' || EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT, 'SIGNUP_BONUS', 'COMMITTED', CURRENT_TIMESTAMP)
        RETURNING id INTO v_txn_id;

        INSERT INTO credit_ledger_entries (transaction_id, account_id, entry_type, amount, created_at)
        VALUES (v_txn_id, v_acc_id, 'CREDIT', 2.00, CURRENT_TIMESTAMP);

        INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, reason, created_at)
        VALUES (NEW.id, 'USER_REGISTERED', 'users', NEW.id, 'New user registered; 2.00 welcome bonus TimeCredits deposited.', CURRENT_TIMESTAMP);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_after_user_insert
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION trg_after_user_insert_func();


-- Stored Procedure: Atomic settlement of live session credits
-- Enforces ACID properties, prevents double spending and duplicate transfers
CREATE OR REPLACE PROCEDURE sp_settle_session_credits(
    IN p_session_id INT,
    IN p_actual_duration_mins INT,
    IN p_idempotency_key VARCHAR(120),
    INOUT p_status_code VARCHAR(50) DEFAULT '',
    INOUT p_transferred_credits NUMERIC(10,2) DEFAULT 0.00
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_teacher_id INT;
    v_learner_id INT;
    v_session_status VARCHAR(30);
    v_credit_rate NUMERIC(4, 2);
    v_calculated_credits NUMERIC(10, 2);
    v_teacher_acc_id INT;
    v_learner_acc_id INT;
    v_learner_balance NUMERIC(10, 2);
    v_txn_id INT;
    v_existing_count INT;
BEGIN
    -- 1. Check idempotency: Ensure this transaction key has not been processed
    SELECT COUNT(*) INTO v_existing_count 
    FROM credit_transactions 
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_count > 0 THEN
        p_status_code := 'ALREADY_SETTLED';
        p_transferred_credits := 0.00;
        RETURN;
    END IF;

    -- 2. Lock the session row to prevent race conditions
    SELECT s.teacher_id, s.learner_id, s.status, so.credit_rate
    INTO v_teacher_id, v_learner_id, v_session_status, v_credit_rate
    FROM sessions s
    JOIN service_requests sr ON s.request_id = sr.id
    JOIN service_offers so ON sr.offer_id = so.id
    WHERE s.id = p_session_id
    FOR UPDATE;

    IF v_session_status IS NULL THEN
        p_status_code := 'SESSION_NOT_FOUND';
        p_transferred_credits := 0.00;
        RETURN;
    END IF;

    IF v_session_status = 'COMPLETED' THEN
        p_status_code := 'SESSION_ALREADY_COMPLETED';
        p_transferred_credits := 0.00;
        RETURN;
    END IF;

    -- 3. Calculate credit: 1 hour = 1.0 credit * rate, 30 min = 0.5 credit * rate
    IF p_actual_duration_mins < 10 THEN
        v_calculated_credits := 0.00;
    ELSE
        v_calculated_credits := ROUND(((p_actual_duration_mins / 60.0) * v_credit_rate)::numeric, 2);
    END IF;

    -- 4. Lock both credit accounts (ordered by user_id to prevent deadlocks)
    IF v_teacher_id < v_learner_id THEN
        SELECT id INTO v_teacher_acc_id FROM credit_accounts WHERE user_id = v_teacher_id FOR UPDATE;
        SELECT id, balance INTO v_learner_acc_id, v_learner_balance FROM credit_accounts WHERE user_id = v_learner_id FOR UPDATE;
    ELSE
        SELECT id, balance INTO v_learner_acc_id, v_learner_balance FROM credit_accounts WHERE user_id = v_learner_id FOR UPDATE;
        SELECT id INTO v_teacher_acc_id FROM credit_accounts WHERE user_id = v_teacher_id FOR UPDATE;
    END IF;

    -- 5. Verify learner balance
    IF v_learner_balance < v_calculated_credits THEN
        p_status_code := 'INSUFFICIENT_CREDITS';
        p_transferred_credits := 0.00;
        RETURN;
    END IF;

    -- 6. Perform Double-Entry Transfer if credits > 0
    IF v_calculated_credits > 0 THEN
        INSERT INTO credit_transactions (session_id, idempotency_key, transaction_type, status, created_at)
        VALUES (p_session_id, p_idempotency_key, 'SESSION_SETTLEMENT', 'COMMITTED', CURRENT_TIMESTAMP)
        RETURNING id INTO v_txn_id;

        INSERT INTO credit_ledger_entries (transaction_id, account_id, entry_type, amount, created_at)
        VALUES (v_txn_id, v_learner_acc_id, 'DEBIT', v_calculated_credits, CURRENT_TIMESTAMP);

        UPDATE credit_accounts
        SET balance = balance - v_calculated_credits
        WHERE id = v_learner_acc_id;

        INSERT INTO credit_ledger_entries (transaction_id, account_id, entry_type, amount, created_at)
        VALUES (v_txn_id, v_teacher_acc_id, 'CREDIT', v_calculated_credits, CURRENT_TIMESTAMP);

        UPDATE credit_accounts
        SET balance = balance + v_calculated_credits
        WHERE id = v_teacher_acc_id;
    END IF;

    -- 7. Update session status to COMPLETED
    UPDATE sessions
    SET status = 'COMPLETED',
        actual_end_at = CURRENT_TIMESTAMP,
        eligible_duration_minutes = p_actual_duration_mins
    WHERE id = p_session_id;

    UPDATE service_requests
    SET status = 'Completed'
    WHERE id = (SELECT request_id FROM sessions WHERE id = p_session_id);

    -- 8. Audit log entry
    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, reason, created_at)
    VALUES (v_learner_id, 'SESSION_COMPLETED', 'sessions', p_session_id, 
            'Session completed; duration: ' || p_actual_duration_mins || ' mins, transferred: ' || v_calculated_credits || ' TimeCredits.', CURRENT_TIMESTAMP);

    p_status_code := 'SUCCESS';
    p_transferred_credits := v_calculated_credits;
END;
$$;

-- ----------------------------------------------------------------------------
-- 20. SESSION SIGNALS (WebRTC P2P Live Streaming)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_signals (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signal_type VARCHAR(50) NOT NULL,
    payload TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_signals_session ON session_signals(session_id, id);

-- ----------------------------------------------------------------------------
-- 21. FRIENDSHIPS & SOCIAL GRAPH
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS friendships (
    id SERIAL PRIMARY KEY,
    user_id_1 INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id_2 INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED')),
    action_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_friendship UNIQUE (user_id_1, user_id_2)
);
CREATE INDEX IF NOT EXISTS idx_friendships_users ON friendships(user_id_1, user_id_2);

-- ----------------------------------------------------------------------------
-- 22. DIRECT MESSAGES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS direct_messages (
    id SERIAL PRIMARY KEY,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dm_thread ON direct_messages(sender_id, receiver_id, id);

-- SEQUENCE SYNCHRONIZATION
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'users_id_seq') THEN
        PERFORM setval('users_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM users), 1));
        PERFORM setval('skill_categories_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM skill_categories), 1));
        PERFORM setval('skills_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM skills), 1));
        PERFORM setval('user_skills_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM user_skills), 1));
        PERFORM setval('service_offers_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM service_offers), 1));
        PERFORM setval('service_requests_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM service_requests), 1));
        PERFORM setval('sessions_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM sessions), 1));
        PERFORM setval('credit_accounts_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM credit_accounts), 1));
        PERFORM setval('credit_transactions_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM credit_transactions), 1));
        PERFORM setval('credit_ledger_entries_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM credit_ledger_entries), 1));
        PERFORM setval('reviews_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM reviews), 1));
        PERFORM setval('notifications_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM notifications), 1));
        PERFORM setval('saved_queries_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM saved_queries), 1));
        PERFORM setval('audit_logs_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM audit_logs), 1));
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'session_signals_id_seq') THEN
            PERFORM setval('session_signals_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM session_signals), 1));
        END IF;
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'friendships_id_seq') THEN
            PERFORM setval('friendships_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM friendships), 1));
        END IF;
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'direct_messages_id_seq') THEN
            PERFORM setval('direct_messages_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM direct_messages), 1));
        END IF;
    END IF;
END $$;
