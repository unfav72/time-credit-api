-- ============================================================================
-- MIGRATION 002: NOTIFICATIONS AND WEB PUSH SUBSCRIPTIONS
-- ============================================================================

-- 1. In-App Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL DEFAULT 'SYSTEM' CHECK (notification_type IN ('SYSTEM', 'REQUEST_RECEIVED', 'REQUEST_ACCEPTED', 'REQUEST_REJECTED', 'SESSION_SCHEDULED', 'SESSION_COMPLETED', 'PAYMENT_SUCCESS', 'SECURITY')),
    action_url VARCHAR(255) DEFAULT NULL,
    read_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- 2. Web Push Subscriptions (VAPID)
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
