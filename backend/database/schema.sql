-- ============================================================================
-- TIMECREDIT LIVE: MAIN PRODUCTION DATABASE SCHEMA
-- Relational Database: MySQL 8+
-- Demonstrates: Normalization (3NF/BCNF), Foreign Key Constraints, Cascades,
--               Indexes, Triggers, Views, Stored Procedures, and Double-Entry Ledger.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `timecredit_db` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `timecredit_db`;

-- Drop existing tables in reverse dependency order if resetting
DROP VIEW IF EXISTS `v_popular_skills`;
DROP VIEW IF EXISTS `v_teacher_leaderboard`;
DROP VIEW IF EXISTS `v_active_sessions`;
DROP VIEW IF EXISTS `v_user_credit_summary`;

DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `query_history`;
DROP TABLE IF EXISTS `saved_queries`;
DROP TABLE IF EXISTS `chat_messages`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `reviews`;
DROP TABLE IF EXISTS `payment_webhook_events`;
DROP TABLE IF EXISTS `credit_ledger_entries`;
DROP TABLE IF EXISTS `credit_transactions`;
DROP TABLE IF EXISTS `credit_topup_orders`;
DROP TABLE IF EXISTS `credit_accounts`;
DROP TABLE IF EXISTS `session_participants`;
DROP TABLE IF EXISTS `sessions`;
DROP TABLE IF EXISTS `service_requests`;
DROP TABLE IF EXISTS `service_offers`;
DROP TABLE IF EXISTS `user_skills`;
DROP TABLE IF EXISTS `skills`;
DROP TABLE IF EXISTS `skill_categories`;
DROP TABLE IF EXISTS `users`;

-- ----------------------------------------------------------------------------
-- 1. USERS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE `users` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `full_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('member', 'admin') NOT NULL DEFAULT 'member',
    `status` ENUM('active', 'suspended', 'pending') NOT NULL DEFAULT 'active',
    `bio` TEXT DEFAULT NULL,
    `avatar_url` VARCHAR(255) DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_users_email` (`email`),
    INDEX `idx_users_role` (`role`)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 2. SKILL CATEGORIES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE `skill_categories` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL UNIQUE,
    `description` VARCHAR(255) DEFAULT NULL,
    `icon` VARCHAR(50) DEFAULT 'book-open',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 3. SKILLS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE `skills` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `category_id` INT UNSIGNED NOT NULL,
    `name` VARCHAR(120) NOT NULL UNIQUE,
    `description` TEXT DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_skills_category` FOREIGN KEY (`category_id`)
        REFERENCES `skill_categories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX `idx_skills_category` (`category_id`),
    INDEX `idx_skills_name` (`name`)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 4. USER SKILLS (Many-to-Many Bridge Table)
