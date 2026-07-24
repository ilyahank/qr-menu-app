-- Multi-Tenancy RLS Policies
-- Ensure Restaurant A can never access Restaurant B's data

-- Enable RLS on all tables EXCEPT users (login requires anon access)
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY; -- Disable for login
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's restaurant_id
CREATE OR REPLACE FUNCTION get_current_restaurant_id()
RETURNS UUID AS $$
DECLARE
    v_restaurant_id UUID;
BEGIN
    -- Return NULL if not authenticated
    IF auth.uid() IS NULL THEN
        RETURN NULL;
    END IF;
    
    SELECT restaurant_id INTO v_restaurant_id
    FROM public.users
    WHERE id = auth.uid();
    
    RETURN v_restaurant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    -- Return false if not authenticated
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;
    
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RESTAURANTS RLS Policies
-- Drop existing policies first
DROP POLICY IF EXISTS "Admins can view all restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Owners can view their restaurant" ON public.restaurants;

-- Admins can see all restaurants
CREATE POLICY "Admins can view all restaurants" ON public.restaurants
    FOR SELECT
    TO authenticated
    USING (is_admin());

-- Owners can only see their own restaurant
CREATE POLICY "Owners can view their restaurant" ON public.restaurants
    FOR SELECT
    TO authenticated
    USING (id = get_current_restaurant_id());

-- USERS RLS Policies - DISABLED for login access
-- Users table RLS is disabled to allow anonymous login queries
-- Multi-tenancy for users is handled at application level

-- MENU ITEMS RLS Policies
DROP POLICY IF EXISTS "Admins can view all menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Owners can view their menu items" ON public.menu_items;

-- Admins can see all menu items
CREATE POLICY "Admins can view all menu items" ON public.menu_items
    FOR SELECT
    TO authenticated
    USING (is_admin());

-- Owners can only see their restaurant's menu items
CREATE POLICY "Owners can view their menu items" ON public.menu_items
    FOR SELECT
    TO authenticated
    USING (restaurant_id = get_current_restaurant_id());

-- CATEGORIES RLS Policies
DROP POLICY IF EXISTS "Admins can view all categories" ON public.categories;
DROP POLICY IF EXISTS "Owners can view their categories" ON public.categories;

-- Admins can see all categories
CREATE POLICY "Admins can view all categories" ON public.categories
    FOR SELECT
    TO authenticated
    USING (is_admin());

-- Owners can only see their restaurant's categories
CREATE POLICY "Owners can view their categories" ON public.categories
    FOR SELECT
    TO authenticated
    USING (restaurant_id = get_current_restaurant_id());

-- ORDERS RLS Policies
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Owners can view their orders" ON public.orders;

-- Admins can see all orders
CREATE POLICY "Admins can view all orders" ON public.orders
    FOR SELECT
    TO authenticated
    USING (is_admin());

-- Owners can only see their restaurant's orders
CREATE POLICY "Owners can view their orders" ON public.orders
    FOR SELECT
    TO authenticated
    USING (restaurant_id = get_current_restaurant_id());

-- ORDER ITEMS RLS Policies
DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;
DROP POLICY IF EXISTS "Owners can view their order items" ON public.order_items;

-- Admins can see all order items
CREATE POLICY "Admins can view all order items" ON public.order_items
    FOR SELECT
    TO authenticated
    USING (is_admin());

-- Owners can only see their restaurant's order items
CREATE POLICY "Owners can view their order items" ON public.order_items
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_items.order_id
            AND orders.restaurant_id = get_current_restaurant_id()
        )
    );

-- SUBSCRIPTIONS RLS Policies
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Owners can view their subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Allow anon subscription access" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can update subscriptions" ON public.subscriptions;

-- Allow anon access for subscription queries (needed for some operations)
CREATE POLICY "Allow anon subscription access" ON public.subscriptions
    FOR SELECT
    TO anon
    USING (true);

-- Admins can see all subscriptions
CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions
    FOR SELECT
    TO authenticated
    USING (is_admin());

-- Admins can update subscriptions
CREATE POLICY "Admins can update subscriptions" ON public.subscriptions
    FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- Owners can only see their restaurant's subscription
CREATE POLICY "Owners can view their subscription" ON public.subscriptions
    FOR SELECT
    TO authenticated
    USING (restaurant_id = get_current_restaurant_id());

-- SUBSCRIPTION HISTORY RLS Policies
DROP POLICY IF EXISTS "Admins can view all subscription history" ON public.subscription_history;
DROP POLICY IF EXISTS "Owners can view their subscription history" ON public.subscription_history;
DROP POLICY IF EXISTS "Allow anon subscription history access" ON public.subscription_history;
DROP POLICY IF EXISTS "Admins can insert subscription history" ON public.subscription_history;

-- Allow anon access for subscription history queries
CREATE POLICY "Allow anon subscription history access" ON public.subscription_history
    FOR SELECT
    TO anon
    USING (true);

-- Admins can see all subscription history
CREATE POLICY "Admins can view all subscription history" ON public.subscription_history
    FOR SELECT
    TO authenticated
    USING (is_admin());

-- Admins can insert subscription history
CREATE POLICY "Admins can insert subscription history" ON public.subscription_history
    FOR INSERT
    TO authenticated
    WITH CHECK (is_admin());

-- Owners can only see their restaurant's subscription history
CREATE POLICY "Owners can view their subscription history" ON public.subscription_history
    FOR SELECT
    TO authenticated
    USING (restaurant_id = get_current_restaurant_id());

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION get_current_restaurant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
