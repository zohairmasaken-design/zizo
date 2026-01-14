-- Add columns for broker and platform data
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS broker_name text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS broker_id text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS platform_name text;

-- Notify pgrst to reload schema cache
NOTIFY pgrst, 'reload config';
