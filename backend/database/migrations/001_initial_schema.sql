-- ============================================================================
-- MIGRATION 001: INITIAL CORE RELATIONAL SCHEMA (POSTGRESQL COMPATIBLE)
-- ============================================================================

-- Universal timestamp updater function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
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
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
        CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END $$;

-- 2. User Preferences & Security Recovery
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    browser_push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    meeting_audio_default BOOLEAN NOT NULL DEFAULT TRUE,
    meeting_video_default BOOLEAN NOT NULL DEFAULT TRUE,
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_token ON password_reset_tokens(token_hash);

-- 3. Skill Categories
CREATE TABLE IF NOT EXISTS skill_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255) DEFAULT NULL,
    icon VARCHAR(50) DEFAULT 'book-open',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Skills
CREATE TABLE IF NOT EXISTS skills (
    id SERIAL PRIMARY KEY,
    category_id INT NOT NULL REFERENCES skill_categories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    name VARCHAR(120) NOT NULL UNIQUE,
    description TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category_id);
CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);

-- 5. User Skills (Offered and Wanted)
CREATE TABLE IF NOT EXISTS user_skills (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    skill_id INT NOT NULL REFERENCES skills(id) ON DELETE CASCADE ON UPDATE CASCADE,
    skill_type VARCHAR(10) NOT NULL CHECK (skill_type IN ('OFFER', 'WANT')),
    experience_level VARCHAR(20) NOT NULL DEFAULT 'intermediate' CHECK (experience_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_user_skill_type UNIQUE (user_id, skill_id, skill_type)
);
CREATE INDEX IF NOT EXISTS idx_user_skills_type ON user_skills(skill_type);

-- 6. Service Offers (Catalog Listings)
CREATE TABLE IF NOT EXISTS service_offers (
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
CREATE INDEX IF NOT EXISTS idx_offers_status ON service_offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_skill ON service_offers(skill_id);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_service_offers_updated_at') THEN
        CREATE TRIGGER trg_service_offers_updated_at BEFORE UPDATE ON service_offers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END $$;

-- 7. Service Requests (Exchange Workflow)
CREATE TABLE IF NOT EXISTS service_requests (
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
CREATE INDEX IF NOT EXISTS idx_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_learner ON service_requests(learner_id);
CREATE INDEX IF NOT EXISTS idx_requests_teacher ON service_requests(teacher_id);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_service_requests_updated_at') THEN
        CREATE TRIGGER trg_service_requests_updated_at BEFORE UPDATE ON service_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END $$;

-- 8. Sessions
CREATE TABLE IF NOT EXISTS sessions (
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
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_scheduled_start ON sessions(scheduled_start_at);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sessions_updated_at') THEN
        CREATE TRIGGER trg_sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END $$;

-- 9. Session Participants
CREATE TABLE IF NOT EXISTS session_participants (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP DEFAULT NULL,
    eligible_duration_minutes INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_participants_session ON session_participants(session_id);

-- 10. Credit Accounts (Wallet)
CREATE TABLE IF NOT EXISTS credit_accounts (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    balance NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0.00),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_credit_accounts_updated_at') THEN
        CREATE TRIGGER trg_credit_accounts_updated_at BEFORE UPDATE ON credit_accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END $$;

-- 11. Credit Top-Up Orders (Razorpay)
CREATE TABLE IF NOT EXISTS credit_topup_orders (
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
CREATE INDEX IF NOT EXISTS idx_topup_user ON credit_topup_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_topup_status ON credit_topup_orders(status);
CREATE INDEX IF NOT EXISTS idx_topup_payment ON credit_topup_orders(razorpay_payment_id);

-- 12. Payment Webhook Events (Idempotency & Replay Protection)
CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id SERIAL PRIMARY KEY,
    provider_event_id VARCHAR(150) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    processing_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (processing_status IN ('PENDING', 'PROCESSED', 'FAILED', 'IGNORED')),
    payload JSONB DEFAULT NULL,
    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_webhook_event_type ON payment_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_status ON payment_webhook_events(processing_status);

-- 13. Credit Transactions
CREATE TABLE IF NOT EXISTS credit_transactions (
    id SERIAL PRIMARY KEY,
    session_id INT DEFAULT NULL REFERENCES sessions(id) ON DELETE SET NULL ON UPDATE CASCADE,
    topup_order_id INT DEFAULT NULL REFERENCES credit_topup_orders(id) ON DELETE SET NULL ON UPDATE CASCADE,
    idempotency_key VARCHAR(120) NOT NULL UNIQUE,
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('SESSION_SETTLEMENT', 'SIGNUP_BONUS', 'ADMIN_ADJUSTMENT', 'REFUND', 'PURCHASE')),
    status VARCHAR(20) NOT NULL DEFAULT 'COMMITTED' CHECK (status IN ('PENDING', 'COMMITTED', 'FAILED', 'REVERSED')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_topup ON credit_transactions(topup_order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON credit_transactions(created_at);

-- 14. Double-Entry Credit Ledger Entries
CREATE TABLE IF NOT EXISTS credit_ledger_entries (
    id SERIAL PRIMARY KEY,
    transaction_id INT NOT NULL REFERENCES credit_transactions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    account_id INT NOT NULL REFERENCES credit_accounts(id) ON DELETE CASCADE ON UPDATE CASCADE,
    entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT')),
    amount NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ledger_account ON credit_ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_transaction ON credit_ledger_entries(transaction_id);

-- 15. Reviews
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    reviewer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    reviewed_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_session_reviewer UNIQUE (session_id, reviewer_id)
);

-- 16. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    actor_id INT DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT DEFAULT NULL,
    reason TEXT DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
