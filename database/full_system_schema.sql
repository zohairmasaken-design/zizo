-- =================================================================================
-- ملف قاعدة البيانات الشامل (Full System Schema - Enterprise Accounting & Operations)
-- =================================================================================
-- هذا الملف يجمع كافة التحديثات والإصلاحات في ملف واحد شامل.
-- This file merges all updates and fixes into a single comprehensive file.
-- =================================================================================

BEGIN;

-- =============================================
-- 1. تنظيف قاعدة البيانات (Clean Database)
-- =============================================
DROP VIEW IF EXISTS public.vw_ar_aging CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.system_events CASCADE;
DROP TABLE IF EXISTS public.revenue_schedules CASCADE;
DROP TABLE IF EXISTS public.payment_allocations CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.ar_subledger CASCADE;
DROP TABLE IF EXISTS public.journal_lines CASCADE;
DROP TABLE IF EXISTS public.journal_entries CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.booking_guests CASCADE;
DROP TABLE IF EXISTS public.booking_commissions CASCADE;
DROP TABLE IF EXISTS public.booking_parties CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.cost_centers CASCADE;
DROP TABLE IF EXISTS public.customer_accounts CASCADE;
DROP TABLE IF EXISTS public.payment_methods CASCADE;
DROP TABLE IF EXISTS public.expense_accruals CASCADE;
DROP TABLE IF EXISTS public.pricing_rules CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.units CASCADE;
DROP TABLE IF EXISTS public.unit_types CASCADE;
DROP TABLE IF EXISTS public.hotels CASCADE;
DROP TABLE IF EXISTS public.accounting_periods CASCADE;
DROP TABLE IF EXISTS public.transaction_types CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;

-- Drop Functions & Triggers
DROP FUNCTION IF EXISTS public.post_transaction CASCADE;
DROP FUNCTION IF EXISTS public.accounting_post_transaction CASCADE;
DROP FUNCTION IF EXISTS public.get_open_accounting_period CASCADE;
DROP FUNCTION IF EXISTS public.enforce_journal_balance CASCADE;
DROP FUNCTION IF EXISTS public.check_journal_balance CASCADE;
DROP FUNCTION IF EXISTS public.prevent_posting_in_closed_period CASCADE;
DROP FUNCTION IF EXISTS public.check_period_status CASCADE;
DROP FUNCTION IF EXISTS public.audit_record_changes CASCADE;
DROP FUNCTION IF EXISTS public.create_booking_v3 CASCADE;
DROP FUNCTION IF EXISTS public.register_payment CASCADE;
DROP FUNCTION IF EXISTS public.sync_ar_subledger CASCADE;
DROP FUNCTION IF EXISTS public.prevent_double_revenue CASCADE;
DROP FUNCTION IF EXISTS public.run_night_audit CASCADE;
DROP FUNCTION IF EXISTS public.get_current_user_role CASCADE;
DROP FUNCTION IF EXISTS public.create_customer_account CASCADE;

-- =============================================
-- 2. الإضافات الأساسية (Extensions)
-- =============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist"; -- Required for prevention of double bookings and overlapping periods

-- =============================================
-- 3. تعريف الجداول (Schema Definition)
-- =============================================

-- 3.1 الفترات المحاسبية (With Overlap Protection)
CREATE TABLE public.accounting_periods (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status text NOT NULL CHECK (status IN ('open','closed')) DEFAULT 'open',
    closed_at timestamp with time zone,
    closed_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    -- Prevent overlapping open periods
    CONSTRAINT only_one_open_period EXCLUDE USING gist (
        daterange(start_date, end_date, '[]') WITH &&,
        status WITH =
    ) WHERE (status = 'open')
);

-- 3.2 جدول الفنادق
CREATE TABLE public.hotels (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    code text,
    floors_count integer DEFAULT 0,
    tax_rate numeric DEFAULT 0.15,
    currency text DEFAULT 'SAR',
    type text,
    description text,
    address text,
    phone text,
    email text,
    amenities jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);

-- 3.3 جدول أنواع الوحدات (With Tax Rate)
CREATE TABLE public.unit_types (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    hotel_id uuid REFERENCES public.hotels(id),
    name text NOT NULL,
    description text,
    daily_price numeric DEFAULT 0 CHECK (daily_price >= 0),
    annual_price numeric DEFAULT 0 CHECK (annual_price >= 0),
    tax_rate numeric DEFAULT 0.15, -- Added tax_rate
    area numeric,
    max_adults integer DEFAULT 2,
    max_children integer DEFAULT 0,
    features jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);

