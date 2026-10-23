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
  - Stored using `DECIMAL(10, 2)` / `NUMERIC(10, 2)` precision (never floating-point).
  - Append-only double-entry ledger (`credit_transactions` and `credit_ledger_entries`).
  - Strict balancing: every session settlement creates balanced `DEBIT` (learner) and `CREDIT` (teacher) entries.
  - Database row locking (`SELECT ... FOR UPDATE`) to eliminate concurrent double-spending or race conditions.
  - Unique idempotency keys to guarantee sessions cannot be settled more than once.

### 3. Live Video Classroom (WebRTC & Jitsi Meet Integration)
- Integrated real-time video conferencing with camera/mic controls, screen sharing, and chat.
- Live elapsed session timer with real-time credit accrual display.
- One-click **End & Settle Session** action triggering double-entry credit transfer and celebratory confetti.

### 4. Razorpay TimeCredit Top-Up Gateway
- 3 fixed server-controlled packages:
  - **Starter**: 10 Credits = ₹27 (150 min)
  - **Standard**: 20 Credits = ₹52 (300 min - Most Popular)
  - **Premium**: 30 Credits = ₹75 (450 min)
- HMAC SHA256 cryptographic verification & asynchronous webhook fulfillment.

### 5. Multi-Database Architecture (Neon PostgreSQL + MySQL 8+)
- 19 structured relational tables with primary keys, foreign keys, cascades, indexes, triggers, and views.
- Fully compatible with **Neon Serverless PostgreSQL** and standard MySQL 8+.

---

## 📂 Project Structure

```text
DBMS/
├── frontend/                         # React 19 + TypeScript + Vite PWA
│   ├── public/                       # Manifest, Service Worker, 3D Clay icons
│   ├── src/
│   │   ├── components/clay/          # Reusable Claymorphism UI component library
│   │   ├── pages/                    # 13 Application Pages (Dashboard, LiveClassroom, Wallet, etc.)
│   │   ├── services/                 # Unified API client & WebAssembly DB Engine
│   │   └── types/                    # Strict TypeScript interfaces
│   └── vercel.json                   # Vercel deployment configuration
├── backend/                          # PHP 8.3 REST API
│   ├── config/database.php           # Auto-switching PostgreSQL / MySQL PDO
│   ├── database/                     # PostgreSQL & MySQL schemas and seeders
│   │   ├── postgres-full-setup.sql   # 1-Click Neon SQL Editor setup
│   │   ├── postgres-schema.sql
│   │   ├── schema.sql
│   │   └── seeders/
│   ├── src/controllers/              # API Controllers (Auth, Sessions, Wallet, Razorpay)
│   ├── public/index.php              # Front Controller
│   └── Dockerfile                    # Container configuration for Render / Railway
├── tests/                            # Automated test runner (18/18 test cases)
└── README.md
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

---

## 🚀 100% Free Cloud Deployment Guide

### 1. Database on Neon (Serverless PostgreSQL)
1. Go to [Neon.tech](https://neon.tech) and create a free project named `timecredit-db`.
2. Open the **SQL Editor** tab in Neon.
3. Paste the contents of `backend/database/postgres-full-setup.sql` (or `postgres-full-setup.sql` at root) and click **Run**.
4. Copy your pooled connection string:
   ```text
   postgresql://neondb_owner:PASSWORD@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

### 2. Backend on Render (Free Docker Web Service)
1. Go to [Render.com](https://render.com) and create a **New Web Service** connected to `https://github.com/unfav72/time-credit-api`.
2. Configure:
   - **Environment:** Docker
   - **Docker Command / Context:** `backend`
   - **Dockerfile Path:** `backend/Dockerfile`
   - **Plan:** Free
3. Add Environment Variables:
   - `DATABASE_URL` = *(Your Neon PostgreSQL connection string)*
   - `SESSION_SECRET` = *(Any 32-character random string)*
   - `RAZORPAY_KEY_ID` = `rzp_test_TrFi6LyCzcSU8k`
   - `RAZORPAY_KEY_SECRET` = `WduRtA2i4mvCeNt4DfobW8cC`
   - `RAZORPAY_WEBHOOK_SECRET` = `whsec_TimeCreditLive2026_test`
   - `FRONTEND_URL` = `https://your-frontend.vercel.app`
4. Click **Deploy Web Service**. You will receive an API URL: `https://time-credit-api-xxxx.onrender.com`.

### 3. Frontend on Vercel (Free PWA Hosting)
1. Go to [Vercel.com](https://vercel.com) and import `https://github.com/unfav72/time-credit-api`.
2. In Project Settings:
   - **Framework Preset:** Vite
   - **Root Directory:** Click Edit and select `frontend`
3. Add Environment Variable:
   - `VITE_API_URL` = `https://time-credit-api-xxxx.onrender.com/api/v1`
4. Click **Deploy**. Your frontend is live with automatic SSL, caching, and PWA support!
