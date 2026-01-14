-- Migration: Setup Fund Hierarchy and Payment Methods
-- Description: Establishes a hierarchy for Cash/Bank accounts and links them to specific payment methods as requested.

BEGIN;

-- 1. Ensure parent_id column exists in accounts (Idempotent check)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'parent_id') THEN
        ALTER TABLE public.accounts ADD COLUMN parent_id uuid REFERENCES public.accounts(id);
    END IF;
END $$;

-- 2. Setup Accounts Hierarchy & Payment Methods
DO $$
DECLARE
    v_fund_id uuid;
    v_cash_id uuid;
    v_bank_alahli_id uuid;
BEGIN
    -- 2.1 Main Fund Account (الصندوق) - Code 1100
    -- This acts as the parent container for all cash/bank assets
    INSERT INTO public.accounts (code, name, type, is_system, is_active)
    VALUES ('1100', 'الصندوق', 'asset', true, true)
    ON CONFLICT (code) DO UPDATE SET name = 'الصندوق', type = 'asset'
    RETURNING id INTO v_fund_id;

    -- 2.2 Cash Sub-Account (نقد) - Code 1101
    -- Child of Fund
    INSERT INTO public.accounts (code, name, type, parent_id, is_system, is_active)
    VALUES ('1101', 'نقد', 'asset', v_fund_id, true, true)
    ON CONFLICT (code) DO UPDATE SET name = 'نقد', parent_id = v_fund_id
    RETURNING id INTO v_cash_id;

    -- 2.3 AlAhli Bank Sub-Account (البنك الأهلي) - Code 1102
    -- Child of Fund
    INSERT INTO public.accounts (code, name, type, parent_id, is_system, is_active)
    VALUES ('1102', 'البنك الأهلي', 'asset', v_fund_id, true, true)
    ON CONFLICT (code) DO UPDATE SET name = 'البنك الأهلي', parent_id = v_fund_id
    RETURNING id INTO v_bank_alahli_id;

    -- 3. Update/Insert Payment Methods
    -- Links the UI payment options to these specific ledger accounts

    -- 3.1 Cash Method
    INSERT INTO public.payment_methods (name, account_id, is_active)
    VALUES ('نقد', v_cash_id, true)
    ON CONFLICT (name) DO UPDATE SET account_id = v_cash_id;

    -- 3.2 AlAhli Method
    INSERT INTO public.payment_methods (name, account_id, is_active)
    VALUES ('البنك الأهلي', v_bank_alahli_id, true)
    ON CONFLICT (name) DO UPDATE SET account_id = v_bank_alahli_id;

    -- 3.3 Update any existing 'Cash' or 'Bank' generic methods to point to these if needed
    -- For now, we assume the user selects the specific ones. 
    -- If there's a generic 'Transfer', we can map it to AlAhli as a default or leave it.
    
    RAISE NOTICE 'Fund Hierarchy and Payment Methods Setup Completed.';
END $$;

COMMIT;