-- 3.4 جدول الوحدات
CREATE TABLE public.units (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    hotel_id uuid REFERENCES public.hotels(id),
    unit_type_id uuid REFERENCES public.unit_types(id),
    unit_number text NOT NULL,
    floor text,
    view_type text,
    notes text,
    status text DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'cleaning')),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);

-- 3.5 جدول العملاء
CREATE TABLE public.customers (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    full_name text NOT NULL,
    national_id text,
    phone text,
    customer_type text DEFAULT 'individual' CHECK (customer_type IN ('individual','company','broker','platform')),
    nationality text,
    email text,
    country text DEFAULT 'Saudi Arabia',
    address text,
    commercial_register text,
    tax_number text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);

-- 3.6 دليل الحسابات
CREATE TABLE public.accounts (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    code text UNIQUE NOT NULL,
    name text NOT NULL,
    type text NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    parent_id uuid REFERENCES public.accounts(id),
    is_active boolean DEFAULT true,
    is_system boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);

-- 3.7 الأستاذ المساعد للعملاء (Customer Subledger Settings)
CREATE TABLE public.customer_accounts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id uuid NOT NULL REFERENCES public.customers(id),
    account_id uuid NOT NULL REFERENCES public.accounts(id), -- AR Account
    deposit_account_id uuid REFERENCES public.accounts(id), -- Unearned Revenue
    opening_balance numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (customer_id)
);

-- 3.8 طرق الدفع
CREATE TABLE public.payment_methods (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    account_id uuid REFERENCES public.accounts(id), -- Bank/Cash Account
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- 3.9 مراكز التكلفة
CREATE TABLE public.cost_centers (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    type text,
    created_at timestamp with time zone DEFAULT now()
);

-- 3.10 جدول الحجوزات (With Availability Constraint)
CREATE TABLE public.bookings (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    hotel_id uuid REFERENCES public.hotels(id),
    unit_id uuid REFERENCES public.units(id),
    customer_id uuid REFERENCES public.customers(id),
    check_in date NOT NULL,
    check_out date NOT NULL,
    nights integer,
    booking_type text DEFAULT 'nightly',
    status text DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed', 'checked_in', 'checked_out')),
    total_price numeric DEFAULT 0 CHECK (total_price >= 0),
    tax_amount numeric DEFAULT 0 CHECK (tax_amount >= 0),
    subtotal numeric DEFAULT 0 CHECK (subtotal >= 0),
    daily_rate numeric DEFAULT 0, -- Needed for Night Audit
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    CONSTRAINT check_dates CHECK (check_out > check_in),
    -- Availability Engine: Prevent Double Booking
    CONSTRAINT prevent_double_booking EXCLUDE USING gist (
        unit_id WITH =,
        daterange(check_in, check_out, '[]') WITH &&
    ) WHERE (status IN ('confirmed', 'checked_in'))
);

-- 3.11 الفواتير
CREATE TABLE public.invoices (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    booking_id uuid REFERENCES public.bookings(id),
    customer_id uuid REFERENCES public.customers(id),
    invoice_number text UNIQUE,
    invoice_date date DEFAULT CURRENT_DATE,
    due_date date,
    subtotal numeric DEFAULT 0,
    tax_amount numeric DEFAULT 0,
    total_amount numeric DEFAULT 0,
    paid_amount numeric DEFAULT 0,
    balance_due numeric GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'paid', 'void')),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);

-- 3.12 قيود اليومية
CREATE TABLE public.journal_entries (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    accounting_period_id uuid REFERENCES public.accounting_periods(id),
    entry_date date NOT NULL,
    description text,
    reference_type text,
    reference_id uuid,
    voucher_number text UNIQUE,
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_at timestamp with time zone
);

-- 3.13 تفاصيل القيود
CREATE TABLE public.journal_lines (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    account_id uuid REFERENCES public.accounts(id),
    cost_center_id uuid REFERENCES public.cost_centers(id),
    debit numeric DEFAULT 0 CHECK (debit >= 0),
    credit numeric DEFAULT 0 CHECK (credit >= 0),
    description text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT check_line_amount CHECK (debit > 0 OR credit > 0)
);

