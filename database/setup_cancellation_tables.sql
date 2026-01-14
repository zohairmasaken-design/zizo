BEGIN;

-- 1. Create Archive Tables (Structure Only, No Constraints)
CREATE TABLE IF NOT EXISTS public.archived_journal_entries AS 
SELECT * FROM public.journal_entries WITH NO DATA;

CREATE TABLE IF NOT EXISTS public.archived_journal_lines AS 
SELECT * FROM public.journal_lines WITH NO DATA;

-- Add timestamps for archiving if not present
-- ALTER TABLE public.archived_journal_entries ADD COLUMN IF NOT EXISTS archived_at timestamp DEFAULT now();

-- 2. Create Cancellation Function
CREATE OR REPLACE FUNCTION public.cancel_booking_fully(p_booking_id uuid)
RETURNS void AS $$
DECLARE
    v_invoice_ids uuid[];
    v_payment_ids uuid[];
    v_journal_ids uuid[];
    v_unit_id uuid;
BEGIN
    -- Get Unit ID
    SELECT unit_id INTO v_unit_id FROM public.bookings WHERE id = p_booking_id;

    -- 1. Get related Invoice IDs
    SELECT array_agg(id) INTO v_invoice_ids
    FROM public.invoices
    WHERE booking_id = p_booking_id;

    -- 2. Get related Payment IDs (linked to Invoices)
    IF v_invoice_ids IS NOT NULL THEN
        SELECT array_agg(id) INTO v_payment_ids
        FROM public.payments
        WHERE invoice_id = ANY(v_invoice_ids);
    END IF;

    -- 3. Identify Journal Entries to Archive
    -- Find entries linked to Booking, Invoices, or Payments
    SELECT array_agg(id) INTO v_journal_ids
    FROM public.journal_entries
    WHERE 
        (reference_type = 'booking' AND reference_id = p_booking_id)
        OR
        (reference_type = 'invoice' AND reference_id = ANY(v_invoice_ids))
        OR
        (reference_type = 'payment' AND reference_id = ANY(v_payment_ids));

    -- 4. Archive & Delete Journal Entries
    IF v_journal_ids IS NOT NULL THEN
        -- Archive Entries (Copy data)
        INSERT INTO public.archived_journal_entries SELECT * FROM public.journal_entries WHERE id = ANY(v_journal_ids);
        INSERT INTO public.archived_journal_lines SELECT * FROM public.journal_lines WHERE journal_entry_id = ANY(v_journal_ids);

        -- Delete from active tables
        -- A. Remove dependencies in ar_subledger
        DELETE FROM public.ar_subledger WHERE journal_entry_id = ANY(v_journal_ids);
        
        -- B. Remove dependencies in payments (Unlink before deleting journal entry)
        -- This fixes the FK violation error
        UPDATE public.payments 
        SET journal_entry_id = NULL 
        WHERE journal_entry_id = ANY(v_journal_ids);

        -- C. Remove dependencies in journal_lines
        DELETE FROM public.journal_lines WHERE journal_entry_id = ANY(v_journal_ids);
        
        -- D. Finally delete the journal entries
        DELETE FROM public.journal_entries WHERE id = ANY(v_journal_ids);
    END IF;

    -- 5. Update Documents Status
    UPDATE public.invoices SET status = 'void' WHERE booking_id = p_booking_id;
    
    IF v_payment_ids IS NOT NULL THEN
        UPDATE public.payments SET status = 'void' WHERE id = ANY(v_payment_ids);
    END IF;

    -- 6. Update Booking & Unit
    UPDATE public.bookings SET status = 'cancelled' WHERE id = p_booking_id;
    
    IF v_unit_id IS NOT NULL THEN
        UPDATE public.units SET status = 'available' WHERE id = v_unit_id;
    END IF;

END;
$$ LANGUAGE plpgsql;

COMMIT;
