-- COMPREHENSIVE FIX SCRIPT - Run this in Supabase SQL Editor
-- This will fix all RLS, schema, and relationship issues

-- 1. DISABLE RLS ON ALL TABLES (complete disable)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_sales_summary DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_totals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.takeaway_qr_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_requests DISABLE ROW LEVEL SECURITY;

-- 2. DROP ALL EXISTING POLICIES (force removal)
DROP POLICY IF EXISTS "Enable all access for users" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own data" ON public.users;
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Users can delete their own data" ON public.users;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.users;

-- 3. FIX SUBSCRIPTION_HISTORY FOREIGN KEY
-- Drop and recreate the extended_by column with proper constraint
ALTER TABLE public.subscription_history DROP COLUMN IF EXISTS extended_by;
ALTER TABLE public.subscription_history 
ADD COLUMN extended_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 4. ENSURE USERS TABLE HAS ALL REQUIRED COLUMNS
DO $$
BEGIN
    -- Check and add password_hash if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE public.users ADD COLUMN password_hash TEXT;
    END IF;
    
    -- Check and add status if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'status'
    ) THEN
        ALTER TABLE public.users ADD COLUMN status VARCHAR(50) DEFAULT 'approved';
    END IF;
END $$;

-- 5. VERIFY USERS DATA - Check if ftea exists
-- This will show the user data in the results
SELECT 'Checking ftea user:' as info;
SELECT id, username, email, role, restaurant_id, status FROM public.users WHERE username = 'ftea';

-- 6. SHOW ALL USERS (to verify data is there)
SELECT 'All users in database:' as info;
SELECT id, username, email, role, restaurant_id FROM public.users LIMIT 50;

-- 7. SHOW RLS STATUS AFTER FIX
SELECT 'RLS Status after fix:' as info;
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'restaurants', 'subscriptions', 'subscription_history');

-- 8. GRANT NECESSARY PERMISSIONS (ensure anon role can access)
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT INSERT ON ALL TABLES IN SCHEMA public TO anon;
GRANT UPDATE ON ALL TABLES IN SCHEMA public TO anon;
GRANT DELETE ON ALL TABLES IN SCHEMA public TO anon;

-- 9. ALTER DEFAULT PRIVILEGES (for future tables)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon;
