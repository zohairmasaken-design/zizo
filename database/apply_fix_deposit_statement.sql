-- ============================================================
-- Customer Statement of Account Report (FIXED)
-- Description: Retrieves the ledger for a specific customer based on their sub-account.
-- Fix: Now includes deposits (Advance Payments) recorded in Unearned Revenue (L-ADV)
--      if they are linked to the customer via Booking or Payment reference.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_customer_statement(
    p_customer_id uuid,
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL
)
RETURNS TABLE (
    transaction_date date,
    voucher_number text,
    description text,
    debit numeric,
    credit numeric,
    balance numeric
) AS $$
DECLARE
    v_account_id uuid;
    v_opening_balance numeric := 0;
BEGIN
    -- 1. Get the Customer's Sub-Account
    SELECT account_id INTO v_account_id 
    FROM public.customer_accounts 
    WHERE customer_id = p_customer_id;

    IF v_account_id IS NULL THEN
        -- Fallback: Try to find by name if not mapped (legacy support)
        SELECT id INTO v_account_id 
        FROM public.accounts 
        WHERE name = (SELECT full_name FROM public.customers WHERE id = p_customer_id)
        LIMIT 1;
    END IF;

    IF v_account_id IS NULL THEN
        RAISE EXCEPTION 'No account found for customer %', p_customer_id;
    END IF;

    -- 2. Calculate Opening Balance (before start date)
    IF p_start_date IS NOT NULL THEN
        SELECT COALESCE(SUM(jl.debit - jl.credit), 0) INTO v_opening_balance
        FROM public.journal_lines jl
        JOIN public.journal_entries je ON jl.journal_entry_id = je.id
        LEFT JOIN public.bookings b_ref ON je.reference_type = 'booking' AND je.reference_id = b_ref.id
        LEFT JOIN public.payments p_ref ON je.reference_type = 'payment' AND je.reference_id = p_ref.id
        WHERE 
        (
            jl.account_id = v_account_id
            OR
            (
                jl.account_id IN (SELECT id FROM public.accounts WHERE code = 'L-ADV')
                AND
                (
                    (je.reference_type = 'booking' AND b_ref.customer_id = p_customer_id)
                    OR
                    (je.reference_type = 'payment' AND p_ref.customer_id = p_customer_id)
                )
            )
        )
        AND je.entry_date < p_start_date
        AND je.status = 'posted';
    END IF;

    -- 3. Return Statement Lines
    RETURN QUERY
    SELECT 
        je.entry_date,
        je.voucher_number,
        -- Enrich Description with details from Bookings/Invoices
        CASE 
            WHEN je.reference_type = 'booking' THEN 
                COALESCE(
                    (SELECT 'حجز #' || SUBSTRING(b.id::text, 1, 8) || ' - وحدة: ' || u.unit_number 
                     FROM public.bookings b 
                     LEFT JOIN public.units u ON b.unit_id = u.id 
                     WHERE b.id = je.reference_id), 
                    jl.description, 
                    je.description
                )
            WHEN je.reference_type = 'invoice' THEN 
                COALESCE(
                    (SELECT 'فاتورة #' || i.invoice_number 
                     FROM public.invoices i 
                     WHERE i.id = je.reference_id), 
                    jl.description, 
                    je.description
                )
             WHEN je.reference_type = 'payment' THEN 
                COALESCE(
                    (SELECT 'سند قبض #' || SUBSTRING(p.id::text, 1, 8) 
                     FROM public.payments p 
                     WHERE p.id = je.reference_id), 
                    jl.description, 
                    je.description
                )
            ELSE COALESCE(jl.description, je.description)
        END as description,
        jl.debit,
        jl.credit,
        SUM(jl.debit - jl.credit) OVER (ORDER BY je.entry_date, je.created_at) + COALESCE(v_opening_balance, 0) as balance
    FROM public.journal_lines jl
    JOIN public.journal_entries je ON jl.journal_entry_id = je.id
    LEFT JOIN public.bookings b_ref ON je.reference_type = 'booking' AND je.reference_id = b_ref.id
    LEFT JOIN public.payments p_ref ON je.reference_type = 'payment' AND je.reference_id = p_ref.id
    WHERE 
    (
        jl.account_id = v_account_id
        OR
        (
            -- Also include Deposits/Unearned Revenue (L-ADV) linked to this customer
            jl.account_id IN (SELECT id FROM public.accounts WHERE code = 'L-ADV')
            AND
            (
                (je.reference_type = 'booking' AND b_ref.customer_id = p_customer_id)
                OR
                (je.reference_type = 'payment' AND p_ref.customer_id = p_customer_id)
            )
        )
    )
    AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
    AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
    AND je.status = 'posted'
    ORDER BY je.entry_date, je.created_at;
END;
$$ LANGUAGE plpgsql;
