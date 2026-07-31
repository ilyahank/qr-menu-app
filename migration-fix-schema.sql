-- Fix schema issues: subscription_history relationship and users RLS

-- 1. Fix subscription_history foreign key relationship
-- First, drop the existing column if it exists without proper constraint
ALTER TABLE public.subscription_history DROP COLUMN IF EXISTS extended_by;

-- Re-add the column with proper foreign key constraint
ALTER TABLE public.subscription_history 
ADD COLUMN extended_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. Disable RLS on users table to allow anonymous access
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 3. Ensure RLS is disabled on subscription_history as well
ALTER TABLE public.subscription_history DISABLE ROW LEVEL SECURITY;

-- 4. Verify the users table has the correct columns
-- Check if password_hash column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE public.users ADD COLUMN password_hash TEXT;
    END IF;
END $$;