-- ----------------------------------------------------------------------------
CREATE TABLE `user_skills` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL,
    `skill_id` INT UNSIGNED NOT NULL,
    `skill_type` ENUM('OFFER', 'WANT') NOT NULL,
    `experience_level` ENUM('beginner', 'intermediate', 'advanced', 'expert') NOT NULL DEFAULT 'intermediate',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_user_skills_user` FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_user_skills_skill` FOREIGN KEY (`skill_id`)
        REFERENCES `skills` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE KEY `uk_user_skill_type` (`user_id`, `skill_id`, `skill_type`),
    INDEX `idx_user_skills_type` (`skill_type`)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 5. SERVICE OFFERS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE `service_offers` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `teacher_id` INT UNSIGNED NOT NULL,
    `skill_id` INT UNSIGNED NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `description` TEXT NOT NULL,
    `duration_minutes` INT UNSIGNED NOT NULL DEFAULT 60,
    `credit_rate` DECIMAL(4, 2) NOT NULL DEFAULT 1.00,
    `experience_level` ENUM('beginner', 'intermediate', 'advanced', 'expert') NOT NULL DEFAULT 'intermediate',
    `language` VARCHAR(50) NOT NULL DEFAULT 'English',
    `mode` ENUM('online', 'in-person') NOT NULL DEFAULT 'online',
    `status` ENUM('active', 'paused', 'archived') NOT NULL DEFAULT 'active',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_service_offers_teacher` FOREIGN KEY (`teacher_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_service_offers_skill` FOREIGN KEY (`skill_id`)
        REFERENCES `skills` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX `idx_offers_status` (`status`),
    INDEX `idx_offers_skill` (`skill_id`)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 6. SERVICE REQUESTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE `service_requests` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `offer_id` INT UNSIGNED NOT NULL,
    `learner_id` INT UNSIGNED NOT NULL,
    `teacher_id` INT UNSIGNED NOT NULL,
    `proposed_start_at` DATETIME NOT NULL,
    `requested_duration_minutes` INT UNSIGNED NOT NULL DEFAULT 60,
    `message` TEXT DEFAULT NULL,
    `status` ENUM('Pending', 'Accepted', 'Rejected', 'Cancelled', 'Scheduled', 'Completed', 'Disputed') NOT NULL DEFAULT 'Pending',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_service_requests_offer` FOREIGN KEY (`offer_id`)
        REFERENCES `service_offers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_service_requests_learner` FOREIGN KEY (`learner_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_service_requests_teacher` FOREIGN KEY (`teacher_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `idx_requests_status` (`status`),
    INDEX `idx_requests_learner` (`learner_id`),
    INDEX `idx_requests_teacher` (`teacher_id`)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 7. SESSIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE `sessions` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `request_id` INT UNSIGNED NOT NULL UNIQUE,
    `teacher_id` INT UNSIGNED NOT NULL,
    `learner_id` INT UNSIGNED NOT NULL,
    `scheduled_start_at` DATETIME NOT NULL,
    `scheduled_end_at` DATETIME NOT NULL,
    `actual_start_at` DATETIME DEFAULT NULL,
    `actual_end_at` DATETIME DEFAULT NULL,
    `eligible_duration_minutes` INT UNSIGNED NOT NULL DEFAULT 0,
    `meeting_room_id` VARCHAR(100) NOT NULL UNIQUE,
    `status` ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED') NOT NULL DEFAULT 'SCHEDULED',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_sessions_request` FOREIGN KEY (`request_id`)
        REFERENCES `service_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_sessions_teacher` FOREIGN KEY (`teacher_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_sessions_learner` FOREIGN KEY (`learner_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `idx_sessions_status` (`status`),
    INDEX `idx_sessions_scheduled_start` (`scheduled_start_at`)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 8. SESSION PARTICIPANTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE `session_participants` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `session_id` INT UNSIGNED NOT NULL,
    `user_id` INT UNSIGNED NOT NULL,
    `joined_at` DATETIME NOT NULL,
    `left_at` DATETIME DEFAULT NULL,
    `eligible_duration_minutes` INT UNSIGNED NOT NULL DEFAULT 0,
    CONSTRAINT `fk_participants_session` FOREIGN KEY (`session_id`)
        REFERENCES `sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_participants_user` FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `idx_participants_session` (`session_id`)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 9. CREDIT ACCOUNTS TABLE (Ledger Balance)
-- ----------------------------------------------------------------------------
CREATE TABLE `credit_accounts` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL UNIQUE,
    `balance` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_credit_accounts_user` FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `chk_balance_non_negative` CHECK (`balance` >= 0.00)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 10. CREDIT TOP-UP ORDERS TABLE (Razorpay Payment Gateway Integration)
-- ----------------------------------------------------------------------------
CREATE TABLE `credit_topup_orders` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL,
    `package_id` VARCHAR(50) NOT NULL,
    `credits` DECIMAL(10, 2) NOT NULL,
    `amount_paise` INT UNSIGNED NOT NULL,
    `currency` VARCHAR(10) NOT NULL DEFAULT 'INR',
    `razorpay_order_id` VARCHAR(100) NOT NULL UNIQUE,
    `razorpay_payment_id` VARCHAR(100) DEFAULT NULL,
    `status` ENUM('CREATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'CREATED',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `paid_at` DATETIME DEFAULT NULL,
    `fulfilled_at` DATETIME DEFAULT NULL,
    CONSTRAINT `fk_topup_user` FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `idx_topup_user` (`user_id`),
    INDEX `idx_topup_status` (`status`),
    INDEX `idx_topup_payment` (`razorpay_payment_id`)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 11. PAYMENT WEBHOOK EVENTS TABLE (Duplicate Prevention)
-- ----------------------------------------------------------------------------
CREATE TABLE `payment_webhook_events` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `provider_event_id` VARCHAR(150) NOT NULL UNIQUE,
    `event_type` VARCHAR(100) NOT NULL,
    `processing_status` ENUM('PENDING', 'PROCESSED', 'FAILED', 'IGNORED') NOT NULL DEFAULT 'PENDING',
    `payload` JSON DEFAULT NULL,
    `received_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `processed_at` DATETIME DEFAULT NULL,
    INDEX `idx_webhook_event_type` (`event_type`),
    INDEX `idx_webhook_status` (`processing_status`)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 12. CREDIT TRANSACTIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE `credit_transactions` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `session_id` INT UNSIGNED DEFAULT NULL,
    `topup_order_id` INT UNSIGNED DEFAULT NULL,
    `idempotency_key` VARCHAR(120) NOT NULL UNIQUE,
    `transaction_type` ENUM('SESSION_SETTLEMENT', 'SIGNUP_BONUS', 'ADMIN_ADJUSTMENT', 'REFUND', 'PURCHASE') NOT NULL,
    `status` ENUM('PENDING', 'COMMITTED', 'FAILED', 'REVERSED') NOT NULL DEFAULT 'COMMITTED',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_transactions_session` FOREIGN KEY (`session_id`)
        REFERENCES `sessions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_transactions_topup` FOREIGN KEY (`topup_order_id`)
        REFERENCES `credit_topup_orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX `idx_transactions_type` (`transaction_type`),
    INDEX `idx_transactions_topup` (`topup_order_id`),
    INDEX `idx_transactions_created` (`created_at`)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 13. CREDIT LEDGER ENTRIES (Double-entry accounting)
-- ----------------------------------------------------------------------------
CREATE TABLE `credit_ledger_entries` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `transaction_id` INT UNSIGNED NOT NULL,
    `account_id` INT UNSIGNED NOT NULL,
    `entry_type` ENUM('DEBIT', 'CREDIT') NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_ledger_transaction` FOREIGN KEY (`transaction_id`)
        REFERENCES `credit_transactions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_ledger_account` FOREIGN KEY (`account_id`)
        REFERENCES `credit_accounts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `idx_ledger_account` (`account_id`),
    INDEX `idx_ledger_transaction` (`transaction_id`)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 12. REVIEWS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE `reviews` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `session_id` INT UNSIGNED NOT NULL,
    `reviewer_id` INT UNSIGNED NOT NULL,
    `reviewed_user_id` INT UNSIGNED NOT NULL,
    `rating` TINYINT UNSIGNED NOT NULL CHECK (`rating` BETWEEN 1 AND 5),
    `comment` TEXT DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_reviews_session` FOREIGN KEY (`session_id`)
        REFERENCES `sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_reviews_reviewer` FOREIGN KEY (`reviewer_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_reviews_reviewed` FOREIGN KEY (`reviewed_user_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE KEY `uk_session_reviewer` (`session_id`, `reviewer_id`)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 13. NOTIFICATIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE `notifications` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `message` TEXT NOT NULL,
    `read_at` DATETIME DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `idx_notifications_user_read` (`user_id`, `read_at`)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 14. CHAT MESSAGES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE `chat_messages` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `session_id` INT UNSIGNED NOT NULL,
    `sender_id` INT UNSIGNED NOT NULL,
    `message` TEXT NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_chat_session` FOREIGN KEY (`session_id`)
        REFERENCES `sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_chat_sender` FOREIGN KEY (`sender_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `idx_chat_session` (`session_id`)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 15. SAVED QUERIES (SQL Query Lab feature)
-- ----------------------------------------------------------------------------
CREATE TABLE `saved_queries` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `sql_text` TEXT NOT NULL,
    `description` VARCHAR(255) DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_saved_queries_user` FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `idx_saved_queries_user` (`user_id`)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 16. QUERY HISTORY (Audit & Student Learning)
-- ----------------------------------------------------------------------------
CREATE TABLE `query_history` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL,
    `query_text` TEXT NOT NULL,
    `query_type` VARCHAR(30) NOT NULL,
    `success` TINYINT(1) NOT NULL DEFAULT 1,
    `rows_affected` INT NOT NULL DEFAULT 0,
    `execution_time_ms` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
    `error_message` TEXT DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_query_history_user` FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `idx_query_history_user` (`user_id`),
    INDEX `idx_query_history_created` (`created_at`)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 17. AUDIT LOGS
-- ----------------------------------------------------------------------------
CREATE TABLE `audit_logs` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `actor_id` INT UNSIGNED DEFAULT NULL,
    `action` VARCHAR(100) NOT NULL,
    `entity_type` VARCHAR(50) NOT NULL,
    `entity_id` INT UNSIGNED DEFAULT NULL,
    `reason` TEXT DEFAULT NULL,
    `ip_address` VARCHAR(45) DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_audit_actor` FOREIGN KEY (`actor_id`)
        REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX `idx_audit_entity` (`entity_type`, `entity_id`)
) ENGINE=InnoDB;


-- ============================================================================
-- VIEWS (DBMS Demonstration)
-- ============================================================================

-- 1. Popular Skills View: Aggregates offers, requests, and teacher ratings
CREATE VIEW `v_popular_skills` AS
SELECT 
    s.id AS skill_id,
    s.name AS skill_name,
    c.name AS category_name,
    COUNT(DISTINCT so.id) AS total_offers,
    COUNT(DISTINCT sr.id) AS total_requests,
    ROUND(AVG(r.rating), 2) AS average_rating,
    COUNT(DISTINCT r.id) AS total_reviews
FROM `skills` s
JOIN `skill_categories` c ON s.category_id = c.id
LEFT JOIN `service_offers` so ON s.id = so.skill_id AND so.status = 'active'
LEFT JOIN `service_requests` sr ON so.id = sr.offer_id
LEFT JOIN `sessions` sess ON sr.id = sess.request_id AND sess.status = 'COMPLETED'
LEFT JOIN `reviews` r ON sess.id = r.session_id
GROUP BY s.id, s.name, c.name;

-- 2. Teacher Leaderboard View: Top instructors ranked by completed sessions & hours
CREATE VIEW `v_teacher_leaderboard` AS
SELECT 
    u.id AS teacher_id,
    u.full_name AS teacher_name,
    u.email AS teacher_email,
    COUNT(DISTINCT s.id) AS completed_sessions,
    ROUND(COALESCE(SUM(s.eligible_duration_minutes) / 60.0, 0), 2) AS total_teaching_hours,
    ROUND(AVG(r.rating), 2) AS average_rating,
    ca.balance AS current_time_credits
FROM `users` u
LEFT JOIN `sessions` s ON u.id = s.teacher_id AND s.status = 'COMPLETED'
LEFT JOIN `reviews` r ON s.id = r.session_id AND r.reviewed_user_id = u.id
LEFT JOIN `credit_accounts` ca ON u.id = ca.user_id
GROUP BY u.id, u.full_name, u.email, ca.balance
ORDER BY completed_sessions DESC, average_rating DESC;

-- 3. Active Sessions View
CREATE VIEW `v_active_sessions` AS
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
FROM `sessions` s
JOIN `service_requests` sr ON s.request_id = sr.id
JOIN `service_offers` so ON sr.offer_id = so.id
JOIN `skills` sk ON so.skill_id = sk.id
JOIN `users` t ON s.teacher_id = t.id
JOIN `users` l ON s.learner_id = l.id
WHERE s.status IN ('SCHEDULED', 'IN_PROGRESS');

-- 4. User Credit Summary View
CREATE VIEW `v_user_credit_summary` AS
SELECT 
    u.id AS user_id,
    u.full_name,
    ca.balance AS available_balance,
    COALESCE(SUM(CASE WHEN le.entry_type = 'CREDIT' THEN le.amount ELSE 0 END), 0) AS total_credits_earned,
    COALESCE(SUM(CASE WHEN le.entry_type = 'DEBIT' THEN le.amount ELSE 0 END), 0) AS total_credits_spent,
    COUNT(le.id) AS total_ledger_entries
FROM `users` u
JOIN `credit_accounts` ca ON u.id = ca.user_id
LEFT JOIN `credit_ledger_entries` le ON ca.id = le.account_id
GROUP BY u.id, u.full_name, ca.balance;


-- ============================================================================
-- STORED PROCEDURES & TRIGGERS (DBMS Core Requirements)
-- ============================================================================

DELIMITER $$

-- Trigger 1: Automatically initialize credit account with 2.0 bonus credits upon registration
CREATE TRIGGER `trg_after_user_insert`
AFTER INSERT ON `users`
FOR EACH ROW
BEGIN
    INSERT INTO `credit_accounts` (`user_id`, `balance`, `updated_at`)
    VALUES (NEW.id, 2.00, NOW());

    -- Log transaction and ledger entry for signup bonus
    INSERT INTO `credit_transactions` (`session_id`, `idempotency_key`, `transaction_type`, `status`)
    VALUES (NULL, CONCAT('SIGNUP_BONUS_', NEW.id, '_', UNIX_TIMESTAMP()), 'SIGNUP_BONUS', 'COMMITTED');

    SET @txn_id = LAST_INSERT_ID();
    SET @acc_id = (SELECT `id` FROM `credit_accounts` WHERE `user_id` = NEW.id LIMIT 1);

    INSERT INTO `credit_ledger_entries` (`transaction_id`, `account_id`, `entry_type`, `amount`)
    VALUES (@txn_id, @acc_id, 'CREDIT', 2.00);

    INSERT INTO `audit_logs` (`actor_id`, `action`, `entity_type`, `entity_id`, `reason`)
    VALUES (NEW.id, 'USER_REGISTERED', 'users', NEW.id, 'New user registered; 2.00 welcome bonus TimeCredits deposited.');
END$$

-- Stored Procedure: Atomic settlement of live session credits
-- Enforces ACID properties, prevents double spending and duplicate transfers
CREATE PROCEDURE `sp_settle_session_credits`(
    IN p_session_id INT UNSIGNED,
    IN p_actual_duration_mins INT UNSIGNED,
    IN p_idempotency_key VARCHAR(120),
    OUT p_status_code VARCHAR(20),
    OUT p_transferred_credits DECIMAL(10,2)
)
proc_label: BEGIN
    DECLARE v_teacher_id INT UNSIGNED;
    DECLARE v_learner_id INT UNSIGNED;
    DECLARE v_session_status VARCHAR(30);
    DECLARE v_credit_rate DECIMAL(4, 2);
    DECLARE v_calculated_credits DECIMAL(10, 2);
    DECLARE v_teacher_acc_id INT UNSIGNED;
    DECLARE v_learner_acc_id INT UNSIGNED;
    DECLARE v_learner_balance DECIMAL(10, 2);
    DECLARE v_txn_id INT UNSIGNED;
    DECLARE v_existing_count INT;

    -- Exit handler for SQL exceptions: rollback transaction
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_status_code = 'ERROR_SQL_EXCEPTION';
        SET p_transferred_credits = 0.00;
    END;

    START TRANSACTION;

    -- 1. Check idempotency: Ensure this transaction key has not been processed
    SELECT COUNT(*) INTO v_existing_count 
    FROM `credit_transactions` 
    WHERE `idempotency_key` = p_idempotency_key;

    IF v_existing_count > 0 THEN
        ROLLBACK;
        SET p_status_code = 'ALREADY_SETTLED';
        SET p_transferred_credits = 0.00;
        LEAVE proc_label;
    END IF;

    -- 2. Lock the session row to prevent race conditions
    SELECT s.teacher_id, s.learner_id, s.status, so.credit_rate
    INTO v_teacher_id, v_learner_id, v_session_status, v_credit_rate
    FROM `sessions` s
    JOIN `service_requests` sr ON s.request_id = sr.id
    JOIN `service_offers` so ON sr.offer_id = so.id
    WHERE s.id = p_session_id
    FOR UPDATE;

    -- Validate session existence and status
    IF v_session_status IS NULL THEN
        ROLLBACK;
        SET p_status_code = 'SESSION_NOT_FOUND';
        SET p_transferred_credits = 0.00;
        LEAVE proc_label;
    END IF;

    IF v_session_status = 'COMPLETED' THEN
        ROLLBACK;
        SET p_status_code = 'SESSION_ALREADY_COMPLETED';
        SET p_transferred_credits = 0.00;
        LEAVE proc_label;
    END IF;

    -- 3. Calculate credit: 1 hour = 1.0 credit * rate, 30 min = 0.5 credit * rate
    -- Minimum duration requirement: 10 minutes
    IF p_actual_duration_mins < 10 THEN
        SET v_calculated_credits = 0.00;
    ELSE
        SET v_calculated_credits = ROUND((p_actual_duration_mins / 60.0) * v_credit_rate, 2);
    END IF;

    -- 4. Lock both credit accounts (ordered by user_id to prevent deadlocks)
    IF v_teacher_id < v_learner_id THEN
        SELECT id INTO v_teacher_acc_id FROM `credit_accounts` WHERE user_id = v_teacher_id FOR UPDATE;
        SELECT id, balance INTO v_learner_acc_id, v_learner_balance FROM `credit_accounts` WHERE user_id = v_learner_id FOR UPDATE;
    ELSE
        SELECT id, balance INTO v_learner_acc_id, v_learner_balance FROM `credit_accounts` WHERE user_id = v_learner_id FOR UPDATE;
        SELECT id INTO v_teacher_acc_id FROM `credit_accounts` WHERE user_id = v_teacher_id FOR UPDATE;
    END IF;

    -- 5. Verify learner balance
    IF v_learner_balance < v_calculated_credits THEN
        ROLLBACK;
        SET p_status_code = 'INSUFFICIENT_CREDITS';
        SET p_transferred_credits = 0.00;
        LEAVE proc_label;
    END IF;

    -- 6. Perform Double-Entry Transfer if credits > 0
    IF v_calculated_credits > 0 THEN
        -- Insert master transaction
        INSERT INTO `credit_transactions` (`session_id`, `idempotency_key`, `transaction_type`, `status`)
        VALUES (p_session_id, p_idempotency_key, 'SESSION_SETTLEMENT', 'COMMITTED');
        SET v_txn_id = LAST_INSERT_ID();

        -- Debit learner
        INSERT INTO `credit_ledger_entries` (`transaction_id`, `account_id`, `entry_type`, `amount`)
        VALUES (v_txn_id, v_learner_acc_id, 'DEBIT', v_calculated_credits);

        UPDATE `credit_accounts`
        SET `balance` = `balance` - v_calculated_credits
        WHERE `id` = v_learner_acc_id;

        -- Credit teacher
        INSERT INTO `credit_ledger_entries` (`transaction_id`, `account_id`, `entry_type`, `amount`)
        VALUES (v_txn_id, v_teacher_acc_id, 'CREDIT', v_calculated_credits);

        UPDATE `credit_accounts`
        SET `balance` = `balance` + v_calculated_credits
        WHERE `id` = v_teacher_acc_id;
    END IF;

    -- 7. Update session status to COMPLETED
    UPDATE `sessions`
    SET `status` = 'COMPLETED',
        `actual_end_at` = NOW(),
        `eligible_duration_minutes` = p_actual_duration_mins
    WHERE `id` = p_session_id;

    -- Also update parent request
    UPDATE `service_requests`
    SET `status` = 'Completed'
    WHERE `id` = (SELECT `request_id` FROM `sessions` WHERE `id` = p_session_id);

    -- 8. Audit log entry
    INSERT INTO `audit_logs` (`actor_id`, `action`, `entity_type`, `entity_id`, `reason`)
    VALUES (v_learner_id, 'SESSION_COMPLETED', 'sessions', p_session_id, 
            CONCAT('Session completed; duration: ', p_actual_duration_mins, ' mins, transferred: ', v_calculated_credits, ' TimeCredits.'));

    COMMIT;
    SET p_status_code = 'SUCCESS';
    SET p_transferred_credits = v_calculated_credits;
END$$

DELIMITER ;
