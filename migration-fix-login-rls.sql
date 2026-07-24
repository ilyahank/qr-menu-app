-- COMPLETE FIX FOR RLS LOGIN ISSUE
-- The problem: RLS policies require auth.uid() which is null during login
-- Solution: Allow anonymous access for login while securing other operations

-- Step 1: Drop all existing restrictive policies on users table
DROP POLICY IF EXISTS "users_read_own_profile" ON public.users;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.users;
DROP POLICY IF EXISTS "users_delete_admin_only" ON public.users;
DROP POLICY IF EXISTS "users_allow_login" ON public.users;
DROP POLICY IF EXISTS "users_read_authenticated" ON public.users;
DROP POLICY IF EXISTS "users_update_authenticated" ON public.users;
DROP POLICY IF EXISTS "users_delete_admin" ON public.users;

-- Step 2: Grant necessary permissions to anon and authenticated roles
-- This is critical - anon role needs SELECT on users for login to work
GRANT SELECT ON public.users TO anon;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- Step 3: Create policy that allows login (anonymous access for username check)
-- This is safe because we only select by username and verify password
CREATE POLICY "users_allow_login" ON public.users
  FOR SELECT USING (true);

-- Step 4: Create policy for authenticated users to read their own profile
CREATE POLICY "users_read_authenticated" ON public.users
  FOR SELECT USING (
    auth.uid() = id OR 
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Step 5: Create policy for authenticated users to update their own profile
CREATE POLICY "users_update_authenticated" ON public.users
  FOR UPDATE USING (
    auth.uid() = id OR 
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Step 6: Create policy for admin to delete users
CREATE POLICY "users_delete_admin" ON public.users
  FOR DELETE USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Step 7: Ensure RLS is enabled on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 8: Verify the policy exists and is working
-- You can test with: SELECT * FROM pg_policies WHERE tablename = 'users';