-- 3.14 AR Subledger (توحيد حسابات العملاء)
CREATE TABLE public.ar_subledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES public.customers(id),
    journal_entry_id uuid NOT NULL REFERENCES public.journal_entries(id),
    amount numeric(14,2) NOT NULL,
    direction text CHECK (direction IN ('debit','credit')),
    transaction_date date NOT NULL,
    due_date date,
    created_at timestamp DEFAULT now()
);

-- 3.15 جدول المدفوعات
CREATE TABLE public.payments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id uuid REFERENCES public.customers(id),
    invoice_id uuid REFERENCES public.invoices(id),
    payment_method_id uuid REFERENCES public.payment_methods(id),
    amount numeric NOT NULL CHECK (amount > 0),
    payment_date date NOT NULL DEFAULT CURRENT_DATE,
    journal_entry_id uuid REFERENCES public.journal_entries(id),
    description text,
    status text DEFAULT 'posted',
    created_at timestamp with time zone DEFAULT now()
);

-- 3.16 تخصيص المدفوعات
CREATE TABLE public.payment_allocations (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    payment_id uuid REFERENCES public.payments(id),
    invoice_id uuid REFERENCES public.invoices(id),
    amount numeric NOT NULL CHECK (amount > 0),
    created_at timestamp with time zone DEFAULT now()
);

-- 3.17 جدول الإيرادات المؤجلة (Revenue Recognition Schedule)
CREATE TABLE public.revenue_schedules (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
    recognition_date date NOT NULL,
    amount numeric NOT NULL CHECK (amount >= 0),
    recognized boolean DEFAULT false,
    journal_entry_id uuid REFERENCES public.journal_entries(id),
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (booking_id, recognition_date) -- IFRS Guard: Prevent Double Recognition
);

-- 3.18 Pricing Engine (محرك التسعير)
CREATE TABLE public.pricing_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_type_id uuid REFERENCES public.unit_types(id),
    season text,
    start_date date,
    end_date date,
    price numeric(10,2),
    priority int DEFAULT 1,
    active boolean DEFAULT true
);

-- 3.19 Expense Accruals (الاستحقاقات)
CREATE TABLE public.expense_accruals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_account_id uuid REFERENCES public.accounts(id),
    amount numeric(14,2),
    accrual_date date,
    description text,
    reversed boolean DEFAULT false
);

-- 3.20 سجل التدقيق
CREATE TABLE public.audit_logs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name text,
    record_id uuid,
    action text CHECK (action IN ('INSERT','UPDATE','DELETE')),
    old_data jsonb,
    new_data jsonb,
    changed_by uuid, -- User ID
    created_at timestamp with time zone DEFAULT now()
);

-- 3.21 سجل أحداث النظام والتنبيهات
CREATE TABLE public.system_events (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type text NOT NULL, -- booking_created, check_in, check_out, room_needs_cleaning, cleaning_done, payment_settled, arrival_today, departure_today, staff_note
    booking_id uuid REFERENCES public.bookings(id),
    unit_id uuid REFERENCES public.units(id),
    customer_id uuid REFERENCES public.customers(id),
    hotel_id uuid REFERENCES public.hotels(id),
    staff_note_id uuid, -- Optional link to staff_notes (defined in separate script)
    payload jsonb, -- Extra details (dates, amounts, texts)
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid, -- auth user who caused the event when applicable
    is_read boolean DEFAULT false
);

-- 3.22 أنواع العمليات
CREATE TABLE public.transaction_types (
    code text PRIMARY KEY,
    description text
);

-- 3.23 أدوار المستخدمين
CREATE TABLE public.user_roles (
    user_id uuid PRIMARY KEY,
    role text NOT NULL CHECK (role IN ('admin', 'manager', 'accountant', 'reception')),
    created_at timestamp with time zone DEFAULT now()
);

-- =============================================
-- 4. الفهارس (Indexes)
-- =============================================
CREATE INDEX idx_journal_entries_period ON public.journal_entries (accounting_period_id);
CREATE INDEX idx_journal_lines_entry ON public.journal_lines (journal_entry_id);
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs (table_name, record_id);
CREATE INDEX idx_invoices_customer ON public.invoices (customer_id);
CREATE INDEX idx_payments_customer ON public.payments (customer_id);
CREATE INDEX idx_revenue_schedules_date ON public.revenue_schedules (recognition_date);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_dates ON public.bookings(check_in, check_out);
CREATE INDEX idx_payments_status ON public.payments(status);

