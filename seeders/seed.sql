-- ============================================================================
-- TIMECREDIT LIVE: SEED DATA
-- Default test accounts:
-- 1. admin@timecredit.live / password123 (Role: Admin)
-- 2. alex.chen@timecredit.live / password123 (Role: Member, Teacher & Learner)
-- 3. priya.patel@timecredit.live / password123 (Role: Member, DBMS Specialist)
-- 4. marcus.vance@timecredit.live / password123 (Role: Member, Web Engineer)
-- 5. sara.kim@timecredit.live / password123 (Role: Member, UI/UX Designer)
-- ============================================================================

USE `timecredit_db`;

-- Note: Passwords are hashed with BCRYPT (cost 10) for 'password123'
-- Hash: '$2y$10$w0B7e9wWlZ6O7B5c2mCg1.c0Q9eQ7b.U7P0rY.p0k3z6f8y8l3x0W' (or compatible)
SET @default_hash = '$2y$10$4n9LzO7N1z/r6xU.5xW1..vS8jH9W1V/mCj7o1tK4.c2Q5F0rA0n.';

-- 1. Insert Categories
INSERT INTO `skill_categories` (`id`, `name`, `description`, `icon`) VALUES
(1, 'Database Systems & SQL', 'Relational database design, query optimization, normalization, indexing, and ACID transactions.', 'database'),
(2, 'Web & Full-Stack Development', 'Modern web technologies, React, TypeScript, APIs, PWA, and backend engineering.', 'code'),
(3, 'Data Science & Machine Learning', 'Python, pandas, algorithms, statistics, neural networks, and data visualization.', 'cpu'),
(4, 'Computer Science Fundamentals', 'Data structures, algorithms, operating systems, and discrete mathematics.', 'book-open'),
(5, 'UI/UX & Claymorphism Design', 'User experience design, Figma, claymorphism, accessibility, and design systems.', 'palette'),
(6, 'Languages & Communication', 'Technical writing, English for engineering, and multilingual exchange.', 'globe')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- 2. Insert Core Users
INSERT INTO `users` (`id`, `full_name`, `email`, `password_hash`, `role`, `status`, `bio`, `created_at`) VALUES
(1, 'Prof. Alex Chen (Admin)', 'admin@timecredit.live', @default_hash, 'admin', 'active', 'DBMS Professor & Lead Architect of TimeCredit Live platform.', NOW()),
(2, 'Priya Patel', 'priya.patel@timecredit.live', @default_hash, 'member', 'Senior Database Administrator & SQL Performance Tuning Enthusiast.', NOW()),
(3, 'Marcus Vance', 'marcus.vance@timecredit.live', @default_hash, 'member', 'Full-stack developer passionate about React, TypeScript, and PWAs.', NOW()),
(4, 'Sara Kim', 'sara.kim@timecredit.live', @default_hash, 'member', 'Product Designer specializing in Claymorphism, micro-interactions, and design systems.', NOW()),
(5, 'Aarav Sharma', 'aarav.sharma@timecredit.live', @default_hash, 'member', 'Computer Science Junior enthusiastic about Machine Learning and Query Optimization.', NOW())
ON DUPLICATE KEY UPDATE `full_name`=VALUES(`full_name`);

-- 3. Insert Skills
INSERT INTO `skills` (`id`, `category_id`, `name`, `description`) VALUES
(1, 1, 'SQL Joins & Complex Queries', 'Mastering INNER JOIN, LEFT/RIGHT JOIN, FULL OUTER JOIN, self joins, and aggregation.'),
(2, 1, 'Database Normalization (1NF to BCNF)', 'Eliminating redundancy, functional dependencies, and lossless decomposition.'),
(3, 1, 'ACID Transactions & Row Locking', 'Understanding atomicity, consistency, isolation levels, row locks, and deadlock prevention.'),
(4, 2, 'React 19 & TypeScript Architecture', 'Component design systems, custom hooks, state machines, and performant UI patterns.'),
(5, 2, 'PWA & Service Worker Caching', 'Offline caching strategies, Web App Manifests, and background sync.'),
(6, 3, 'Pandas & SQL Data Pipelines', 'Bridging SQL queries with Python data science workflows and analysis.'),
(7, 5, 'Claymorphism 3D UI Design', 'Creating soft 3D clay depth, dual inset shadows, and accessible pastel aesthetics.'),
(8, 4, 'Graph & Tree Algorithms', 'DFS, BFS, Dijkstra, and Binary Search Trees with live whiteboard coding.')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- 4. User Skills Mapping
INSERT INTO `user_skills` (`user_id`, `skill_id`, `skill_type`, `experience_level`) VALUES
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
ON DUPLICATE KEY UPDATE `experience_level`=VALUES(`experience_level`);

