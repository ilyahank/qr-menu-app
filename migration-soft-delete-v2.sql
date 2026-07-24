-- Soft Delete Implementation v2 - Production Ready
-- Generic approach with views for safe data access

-- Add deleted_at column to tables (NOT orders - use status instead)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- DO NOT soft delete orders - use status field instead
-- Orders should have: pending, confirmed, completed, cancelled, refunded, rejected

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON public.users(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_restaurants_deleted_at ON public.restaurants(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_menu_items_deleted_at ON public.menu_items(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_categories_deleted_at ON public.categories(deleted_at) WHERE deleted_at IS NULL;

-- Create views for safe data access (frontend should use these)
CREATE OR REPLACE VIEW active_users AS
SELECT * FROM public.users WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW active_restaurants AS
SELECT * FROM public.restaurants WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW active_menu_items AS
SELECT * FROM public.menu_items WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW active_categories AS
SELECT * FROM public.categories WHERE deleted_at IS NULL;

-- Generic soft delete function (one function for all tables)
CREATE OR REPLACE FUNCTION soft_delete_record(table_name TEXT, record_id UUID)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('UPDATE %I SET deleted_at = NOW() WHERE id = $1', table_name)
    USING record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generic restore function
CREATE OR REPLACE FUNCTION restore_record(table_name TEXT, record_id UUID)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('UPDATE %I SET deleted_at = NULL WHERE id = $1', table_name)
    USING record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION soft_delete_record(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_record(TEXT, UUID) TO authenticated;