-- =============================================
-- 5. المشاهدات (Views)
-- =============================================

-- 5.1 AR Aging View
CREATE OR REPLACE VIEW public.vw_ar_aging AS 
SELECT 
    customer_id, 
    SUM (
        CASE 
            WHEN due_date < CURRENT_DATE THEN 
                CASE WHEN direction = 'debit' THEN amount ELSE -amount END
            ELSE 0 
        END 
    ) AS overdue_amount,
    SUM (
        CASE WHEN direction = 'debit' THEN amount ELSE -amount END
    ) as total_balance
FROM public.ar_subledger 
GROUP BY customer_id;

-- =============================================
-- 6. الدوال والمشغلات (Functions & Triggers)
-- =============================================

-- 6.1 Helper Functions
CREATE OR REPLACE FUNCTION public.get_open_accounting_period(p_date date)
RETURNS uuid AS $$
DECLARE
    v_period_id uuid;
BEGIN
    SELECT id INTO v_period_id
    FROM public.accounting_periods
    WHERE start_date <= p_date AND end_date >= p_date
    AND status = 'open'
    LIMIT 1;

    IF v_period_id IS NULL THEN
        RAISE EXCEPTION 'No open accounting period found for date %', p_date;
    END IF;

    RETURN v_period_id;
END;
$$ LANGUAGE plpgsql;

-- 6.2 Customer Account Auto-Creation
CREATE OR REPLACE FUNCTION public.create_customer_account() 
RETURNS TRIGGER AS $$ 
BEGIN 
  -- Find the default AR account (1200)
  -- Insert into customer_accounts if not exists
  INSERT INTO public.customer_accounts (customer_id, account_id, opening_balance) 
  SELECT NEW.id, (SELECT id FROM accounts WHERE code = '1200' LIMIT 1), 0 
  WHERE NOT EXISTS ( 
    SELECT 1 FROM customer_accounts WHERE customer_id = NEW.id 
  ); 
  RETURN NEW; 
END; 
$$ LANGUAGE plpgsql; 

CREATE TRIGGER trg_create_customer_account 
AFTER INSERT ON public.customers 
FOR EACH ROW 
EXECUTE FUNCTION public.create_customer_account();

-- 6.3 Journal Balance Check
CREATE OR REPLACE FUNCTION public.check_journal_balance() 
RETURNS TRIGGER AS $$ 
DECLARE 
  v_debit numeric; 
  v_credit numeric; 
BEGIN 
  -- Only check when status changes to 'posted' or inserted as 'posted'
  IF (TG_OP = 'INSERT' AND NEW.status = 'posted') OR (TG_OP = 'UPDATE' AND NEW.status = 'posted' AND OLD.status != 'posted') THEN
      SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0) INTO v_debit, v_credit 
      FROM journal_lines 
      WHERE journal_entry_id = NEW.id; 

      IF v_debit <> v_credit THEN 
        RAISE EXCEPTION 'Journal Entry % not balanced: debit % <> credit %', NEW.id, v_debit, v_credit; 
      END IF; 
  END IF;
  RETURN NEW; 
END; 
$$ LANGUAGE plpgsql; 

CREATE TRIGGER trg_check_journal_balance 
AFTER INSERT OR UPDATE ON public.journal_entries 
FOR EACH ROW 
EXECUTE FUNCTION public.check_journal_balance();

-- 6.4 Sync AR Subledger
CREATE OR REPLACE FUNCTION public.sync_ar_subledger()
RETURNS TRIGGER AS $$
DECLARE
    v_account_code text;
    v_customer_id uuid;
    v_entry_type text;