-- 5. Service Offers
INSERT INTO `service_offers` (`id`, `teacher_id`, `skill_id`, `title`, `description`, `duration_minutes`, `credit_rate`, `experience_level`, `language`, `mode`, `status`) VALUES
(1, 2, 1, 'Mastering Advanced SQL Joins & Subqueries', 'Interactive hands-on session solving real-world multi-table queries and query plans.', 60, 1.00, 'expert', 'English', 'online', 'active'),
(2, 2, 2, 'DBMS Normalization: 1NF to BCNF Step-by-Step', 'Learn functional dependencies, candidate keys, and how to decompose tables with zero anomaly.', 60, 1.00, 'expert', 'English', 'online', 'active'),
(3, 3, 4, 'Modern React & TypeScript Clean Architecture', 'Build resilient frontend apps with strict types, custom hooks, and scalable component structures.', 60, 1.00, 'advanced', 'English', 'online', 'active'),
(4, 4, 7, 'Claymorphism UI Workshop: Shadows & 3D Depth', 'Learn how to construct delightful 3D clay interfaces using CSS inset shadows and pastel palettes.', 45, 0.75, 'expert', 'English', 'online', 'active'),
(5, 5, 6, 'Data Wrangling: SQL into Pandas Dataframes', 'Export SQL result sets directly into Jupyter notebooks for cleaning and chart visualizations.', 30, 0.50, 'intermediate', 'English', 'online', 'active')
ON DUPLICATE KEY UPDATE `title`=VALUES(`title`);

-- 6. Credit Accounts (Initial Balances)
INSERT INTO `credit_accounts` (`id`, `user_id`, `balance`, `updated_at`) VALUES
(1, 1, 15.00, NOW()),
(2, 2, 8.50, NOW()),
(3, 3, 4.00, NOW()),
(4, 4, 6.00, NOW()),
(5, 5, 3.50, NOW())
ON DUPLICATE KEY UPDATE `balance`=VALUES(`balance`);

-- 7. Service Requests & Completed Sessions
INSERT INTO `service_requests` (`id`, `offer_id`, `learner_id`, `teacher_id`, `proposed_start_at`, `requested_duration_minutes`, `message`, `status`, `created_at`) VALUES
(1, 1, 3, 2, DATE_SUB(NOW(), INTERVAL 2 DAY), 60, 'Would love your guidance on SQL Query Lab indexing and JOIN optimization!', 'Completed', DATE_SUB(NOW(), INTERVAL 3 DAY)),
(2, 2, 5, 2, DATE_SUB(NOW(), INTERVAL 1 DAY), 60, 'Need help preparing for SEM 5 DBMS Normalization university exam.', 'Completed', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(3, 3, 4, 3, DATE_ADD(NOW(), INTERVAL 1 DAY), 60, 'Excited to integrate TypeScript with my new design system components.', 'Accepted', NOW()),
(4, 4, 5, 4, DATE_ADD(NOW(), INTERVAL 2 DAY), 45, 'Can you review my claymorphic card shadows and contrast ratios?', 'Pending', NOW())
ON DUPLICATE KEY UPDATE `status`=VALUES(`status`);

-- 8. Sessions
INSERT INTO `sessions` (`id`, `request_id`, `teacher_id`, `learner_id`, `scheduled_start_at`, `scheduled_end_at`, `actual_start_at`, `actual_end_at`, `eligible_duration_minutes`, `meeting_room_id`, `status`) VALUES
(1, 1, 2, 3, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY) + INTERVAL 1 HOUR, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY) + INTERVAL 1 HOUR, 60, 'timecredit-session-priya-marcus-9021', 'COMPLETED'),
(2, 2, 2, 5, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY) + INTERVAL 1 HOUR, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY) + INTERVAL 1 HOUR, 60, 'timecredit-session-priya-aarav-8114', 'COMPLETED'),
(3, 3, 3, 4, DATE_ADD(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 1 DAY) + INTERVAL 1 HOUR, NULL, NULL, 0, 'timecredit-session-marcus-sara-4521', 'SCHEDULED')
ON DUPLICATE KEY UPDATE `status`=VALUES(`status`);

