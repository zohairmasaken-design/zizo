-- Add discount and additional services columns to bookings table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0 CHECK (discount_amount >= 0),
ADD COLUMN IF NOT EXISTS additional_services jsonb DEFAULT '[]'::jsonb;

-- Comment on columns
COMMENT ON COLUMN public.bookings.discount_amount IS 'Total discount amount applied to the booking';
COMMENT ON COLUMN public.bookings.additional_services IS 'JSON array of additional services/extras (e.g., [{name: "Breakfast", amount: 50}])';
