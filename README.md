# TimeCredit Live — Full-Stack DBMS & Skill Exchange PWA

> **Tagline:** Share Skills. Earn Time. Grow Together.  
> **A Claymorphism-based, SQL-powered skill exchange and live-learning Progressive Web Application (PWA) demonstrating Database Management System concepts through a functional SQL backend.**

---

## 📸 Project Identity & Claymorphism Logo

TimeCredit Live features a soft 3D **Claymorphism** design system with dual pillowy shadows, pastel color accents (pastel sky blue, lavender, mint green, and porcelain white surfaces), and high-contrast deep navy typography.

The official 3D clay app icon is located at:
- `frontend/public/logo.png`
- `frontend/public/icons/icon-192.png`
- `frontend/public/icons/icon-512.png`

---

## 🌟 Core Features & DBMS Demonstration

### 1. Interactive SQL Query Lab (Primary DBMS Capstone Feature)
- **Split-Pane Layout**:
  - **Left Pane**: Relational table and database explorer with expandable table names, column data types, primary key (`PK`) and foreign key (`FK`) badges, and click-to-query shortcuts.
  - **Center Pane**: Monospace SQL code editor with syntax formatting, line numbers, clear, save query, and execute (`Ctrl + Enter`) shortcuts.
  - **Bottom/Right Pane**: Query results table with execution duration in milliseconds, affected row counts, pagination, JSON copy, and CSV export.
- **Educational SQL Support**:
  - `SELECT`, `WHERE`, `ORDER BY`, `GROUP BY`, `HAVING`, `DISTINCT`, `LIMIT`
  - Multi-table `INNER JOIN`, `LEFT JOIN`, `RIGHT JOIN`, self-joins
  - Aggregations: `COUNT()`, `SUM()`, `AVG()`, `MIN()`, `MAX()`
  - DDL & DML: `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, `INSERT`, `UPDATE`, `DELETE`
  - Subqueries and transaction control
- **Controlled Practice Database (`timecredit_practice`)**:
  - Isolated educational sandbox containing `students`, `courses`, `enrollments`, `instructors`, `practice_credit_logs`, `study_groups`, and `assignments`.
  - One-click **Reset Practice DB** button to safely restore clean seed data at any time.

### 2. TimeCredit Wallet & Double-Entry Accounting
- **Core Rule**: **One eligible hour of teaching earns 1.00 TimeCredit** (a 30-minute verified session earns 0.50 TimeCredits).
- **Relational Ledger Integrity**:
  - Stored using `DECIMAL(10, 2)` precision (never floating-point).
  - Append-only double-entry ledger (`credit_transactions` and `credit_ledger_entries`).
  - Strict balancing: every session settlement creates balanced `DEBIT` (learner) and `CREDIT` (teacher) entries.
  - Database row locking (`SELECT ... FOR UPDATE`) to eliminate concurrent double-spending or race conditions.
  - Unique idempotency keys to guarantee sessions cannot be settled more than once.

### 3. Live Video Classroom (Jitsi Meet Integration)
- Integrated real-time video conferencing using Jitsi Meet.
- Camera and microphone controls, screen sharing, and meeting chat.
- Live elapsed session timer with real-time credit accrual display.
- One-click **End & Settle Session** action triggering double-entry credit transfer and celebratory confetti.
- Dual-mode support: Real Jitsi Meet iframe streaming or high-fidelity Claymorphic interactive classroom.

### 4. Normalized MySQL 8+ Schema (3NF/BCNF)
- 17 structured tables with primary keys, foreign key constraints, `ON DELETE CASCADE / RESTRICT`, unique keys, and indexes:
  - `users`
  - `skill_categories`
  - `skills`
  - `user_skills` (Many-to-Many bridge)
  - `service_offers`
  - `service_requests`
  - `sessions`
  - `session_participants`
  - `credit_accounts`
  - `credit_transactions`
  - `credit_ledger_entries`
  - `reviews`
  - `notifications`
  - `chat_messages`
  - `saved_queries`
  - `query_history`
  - `audit_logs`
- **Views**:
  - `v_popular_skills`
  - `v_teacher_leaderboard`
  - `v_active_sessions`
  - `v_user_credit_summary`
- **Stored Procedures**:
  - `sp_settle_session_credits`: Atomic session completion and credit transfer with rollback exception handler.
- **Triggers**:
  - `trg_after_user_insert`: Automatically creates credit account with 2.00 signup welcome credits.

### 5. Progressive Web App (PWA)
- Web App Manifest (`manifest.webmanifest`) configured with standalone display mode.
- Service Worker (`sw.js`) caching application shell and static assets for offline navigation.
- Dedicated Claymorphic offline fallback page (`offline.html`).
- Evaluator install app banner and prompt handler.

---

## 📂 Project Structure

```text
DBMS/
├── frontend/
│   ├── public/
│   │   ├── manifest.webmanifest      # PWA Web App Manifest
│   │   ├── sw.js                     # PWA Service Worker caching
│   │   ├── offline.html              # Claymorphic offline fallback
│   │   ├── logo.png                  # 3D Claymorphism App Icon
│   │   └── icons/
│   │       ├── icon-192.png
│   │       └── icon-512.png
│   ├── src/
│   │   ├── components/clay/          # Reusable Claymorphism UI Library
│   │   │   ├── ClayCard.tsx
│   │   │   ├── ClayButton.tsx
│   │   │   ├── ClayInput.tsx
│   │   │   ├── ClayBadge.tsx
│   │   │   ├── ClayStatCard.tsx
│   │   │   ├── ClayModal.tsx
│   │   │   ├── ClayNavbar.tsx
│   │   │   └── ClaySidebar.tsx
│   │   ├── pages/                    # 13 Application Pages
│   │   │   ├── LandingPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── SqlQueryLabPage.tsx   # Flagship DBMS SQL Editor
│   │   │   ├── LiveClassroomPage.tsx # Jitsi Meet & Session Timer
│   │   │   ├── WalletPage.tsx        # Double-entry ledger
│   │   │   ├── DatabaseExplorerPage.tsx # ERD & Table Inspector
│   │   │   ├── SkillsPage.tsx
│   │   │   ├── BrowseServicesPage.tsx
│   │   │   ├── ServiceRequestsPage.tsx
│   │   │   ├── SessionsPage.tsx
│   │   │   ├── ReportsPage.tsx
│   │   │   ├── ProfilePage.tsx
│   │   │   ├── NotificationsPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── services/
│   │   │   ├── api.ts                # Unified API client
│   │   │   └── dbEngine.ts           # WebAssembly real SQL engine
│   │   ├── types/
│   │   │   └── index.ts              # TypeScript domain types
│   │   ├── index.css                 # Claymorphism Design System CSS
│   │   ├── App.tsx                   # Master router & state
│   │   └── main.tsx
│   └── package.json
├── backend/
│   ├── config/
│   │   └── database.php              # PDO configurations
│   ├── database/
│   │   ├── schema.sql                # Production MySQL 8+ Schema
│   │   ├── practice-schema.sql       # Controlled practice sandbox
│   │   └── seeders/
│   │       └── seed.sql              # Rich seed data
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── AuthController.php    # Bcrypt hashing & sessions
│   │   │   ├── SkillController.php
│   │   │   ├── RequestController.php
│   │   │   ├── SessionController.php # Atomic credit settlement
│   │   │   ├── WalletController.php
│   │   │   ├── SqlLabController.php  # Dedicated SQL execution API
│   │   │   └── ReportController.php
│   │   ├── middleware/
│   │   │   └── AuthMiddleware.php
│   │   └── repositories/
│   │       └── Database.php
│   ├── public/
│   │   └── index.php                 # REST API Front Controller
│   └── .env.example
├── tests/
│   └── DatabaseTest.php              # Ledger & rule verification
└── README.md
```

---

## 🚀 How to Run Locally

### 1. Run the Frontend (React + Vite + TypeScript)
```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173** in your browser.

