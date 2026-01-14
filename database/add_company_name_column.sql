-- Add company_name column to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS company_name text;

-- Notify pgrst to reload schema cache
NOTIFY pgrst, 'reload config';