BEGIN
    -- Get Account Code
    SELECT code INTO v_account_code FROM public.accounts WHERE id = NEW.account_id;
    
    -- Only process if Account is 1200 (AR)
    IF v_account_code = '1200' THEN
        -- Try to fetch customer from the Journal Entry source
        SELECT 
            CASE 
                WHEN je.reference_type = 'booking' THEN (SELECT customer_id FROM public.bookings WHERE id = je.reference_id)
                WHEN je.reference_type = 'invoice' THEN (SELECT customer_id FROM public.invoices WHERE id = je.reference_id)
                WHEN je.reference_type = 'payment' THEN (SELECT customer_id FROM public.payments WHERE id = je.reference_id)
                ELSE NULL 
            END
        INTO v_customer_id
        FROM public.journal_entries je
        WHERE je.id = NEW.journal_entry_id;

        IF v_customer_id IS NOT NULL THEN
            v_entry_type := CASE WHEN NEW.debit > 0 THEN 'debit' ELSE 'credit' END;
            
            INSERT INTO public.ar_subledger (
                customer_id,
                journal_entry_id,
                amount,
                direction,
                transaction_date,
                due_date
            )
            VALUES (
                v_customer_id,
                NEW.journal_entry_id,
                GREATEST(NEW.debit, NEW.credit),
                v_entry_type,
                CURRENT_DATE,
                CURRENT_DATE + INTERVAL '30 days'
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_ar
AFTER INSERT ON public.journal_lines
FOR EACH ROW
EXECUTE FUNCTION public.sync_ar_subledger();

-- 6.5 Enhanced Post Transaction (The Core Engine)
CREATE OR REPLACE FUNCTION public.post_transaction(
    p_transaction_type text, -- 'advance_payment', 'revenue_recognition', 'payment', 'invoice_issue', 'refund', 'adjustment'
    p_source_type text, -- 'booking', 'invoice', 'payment'
    p_source_id uuid,
    p_amount numeric,
    p_customer_id uuid DEFAULT NULL,
    p_payment_method_id uuid DEFAULT NULL,
    p_transaction_date date DEFAULT CURRENT_DATE,
    p_description text DEFAULT NULL,
    p_tax_amount numeric DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    v_journal_id uuid;
    v_period_id uuid;
    v_cash_account uuid;
    v_customer_account uuid;
    v_unearned_account uuid;
    v_revenue_account uuid;
    v_vat_account uuid;
    v_ar_account uuid;
    v_voucher_number text;
    v_current_ar_balance numeric;
BEGIN
    -- 1. Get Open Period
    v_period_id := public.get_open_accounting_period(p_transaction_date);

    -- 2. Identify Accounts & Locking
    -- Customer AR Account
    IF p_customer_id IS NOT NULL THEN
        PERFORM 1 FROM public.customers WHERE id = p_customer_id FOR UPDATE;

        SELECT account_id INTO v_customer_account
        FROM public.customer_accounts
        WHERE customer_id = p_customer_id;
    END IF;

    -- Cash/Bank Account (Fund)
    IF p_payment_method_id IS NOT NULL THEN
        SELECT account_id INTO v_cash_account
        FROM public.payment_methods
        WHERE id = p_payment_method_id;
    END IF;

    -- System Accounts
    SELECT id INTO v_revenue_account FROM public.accounts WHERE code = '4100'; 
    SELECT id INTO v_unearned_account FROM public.accounts WHERE code = 'L-ADV'; 
    SELECT id INTO v_vat_account FROM public.accounts WHERE code = '2100'; 
    SELECT id INTO v_ar_account FROM public.accounts WHERE code = '1200'; 

    -- Fallback for Customer Account
    IF v_customer_account IS NULL THEN
        v_customer_account := v_ar_account;
    END IF;

    -- 3. Balance Check for Refund/Adjustment
    IF p_transaction_type IN ('refund', 'adjustment') AND p_customer_id IS NOT NULL THEN
       SELECT COALESCE(SUM(CASE WHEN direction='debit' THEN amount ELSE -amount END), 0)
       INTO v_current_ar_balance
       FROM public.ar_subledger
       WHERE customer_id = p_customer_id;
       
       IF v_current_ar_balance < p_amount THEN
          RAISE NOTICE 'Warning: Transaction amount % exceeds current balance % for customer %', p_amount, v_current_ar_balance, p_customer_id;
       END IF;
    END IF;

    -- 4. Create Journal Entry Header (Draft)
    v_voucher_number := 'JV-' || to_char(now(), 'YYYYMMDD') || '-' || substring(uuid_generate_v4()::text, 1, 8);
    
    INSERT INTO public.journal_entries (
        entry_date,
        description,
        reference_type,
        reference_id,
        status,
        accounting_period_id,
        voucher_number,
        created_at
    ) VALUES (
        p_transaction_date,
        COALESCE(p_description, p_transaction_type),
        p_source_type,
        p_source_id,
        'draft', 
        v_period_id,
        v_voucher_number,
        now()
    ) RETURNING id INTO v_journal_id;

    -- 5. Logic per Transaction Type
    ----------------------------------------------------------------
    
    -- 🔵 advance_payment
    IF p_transaction_type = 'advance_payment' THEN
        IF v_cash_account IS NULL THEN
            RAISE EXCEPTION 'Cash account (Fund) is required for advance payment';
        END IF;

        INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_cash_account, p_amount, 0, 'Advance Payment Collection');

        INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_unearned_account, 0, p_amount, 'Unearned Revenue - Advance');
    END IF;

    -- 🟢 revenue_recognition
    IF p_transaction_type = 'revenue_recognition' THEN
        INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_unearned_account, p_amount, 0, 'Revenue Recognition');

        INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_revenue_account, 0, p_amount, 'Room Revenue');
    END IF;

    -- 🟡 payment
    IF p_transaction_type = 'payment' THEN
        IF v_cash_account IS NULL THEN
            RAISE EXCEPTION 'Cash account (Fund) is required for payment';
        END IF;

        INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_cash_account, p_amount, 0, 'Invoice Payment');

        INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_customer_account, 0, p_amount, 'AR Payment Settlement');
    END IF;
    
    -- 🟠 invoice_issue
    IF p_transaction_type = 'invoice_issue' THEN
         DECLARE
            v_base numeric;
            v_vat numeric;
         BEGIN
            -- Calculate VAT
            IF p_tax_amount IS NOT NULL THEN
                v_vat := p_tax_amount;
                v_base := p_amount - v_vat;
            ELSE
                v_base := ROUND(p_amount / 1.15, 2);
                v_vat := p_amount - v_base;
            END IF;

            -- Debit AR (Customer)
            INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_journal_id, v_customer_account, p_amount, 0, 'Invoice Issuance');
            
            -- Credit Revenue (Sales)
            INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_journal_id, v_revenue_account, 0, v_base, 'Room/Service Revenue');
            
            -- Credit VAT (Tax Liability)
            INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_journal_id, v_vat_account, 0, v_vat, 'VAT Output Tax');
         END;
    END IF;

    -- 🟣 refund
    IF p_transaction_type = 'refund' THEN
        IF v_cash_account IS NULL THEN
            RAISE EXCEPTION 'Cash account is required for refund';
        END IF;
        
        INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_customer_account, p_amount, 0, 'Refund to Customer');

        INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_cash_account, 0, p_amount, 'Cash Refund');
    END IF;

    -- 6. Post the Journal (Triggers validation)
    UPDATE public.journal_entries SET status = 'posted' WHERE id = v_journal_id;

    RETURN v_journal_id;
