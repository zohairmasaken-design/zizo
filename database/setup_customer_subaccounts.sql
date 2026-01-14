-- ============================================================
-- Setup Customer Sub-Accounts (Sub-Ledger Logic)
-- Description: 
-- 1. Creates a function to automatically generate a sub-account for each customer
--    under the main Customers account (1200).
-- 2. Updates the trigger to create this account immediately upon customer creation.
-- 3. Updates post_transaction to ensure this account is used.
-- ============================================================

-- 1. Function to Ensure Customer Sub-Account Exists
CREATE OR REPLACE FUNCTION public.ensure_customer_subaccount(p_customer_id uuid)
RETURNS uuid AS $$
DECLARE
    v_account_id uuid;
    v_parent_id uuid;
    v_parent_code text := '1200'; -- Main AR Account
    v_customer_name text;
    v_new_code text;
    v_count integer;
BEGIN
    -- A. Check if mapping already exists and points to a specific sub-account (not the parent itself)
    SELECT account_id INTO v_account_id 
    FROM public.customer_accounts 
    WHERE customer_id = p_customer_id;

    -- Get Parent Account ID
    SELECT id INTO v_parent_id FROM public.accounts WHERE code = v_parent_code;
    
    -- If Parent doesn't exist, we can't create a sub-account (Should not happen in prod)
    IF v_parent_id IS NULL THEN
        RAISE NOTICE 'Parent Account % not found. Using default logic.', v_parent_code;
        RETURN NULL;
    END IF;

    -- If mapped account is the parent itself (old logic), treat it as 'not found' so we upgrade it
    IF v_account_id = v_parent_id THEN
        v_account_id := NULL;
    END IF;

    -- If we found a valid specific sub-account, return it
    IF v_account_id IS NOT NULL THEN
        RETURN v_account_id;
    END IF;

    -- B. Create New Sub-Account
    -- Get Customer Name
    SELECT full_name INTO v_customer_name FROM public.customers WHERE id = p_customer_id;
    
    IF v_customer_name IS NULL THEN
        RAISE EXCEPTION 'Customer % not found', p_customer_id;
    END IF;

    -- Generate New Code (Pattern: 1200-00001)
    SELECT count(*) INTO v_count FROM public.accounts WHERE parent_id = v_parent_id;
    
    -- Simple loop to find a unique code
    LOOP
        v_count := v_count + 1;
        v_new_code := v_parent_code || '-' || lpad(v_count::text, 5, '0');
        
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.accounts WHERE code = v_new_code);
    END LOOP;

    -- Insert Account
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

-- 2. Update Trigger for New Customers
CREATE OR REPLACE FUNCTION public.create_customer_account() 
RETURNS TRIGGER AS $$ 
DECLARE
    v_account_id uuid;
BEGIN 
  -- Call the ensure function to create the account
  v_account_id := public.ensure_customer_subaccount(NEW.id);
  RETURN NEW; 
END; 
$$ LANGUAGE plpgsql; 

-- Re-attach trigger (in case it was dropped or modified)
DROP TRIGGER IF EXISTS trg_create_customer_account ON public.customers;
CREATE TRIGGER trg_create_customer_account 
AFTER INSERT ON public.customers 
FOR EACH ROW 
EXECUTE FUNCTION public.create_customer_account();

-- 3. Update post_transaction to use the new logic
-- First, drop old versions to prevent ambiguity (Safety Step)
DROP FUNCTION IF EXISTS public.post_transaction(text, text, uuid, numeric, uuid, uuid, date, text, numeric);
DROP FUNCTION IF EXISTS public.post_transaction(text, text, uuid, numeric, uuid, uuid, date, text, numeric, numeric, numeric);

