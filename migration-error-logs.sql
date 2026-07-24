-- Error Logs Table
-- Stores all application errors and important logs for debugging

CREATE TABLE IF NOT EXISTS public.error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_message TEXT,
    error_stack TEXT,
    log_type VARCHAR(20) DEFAULT 'error', -- 'error', 'info', 'warning'
    message TEXT,
    context JSONB,
    user_id UUID,
    url TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID
);

-- Create indexes for querying
CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON public.error_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON public.error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON public.error_logs(resolved);

-- Disable RLS for error logs
ALTER TABLE public.error_logs DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT ON public.error_logs TO anon;
GRANT SELECT, INSERT, UPDATE ON public.error_logs TO authenticated;

-- Function to clean old error logs (keep last 30 days)
CREATE OR REPLACE FUNCTION clean_old_error_logs()
RETURNS VOID AS $$
BEGIN
    DELETE FROM public.error_logs 
    WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
