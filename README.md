# Masaken Fandkanood - Enterprise Hotel Management System

## 🏗️ Approved Architecture

This environment is prepared based on the following approved architecture:

### 🔵 Backend (Orchestration Layer)
- **Tech Stack:** Node.js + TypeScript
- **Role:** Orchestration only.
- **Responsibilities:**
  - Check availability.
  - Session management.
  - RPC calls to Database.
  - Permission control.
- **Strictly Forbidden:**
  - No financial logic.
  - No VAT calculations.
  - No journal entry creation.
  - No debit/credit balancing.

### 🟢 Database (Core Engine)
- **Tech Stack:** Supabase (PostgreSQL)
- **Role:** The "Brain" and "Accountant".
- **Responsibilities:**
  - Full accounting logic (Double Entry, Accrual).
  - Journal entries & posting.
  - Closing periods.
  - Deferred revenue management.
  - Data integrity (Constraints / Triggers).
  - **Central Engine:** `post_transaction()` RPC.

### 🟣 Frontend (Presentation Layer)
- **Tech Stack:** Next.js
- **Role:** UI/UX.
- **Responsibilities:**
  - Display data.
  - User input.
  - Role-based views.
- **Strictly Forbidden:**
  - No financial logic.

---

## 📂 Project Structure

- **/backend**: Node.js + TypeScript source code (Orchestration).
- **/frontend**: Next.js source code (UI).
- **/database**: SQL scripts for Database Schema & Seed Data.
  - `master_database_setup_v2.sql`: **The Core Environment.** Contains all tables, the accounting engine, RLS policies, and seed data.
  - `seed_demo_booking_cycle.sql`: Verification script to test the accounting engine.

## 🔐 Security & Roles (RLS)

- **Admin**: Full Access.
- **Manager**: Full Access + Reports.
- **Accountant**: Invoices & Journals.
- **Reception**: Bookings (View/Create).

## 🧪 Verification

To verify the environment, run the SQL scripts in `/database` against your PostgreSQL/Supabase instance.
