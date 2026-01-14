-- Drop potentially ambiguous older versions of the function
DROP FUNCTION IF EXISTS public.post_transaction(text, text, uuid, numeric, uuid, uuid, date, text, numeric);
DROP FUNCTION IF EXISTS public.post_transaction(text, text, uuid, numeric, uuid, uuid, date, text, numeric, numeric, numeric);

CREATE OR REPLACE FUNCTION public.post_transaction(
    p_transaction_type text, -- 'advance_payment', 'revenue_recognition', 'payment', 'invoice_issue', 'refund', 'credit_note'
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

    -- 🔴 credit_note (Invoice Cancellation / Reversal)
    IF p_transaction_type = 'credit_note' THEN
         DECLARE
            v_base numeric;
            v_vat numeric;
         BEGIN
            -- Calculate VAT (Same logic as invoice)
            IF p_tax_amount IS NOT NULL THEN
                v_vat := p_tax_amount;
                v_base := p_amount - v_vat;
            ELSE
                v_base := ROUND(p_amount / 1.15, 2);
                v_vat := p_amount - v_base;
            END IF;

            -- Credit AR (Customer) - Decrease Debt
            INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_journal_id, v_customer_account, 0, p_amount, 'Credit Note - Cancellation');
            
            -- Debit Revenue (Sales Return)
            INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_journal_id, v_revenue_account, v_base, 0, 'Revenue Reversal');
            
            -- Debit VAT (Tax Reversal)
            INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description)
            VALUES (v_journal_id, v_vat_account, v_vat, 0, 'VAT Reversal');
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
