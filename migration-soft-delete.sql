-- Soft Delete Implementation
-- Add deleted_at column to critical tables instead of permanent deletion

-- Users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Restaurants table  
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Menu items table
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Categories table
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for soft delete queries
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON public.users(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_restaurants_deleted_at ON public.restaurants(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON public.orders(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_menu_items_deleted_at ON public.menu_items(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_categories_deleted_at ON public.categories(deleted_at) WHERE deleted_at IS NULL;

-- Create function to soft delete users
CREATE OR REPLACE FUNCTION soft_delete_user(user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.users 
    SET deleted_at = NOW() 
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to soft delete restaurants
CREATE OR REPLACE FUNCTION soft_delete_restaurant(restaurant_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.restaurants 
    SET deleted_at = NOW() 
    WHERE id = restaurant_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to soft delete orders
CREATE OR REPLACE FUNCTION soft_delete_order(order_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.orders 
    SET deleted_at = NOW() 
    WHERE id = order_id;
END;
$$ LANGUAGE plpgsql;
