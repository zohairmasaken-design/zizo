-- ============================================================
-- Setup: Booking Platforms Accounting & Settlement
-- Description: 
-- 1. Creates a parent account for Booking Platforms (Receivables).
-- 2. Creates default sub-accounts for major platforms.
-- 3. Adds a function to settle platform balances.
-- ============================================================

BEGIN;

-- 1. Create Parent Account for Platforms
-- We use code 1120 as "Booking Platforms Receivables" (Asset)
DO $$
DECLARE
    v_parent_id uuid;
BEGIN
    INSERT INTO public.accounts (code, name, type, is_system, is_active)
    VALUES ('1120', 'أرصدة منصات الحجز', 'asset', true, true)
    ON CONFLICT (code) DO UPDATE SET name = 'أرصدة منصات الحجز', is_system = true
    RETURNING id INTO v_parent_id;

    INSERT INTO public.accounts (code, name, type, parent_id, is_system, is_active)
    VALUES ('1121', 'Booking.com', 'asset', v_parent_id, false, true)
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO public.accounts (code, name, type, parent_id, is_system, is_active)
    VALUES ('1122', 'Agoda', 'asset', v_parent_id, false, true)
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO public.accounts (code, name, type, parent_id, is_system, is_active)
    VALUES ('1123', 'Gathern (جاذر إن)', 'asset', v_parent_id, false, true)
    ON CONFLICT (code) DO NOTHING;
    
    INSERT INTO public.accounts (code, name, type, parent_id, is_system, is_active)
    VALUES ('1124', 'Airbnb', 'asset', v_parent_id, false, true)
    ON CONFLICT (code) DO NOTHING;

END $$;

DO $$
DECLARE
    v_parent_id uuid;
    r_account record;
BEGIN
    SELECT id INTO v_parent_id FROM public.accounts WHERE code = '1120';

    IF v_parent_id IS NOT NULL THEN
        FOR r_account IN
            SELECT id, name
            FROM public.accounts
            WHERE parent_id = v_parent_id
        LOOP
            INSERT INTO public.payment_methods (name, account_id, is_active)
            VALUES (r_account.name, r_account.id, true)
            ON CONFLICT (name) DO UPDATE SET account_id = EXCLUDED.account_id, is_active = true;
        END LOOP;
    END IF;
END $$;

-- Ensure Commission Expense Account Exists
INSERT INTO public.accounts (code, name, type, is_system, is_active)
VALUES ('5200', 'عمولات منصات الحجز', 'expense', true, true)
ON CONFLICT (code) DO UPDATE SET name = 'عمولات منصات الحجز', type = 'expense';


-- 2. Create Settlement Function
CREATE OR REPLACE FUNCTION public.settle_platform_payment(
    p_platform_account_id uuid,
    p_target_bank_account_id uuid,
    p_amount numeric, -- Total amount settled (including commission)
    p_commission_amount numeric DEFAULT 0,
    p_reference_number text DEFAULT NULL,
    p_date date DEFAULT CURRENT_DATE
)
RETURNS uuid AS $$
DECLARE
    v_journal_id uuid;
    v_period_id uuid;
    v_commission_account_id uuid;
    v_net_amount numeric;
    v_voucher_number text;
BEGIN
    -- Validation
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Settlement amount must be positive';
    END IF;

    v_net_amount := p_amount - COALESCE(p_commission_amount, 0);
    
    IF v_net_amount < 0 THEN
        RAISE EXCEPTION 'Commission cannot exceed total amount';
    END IF;

    -- Get Accounts
    SELECT id INTO v_commission_account_id FROM public.accounts WHERE code = '5200';
    
    -- Get Period
    v_period_id := public.get_open_accounting_period(p_date);

    -- Create Journal Entry
    v_voucher_number := 'JV-SETTLE-' || to_char(now(), 'YYYYMMDD') || '-' || substring(uuid_generate_v4()::text, 1, 8);

    INSERT INTO public.journal_entries (
        entry_date,
        description,
        reference_type,
        status,
        accounting_period_id,
        voucher_number,
        created_at
    ) VALUES (
        p_date,
        'تسوية رصيد منصة حجز' || COALESCE(' - ' || p_reference_number, ''),
        'platform_settlement',
        'draft', 
        v_period_id,
        v_voucher_number,
        now()
    ) RETURNING id INTO v_journal_id;
    
    -- Update status to posted directly for UX
    UPDATE public.journal_entries SET status = 'posted' WHERE id = v_journal_id;

    -- Journal Lines
    
    -- 1. Debit Bank (Net Amount Received)
    IF v_net_amount > 0 THEN
        INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_id, p_target_bank_account_id, v_net_amount, 0, 'استلام مستحقات منصة (صافي)');
    END IF;

    -- 2. Debit Commission Expense (If any)
    IF p_commission_amount > 0 THEN
        INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_commission_account_id, p_commission_amount, 0, 'خصم عمولة المنصة');
    END IF;

    -- 3. Credit Platform Account (Total Amount Reduced from Receivable)
    INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_id, p_platform_account_id, 0, p_amount, 'تسوية رصيد المنصة');

    RETURN v_journal_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Helper to get platform balances
-- Now we specifically look for accounts under parent 1120
CREATE OR REPLACE FUNCTION public.get_platform_balances()
RETURNS TABLE (
    account_id uuid,
    account_name text,
    payment_method_name text,
    balance numeric,
    last_transaction_date date
) AS $$
DECLARE
    v_parent_id uuid;
BEGIN
    SELECT id INTO v_parent_id FROM public.accounts WHERE code = '1120';

    RETURN QUERY
    SELECT 
        a.id,
        a.name,
        pm.name as payment_method_name,
        COALESCE(SUM(jl.debit - jl.credit), 0) as balance,
        MAX(je.entry_date) as last_transaction_date
    FROM public.accounts a
    LEFT JOIN public.payment_methods pm ON a.id = pm.account_id
    LEFT JOIN public.journal_lines jl ON a.id = jl.account_id
    LEFT JOIN public.journal_entries je ON jl.journal_entry_id = je.id AND je.status = 'posted'
    WHERE a.parent_id = v_parent_id
    GROUP BY a.id, a.name, pm.name
    -- Show if it has balance OR if it is a platform account (even with 0 balance)
    HAVING COALESCE(SUM(jl.debit - jl.credit), 0) <> 0 OR MAX(je.entry_date) IS NOT NULL OR TRUE; 
END;
$$ LANGUAGE plpgsql;

COMMIT;
