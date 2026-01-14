-- Add details column to customers table for operational data (family, companions, etc.)
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS details text;

-- Notify pgrst to reload schema cache
NOTIFY pgrst, 'reload config';
