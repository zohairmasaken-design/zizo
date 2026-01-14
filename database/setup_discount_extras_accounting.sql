-- ============================================================
-- Feature: Accounting for Discounts and Additional Services
-- Description: 
-- 1. Adds discount/extras columns to invoices table.
-- 2. Creates dedicated accounts for Discounts (5100) and Extras (4200).
-- 3. Updates post_transaction to handle complex invoice entries (splitting revenue, discounts, extras, tax).
-- ============================================================

BEGIN;

-- 1. Add Columns to Invoices Table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0 CHECK (discount_amount >= 0),
ADD COLUMN IF NOT EXISTS additional_services_amount numeric DEFAULT 0 CHECK (additional_services_amount >= 0);

-- 2. Create Accounts
-- 4200: Services Revenue (Revenue)
INSERT INTO public.accounts (code, name, type, is_system, is_active)
VALUES ('4200', 'إيرادات خدمات إضافية', 'revenue', true, true)
ON CONFLICT (code) DO UPDATE SET name = 'إيرادات خدمات إضافية', type = 'revenue';

-- 5100: Discounts Allowed (Expense)
INSERT INTO public.accounts (code, name, type, is_system, is_active)
VALUES ('5100', 'الخصومات المسموح بها', 'expense', true, true)
ON CONFLICT (code) DO UPDATE SET name = 'الخصومات المسموح بها', type = 'expense';

-- 3. Update post_transaction to handle discounts and extras
CREATE OR REPLACE FUNCTION public.post_transaction(
    p_transaction_type text,
    p_source_type text,
    p_source_id uuid,
    p_amount numeric, -- This is the TOTAL amount (Receivable/Paid)
    p_customer_id uuid DEFAULT NULL,
    p_payment_method_id uuid DEFAULT NULL,
    p_transaction_date date DEFAULT CURRENT_DATE,
    p_description text DEFAULT NULL,
    p_tax_amount numeric DEFAULT NULL,
    p_discount_amount numeric DEFAULT 0,
    p_extras_amount numeric DEFAULT 0
)
RETURNS uuid AS $$
DECLARE
    v_journal_id uuid;
    v_period_id uuid;
    v_cash_account uuid;
    v_customer_account uuid;
    v_revenue_account uuid;
    v_unearned_account uuid;
    v_vat_account uuid;
    v_ar_account uuid;
    v_discount_account uuid;
    v_extras_account uuid;
    v_voucher_number text;
    v_current_ar_balance numeric;
