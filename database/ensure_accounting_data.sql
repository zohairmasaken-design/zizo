-- ============================================================
-- Fix: Ensure Essential Data Exists (Periods & Payment Methods)
-- Description:
-- 1. Creates an open accounting period for the current year (2024-2026).
-- 2. Ensures payment methods (Cash, AlAhli) exist and are linked to accounts.
-- 3. Handles potential "Cash account required" errors by fixing the linkage.
-- ============================================================

BEGIN;

-- 1. Ensure Open Accounting Period Exists
-- Checks if an open period covers TODAY. If not, creates one.
DO $$
DECLARE
    v_today date := CURRENT_DATE;
    v_start_of_year date := date_trunc('year', v_today);
    v_end_of_year date := (date_trunc('year', v_today) + interval '1 year' - interval '1 day')::date;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.accounting_periods 
        WHERE status = 'open' 
        AND v_today BETWEEN start_date AND end_date
    ) THEN
        -- Close any existing open periods to avoid overlap error (strict rule)
        UPDATE public.accounting_periods SET status = 'closed' WHERE status = 'open';

        INSERT INTO public.accounting_periods (period_name, start_date, end_date, status)
        VALUES (
            'Financial Year ' || to_char(v_today, 'YYYY'),
            v_start_of_year,
            v_end_of_year,
            'open'
        );
        RAISE NOTICE 'Created new accounting period for %', to_char(v_today, 'YYYY');
    ELSE
        RAISE NOTICE 'Open accounting period already exists.';
    END IF;
END $$;

-- 2. Ensure Fund Accounts Exist
DO $$
DECLARE
    v_fund_id uuid;
BEGIN
    -- Fund (Parent)
    INSERT INTO public.accounts (code, name, type, is_system, is_active)
    VALUES ('1100', 'الصندوق', 'asset', true, true)
    ON CONFLICT (code) DO UPDATE SET name = 'الصندوق'
    RETURNING id INTO v_fund_id;

    -- Cash (Child)
    INSERT INTO public.accounts (code, name, type, parent_id, is_system, is_active)
    VALUES ('1101', 'نقد', 'asset', v_fund_id, true, true)
    ON CONFLICT (code) DO UPDATE SET parent_id = v_fund_id;

    -- Bank (Child)
    INSERT INTO public.accounts (code, name, type, parent_id, is_system, is_active)
    VALUES ('1102', 'البنك الأهلي', 'asset', v_fund_id, true, true)
    ON CONFLICT (code) DO UPDATE SET parent_id = v_fund_id;
END $$;

-- 3. Ensure Payment Methods Exist & Link Correctly
DO $$
DECLARE
    v_cash_acc_id uuid;
    v_bank_acc_id uuid;
BEGIN
    SELECT id INTO v_cash_acc_id FROM public.accounts WHERE code = '1101';
    SELECT id INTO v_bank_acc_id FROM public.accounts WHERE code = '1102';

    -- Cash Method
    INSERT INTO public.payment_methods (name, account_id, is_active)
    VALUES ('نقد', v_cash_acc_id, true)
    ON CONFLICT (name) DO UPDATE SET account_id = v_cash_acc_id, is_active = true;

    -- AlAhli Method
    INSERT INTO public.payment_methods (name, account_id, is_active)
    VALUES ('البنك الأهلي', v_bank_acc_id, true)
    ON CONFLICT (name) DO UPDATE SET account_id = v_bank_acc_id, is_active = true;
    
    RAISE NOTICE 'Payment methods verified.';
END $$;

COMMIT;
