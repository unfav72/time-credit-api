-- ============================================================================
-- TIMECREDIT LIVE: COMPLETE POSTGRESQL DATABASE SETUP FOR NEON
-- (Schema + Views + Triggers + Stored Procedures + Seed Data + Sequence Sync)
-- Web console: Simply paste this entire script into Neon SQL Editor and click RUN.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: CLEANUP EXISTING OBJECTS
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS v_popular_skills CASCADE;
DROP VIEW IF EXISTS v_teacher_leaderboard CASCADE;
DROP VIEW IF EXISTS v_active_sessions CASCADE;
DROP VIEW IF EXISTS v_user_credit_summary CASCADE;

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
-- STEP 2: TIMESTAMP TRIGGER FUNCTION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- STEP 3: RELATIONAL TABLES (3NF / BCNF Architecture)
-- ----------------------------------------------------------------------------

-- 1. Users
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

-- 2. Skill Categories
CREATE TABLE skill_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255) DEFAULT NULL,
    icon VARCHAR(50) DEFAULT 'book-open',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Skills
CREATE TABLE skills (
    id SERIAL PRIMARY KEY,
    category_id INT NOT NULL REFERENCES skill_categories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    name VARCHAR(120) NOT NULL UNIQUE,
    description TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_skills_category ON skills(category_id);
CREATE INDEX idx_skills_name ON skills(name);

-- 4. User Skills (Many-to-Many Bridge Table)
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

-- 5. Service Offers
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

-- 6. Service Requests
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

-- 7. Live Sessions
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

-- 8. Session Participants
CREATE TABLE session_participants (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    joined_at TIMESTAMP NOT NULL,
    left_at TIMESTAMP DEFAULT NULL,
    eligible_duration_minutes INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_participants_session ON session_participants(session_id);

-- 9. Credit Accounts (User Wallet Ledger Balances)
CREATE TABLE credit_accounts (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    balance NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0.00),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER trg_credit_accounts_updated_at BEFORE UPDATE ON credit_accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 10. Credit Top-Up Orders (Razorpay Integration)
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

-- 11. Payment Webhook Events
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

-- 12. Credit Transactions
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

-- 13. Credit Ledger Entries (Double-Entry Bookkeeping)
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

-- 14. Reviews
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

-- 15. Notifications
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL DEFAULT 'SYSTEM' CHECK (notification_type IN ('SYSTEM', 'REQUEST_RECEIVED', 'REQUEST_ACCEPTED', 'REQUEST_REJECTED', 'SESSION_SCHEDULED', 'SESSION_COMPLETED', 'PAYMENT_SUCCESS', 'SECURITY')),
    action_url VARCHAR(255) DEFAULT NULL,
    read_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read_at);

-- 16. Chat Messages
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_chat_session ON chat_messages(session_id);

-- 17. Saved Queries (SQL Query Lab)
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

-- 18. Query History (Audit & Analytics)
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

-- 19. Audit Logs
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

-- 20. Session Signals (WebRTC P2P Live Streaming)
CREATE TABLE IF NOT EXISTS session_signals (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signal_type VARCHAR(50) NOT NULL,
    payload TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_signals_session ON session_signals(session_id, id);

-- 21. Friendships & Social Graph
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

-- 22. Direct Messages
CREATE TABLE IF NOT EXISTS direct_messages (
    id SERIAL PRIMARY KEY,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dm_thread ON direct_messages(sender_id, receiver_id, id);


-- ----------------------------------------------------------------------------
-- STEP 4: VIEWS
-- ----------------------------------------------------------------------------

-- 1. Popular Skills View
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

-- 2. Teacher Leaderboard View
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


-- ----------------------------------------------------------------------------
-- STEP 5: REGISTRATION TRIGGER & STORED PROCEDURE
-- ----------------------------------------------------------------------------

-- Trigger: Signup Bonus Credits
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


-- Stored Procedure: Atomic Session Settlement
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
    SELECT COUNT(*) INTO v_existing_count 
    FROM credit_transactions 
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_count > 0 THEN
        p_status_code := 'ALREADY_SETTLED';
        p_transferred_credits := 0.00;
        RETURN;
    END IF;

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

    IF p_actual_duration_mins < 10 THEN
        v_calculated_credits := 0.00;
    ELSE
        v_calculated_credits := ROUND(((p_actual_duration_mins / 60.0) * v_credit_rate)::numeric, 2);
    END IF;

    IF v_teacher_id < v_learner_id THEN
        SELECT id INTO v_teacher_acc_id FROM credit_accounts WHERE user_id = v_teacher_id FOR UPDATE;
        SELECT id, balance INTO v_learner_acc_id, v_learner_balance FROM credit_accounts WHERE user_id = v_learner_id FOR UPDATE;
    ELSE
        SELECT id, balance INTO v_learner_acc_id, v_learner_balance FROM credit_accounts WHERE user_id = v_learner_id FOR UPDATE;
        SELECT id INTO v_teacher_acc_id FROM credit_accounts WHERE user_id = v_teacher_id FOR UPDATE;
    END IF;

    IF v_learner_balance < v_calculated_credits THEN
        p_status_code := 'INSUFFICIENT_CREDITS';
        p_transferred_credits := 0.00;
        RETURN;
    END IF;

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

    UPDATE sessions
    SET status = 'COMPLETED',
        actual_end_at = CURRENT_TIMESTAMP,
        eligible_duration_minutes = p_actual_duration_mins
    WHERE id = p_session_id;

    UPDATE service_requests
    SET status = 'Completed'
    WHERE id = (SELECT request_id FROM sessions WHERE id = p_session_id);

    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, reason, created_at)
    VALUES (v_learner_id, 'SESSION_COMPLETED', 'sessions', p_session_id, 
            'Session completed; duration: ' || p_actual_duration_mins || ' mins, transferred: ' || v_calculated_credits || ' TimeCredits.', CURRENT_TIMESTAMP);

    p_status_code := 'SUCCESS';
    p_transferred_credits := v_calculated_credits;
END;
$$;


-- ----------------------------------------------------------------------------
-- STEP 6: INITIAL SEED DATA
-- ----------------------------------------------------------------------------

-- Categories
INSERT INTO skill_categories (id, name, description, icon) VALUES
(1, 'Database Systems & SQL', 'Relational database design, query optimization, normalization, indexing, and ACID transactions.', 'database'),
(2, 'Web & Full-Stack Development', 'Modern web technologies, React, TypeScript, APIs, PWA, and backend engineering.', 'code'),
(3, 'Data Science & Machine Learning', 'Python, pandas, algorithms, statistics, neural networks, and data visualization.', 'cpu'),
(4, 'Computer Science Fundamentals', 'Data structures, algorithms, operating systems, and discrete mathematics.', 'book-open'),
(5, 'UI/UX & Claymorphism Design', 'User experience design, Figma, claymorphism, accessibility, and design systems.', 'palette'),
(6, 'Languages & Communication', 'Technical writing, English for engineering, and multilingual exchange.', 'globe')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Users (All have password: 'password123')
INSERT INTO users (id, full_name, email, password_hash, role, status, bio, created_at) VALUES
(1, 'Prof. Alex Chen (Admin)', 'admin@timecredit.live', '$2y$10$4n9LzO7N1z/r6xU.5xW1..vS8jH9W1V/mCj7o1tK4.c2Q5F0rA0n.', 'admin', 'active', 'DBMS Professor & Lead Architect of TimeCredit Live platform.', CURRENT_TIMESTAMP),
(2, 'Priya Patel', 'priya.patel@timecredit.live', '$2y$10$4n9LzO7N1z/r6xU.5xW1..vS8jH9W1V/mCj7o1tK4.c2Q5F0rA0n.', 'member', 'active', 'Senior Database Administrator & SQL Performance Tuning Enthusiast.', CURRENT_TIMESTAMP),
(3, 'Marcus Vance', 'marcus.vance@timecredit.live', '$2y$10$4n9LzO7N1z/r6xU.5xW1..vS8jH9W1V/mCj7o1tK4.c2Q5F0rA0n.', 'member', 'active', 'Full-stack developer passionate about React, TypeScript, and PWAs.', CURRENT_TIMESTAMP),
(4, 'Sara Kim', 'sara.kim@timecredit.live', '$2y$10$4n9LzO7N1z/r6xU.5xW1..vS8jH9W1V/mCj7o1tK4.c2Q5F0rA0n.', 'member', 'active', 'Product Designer specializing in Claymorphism, micro-interactions, and design systems.', CURRENT_TIMESTAMP),
(5, 'Aarav Sharma', 'aarav.sharma@timecredit.live', '$2y$10$4n9LzO7N1z/r6xU.5xW1..vS8jH9W1V/mCj7o1tK4.c2Q5F0rA0n.', 'member', 'active', 'Computer Science Junior enthusiastic about Machine Learning and Query Optimization.', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- Skills
INSERT INTO skills (id, category_id, name, description) VALUES
(1, 1, 'SQL Joins & Complex Queries', 'Mastering INNER JOIN, LEFT/RIGHT JOIN, FULL OUTER JOIN, self joins, and aggregation.'),
(2, 1, 'Database Normalization (1NF to BCNF)', 'Eliminating redundancy, functional dependencies, and lossless decomposition.'),
(3, 1, 'ACID Transactions & Row Locking', 'Understanding atomicity, consistency, isolation levels, row locks, and deadlock prevention.'),
(4, 2, 'React 19 & TypeScript Architecture', 'Component design systems, custom hooks, state machines, and performant UI patterns.'),
(5, 2, 'PWA & Service Worker Caching', 'Offline caching strategies, Web App Manifests, and background sync.'),
(6, 3, 'Pandas & SQL Data Pipelines', 'Bridging SQL queries with Python data science workflows and analysis.'),
(7, 5, 'Claymorphism 3D UI Design', 'Creating soft 3D clay depth, dual inset shadows, and accessible pastel aesthetics.'),
(8, 4, 'Graph & Tree Algorithms', 'DFS, BFS, Dijkstra, and Binary Search Trees with live whiteboard coding.')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- User Skills
INSERT INTO user_skills (user_id, skill_id, skill_type, experience_level) VALUES
(2, 1, 'OFFER', 'expert'),
(2, 2, 'OFFER', 'expert'),
(2, 3, 'OFFER', 'expert'),
(2, 6, 'WANT', 'beginner'),
(3, 4, 'OFFER', 'expert'),
(3, 5, 'OFFER', 'advanced'),
(3, 1, 'WANT', 'intermediate'),
(4, 7, 'OFFER', 'expert'),
(4, 4, 'WANT', 'beginner'),
(5, 6, 'OFFER', 'intermediate'),
(5, 2, 'WANT', 'beginner')
ON CONFLICT (user_id, skill_id, skill_type) DO UPDATE SET experience_level = EXCLUDED.experience_level;

-- Service Offers
INSERT INTO service_offers (id, teacher_id, skill_id, title, description, duration_minutes, credit_rate, experience_level, language, mode, status) VALUES
(1, 2, 1, 'Mastering Advanced SQL Joins & Subqueries', 'Interactive hands-on session solving real-world multi-table queries and query plans.', 60, 1.00, 'expert', 'English', 'online', 'active'),
(2, 2, 2, 'DBMS Normalization: 1NF to BCNF Step-by-Step', 'Learn functional dependencies, candidate keys, and how to decompose tables with zero anomaly.', 60, 1.00, 'expert', 'English', 'online', 'active'),
(3, 3, 4, 'Modern React & TypeScript Clean Architecture', 'Build resilient frontend apps with strict types, custom hooks, and scalable component structures.', 60, 1.00, 'advanced', 'English', 'online', 'active'),
(4, 4, 7, 'Claymorphism UI Workshop: Shadows & 3D Depth', 'Learn how to construct delightful 3D clay interfaces using CSS inset shadows and pastel palettes.', 45, 0.75, 'expert', 'English', 'online', 'active'),
(5, 5, 6, 'Data Wrangling: SQL into Pandas Dataframes', 'Export SQL result sets directly into Jupyter notebooks for cleaning and chart visualizations.', 30, 0.50, 'intermediate', 'English', 'online', 'active')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

-- Credit Accounts
INSERT INTO credit_accounts (id, user_id, balance, updated_at) VALUES
(1, 1, 15.00, CURRENT_TIMESTAMP),
(2, 2, 8.50, CURRENT_TIMESTAMP),
(3, 3, 4.00, CURRENT_TIMESTAMP),
(4, 4, 6.00, CURRENT_TIMESTAMP),
(5, 5, 3.50, CURRENT_TIMESTAMP)
ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance;

-- Requests
INSERT INTO service_requests (id, offer_id, learner_id, teacher_id, proposed_start_at, requested_duration_minutes, message, status, created_at) VALUES
(1, 1, 3, 2, CURRENT_TIMESTAMP - INTERVAL '2 days', 60, 'Would love your guidance on SQL Query Lab indexing and JOIN optimization!', 'Completed', CURRENT_TIMESTAMP - INTERVAL '3 days'),
(2, 2, 5, 2, CURRENT_TIMESTAMP - INTERVAL '1 day', 60, 'Need help preparing for SEM 5 DBMS Normalization university exam.', 'Completed', CURRENT_TIMESTAMP - INTERVAL '2 days'),
(3, 3, 4, 3, CURRENT_TIMESTAMP + INTERVAL '1 day', 60, 'Excited to integrate TypeScript with my new design system components.', 'Accepted', CURRENT_TIMESTAMP),
(4, 4, 5, 4, CURRENT_TIMESTAMP + INTERVAL '2 days', 45, 'Can you review my claymorphic card shadows and contrast ratios?', 'Pending', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

-- Sessions
INSERT INTO sessions (id, request_id, teacher_id, learner_id, scheduled_start_at, scheduled_end_at, actual_start_at, actual_end_at, eligible_duration_minutes, meeting_room_id, status) VALUES
(1, 1, 2, 3, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '1 hour', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '1 hour', 60, 'timecredit-session-priya-marcus-9021', 'COMPLETED'),
(2, 2, 2, 5, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day' + INTERVAL '1 hour', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day' + INTERVAL '1 hour', 60, 'timecredit-session-priya-aarav-8114', 'COMPLETED'),
(3, 3, 3, 4, CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '1 day' + INTERVAL '1 hour', NULL, NULL, 0, 'timecredit-session-marcus-sara-4521', 'SCHEDULED')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

-- Transactions & Ledger Entries
INSERT INTO credit_transactions (id, session_id, idempotency_key, transaction_type, status, created_at) VALUES
(1, 1, 'SETTLE_SESSION_1_TXN', 'SESSION_SETTLEMENT', 'COMMITTED', CURRENT_TIMESTAMP - INTERVAL '2 days'),
(2, 2, 'SETTLE_SESSION_2_TXN', 'SESSION_SETTLEMENT', 'COMMITTED', CURRENT_TIMESTAMP - INTERVAL '1 day')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

INSERT INTO credit_ledger_entries (id, transaction_id, account_id, entry_type, amount, created_at) VALUES
(1, 1, 3, 'DEBIT', 1.00, CURRENT_TIMESTAMP - INTERVAL '2 days'),
(2, 1, 2, 'CREDIT', 1.00, CURRENT_TIMESTAMP - INTERVAL '2 days'),
(3, 2, 5, 'DEBIT', 1.00, CURRENT_TIMESTAMP - INTERVAL '1 day'),
(4, 2, 2, 'CREDIT', 1.00, CURRENT_TIMESTAMP - INTERVAL '1 day')
ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount;

-- Reviews
INSERT INTO reviews (id, session_id, reviewer_id, reviewed_user_id, rating, comment, created_at) VALUES
(1, 1, 3, 2, 5, 'Priya is phenomenal! She explained query execution plans, hash joins, and B-Tree indexes so intuitively.', CURRENT_TIMESTAMP - INTERVAL '2 days'),
(2, 2, 5, 2, 5, 'The 3NF vs BCNF examples were crystal clear. Earned every bit of the TimeCredit!', CURRENT_TIMESTAMP - INTERVAL '1 day')
ON CONFLICT (id) DO UPDATE SET rating = EXCLUDED.rating;

-- Notifications
INSERT INTO notifications (id, user_id, title, message, read_at, created_at) VALUES
(1, 2, 'Credits Received!', 'You earned 1.00 TimeCredit for your completed session with Marcus Vance.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP - INTERVAL '2 days'),
(2, 3, 'Session Completed', 'Your session with Priya Patel was completed. 1.00 TimeCredit has been settled.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP - INTERVAL '2 days'),
(3, 4, 'Request Accepted', 'Marcus Vance accepted your request for "Modern React & TypeScript Architecture"!', NULL, CURRENT_TIMESTAMP),
(4, 5, 'Welcome to TimeCredit Live', 'Welcome! 2.00 signup bonus TimeCredits have been credited to your wallet.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP - INTERVAL '5 days')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

-- Saved Queries for SQL Lab
INSERT INTO saved_queries (id, user_id, title, sql_text, description) VALUES
(1, 1, 'Top Rated Teachers Report', 'SELECT u.full_name, COUNT(s.id) AS sessions_taught, ROUND(AVG(r.rating)::numeric, 2) AS avg_rating
FROM users u
JOIN sessions s ON u.id = s.teacher_id
LEFT JOIN reviews r ON s.id = r.session_id
WHERE s.status = ''COMPLETED''
GROUP BY u.id, u.full_name
ORDER BY avg_rating DESC;', 'Demonstrates JOIN, GROUP BY, aggregate functions, and ORDER BY'),
(2, 1, 'Double-Entry Ledger Audit Check', 'SELECT ct.id AS txn_id, ct.transaction_type, 
       SUM(CASE WHEN cle.entry_type = ''DEBIT'' THEN cle.amount ELSE 0 END) AS total_debit,
       SUM(CASE WHEN cle.entry_type = ''CREDIT'' THEN cle.amount ELSE 0 END) AS total_credit
FROM credit_transactions ct
JOIN credit_ledger_entries cle ON ct.id = cle.transaction_id
GROUP BY ct.id, ct.transaction_type
HAVING SUM(CASE WHEN cle.entry_type = ''DEBIT'' THEN cle.amount ELSE 0 END) <> SUM(CASE WHEN cle.entry_type = ''CREDIT'' THEN cle.amount ELSE 0 END);', 'Verifies double-entry consistency (DEBIT sum must equal CREDIT sum).'),
(3, 1, 'Skills Match Matrix', 'SELECT o.full_name AS teacher, w.full_name AS learner, s.name AS matched_skill
FROM user_skills us_o
JOIN user_skills us_w ON us_o.skill_id = us_w.skill_id AND us_o.skill_type = ''OFFER'' AND us_w.skill_type = ''WANT''
JOIN users o ON us_o.user_id = o.id
JOIN users w ON us_w.user_id = w.id
JOIN skills s ON us_o.skill_id = s.id
WHERE o.id <> w.id;', 'Demonstrates self-join logic matching teachers offering skills to learners seeking them.')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

-- ----------------------------------------------------------------------------
-- STEP 7: AUTO-INCREMENT SEQUENCE SYNCHRONIZATION
-- ----------------------------------------------------------------------------
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1));
SELECT setval('skill_categories_id_seq', COALESCE((SELECT MAX(id) FROM skill_categories), 1));
SELECT setval('skills_id_seq', COALESCE((SELECT MAX(id) FROM skills), 1));
SELECT setval('user_skills_id_seq', COALESCE((SELECT MAX(id) FROM user_skills), 1));
SELECT setval('service_offers_id_seq', COALESCE((SELECT MAX(id) FROM service_offers), 1));
SELECT setval('service_requests_id_seq', COALESCE((SELECT MAX(id) FROM service_requests), 1));
SELECT setval('sessions_id_seq', COALESCE((SELECT MAX(id) FROM sessions), 1));
SELECT setval('credit_accounts_id_seq', COALESCE((SELECT MAX(id) FROM credit_accounts), 1));
SELECT setval('credit_topup_orders_id_seq', COALESCE((SELECT MAX(id) FROM credit_topup_orders), 1));
SELECT setval('credit_transactions_id_seq', COALESCE((SELECT MAX(id) FROM credit_transactions), 1));
SELECT setval('credit_ledger_entries_id_seq', COALESCE((SELECT MAX(id) FROM credit_ledger_entries), 1));
SELECT setval('reviews_id_seq', COALESCE((SELECT MAX(id) FROM reviews), 1));
SELECT setval('notifications_id_seq', COALESCE((SELECT MAX(id) FROM notifications), 1));
SELECT setval('saved_queries_id_seq', COALESCE((SELECT MAX(id) FROM saved_queries), 1));
SELECT setval('audit_logs_id_seq', COALESCE((SELECT MAX(id) FROM audit_logs), 1));
SELECT setval('session_signals_id_seq', COALESCE((SELECT MAX(id) FROM session_signals), 1));
SELECT setval('friendships_id_seq', COALESCE((SELECT MAX(id) FROM friendships), 1));
SELECT setval('direct_messages_id_seq', COALESCE((SELECT MAX(id) FROM direct_messages), 1));
