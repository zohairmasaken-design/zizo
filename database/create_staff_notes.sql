
-- Create staff_notes table
CREATE TABLE IF NOT EXISTS public.staff_notes (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    target_user_id uuid REFERENCES public.profiles(id), -- The employee being noted
    created_by uuid REFERENCES auth.users(id), -- The manager creating the note
    type text CHECK (type IN ('violation', 'note', 'commendation')) DEFAULT 'note',
    severity text CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- RLS
ALTER TABLE public.staff_notes ENABLE ROW LEVEL SECURITY;

-- Allow read for authenticated users
CREATE POLICY "Enable read access for authenticated users on staff_notes" 
    ON public.staff_notes FOR SELECT TO authenticated USING (true);

-- Allow insert for authenticated users
CREATE POLICY "Enable insert access for authenticated users on staff_notes" 
    ON public.staff_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- Allow update/delete for creator or admins (simplified to creator for now)
CREATE POLICY "Enable update for creator on staff_notes" 
    ON public.staff_notes FOR UPDATE TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Enable delete for creator on staff_notes" 
    ON public.staff_notes FOR DELETE TO authenticated USING (auth.uid() = created_by);
