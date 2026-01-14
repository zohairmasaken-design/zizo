CREATE OR REPLACE FUNCTION public.get_cash_flow_stats()
RETURNS jsonb AS $$
DECLARE
    v_month_start date := date_trunc('month', CURRENT_DATE)::date;
    v_month_end date := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date;
    v_last_7_days_start date := (CURRENT_DATE - interval '6 days')::date;
    v_month_revenue numeric;
    v_chart_data jsonb;
BEGIN
    -- 1. Calculate Monthly Revenue (Net Cash In)
    -- Sum of Debits (In) - Credits (Out) to Payment Method Accounts in current month
    SELECT COALESCE(SUM(jl.debit - jl.credit), 0)
    INTO v_month_revenue
    FROM public.journal_lines jl
    JOIN public.journal_entries je ON jl.journal_entry_id = je.id
    WHERE jl.account_id IN (SELECT account_id FROM public.payment_methods)
      AND je.status = 'posted'
      AND je.entry_date BETWEEN v_month_start AND v_month_end;

    -- 2. Calculate Last 7 Days Revenue (Daily Breakdown)
    SELECT jsonb_agg(
        jsonb_build_object(
            'date', to_char(d.day, 'YYYY-MM-DD'),
            'amount', COALESCE(daily_sum.amount, 0)
        )
    )
    INTO v_chart_data
    FROM (
        SELECT generate_series(v_last_7_days_start, CURRENT_DATE, '1 day'::interval)::date AS day
    ) d
    LEFT JOIN (
        SELECT 
            je.entry_date,
            SUM(jl.debit - jl.credit) as amount
        FROM public.journal_lines jl
        JOIN public.journal_entries je ON jl.journal_entry_id = je.id
        WHERE jl.account_id IN (SELECT account_id FROM public.payment_methods)
          AND je.status = 'posted'
          AND je.entry_date >= v_last_7_days_start
        GROUP BY je.entry_date
    ) daily_sum ON d.day = daily_sum.entry_date;

    RETURN jsonb_build_object(
        'month_revenue', v_month_revenue,
        'chart_data', COALESCE(v_chart_data, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