-- 9. Credit Transactions & Double-Entry Ledger
INSERT INTO `credit_transactions` (`id`, `session_id`, `idempotency_key`, `transaction_type`, `status`, `created_at`) VALUES
(1, 1, 'SETTLE_SESSION_1_TXN', 'SESSION_SETTLEMENT', 'COMMITTED', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(2, 2, 'SETTLE_SESSION_2_TXN', 'SESSION_SETTLEMENT', 'COMMITTED', DATE_SUB(NOW(), INTERVAL 1 DAY))
ON DUPLICATE KEY UPDATE `status`=VALUES(`status`);

INSERT INTO `credit_ledger_entries` (`transaction_id`, `account_id`, `entry_type`, `amount`, `created_at`) VALUES
(1, 3, 'DEBIT', 1.00, DATE_SUB(NOW(), INTERVAL 2 DAY)),  -- Marcus spent 1.00
(1, 2, 'CREDIT', 1.00, DATE_SUB(NOW(), INTERVAL 2 DAY)), -- Priya earned 1.00
(2, 5, 'DEBIT', 1.00, DATE_SUB(NOW(), INTERVAL 1 DAY)),  -- Aarav spent 1.00
(2, 2, 'CREDIT', 1.00, DATE_SUB(NOW(), INTERVAL 1 DAY))  -- Priya earned 1.00
ON DUPLICATE KEY UPDATE `amount`=VALUES(`amount`);

-- 10. Reviews
INSERT INTO `reviews` (`session_id`, `reviewer_id`, `reviewed_user_id`, `rating`, `comment`, `created_at`) VALUES
(1, 3, 2, 5, 'Priya is phenomenal! She explained query execution plans, hash joins, and B-Tree indexes so intuitively.', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(2, 5, 2, 5, 'The 3NF vs BCNF examples were crystal clear. Earned every bit of the TimeCredit!', DATE_SUB(NOW(), INTERVAL 1 DAY))
ON DUPLICATE KEY UPDATE `rating`=VALUES(`rating`);

-- 11. Notifications
INSERT INTO `notifications` (`user_id`, `title`, `message`, `read_at`, `created_at`) VALUES
(2, 'Credits Received!', 'You earned 1.00 TimeCredit for your completed session with Marcus Vance.', NOW(), DATE_SUB(NOW(), INTERVAL 2 DAY)),
(3, 'Session Completed', 'Your session with Priya Patel was completed. 1.00 TimeCredit has been settled.', NOW(), DATE_SUB(NOW(), INTERVAL 2 DAY)),
(4, 'Request Accepted', 'Marcus Vance accepted your request for "Modern React & TypeScript Architecture"!', NULL, NOW()),
(5, 'Welcome to TimeCredit Live', 'Welcome! 2.00 signup bonus TimeCredits have been credited to your wallet.', NOW(), DATE_SUB(NOW(), INTERVAL 5 DAY))
ON DUPLICATE KEY UPDATE `title`=VALUES(`title`);

-- 12. Saved Queries for SQL Query Lab
INSERT INTO `saved_queries` (`id`, `user_id`, `title`, `sql_text`, `description`) VALUES
(1, 1, 'Top Rated Teachers Report', 'SELECT u.full_name, COUNT(s.id) AS sessions_taught, ROUND(AVG(r.rating), 2) AS avg_rating\nFROM users u\nJOIN sessions s ON u.id = s.teacher_id\nLEFT JOIN reviews r ON s.id = r.session_id\nWHERE s.status = \'COMPLETED\'\nGROUP BY u.id, u.full_name\nORDER BY avg_rating DESC;', 'Demonstrates JOIN, GROUP BY, aggregate functions, and ORDER BY'),
(2, 1, 'Double-Entry Ledger Audit Check', 'SELECT ct.id AS txn_id, ct.transaction_type, \n       SUM(CASE WHEN cle.entry_type = \'DEBIT\' THEN cle.amount ELSE 0 END) AS total_debit,\n       SUM(CASE WHEN cle.entry_type = \'CREDIT\' THEN cle.amount ELSE 0 END) AS total_credit\nFROM credit_transactions ct\nJOIN credit_ledger_entries cle ON ct.id = cle.transaction_id\nGROUP BY ct.id, ct.transaction_type\nHAVING total_debit <> total_credit;', 'Verifies double-entry consistency (DEBIT sum must equal CREDIT sum).'),
(3, 1, 'Skills Match Matrix', 'SELECT o.full_name AS teacher, w.full_name AS learner, s.name AS matched_skill\nFROM user_skills us_o\nJOIN user_skills us_w ON us_o.skill_id = us_w.skill_id AND us_o.skill_type = \'OFFER\' AND us_w.skill_type = \'WANT\'\nJOIN users o ON us_o.user_id = o.id\nJOIN users w ON us_w.user_id = w.id\nJOIN skills s ON us_o.skill_id = s.id\nWHERE o.id <> w.id;', 'Demonstrates self-join logic matching teachers offering skills to learners seeking them.')
ON DUPLICATE KEY UPDATE `title`=VALUES(`title`);
