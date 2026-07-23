-- Comprehensive RLS disable script for restaurant_tables
-- This will disable ALL RLS policies on the table

-- First, drop ALL policies on the table
DROP POLICY IF EXISTS "Enable all access for users" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Users can insert their own restaurant tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Users can view their own restaurant tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Users can update their own restaurant tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Users can delete their own restaurant tables" ON public.restaurant_tables;

-- Disable RLS
ALTER TABLE public.restaurant_tables DISABLE ROW LEVEL SECURITY;

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_number VARCHAR(50) NOT NULL,
    table_name VARCHAR(100),
    qr_code_url VARCHAR(512),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('Africa/Algiers'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('Africa/Algiers'::text, now()),
    UNIQUE(restaurant_id, table_number)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_restaurant ON public.restaurant_tables(restaurant_id, is_active);

-- Ensure RLS is disabled again after table creation
ALTER TABLE public.restaurant_tables DISABLE ROW LEVEL SECURITY;