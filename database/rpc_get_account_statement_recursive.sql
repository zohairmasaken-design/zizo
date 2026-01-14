-- ============================================================
-- Account Statement Report (Recursive / Hierarchical)
-- Description: Retrieves the ledger for a specific account AND all its sub-accounts.
-- Useful for Parent Accounts like "Fund" (1100) to see Cash + Bank transactions.
-- ============================================================

-- 1. Helper Function: Get Opening Balance Recursively
CREATE OR REPLACE FUNCTION public.get_account_balance_recursive(
    p_account_id uuid,
    p_date date
)
RETURNS numeric AS $$
DECLARE
    v_balance numeric := 0;
    v_account_ids uuid[];
BEGIN
    -- Get all Account IDs (Self + Children Recursive)
    WITH RECURSIVE account_tree AS (
        SELECT base.id FROM public.accounts base WHERE base.id = p_account_id
        UNION ALL
        SELECT child.id FROM public.accounts child
        JOIN account_tree t ON child.parent_id = t.id
    )
    SELECT array_agg(tree.id) INTO v_account_ids FROM account_tree tree;

    -- Calculate Balance
    SELECT COALESCE(SUM(jl.debit - jl.credit), 0) INTO v_balance
    FROM public.journal_lines jl
    JOIN public.journal_entries je ON jl.journal_entry_id = je.id
    WHERE jl.account_id = ANY(v_account_ids)
    AND je.entry_date < p_date
    AND je.status = 'posted';

    RETURN v_balance;
END;
$$ LANGUAGE plpgsql;


-- 2. Main Function: Get Statement Lines Recursively
CREATE OR REPLACE FUNCTION public.get_account_statement(
    p_account_id uuid,
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    transaction_date date,
    voucher_number text,
    account_name text,
    description text,
    debit numeric,
    credit numeric,
    balance numeric,
    reference_type text,
    reference_id uuid
) AS $$
DECLARE
    v_opening_balance numeric := 0;
    v_account_ids uuid[];
BEGIN
    -- 1. Get all Account IDs (Self + Children Recursive)
    WITH RECURSIVE account_tree AS (
        -- Base case: The selected account (Alias 'base' to avoid ambiguity)
        SELECT base.id FROM public.accounts base WHERE base.id = p_account_id
        UNION ALL
        -- Recursive case: Children of accounts in the tree
        SELECT child.id FROM public.accounts child
        JOIN account_tree t ON child.parent_id = t.id
    )
    SELECT array_agg(tree.id) INTO v_account_ids FROM account_tree tree;

    -- 2. Calculate Opening Balance (before start date) for ALL accounts in the tree
    IF p_start_date IS NOT NULL THEN
        SELECT COALESCE(SUM(jl.debit - jl.credit), 0) INTO v_opening_balance
        FROM public.journal_lines jl
        JOIN public.journal_entries je ON jl.journal_entry_id = je.id
        WHERE jl.account_id = ANY(v_account_ids)
        AND je.entry_date < p_start_date
        AND je.status = 'posted';
    END IF;

    -- 3. Return Statement Lines
    RETURN QUERY
    SELECT 
        jl.id,
        je.entry_date,
        je.voucher_number,
        a.name as account_name,
        -- Enrich Description
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
        -- Running Balance
        SUM(jl.debit - jl.credit) OVER (ORDER BY je.entry_date, je.created_at) + COALESCE(v_opening_balance, 0) as balance,
        je.reference_type,
        je.reference_id
    FROM public.journal_lines jl
    JOIN public.journal_entries je ON jl.journal_entry_id = je.id
    JOIN public.accounts a ON jl.account_id = a.id
    WHERE jl.account_id = ANY(v_account_ids)
    AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
    AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
    AND je.status = 'posted'
    ORDER BY je.entry_date, je.created_at;
END;
$$ LANGUAGE plpgsql;
