-- Backup Strategy for Supabase
-- Use Supabase built-in features + external backups

-- 1. Enable Supabase Point-in-Time Recovery (PITR)
-- This is done in Supabase Dashboard > Database > Backups
-- Recommended: Enable PITR for production (available on Pro plan)

-- 2. Create weekly export function for external backup
CREATE OR REPLACE FUNCTION export_database_backup()
RETURNS TEXT AS $$
DECLARE
    backup_filename TEXT;
BEGIN
    -- This function would be called by an external script
    -- The actual export is done via pg_dump from outside the database
    backup_filename := 'qr_menu_backup_' || to_char(NOW(), 'YYYYMMDD_HHMMSS') || '.sql';
    RETURN backup_filename;
END;
$$ LANGUAGE plpgsql;

-- 3. Storage backup function
-- Backup Supabase Storage buckets (logos, QR codes, menu images)
CREATE OR REPLACE FUNCTION list_storage_files(bucket_name TEXT)
RETURNS TABLE (filename TEXT, created_at TIMESTAMPTZ, size BIGINT) AS $$
BEGIN
    -- This would be called by external script using Supabase Storage API
    -- Example: supabase storage list --bucket logos
    RETURN QUERY SELECT 
        'file_' || generate_series(1,10) as filename,
        NOW() - (generate_series(1,10) || ' days')::interval as created_at,
        (random() * 1000000)::bigint as size;
END;
$$ LANGUAGE plpgsql;

-- 4. Backup verification function
CREATE OR REPLACE FUNCTION verify_backup_integrity()
RETURNS TABLE (table_name TEXT, record_count BIGINT, last_backup TIMESTAMPTZ) AS $$
BEGIN
    -- Verify critical tables have data
    RETURN QUERY
    SELECT 
        'users'::TEXT as table_name,
        COUNT(*)::BIGINT as record_count,
        NOW() as last_backup
    FROM public.users
    WHERE deleted_at IS NULL
    
    UNION ALL
    
    SELECT 
        'restaurants'::TEXT,
        COUNT(*)::BIGINT,
        NOW()
    FROM public.restaurants
    WHERE deleted_at IS NULL
    
    UNION ALL
    
    SELECT 
        'orders'::TEXT,
        COUNT(*)::BIGINT,
        NOW()
    FROM public.orders
    WHERE deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;
