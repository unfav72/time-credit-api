-- ============================================================================
-- TIMECREDIT LIVE: POSTGRESQL SEED DATA
-- Default test accounts:
-- 1. admin@timecredit.live / password123 (Role: Admin)
-- 2. priya.patel@timecredit.live / password123 (Role: Member, DBMS Specialist)
-- 3. marcus.vance@timecredit.live / password123 (Role: Member, Web Engineer)
-- 4. sara.kim@timecredit.live / password123 (Role: Member, UI/UX Designer)
-- 5. aarav.sharma@timecredit.live / password123 (Role: Member, Junior Learner)
-- ============================================================================

-- 1. Insert Categories
INSERT INTO skill_categories (id, name, description, icon) VALUES
(1, 'Database Systems & SQL', 'Relational database design, query optimization, normalization, indexing, and ACID transactions.', 'database'),
(2, 'Web & Full-Stack Development', 'Modern web technologies, React, TypeScript, APIs, PWA, and backend engineering.', 'code'),
(3, 'Data Science & Machine Learning', 'Python, pandas, algorithms, statistics, neural networks, and data visualization.', 'cpu'),
(4, 'Computer Science Fundamentals', 'Data structures, algorithms, operating systems, and discrete mathematics.', 'book-open'),
(5, 'UI/UX & Claymorphism Design', 'User experience design, Figma, claymorphism, accessibility, and design systems.', 'palette'),
(6, 'Languages & Communication', 'Technical writing, English for engineering, and multilingual exchange.', 'globe')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 2. Insert Core Users (password123 bcrypt hash)
INSERT INTO users (id, full_name, email, password_hash, role, status, bio, created_at) VALUES
(1, 'Prof. Alex Chen (Admin)', 'admin@timecredit.live', '$2y$10$4n9LzO7N1z/r6xU.5xW1..vS8jH9W1V/mCj7o1tK4.c2Q5F0rA0n.', 'admin', 'active', 'DBMS Professor & Lead Architect of TimeCredit Live platform.', CURRENT_TIMESTAMP),
(2, 'Priya Patel', 'priya.patel@timecredit.live', '$2y$10$4n9LzO7N1z/r6xU.5xW1..vS8jH9W1V/mCj7o1tK4.c2Q5F0rA0n.', 'member', 'active', 'Senior Database Administrator & SQL Performance Tuning Enthusiast.', CURRENT_TIMESTAMP),
(3, 'Marcus Vance', 'marcus.vance@timecredit.live', '$2y$10$4n9LzO7N1z/r6xU.5xW1..vS8jH9W1V/mCj7o1tK4.c2Q5F0rA0n.', 'member', 'active', 'Full-stack developer passionate about React, TypeScript, and PWAs.', CURRENT_TIMESTAMP),
(4, 'Sara Kim', 'sara.kim@timecredit.live', '$2y$10$4n9LzO7N1z/r6xU.5xW1..vS8jH9W1V/mCj7o1tK4.c2Q5F0rA0n.', 'member', 'active', 'Product Designer specializing in Claymorphism, micro-interactions, and design systems.', CURRENT_TIMESTAMP),
(5, 'Aarav Sharma', 'aarav.sharma@timecredit.live', '$2y$10$4n9LzO7N1z/r6xU.5xW1..vS8jH9W1V/mCj7o1tK4.c2Q5F0rA0n.', 'member', 'active', 'Computer Science Junior enthusiastic about Machine Learning and Query Optimization.', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- 3. Insert Skills
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

-- 4. User Skills Mapping
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

-- 5. Service Offers
INSERT INTO service_offers (id, teacher_id, skill_id, title, description, duration_minutes, credit_rate, experience_level, language, mode, status) VALUES
(1, 2, 1, 'Mastering Advanced SQL Joins & Subqueries', 'Interactive hands-on session solving real-world multi-table queries and query plans.', 60, 1.00, 'expert', 'English', 'online', 'active'),
(2, 2, 2, 'DBMS Normalization: 1NF to BCNF Step-by-Step', 'Learn functional dependencies, candidate keys, and how to decompose tables with zero anomaly.', 60, 1.00, 'expert', 'English', 'online', 'active'),
(3, 3, 4, 'Modern React & TypeScript Clean Architecture', 'Build resilient frontend apps with strict types, custom hooks, and scalable component structures.', 60, 1.00, 'advanced', 'English', 'online', 'active'),
(4, 4, 7, 'Claymorphism UI Workshop: Shadows & 3D Depth', 'Learn how to construct delightful 3D clay interfaces using CSS inset shadows and pastel palettes.', 45, 0.75, 'expert', 'English', 'online', 'active'),
(5, 5, 6, 'Data Wrangling: SQL into Pandas Dataframes', 'Export SQL result sets directly into Jupyter notebooks for cleaning and chart visualizations.', 30, 0.50, 'intermediate', 'English', 'online', 'active')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

-- 6. Credit Accounts (Initial Balances)
INSERT INTO credit_accounts (id, user_id, balance, updated_at) VALUES
(1, 1, 15.00, CURRENT_TIMESTAMP),
(2, 2, 8.50, CURRENT_TIMESTAMP),
(3, 3, 4.00, CURRENT_TIMESTAMP),
(4, 4, 6.00, CURRENT_TIMESTAMP),
(5, 5, 3.50, CURRENT_TIMESTAMP)
ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance;

-- 7. Service Requests & Completed Sessions
INSERT INTO service_requests (id, offer_id, learner_id, teacher_id, proposed_start_at, requested_duration_minutes, message, status, created_at) VALUES
(1, 1, 3, 2, CURRENT_TIMESTAMP - INTERVAL '2 days', 60, 'Would love your guidance on SQL Query Lab indexing and JOIN optimization!', 'Completed', CURRENT_TIMESTAMP - INTERVAL '3 days'),
(2, 2, 5, 2, CURRENT_TIMESTAMP - INTERVAL '1 day', 60, 'Need help preparing for SEM 5 DBMS Normalization university exam.', 'Completed', CURRENT_TIMESTAMP - INTERVAL '2 days'),
(3, 3, 4, 3, CURRENT_TIMESTAMP + INTERVAL '1 day', 60, 'Excited to integrate TypeScript with my new design system components.', 'Accepted', CURRENT_TIMESTAMP),
(4, 4, 5, 4, CURRENT_TIMESTAMP + INTERVAL '2 days', 45, 'Can you review my claymorphic card shadows and contrast ratios?', 'Pending', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

-- 8. Sessions
INSERT INTO sessions (id, request_id, teacher_id, learner_id, scheduled_start_at, scheduled_end_at, actual_start_at, actual_end_at, eligible_duration_minutes, meeting_room_id, status) VALUES
(1, 1, 2, 3, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '1 hour', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '1 hour', 60, 'timecredit-session-priya-marcus-9021', 'COMPLETED'),
(2, 2, 2, 5, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day' + INTERVAL '1 hour', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day' + INTERVAL '1 hour', 60, 'timecredit-session-priya-aarav-8114', 'COMPLETED'),
(3, 3, 3, 4, CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '1 day' + INTERVAL '1 hour', NULL, NULL, 0, 'timecredit-session-marcus-sara-4521', 'SCHEDULED')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

-- 9. Credit Transactions & Double-Entry Ledger
INSERT INTO credit_transactions (id, session_id, idempotency_key, transaction_type, status, created_at) VALUES
(1, 1, 'SETTLE_SESSION_1_TXN', 'SESSION_SETTLEMENT', 'COMMITTED', CURRENT_TIMESTAMP - INTERVAL '2 days'),
(2, 2, 'SETTLE_SESSION_2_TXN', 'SESSION_SETTLEMENT', 'COMMITTED', CURRENT_TIMESTAMP - INTERVAL '1 day')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

INSERT INTO credit_ledger_entries (id, transaction_id, account_id, entry_type, amount, created_at) VALUES
(1, 1, 3, 'DEBIT', 1.00, CURRENT_TIMESTAMP - INTERVAL '2 days'),  -- Marcus spent 1.00
(2, 1, 2, 'CREDIT', 1.00, CURRENT_TIMESTAMP - INTERVAL '2 days'), -- Priya earned 1.00
(3, 2, 5, 'DEBIT', 1.00, CURRENT_TIMESTAMP - INTERVAL '1 day'),  -- Aarav spent 1.00
(4, 2, 2, 'CREDIT', 1.00, CURRENT_TIMESTAMP - INTERVAL '1 day')  -- Priya earned 1.00
ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount;

-- 10. Reviews
INSERT INTO reviews (id, session_id, reviewer_id, reviewed_user_id, rating, comment, created_at) VALUES
(1, 1, 3, 2, 5, 'Priya is phenomenal! She explained query execution plans, hash joins, and B-Tree indexes so intuitively.', CURRENT_TIMESTAMP - INTERVAL '2 days'),
(2, 2, 5, 2, 5, 'The 3NF vs BCNF examples were crystal clear. Earned every bit of the TimeCredit!', CURRENT_TIMESTAMP - INTERVAL '1 day')
ON CONFLICT (id) DO UPDATE SET rating = EXCLUDED.rating;

-- 11. Notifications
INSERT INTO notifications (id, user_id, title, message, read_at, created_at) VALUES
(1, 2, 'Credits Received!', 'You earned 1.00 TimeCredit for your completed session with Marcus Vance.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP - INTERVAL '2 days'),
(2, 3, 'Session Completed', 'Your session with Priya Patel was completed. 1.00 TimeCredit has been settled.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP - INTERVAL '2 days'),
(3, 4, 'Request Accepted', 'Marcus Vance accepted your request for "Modern React & TypeScript Architecture"!', NULL, CURRENT_TIMESTAMP),
(4, 5, 'Welcome to TimeCredit Live', 'Welcome! 2.00 signup bonus TimeCredits have been credited to your wallet.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP - INTERVAL '5 days')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

-- 12. Saved Queries for SQL Query Lab
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

-- 13. Sync Sequence Auto-Increment Values
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1));
SELECT setval('skill_categories_id_seq', COALESCE((SELECT MAX(id) FROM skill_categories), 1));
SELECT setval('skills_id_seq', COALESCE((SELECT MAX(id) FROM skills), 1));
SELECT setval('user_skills_id_seq', COALESCE((SELECT MAX(id) FROM user_skills), 1));
SELECT setval('service_offers_id_seq', COALESCE((SELECT MAX(id) FROM service_offers), 1));
SELECT setval('service_requests_id_seq', COALESCE((SELECT MAX(id) FROM service_requests), 1));
SELECT setval('sessions_id_seq', COALESCE((SELECT MAX(id) FROM sessions), 1));
SELECT setval('credit_accounts_id_seq', COALESCE((SELECT MAX(id) FROM credit_accounts), 1));
SELECT setval('credit_transactions_id_seq', COALESCE((SELECT MAX(id) FROM credit_transactions), 1));
SELECT setval('credit_ledger_entries_id_seq', COALESCE((SELECT MAX(id) FROM credit_ledger_entries), 1));
SELECT setval('reviews_id_seq', COALESCE((SELECT MAX(id) FROM reviews), 1));
SELECT setval('notifications_id_seq', COALESCE((SELECT MAX(id) FROM notifications), 1));
SELECT setval('saved_queries_id_seq', COALESCE((SELECT MAX(id) FROM saved_queries), 1));
