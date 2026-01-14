
-- Add confirmation fields to cleaning_logs
ALTER TABLE public.cleaning_logs 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS confirmed_at timestamp with time zone;

-- Policy to allow updates (confirmation)
-- Existing policy is "Enable all access for authenticated users", so updates are allowed.
