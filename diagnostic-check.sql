-- Diagnostic script to check database state and RLS issues

-- 1. Check if users table exists and has data
SELECT 'users table count' as check_name, COUNT(*) as result FROM public.users;

-- 2. Check specific user 'ftea'
SELECT 'ftea user check' as check_name, id, username, email, role FROM public.users WHERE username = 'ftea';

-- 3. Check RLS status on users table
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';

-- 4. Check all RLS policies on users table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users';

-- 5. Check RLS status on all relevant tables
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'restaurants', 'subscriptions', 'subscription_history', 'menu_items', 'categories');

-- 6. Check subscription_history table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'subscription_history' 
AND table_schema = 'public';

-- 7. Check users table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public';

-- 8. Check all users in the database
SELECT 'all users' as check_name, id, username, email, role, restaurant_id FROM public.users LIMIT 20;
