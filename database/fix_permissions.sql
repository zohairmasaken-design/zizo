-- ============================================================
-- Fix Permissions & Security for Accounting Functions
-- Description: 
-- 1. Grants EXECUTE permissions to authenticated users for critical RPCs.
-- 2. Sets SECURITY DEFINER on helper functions that modify system tables (accounts) 
--    to prevent RLS violations during automatic account creation.
-- ============================================================

BEGIN;

-- 1. Grant Permissions
GRANT EXECUTE ON FUNCTION public.get_customer_statement(uuid, date, date) TO postgres, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_transaction(text, text, uuid, numeric, uuid, uuid, date, text, numeric, numeric, numeric) TO postgres, authenticated, service_role;

-- 2. Update ensure_customer_subaccount to be SECURITY DEFINER
-- This is critical because normal users might not have permission to INSERT into 'accounts' table directly,
-- but they need to trigger it when creating a customer or posting a transaction.
CREATE OR REPLACE FUNCTION public.ensure_customer_subaccount(p_customer_id uuid)
RETURNS uuid 
SECURITY DEFINER -- Runs with privileges of the creator (superuser/admin)
SET search_path = public -- Secure search path
AS $$
DECLARE
    v_account_id uuid;
    v_parent_id uuid;
    v_parent_code text := '1200'; -- Main AR Account
    v_customer_name text;
    v_new_code text;
    v_count integer;
BEGIN
    -- A. Check if mapping already exists
    SELECT account_id INTO v_account_id 
    FROM public.customer_accounts 
    WHERE customer_id = p_customer_id;

    -- Get Parent Account ID
    SELECT id INTO v_parent_id FROM public.accounts WHERE code = v_parent_code;
    
    IF v_parent_id IS NULL THEN
        RAISE NOTICE 'Parent Account % not found.', v_parent_code;
        RETURN NULL;
    END IF;

    -- If mapped account is the parent itself (old logic), treat it as 'not found'
    IF v_account_id = v_parent_id THEN
        v_account_id := NULL;
    END IF;

    IF v_account_id IS NOT NULL THEN
        RETURN v_account_id;
    END IF;

    -- B. Create New Sub-Account
    SELECT full_name INTO v_customer_name FROM public.customers WHERE id = p_customer_id;
    
    IF v_customer_name IS NULL THEN
        -- If customer doesn't exist yet (race condition?), we can't create account
        RETURN NULL; 
    END IF;

    -- Generate New Code
    SELECT count(*) INTO v_count FROM public.accounts WHERE parent_id = v_parent_id;
    
    LOOP
        v_count := v_count + 1;
        v_new_code := v_parent_code || '-' || lpad(v_count::text, 5, '0');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.accounts WHERE code = v_new_code);
    END LOOP;

    -- Insert Account (as Superuser due to SECURITY DEFINER)
    INSERT INTO public.accounts (
        code, name, type, parent_id, is_active, is_system
    ) VALUES (
        v_new_code, 
        v_customer_name, 
        'asset', 
        v_parent_id, 
        true, 
        false
    ) RETURNING id INTO v_account_id;

    -- C. Update Mapping Table
    INSERT INTO public.customer_accounts (customer_id, account_id)
    VALUES (p_customer_id, v_account_id)
    ON CONFLICT (customer_id) 
    DO UPDATE SET account_id = EXCLUDED.account_id;

    RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;

SELECT 'Permissions granted and Security Definers set.' as status;