BEGIN
    -- 1. Get Open Period
    v_period_id := public.get_open_accounting_period(p_transaction_date);

    -- 2. Identify Accounts
    IF p_customer_id IS NOT NULL THEN
        PERFORM 1 FROM public.customers WHERE id = p_customer_id FOR UPDATE;
        SELECT account_id INTO v_customer_account FROM public.customer_accounts WHERE customer_id = p_customer_id;
    END IF;

    IF p_payment_method_id IS NOT NULL THEN
        SELECT account_id INTO v_cash_account FROM public.payment_methods WHERE id = p_payment_method_id;
    END IF;

    SELECT id INTO v_revenue_account FROM public.accounts WHERE code = '4100'; -- Room Revenue
    SELECT id INTO v_extras_account FROM public.accounts WHERE code = '4200'; -- Extras Revenue
    SELECT id INTO v_discount_account FROM public.accounts WHERE code = '5100'; -- Discounts
    SELECT id INTO v_unearned_account FROM public.accounts WHERE code = 'L-ADV';
    SELECT id INTO v_vat_account FROM public.accounts WHERE code = '2100';
    SELECT id INTO v_ar_account FROM public.accounts WHERE code = '1200';

    IF v_customer_account IS NULL THEN v_customer_account := v_ar_account; END IF;

    -- 3. Create Journal Entry Header
    v_voucher_number := 'JV-' || to_char(now(), 'YYYYMMDD') || '-' || substring(uuid_generate_v4()::text, 1, 8);
    
    INSERT INTO public.journal_entries (
        entry_date, description, reference_type, reference_id, status, accounting_period_id, voucher_number, created_at
    ) VALUES (
        p_transaction_date, COALESCE(p_description, p_transaction_type), p_source_type, p_source_id, 'draft', v_period_id, v_voucher_number, now()
    ) RETURNING id INTO v_journal_id;

    -- 4. Logic per Transaction Type

    -- 🔵 advance_payment
    IF p_transaction_type = 'advance_payment' THEN
        IF v_cash_account IS NULL THEN RAISE EXCEPTION 'Cash account required'; END IF;
        INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_cash_account, p_amount, 0, 'Advance Payment Collection');
        INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_unearned_account, 0, p_amount, 'Unearned Revenue - Advance');
    END IF;

    -- 🟡 payment
    IF p_transaction_type = 'payment' THEN
        IF v_cash_account IS NULL THEN RAISE EXCEPTION 'Cash account required'; END IF;
        INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_cash_account, p_amount, 0, 'Invoice Payment');
        INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_customer_account, 0, p_amount, 'AR Payment Settlement');
    END IF;

    -- 🟠 invoice_issue (UPDATED for Discounts & Extras)
    IF p_transaction_type = 'invoice_issue' THEN
         DECLARE
            v_room_revenue numeric;
            v_extras_revenue numeric;
            v_vat numeric;
            v_discount numeric;
            v_total_receivable numeric;
         BEGIN
            -- Inputs:
            -- p_amount: Total Receivable (Net to Pay)
            -- p_tax_amount: Total Tax
            -- p_discount_amount: Total Discount
            -- p_extras_amount: Total Extras

            v_total_receivable := p_amount;
            v_vat := COALESCE(p_tax_amount, 0);
            v_discount := COALESCE(p_discount_amount, 0);
            v_extras_revenue := COALESCE(p_extras_amount, 0);
            
            -- Calculate Room Revenue
            -- Formula: Total = (Room + Extras - Discount) + VAT
            -- Room = Total - VAT + Discount - Extras
            v_room_revenue := v_total_receivable - v_vat + v_discount - v_extras_revenue;

            -- 1. Debit AR (Total Receivable)
            INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_journal_id, v_customer_account, v_total_receivable, 0, 'Invoice Issuance - Total');

            -- 2. Debit Discount (Expense)
            IF v_discount > 0 THEN
                INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
                VALUES (v_journal_id, v_discount_account, v_discount, 0, 'Discount Allowed');
            END IF;

            -- 3. Credit Extras Revenue
            IF v_extras_revenue > 0 THEN
                INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
                VALUES (v_journal_id, v_extras_account, 0, v_extras_revenue, 'Additional Services Revenue');
            END IF;

            -- 4. Credit Room Revenue
            INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_journal_id, v_revenue_account, 0, v_room_revenue, 'Room Revenue');

            -- 5. Credit VAT
            IF v_vat > 0 THEN
                INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
                VALUES (v_journal_id, v_vat_account, 0, v_vat, 'VAT Output Tax');
            END IF;
         END;
    END IF;

    -- 🟣 refund
    IF p_transaction_type = 'refund' THEN
        IF v_cash_account IS NULL THEN RAISE EXCEPTION 'Cash account required'; END IF;
        INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_customer_account, p_amount, 0, 'Refund - AR Adjustment');
        INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_cash_account, 0, p_amount, 'Cash Refund');
    END IF;

    -- 🟢 revenue_recognition
    IF p_transaction_type = 'revenue_recognition' THEN
        INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_unearned_account, p_amount, 0, 'Revenue Recognition');
        INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_revenue_account, 0, p_amount, 'Room Revenue');
    END IF;

    UPDATE public.journal_entries SET status = 'posted' WHERE id = v_journal_id;
    RETURN v_journal_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;
