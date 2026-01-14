-- ============================================================
-- Check and Fix Customer Statements & Sub-Accounts
-- Description:
-- 1. Verifies that every customer has a dedicated sub-account (e.g., 1200-00001).
-- 2. Creates missing sub-accounts if necessary.
-- 3. Scans for journal entries recorded on the Main Customers Account (1200) 
--    that should be moved to the specific Customer Sub-Account.
-- ============================================================

BEGIN;

DO $$
DECLARE
    r_customer RECORD;
    v_account_id uuid;
    v_main_ar_account_id uuid;
    v_moved_count integer := 0;
    v_created_count integer := 0;
BEGIN
    -- 1. Get Main AR Account ID (1200)
    SELECT id INTO v_main_ar_account_id FROM public.accounts WHERE code = '1200';
    
    IF v_main_ar_account_id IS NULL THEN
        RAISE NOTICE 'Main AR Account (1200) not found!';
        RETURN;
    END IF;

    -- 2. Iterate over all customers to ensure sub-accounts exist
    FOR r_customer IN SELECT * FROM public.customers LOOP
        -- This function creates the account if it doesn't exist and updates the mapping
        -- We assume ensure_customer_subaccount is already defined (from setup_customer_subaccounts.sql)
        -- If not, you must run setup_customer_subaccounts.sql first.
        
        -- Calling it with SECURITY DEFINER privileges (if updated) or current privileges
        v_account_id := public.ensure_customer_subaccount(r_customer.id);
        
        IF v_account_id IS NOT NULL THEN
            v_created_count := v_created_count + 1; -- It returns ID whether created or found
        END IF;
    END LOOP;

    RAISE NOTICE 'Verified sub-accounts for all customers.';

    -- 3. Fix Journal Entries on Main Account (1200)
    --    If a journal line is on 1200, but the entry is linked to a Booking/Invoice 
    --    that belongs to a specific customer, we should move it to their sub-account.

    -- A. Fix based on Booking Reference
    -- Find lines on 1200 where entry -> booking -> customer -> sub-account is known
    UPDATE public.journal_lines jl
    SET account_id = ca.account_id
    FROM public.journal_entries je
    JOIN public.bookings b ON (je.reference_id = b.id AND je.reference_type = 'booking')
    JOIN public.customer_accounts ca ON b.customer_id = ca.customer_id
    WHERE jl.journal_entry_id = je.id
    AND jl.account_id = v_main_ar_account_id -- Only move if currently on Main Account
    AND ca.account_id IS NOT NULL;

    GET DIAGNOSTICS v_moved_count = ROW_COUNT;
    RAISE NOTICE 'Moved % journal lines from Main Account to Customer Sub-Accounts (via Booking Ref).', v_moved_count;

    -- B. Fix based on Invoice Reference
    UPDATE public.journal_lines jl
    SET account_id = ca.account_id
    FROM public.journal_entries je
    JOIN public.invoices i ON (je.reference_id = i.id AND je.reference_type = 'invoice')
    JOIN public.customer_accounts ca ON i.customer_id = ca.customer_id
    WHERE jl.journal_entry_id = je.id
    AND jl.account_id = v_main_ar_account_id
    AND ca.account_id IS NOT NULL;

    -- C. Fix based on Payment Reference (if any)
    UPDATE public.journal_lines jl
    SET account_id = ca.account_id
    FROM public.journal_entries je
    JOIN public.payments p ON (je.reference_id = p.id AND je.reference_type = 'payment')
    JOIN public.customer_accounts ca ON p.customer_id = ca.customer_id
    WHERE jl.journal_entry_id = je.id
    AND jl.account_id = v_main_ar_account_id
    AND ca.account_id IS NOT NULL;

    -- D. Fix Deposits (Unearned Revenue L-ADV) -> Move to Customer Account
    --    This ensures deposits appear in the Customer Statement
    UPDATE public.journal_lines jl
    SET account_id = ca.account_id
    FROM public.journal_entries je
    -- Try to link via Booking or Payment reference
    LEFT JOIN public.bookings b ON (je.reference_id = b.id AND je.reference_type = 'booking')
    LEFT JOIN public.payments p ON (je.reference_id = p.id AND je.reference_type = 'payment') -- Payment record might exist for deposit
    JOIN public.customer_accounts ca ON (
        b.customer_id = ca.customer_id OR 
        p.customer_id = ca.customer_id OR
        -- Fallback: If description contains customer name (risky, skip for now)
        false
    )
    WHERE jl.journal_entry_id = je.id
    AND jl.account_id = (SELECT id FROM public.accounts WHERE code = 'L-ADV') -- Only move Unearned Revenue
    AND ca.account_id IS NOT NULL;


END $$;

COMMIT;

SELECT 'Repair completed. Sub-accounts ensured and transactions migrated.' as result;