END;
$$ LANGUAGE plpgsql;

-- 6.6 Audit Logs with User ID
CREATE OR REPLACE FUNCTION public.audit_record_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data jsonb;
    v_new_data jsonb;
    v_user_id uuid;
BEGIN
    -- Try to get user ID from Supabase auth.uid()
    BEGIN
        v_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    IF (TG_OP = 'UPDATE') THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        
        INSERT INTO public.audit_logs (
            table_name,
            record_id,
            action,
            old_data,
            new_data,
            changed_by
        )
        VALUES (
            TG_TABLE_NAME,
            OLD.id,
            'UPDATE',
            v_old_data,
            v_new_data,
            v_user_id
        );
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        v_old_data := to_jsonb(OLD);
        
        INSERT INTO public.audit_logs (
            table_name,
            record_id,
            action,
            old_data,
            changed_by
        )
        VALUES (
            TG_TABLE_NAME,
            OLD.id,
            'DELETE',
            v_old_data,
            v_user_id
        );
        RETURN OLD;
    ELSIF (TG_OP = 'INSERT') THEN
        v_new_data := to_jsonb(NEW);
        
        INSERT INTO public.audit_logs (
            table_name,
            record_id,
            action,
            new_data,
            changed_by
        )
        VALUES (
            TG_TABLE_NAME,
            NEW.id,
            'INSERT',
            v_new_data,
            v_user_id
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 6.7 Prevent Double Revenue
CREATE OR REPLACE FUNCTION public.prevent_double_revenue()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.revenue_schedules
        WHERE booking_id = NEW.booking_id
        AND recognition_date = NEW.recognition_date
    ) THEN
        RAISE EXCEPTION 'Revenue already recognized for this booking and date';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_double_revenue
