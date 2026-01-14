
BEGIN;

-- Create cleaning_logs table
CREATE TABLE IF NOT EXISTS public.cleaning_logs (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    unit_id uuid REFERENCES public.units(id),
    cleaned_by uuid REFERENCES auth.users(id),
    cleaned_at timestamp with time zone DEFAULT now(),
    notes text,
    photo_data text, -- Base64 string for the image
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cleaning_logs ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Enable all access for authenticated users on cleaning_logs" ON public.cleaning_logs;
CREATE POLICY "Enable all access for authenticated users on cleaning_logs" 
    ON public.cleaning_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;