> **Note for Evaluators:** The frontend features an **embedded WebAssembly SQL engine (`sql.js`)** that parses and executes real relational SQL statements directly in your browser. All 13 pages, live classroom features, and SQL Query Lab operations work immediately out-of-the-box!

### 2. Run the PHP & MySQL Backend (Optional / Production)
1. Import `backend/database/schema.sql` and `backend/database/seeders/seed.sql` into MySQL 8+ (`timecredit_db`).
2. Import `backend/database/practice-schema.sql` into MySQL 8+ (`timecredit_practice`).
3. Copy `backend/.env.example` to `backend/.env` and update MySQL credentials.
4. Start the PHP server:
```bash
cd backend
php -S 127.0.0.1:8000 -t public
```

---

## 👥 Demo Evaluator Accounts (1-Click Switchable in Navbar)

| Account | Email | Role | TimeCredits | Specialty |
|---|---|---|---|---|
| **Prof. Alex Chen** | `admin@timecredit.live` | Admin | 15.00 TC | DBMS Architect |
| **Priya Patel** | `priya.patel@timecredit.live` | Member | 8.50 TC | Senior DBA & SQL Tuning |
| **Marcus Vance** | `marcus.vance@timecredit.live` | Member | 4.00 TC | React 19 & TypeScript |
| **Sara Kim** | `sara.kim@timecredit.live` | Member | 6.00 TC | Claymorphism 3D UI |

*Password for all test accounts is `password123`.*
#   t i m e - c r e d i t - a p i  
 #   D B M S - A P I  
 