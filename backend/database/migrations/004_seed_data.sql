-- ============================================================================
-- MIGRATION 004: FOUNDATIONAL SEED DATA & EVALUATOR ACCOUNTS
-- ============================================================================

-- 1. Skill Categories
INSERT INTO skill_categories (id, name, description, icon) VALUES
(1, 'Database Systems & SQL', 'Relational design, normalization, query performance, and ACID transactions.', 'database'),
(2, 'Web & Full-Stack Development', 'Modern web development, React 19, TypeScript, and microservice APIs.', 'code'),
(3, 'Data Science & Machine Learning', 'Python, statistics, algorithms, and data modeling pipelines.', 'cpu'),
(4, 'Computer Science Fundamentals', 'Data structures, algorithms, operating systems, and system design.', 'book-open'),
(5, 'UI/UX & Claymorphism Design', 'Interface aesthetics, 3D soft clay surfaces, and WCAG accessibility.', 'palette'),
(6, 'Languages & Communication', 'Technical speaking, professional presentation, and engineering writing.', 'globe')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon;

SELECT setval('skill_categories_id_seq', (SELECT MAX(id) FROM skill_categories));

-- 2. Foundational Skills
INSERT INTO skills (id, category_id, name, description) VALUES
(1, 1, 'SQL Joins & Complex Queries', 'Mastering INNER/LEFT/RIGHT joins, aggregates, subqueries, and execution plans.'),
(2, 1, 'Database Normalization (1NF to BCNF)', 'Functional dependencies, lossless decomposition, and candidate keys.'),
(3, 1, 'ACID Transactions & Row Locking', 'Transaction isolation levels, concurrency control, and deadlocks.'),
(4, 2, 'React 19 & TypeScript Architecture', 'Modern reactive component patterns, strict hooks, and clean architecture.'),
(5, 2, 'Progressive Web Apps (PWA)', 'Offline service workers, manifest configuration, and background synchronization.'),
(6, 3, 'Python Data Pipelines', 'Data extraction, analysis with pandas, and visualization.'),
(7, 5, 'Claymorphism 3D UI Design', 'Crafting soft 3D clay surfaces, dual inset shadows, and pastel palettes.'),
(8, 4, 'Data Structures & Algorithms', 'Binary trees, graphs, dynamic programming, and algorithmic time complexity.')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

SELECT setval('skills_id_seq', (SELECT MAX(id) FROM skills));

-- 3. Core Evaluator Users (Bcrypt hash for 'password123')
INSERT INTO users (id, full_name, email, password_hash, role, status, bio) VALUES
(1, 'Prof. Alex Chen', 'admin@timecredit.live', '$2y$10$7.R4c.SRZ4K5fEDQnyHlDeLxgJpJ0q.paZYJERegjvPZBC36lEtMy', 'admin', 'active', 'DBMS Architect, relational design specialist, and TimeCredit Live administrator.'),
(2, 'Priya Patel', 'priya.patel@timecredit.live', '$2y$10$7.R4c.SRZ4K5fEDQnyHlDeLxgJpJ0q.paZYJERegjvPZBC36lEtMy', 'member', 'active', 'Senior Database Administrator & PostgreSQL Performance Tuning Engineer.'),
(3, 'Marcus Vance', 'marcus.vance@timecredit.live', '$2y$10$7.R4c.SRZ4K5fEDQnyHlDeLxgJpJ0q.paZYJERegjvPZBC36lEtMy', 'member', 'active', 'Full-Stack Software Engineer specializing in React 19, TypeScript, and micro-frontends.'),
(4, 'Sara Kim', 'sara.kim@timecredit.live', '$2y$10$7.R4c.SRZ4K5fEDQnyHlDeLxgJpJ0q.paZYJERegjvPZBC36lEtMy', 'member', 'active', 'Product Designer & Claymorphism 3D UI/UX specialist.')
ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    password_hash = EXCLUDED.password_hash,
    bio = EXCLUDED.bio;

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- 4. User Skills Bridges
INSERT INTO user_skills (user_id, skill_id, skill_type, experience_level) VALUES
(2, 1, 'OFFER', 'expert'),
(2, 2, 'OFFER', 'expert'),
(2, 4, 'WANT', 'intermediate'),
(3, 4, 'OFFER', 'advanced'),
(3, 5, 'OFFER', 'advanced'),
(3, 1, 'WANT', 'beginner'),
(4, 7, 'OFFER', 'expert'),
(4, 3, 'WANT', 'beginner')
ON CONFLICT (user_id, skill_id, skill_type) DO NOTHING;

-- 5. Service Offers
INSERT INTO service_offers (id, teacher_id, skill_id, title, description, duration_minutes, credit_rate, experience_level, language, mode, status) VALUES
(1, 2, 1, 'Advanced Relational Database Design & Query Tuning', 'Learn how to construct normalized schemas, optimize indexing strategies, and troubleshoot execution bottlenecks in PostgreSQL.', 60, 1.00, 'expert', 'English', 'online', 'active'),
(2, 3, 4, 'Modern React 19 & TypeScript Clean Architecture', 'Build enterprise-grade frontend apps with strict types, custom hooks, and scalable component structures.', 60, 1.00, 'advanced', 'English', 'online', 'active'),
(3, 4, 7, 'Claymorphism 3D Design Systems & Modern CSS', 'Master soft 3D surfaces, multiple pillowy shadows, dual inset bevels, and accessible pastel palettes.', 45, 0.75, 'expert', 'English', 'online', 'active')
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description;

SELECT setval('service_offers_id_seq', (SELECT MAX(id) FROM service_offers));

-- 6. Credit Wallets & Initial Balances
INSERT INTO credit_accounts (id, user_id, balance) VALUES
(1, 1, 15.00),
(2, 2, 8.50),
(3, 3, 4.00),
(4, 4, 6.00)
ON CONFLICT (user_id) DO UPDATE SET
    balance = EXCLUDED.balance;

SELECT setval('credit_accounts_id_seq', (SELECT MAX(id) FROM credit_accounts));

-- 7. Initial Ledger Entries
INSERT INTO credit_transactions (id, idempotency_key, transaction_type, status) VALUES
(1, 'SEED_SIGNUP_BONUS_1', 'SIGNUP_BONUS', 'COMMITTED'),
(2, 'SEED_SIGNUP_BONUS_2', 'SIGNUP_BONUS', 'COMMITTED'),
(3, 'SEED_SIGNUP_BONUS_3', 'SIGNUP_BONUS', 'COMMITTED'),
(4, 'SEED_SIGNUP_BONUS_4', 'SIGNUP_BONUS', 'COMMITTED')
ON CONFLICT (idempotency_key) DO NOTHING;

SELECT setval('credit_transactions_id_seq', (SELECT MAX(id) FROM credit_transactions));

INSERT INTO credit_ledger_entries (transaction_id, account_id, entry_type, amount) VALUES
(1, 1, 'CREDIT', 2.00),
(2, 2, 'CREDIT', 2.00),
(3, 3, 'CREDIT', 2.00),
(4, 4, 'CREDIT', 2.00)
ON CONFLICT DO NOTHING;