BEFORE INSERT ON public.revenue_schedules
FOR EACH ROW
EXECUTE FUNCTION public.prevent_double_revenue();

-- 6.8 Night Audit Job
CREATE OR REPLACE FUNCTION public.run_night_audit(p_date DATE)
RETURNS VOID AS $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT *
        FROM public.bookings
        WHERE status = 'checked_in'
        AND p_date >= check_in
        AND p_date < check_out
    LOOP
        BEGIN
            INSERT INTO public.revenue_schedules (
                booking_id,
                recognition_date,
                amount
            )
            VALUES (
                rec.id,
                p_date,
                rec.daily_rate
            );
        EXCEPTION WHEN unique_violation THEN
            RAISE NOTICE 'Revenue already recognized for Booking % on %', rec.id, p_date;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 7. سياسات الأمان (RLS Policies)
-- =============================================
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_subledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

-- Permissive Policies (Allow Authenticated Users to Work)
CREATE POLICY "Enable all access for authenticated users on bookings" ON public.bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users on invoices" ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users on journal_entries" ON public.journal_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users on journal_lines" ON public.journal_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users on customers" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users on payments" ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users on ar_subledger" ON public.ar_subledger FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users on hotels" ON public.hotels FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users on unit_types" ON public.unit_types FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users on pricing_rules" ON public.pricing_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users on system_events" ON public.system_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- 8. البيانات الأولية (Seed Data - Optional)
-- =============================================
-- Insert default accounts if they don't exist
INSERT INTO public.accounts (code, name, type, is_system) VALUES 
('1200', 'Accounts Receivable', 'asset', true),
('1100', 'Cash on Hand', 'asset', true),
('1110', 'Bank', 'asset', true),
('2100', 'VAT Output Tax', 'liability', true),
('4100', 'Room Revenue', 'revenue', true),
('L-ADV', 'Unearned Revenue', 'liability', true)
ON CONFLICT (code) DO NOTHING;

-- =============================================
-- 9. إصلاحات البيانات (Data Fixes & Seeds)
-- =============================================

-- 9.1 Fix Login Issue (Admin User)
DO $$
DECLARE
    v_auth_id uuid := '267f8974-9a61-4537-9777-c26ff3f5790b';
    v_email text := 'admin@gmail.com';
BEGIN
    UPDATE auth.users SET email_confirmed_at = now() WHERE email = v_email;

    DELETE FROM public.users WHERE email = v_email AND id != v_auth_id;

    INSERT INTO public.users (id, email, full_name, role, password_hash, is_active)
    VALUES (v_auth_id, v_email, 'Zizo admin', 'admin', crypt('adminpassword', gen_salt('bf')), true)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = 'admin', is_active = true;
END $$;

-- 9.2 Backfill AR Subledger
DO $$
BEGIN
    INSERT INTO public.ar_subledger (customer_id, journal_entry_id, amount, direction, transaction_date, due_date)
    SELECT 
        COALESCE(
            (SELECT customer_id FROM public.bookings WHERE id = je.reference_id AND je.reference_type = 'booking'),
            (SELECT customer_id FROM public.invoices WHERE id = je.reference_id AND je.reference_type = 'invoice'),
            (SELECT customer_id FROM public.payments WHERE id = je.reference_id AND je.reference_type = 'payment')
        ) as cust_id,
        jl.journal_entry_id,
        GREATEST(jl.debit, jl.credit),
        CASE WHEN jl.debit > 0 THEN 'debit' ELSE 'credit' END,
        je.entry_date,
        je.entry_date + INTERVAL '30 days'
    FROM public.journal_lines jl
    JOIN public.journal_entries je ON je.id = jl.journal_entry_id
    JOIN public.accounts a ON a.id = jl.account_id
    WHERE a.code = '1200'
    AND NOT EXISTS (SELECT 1 FROM public.ar_subledger existing WHERE existing.journal_entry_id = jl.journal_entry_id)
    AND COALESCE(
        (SELECT customer_id FROM public.bookings WHERE id = je.reference_id AND je.reference_type = 'booking'),
        (SELECT customer_id FROM public.invoices WHERE id = je.reference_id AND je.reference_type = 'invoice'),
        (SELECT customer_id FROM public.payments WHERE id = je.reference_id AND je.reference_type = 'payment')
    ) IS NOT NULL;
END $$;

COMMIT;