CREATE OR REPLACE FUNCTION public.post_transaction(
    p_transaction_type text,
    p_source_type text,
    p_source_id uuid,
    p_amount numeric,
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
        -- Ensure dedicated account exists (Auto-create if missing)
        v_customer_account := public.ensure_customer_subaccount(p_customer_id);
    END IF;

    IF p_payment_method_id IS NOT NULL THEN
        SELECT account_id INTO v_cash_account FROM public.payment_methods WHERE id = p_payment_method_id;
    END IF;

    -- System Accounts
    SELECT id INTO v_revenue_account FROM public.accounts WHERE code = '4100'; -- Room Revenue
    SELECT id INTO v_extras_account FROM public.accounts WHERE code = '4200'; -- Extras Revenue
    SELECT id INTO v_discount_account FROM public.accounts WHERE code = '5100'; -- Discounts
    SELECT id INTO v_unearned_account FROM public.accounts WHERE code = 'L-ADV'; -- Liability
    SELECT id INTO v_vat_account FROM public.accounts WHERE code = '2100'; -- VAT
    SELECT id INTO v_ar_account FROM public.accounts WHERE code = '1200'; -- Default AR (Fallback)

    -- Fallback for Customer Account (should not happen with ensure_customer_subaccount, but for safety)
    IF v_customer_account IS NULL THEN 
        v_customer_account := v_ar_account; 
    END IF;

    -- 3. Create Journal Entry Header
    v_voucher_number := 'JV-' || to_char(now(), 'YYYYMMDD') || '-' || substring(uuid_generate_v4()::text, 1, 8);
    
    INSERT INTO public.journal_entries (
        entry_date, description, reference_type, reference_id, status, accounting_period_id, voucher_number, created_at
    ) VALUES (
        p_transaction_date, COALESCE(p_description, p_transaction_type), p_source_type, p_source_id, 'draft', v_period_id, v_voucher_number, now()
    ) RETURNING id INTO v_journal_id;

    -- 4. Logic per Transaction Type

    -- 🔵 advance_payment (Deposit)
    IF p_transaction_type = 'advance_payment' THEN
        IF v_cash_account IS NULL THEN 
            RAISE EXCEPTION 'Cash account required for advance payment. Check payment method.'; 
        END IF;
        
        -- Debit Cash
        INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_cash_account, p_amount, 0, 'Advance Payment Collection');
        
        -- Credit Customer Account (Prepayment / Unearned)
        -- We credit the Customer Account directly so it appears in their statement as a credit balance.
        INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_customer_account, 0, p_amount, 'Unearned Revenue - Advance');
    END IF;

    -- 🟡 payment (AR Settlement)
    IF p_transaction_type = 'payment' THEN
        IF v_cash_account IS NULL THEN 
            RAISE EXCEPTION 'Cash account required for payment. Check payment method.'; 
        END IF;

        -- Debit Cash
        INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_cash_account, p_amount, 0, 'Invoice Payment');

        -- Credit AR (Specific Customer Account)
        INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_customer_account, 0, p_amount, 'AR Payment Settlement');
    END IF;

    -- 🟠 invoice_issue (Complex: Split Revenue, Extras, Discount, Tax)
    IF p_transaction_type = 'invoice_issue' THEN
         DECLARE
            v_room_revenue numeric;
            v_extras_revenue numeric;
            v_vat numeric;
            v_discount numeric;
            v_total_receivable numeric;
         BEGIN
            v_total_receivable := p_amount;
            v_vat := COALESCE(p_tax_amount, 0);
            v_discount := COALESCE(p_discount_amount, 0);
            v_extras_revenue := COALESCE(p_extras_amount, 0);
            
            -- Calculate Room Revenue
            -- Formula: Total = (Room + Extras - Discount) + VAT
            -- Room = Total - VAT + Discount - Extras
            v_room_revenue := v_total_receivable - v_vat + v_discount - v_extras_revenue;
            
            -- Debit AR (Specific Customer Account)
            INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_journal_id, v_customer_account, v_total_receivable, 0, 'Invoice Issuance - Total');
            
            -- Debit Discounts (Expense)
            IF v_discount > 0 THEN
                INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
                VALUES (v_journal_id, v_discount_account, v_discount, 0, 'Discount Allowed');
            END IF;
            
            -- Credit Extras Revenue
            IF v_extras_revenue > 0 THEN
                INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
                VALUES (v_journal_id, v_extras_account, 0, v_extras_revenue, 'Additional Services Revenue');
            END IF;

            -- Credit Room Revenue
            INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_journal_id, v_revenue_account, 0, v_room_revenue, 'Room Revenue');
            
            -- Credit VAT
            IF v_vat > 0 THEN
                INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
                VALUES (v_journal_id, v_vat_account, 0, v_vat, 'VAT Output Tax');
            END IF;
         END;
    END IF;

    -- 🟣 refund
    IF p_transaction_type = 'refund' THEN
        IF v_cash_account IS NULL THEN
            RAISE EXCEPTION 'Cash account is required for refund';
        END IF;
        
        -- Debit AR (Customer receives money/credit) - WAIT, Refund means we PAY customer back.
        -- Usually: Credit Cash, Debit AR (if reducing balance) or Debit Revenue (if direct refund).
        -- Let's assume Refund reduces AR balance (Credit AR? No, Debit AR reduces liability? No.)
        -- Refund: We pay Cash (Credit Cash). We reduce what we owe them (Debit Unearned?) or they owe us less (Debit AR?? No).
        -- If we refund an advance: Debit Unearned, Credit Cash.
        -- If we refund an invoice payment: Debit AR (increase balance?? No), Credit Cash.
        -- Wait, if customer paid 100, AR is 0. If we refund 100, AR becomes 100 (they owe us again?? No).
        -- Refund usually implies cancelling a receipt.
        
        -- Implementation: Debit Customer Account (Increase AR/Reduce Liability), Credit Cash.
        -- Because Customer Account is Asset (Receivable). 
        -- If they have credit balance (Liability), Debit reduces it.
        
        INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_customer_account, p_amount, 0, 'Refund to Customer');
        
        INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_cash_account, 0, p_amount, 'Cash Refund');
    END IF;

    -- 5. Post the Entry (Update Status)
    UPDATE public.journal_entries SET status = 'posted' WHERE id = v_journal_id;
    
    RETURN v_journal_id;
END;
$$ LANGUAGE plpgsql;
