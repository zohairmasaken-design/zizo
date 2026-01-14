-- ========================================================
-- FIX: Infinite Recursion in RLS Policies for Profiles Table
-- ========================================================
-- This script fixes the "infinite recursion detected in policy for relation profiles" error.
-- It creates a secure function to check roles and updates the RLS policies to use it.
-- Run this script in your Supabase SQL Editor.

BEGIN;

-- 1. Create a secure function to check roles (bypassing RLS to avoid recursion)
CREATE OR REPLACE FUNCTION public.check_user_role(required_roles text[])
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role = ANY(required_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop existing problematic policies
DROP POLICY IF EXISTS "Admins and Managers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- 3. Re-create policies using the secure function
CREATE POLICY "Admins and Managers can view all profiles" ON public.profiles 
  FOR SELECT USING (
    public.check_user_role(ARRAY['admin', 'manager'])
  );

CREATE POLICY "Admins can update all profiles" ON public.profiles 
  FOR UPDATE USING (
    public.check_user_role(ARRAY['admin'])
  );

COMMIT;
