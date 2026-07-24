-- Audit Logs Table
-- Track all important actions for accountability and debugging

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID,
    user_id UUID,
    action VARCHAR(50) NOT NULL, -- create, update, delete, login, logout, order_create, order_cancel, etc.
    table_name VARCHAR(50),
    record_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address TEXT,
    user_agent TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_restaurant_id ON public.audit_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Only authenticated users can insert (system will log automatically)
CREATE POLICY "System can insert audit logs" ON public.audit_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Restaurant owners can read their own audit logs
CREATE POLICY "Owners can read their audit logs" ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM public.users 
            WHERE users.id = auth.uid()
        )
    );

-- Admins can read all audit logs
CREATE POLICY "Admins can read all audit logs" ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Function to automatically log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
    p_action VARCHAR,
    p_table_name VARCHAR DEFAULT NULL,
    p_record_id UUID DEFAULT NULL,
    p_old_value JSONB DEFAULT NULL,
    p_new_value JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_restaurant_id UUID;
    v_user_id UUID := auth.uid();
    v_result UUID;
BEGIN
    -- Get restaurant_id from current user
    SELECT restaurant_id INTO v_restaurant_id
    FROM public.users
    WHERE id = v_user_id;
    
    -- Insert audit log
    INSERT INTO public.audit_logs (
        restaurant_id,
        user_id,
        action,
        table_name,
        record_id,
        old_value,
        new_value,
        ip_address,
        user_agent,
        metadata
    ) VALUES (
        v_restaurant_id,
        v_user_id,
        p_action,
        p_table_name,
        p_record_id,
        p_old_value,
        p_new_value,
        current_setting('request.headers', '{}')::json->>'x-forwarded-for',
        current_setting('request.headers', '{}')::json->>'user-agent',
        p_metadata
    )
    RETURNING id INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION log_audit_event(VARCHAR, VARCHAR, UUID, JSONB, JSONB, JSONB) TO authenticated;

-- Trigger function to automatically log changes to critical tables
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM log_audit_event('create', TG_TABLE_NAME, NEW.id, NULL, to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM log_audit_event('update', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM log_audit_event('delete', TG_TABLE_NAME, OLD.id, to_jsonb(OLD), NULL);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Add audit triggers to critical tables (example - add as needed)
-- CREATE TRIGGER audit_users_trigger AFTER INSERT OR UPDATE OR DELETE ON public.users
--     FOR EACH ROW EXECUTE FUNCTION audit_trigger();
