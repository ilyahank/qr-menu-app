-- Migration to add restaurant_tables and takeaway_qr_codes tables
-- This script only adds missing tables without dropping existing ones

-- 11. RESTAURANT TABLES MANAGEMENT
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

-- DROP ANY EXISTING RLS POLICIES AND DISABLE RLS
DROP POLICY IF EXISTS "Enable all access for users" ON public.restaurant_tables;
ALTER TABLE public.restaurant_tables DISABLE ROW LEVEL SECURITY;

-- 12. TAKEAWAY QR CODES
CREATE TABLE IF NOT EXISTS public.takeaway_qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    qr_code_url VARCHAR(512) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('Africa/Algiers'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('Africa/Algiers'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_takeaway_qr_restaurant ON public.takeaway_qr_codes(restaurant_id, is_active);

-- DROP ANY EXISTING RLS POLICIES AND DISABLE RLS
DROP POLICY IF EXISTS "Enable all access for users" ON public.takeaway_qr_codes;
ALTER TABLE public.takeaway_qr_codes DISABLE ROW LEVEL SECURITY;