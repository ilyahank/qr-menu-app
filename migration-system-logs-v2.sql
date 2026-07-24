-- System Logs Table v2 - Production Ready
-- Proper RLS, no anon access, flexible log types

CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_type VARCHAR(20) NOT NULL CHECK (log_type IN ('error', 'warning', 'info', 'security', 'payment', 'order', 'login', 'audit')),
    message TEXT NOT NULL,
    context JSONB,
    user_id UUID,
    restaurant_id UUID,
    url TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_agent TEXT,
    severity VARCHAR(10) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON public.system_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON public.system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_restaurant_id ON public.system_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_log_type ON public.system_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_resolved ON public.system_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_system_logs_severity ON public.system_logs(severity);

-- ENABLE RLS (critical security)
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Only authenticated users can insert logs
CREATE POLICY "Authenticated users can insert logs" ON public.system_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Only admins can read all logs
CREATE POLICY "Admins can read all logs" ON public.system_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Restaurant owners can read their own logs
CREATE POLICY "Owners can read their restaurant logs" ON public.system_logs
    FOR SELECT
    TO authenticated
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM public.users 
            WHERE users.id = auth.uid()
        )
    );

-- Only admins can update (resolve) logs
CREATE POLICY "Admins can update logs" ON public.system_logs
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Function to clean old logs (keep last 30 days)
CREATE OR REPLACE FUNCTION clean_old_system_logs()
RETURNS VOID AS $$
BEGIN
    DELETE FROM public.system_logs 
    WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION clean_old_system_logs() TO authenticated;
