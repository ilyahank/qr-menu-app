-- Disable RLS on users table to fix login issues
-- This allows anonymous access via the anon key for authentication

-- Drop any existing policies on users table
DROP POLICY IF EXISTS "Enable all access for users" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own data" ON public.users;
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Users can delete their own data" ON public.users;

-- Disable RLS on users table
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
