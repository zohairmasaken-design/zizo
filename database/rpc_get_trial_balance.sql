-- Function to get trial balance report (Version 2 to bypass cache)
CREATE OR REPLACE FUNCTION public.get_trial_balance_v2(start_date TEXT, end_date TEXT)
RETURNS TABLE (
    account_id UUID,
    account_code TEXT,
    account_name TEXT,
    account_type TEXT,
    opening_balance NUMERIC,
    period_debit NUMERIC,
    period_credit NUMERIC,
    net_balance NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    -- Cast text to date to avoid type ambiguity
    v_start_date := start_date::DATE;
    v_end_date := end_date::DATE;

    RETURN QUERY
    WITH opening_stats AS (
        SELECT
            jl.account_id,
            COALESCE(SUM(jl.debit - jl.credit), 0) as balance
        FROM journal_lines jl
        JOIN journal_entries je ON jl.entry_id = je.id
        WHERE je.entry_date < v_start_date
        GROUP BY jl.account_id
    ),
    period_stats AS (
        SELECT
            jl.account_id,
            COALESCE(SUM(jl.debit), 0) as debit,
            COALESCE(SUM(jl.credit), 0) as credit
        FROM journal_lines jl
        JOIN journal_entries je ON jl.journal_entry_id = je.id
        WHERE je.entry_date BETWEEN v_start_date AND v_end_date
        GROUP BY jl.account_id
    )
    SELECT
        a.id,
        a.code,
        a.name,
        a.type,
        COALESCE(os.balance, 0) as opening_balance,
        COALESCE(ps.debit, 0) as period_debit,
        COALESCE(ps.credit, 0) as period_credit,
        (COALESCE(os.balance, 0) + COALESCE(ps.debit, 0) - COALESCE(ps.credit, 0)) as net_balance
    FROM accounts a
    LEFT JOIN opening_stats os ON a.id = os.account_id
    LEFT JOIN period_stats ps ON a.id = ps.account_id
    WHERE 
        COALESCE(os.balance, 0) != 0 OR 
        COALESCE(ps.debit, 0) != 0 OR 
        COALESCE(ps.credit, 0) != 0
    ORDER BY a.code;
END;
$$;

-- Grant permissions explicitly
GRANT EXECUTE ON FUNCTION public.get_trial_balance_v2(TEXT, TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_trial_balance_v2(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_trial_balance_v2(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trial_balance_v2(TEXT, TEXT) TO service_role;
