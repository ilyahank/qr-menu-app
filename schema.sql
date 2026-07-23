-- 1. DROP TABLES IF THEY EXIST (FOR CLEAN RUN)
DROP TRIGGER IF EXISTS trigger_update_daily_sales ON public.orders;
DROP FUNCTION IF EXISTS update_daily_sales_summary();
DROP TABLE IF EXISTS public.print_jobs;
DROP TABLE IF EXISTS public.monthly_totals;
DROP TABLE IF EXISTS public.daily_sales_summary;
DROP TABLE IF EXISTS public.subscription_history;
DROP TABLE IF EXISTS public.subscriptions;
DROP TABLE IF EXISTS public.order_items;
DROP TABLE IF EXISTS public.orders;

-- 1.5. CREATE STORAGE BUCKET FOR REPORTS IF NOT EXISTS
INSERT INTO storage.buckets (id, name, public) 
VALUES ('reports', 'reports', true)
ON CONFLICT (id) DO NOTHING;

-- 2. CREATE ORDERS & ORDER ITEMS TABLES
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_number VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, confirmed, completed, cancelled
    total_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('Africa/Algiers'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('Africa/Algiers'::text, now())
);

CREATE TABLE public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 1,
    price DECIMAL(10, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('Africa/Algiers'::text, now())
);

-- Indexes for performance
CREATE INDEX idx_orders_restaurant ON public.orders(restaurant_id);
CREATE INDEX idx_orders_created_at ON public.orders(created_at);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);

-- 3. CREATE SUBSCRIPTIONS & SUBSCRIPTION HISTORY TABLES
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID UNIQUE NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, expiring_soon, expired
    start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('Africa/Algiers'::text, now()),
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('Africa/Algiers'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('Africa/Algiers'::text, now())
);

CREATE TABLE public.subscription_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    extended_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL DEFAULT 'extend', -- create, extend
    old_end_date TIMESTAMP WITH TIME ZONE,
    new_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_days INTEGER NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('Africa/Algiers'::text, now())
);

-- 4. CREATE SALES SUMMARY TABLES
CREATE TABLE public.daily_sales_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_orders INTEGER NOT NULL DEFAULT 0,
    total_revenue DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    avg_order_value DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('Africa/Algiers'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('Africa/Algiers'::text, now()),
    UNIQUE(restaurant_id, date)
);

CREATE TABLE public.monthly_totals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    total_orders INTEGER NOT NULL DEFAULT 0,
    total_revenue DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    pdf_url VARCHAR(512),
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('Africa/Algiers'::text, now()),
    UNIQUE(restaurant_id, month, year)
);

-- 5. CREATE PRINT JOBS TABLE
CREATE TABLE public.print_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    print_type VARCHAR(50) NOT NULL, -- customer, kitchen
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, printed, failed
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('Africa/Algiers'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('Africa/Algiers'::text, now()),
    UNIQUE(order_id, print_type)
);

-- 6. DISABLE ROW LEVEL SECURITY (RLS) FOR ALL NEW TABLES
-- (Aligining with current auth model of direct client access via Anon Key)
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_sales_summary DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_totals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_jobs DISABLE ROW LEVEL SECURITY;

-- 7. TRIGGER FOR AUTO-UPDATING DAILY SALES SUMMARY
CREATE OR REPLACE FUNCTION update_daily_sales_summary()
RETURNS TRIGGER AS $$
DECLARE
    order_date DATE;
    total_rev DECIMAL(10,2);
    total_ord INTEGER;
    avg_val DECIMAL(10,2);
BEGIN
    -- Extract date in Algiers timezone
    order_date := (NEW.created_at AT TIME ZONE 'Africa/Algiers')::DATE;

    -- Aggregate completed (paid) orders for that day
    SELECT COALESCE(COUNT(id), 0), COALESCE(SUM(total_price), 0)
    INTO total_ord, total_rev
    FROM public.orders
    WHERE restaurant_id = NEW.restaurant_id
      AND (created_at AT TIME ZONE 'Africa/Algiers')::DATE = order_date
      AND status = 'completed';

    IF total_ord > 0 THEN
        avg_val := total_rev / total_ord;
    ELSE
        avg_val := 0;
    END IF;

    -- Upsert daily sales summary
    INSERT INTO public.daily_sales_summary (restaurant_id, date, total_orders, total_revenue, avg_order_value, updated_at)
    VALUES (NEW.restaurant_id, order_date, total_ord, total_rev, avg_val, now())
    ON CONFLICT (restaurant_id, date)
    DO UPDATE SET
        total_orders = EXCLUDED.total_orders,
        total_revenue = EXCLUDED.total_revenue,
        avg_order_value = EXCLUDED.avg_order_value,
        updated_at = now();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_daily_sales
AFTER INSERT OR UPDATE OF status OR UPDATE OF total_price ON public.orders
FOR EACH ROW
EXECUTE FUNCTION update_daily_sales_summary();

-- 8. TRANSACTIONAL ARCHIVE RPC FUNCTION
CREATE OR REPLACE FUNCTION archive_restaurant_month(
    p_restaurant_id UUID,
    p_year INTEGER,
    p_month INTEGER,
    p_pdf_url VARCHAR(512),
    p_total_orders INTEGER,
    p_total_revenue DECIMAL(10, 2)
) RETURNS VOID AS $$
DECLARE
    start_date TIMESTAMP WITH TIME ZONE;
    end_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Calculate start and end bounds in Africa/Algiers timezone
    start_date := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'Africa/Algiers');
    end_date := start_date + INTERVAL '1 month';

    -- 1. Insert into monthly_totals
    INSERT INTO public.monthly_totals (restaurant_id, month, year, total_orders, total_revenue, pdf_url, archived_at)
    VALUES (p_restaurant_id, p_month, p_year, p_total_orders, p_total_revenue, p_pdf_url, now())
    ON CONFLICT (restaurant_id, month, year) 
    DO UPDATE SET 
        total_orders = EXCLUDED.total_orders,
        total_revenue = EXCLUDED.total_revenue,
        pdf_url = EXCLUDED.pdf_url;

    -- 2. Delete raw order items
    DELETE FROM public.order_items
    WHERE order_id IN (
        SELECT id FROM public.orders
        WHERE restaurant_id = p_restaurant_id
          AND created_at >= start_date
          AND created_at < end_date
    );

    -- 3. Delete raw orders
    DELETE FROM public.orders
    WHERE restaurant_id = p_restaurant_id
      AND created_at >= start_date
      AND created_at < end_date;

    -- 4. Delete daily sales summaries
    DELETE FROM public.daily_sales_summary
    WHERE restaurant_id = p_restaurant_id
      AND date >= start_date::DATE
      AND date < end_date::DATE;

END;
$$ LANGUAGE plpgsql;

-- 9. BEFORE INSERT TRIGGER FOR SUBSCRIPTION ENFORCEMENT ON ORDERS
CREATE OR REPLACE FUNCTION check_restaurant_subscription()
RETURNS TRIGGER AS $$
DECLARE
    sub_end TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get subscription end date for the restaurant
    SELECT end_date INTO sub_end
    FROM public.subscriptions
    WHERE restaurant_id = NEW.restaurant_id;

    -- If subscription is missing or expired, block the order insertion
    IF sub_end IS NULL THEN
        RAISE EXCEPTION 'Restaurant has no active subscription';
    ELSIF sub_end <= timezone('Africa/Algiers'::text, now()) THEN
        RAISE EXCEPTION 'Restaurant subscription has expired';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_subscription_before_order
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION check_restaurant_subscription();

-- 10. TABLE SESSIONS FOR LOCKING
CREATE TABLE IF NOT EXISTS public.table_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_number VARCHAR(50) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    device_info TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('Africa/Algiers'::text, now()),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT timezone('Africa/Algiers'::text, now()),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(restaurant_id, table_number, is_active)
);

CREATE INDEX idx_table_sessions_restaurant ON public.table_sessions(restaurant_id, is_active);
CREATE INDEX idx_table_sessions_table ON public.table_sessions(restaurant_id, table_number);

-- Function to create or update table session
CREATE OR REPLACE FUNCTION create_or_update_table_session(
    p_restaurant_id UUID,
    p_table_number VARCHAR(50),
    p_session_id VARCHAR(255),
    p_device_info TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.table_sessions (restaurant_id, table_number, session_id, device_info, is_active)
    VALUES (p_restaurant_id, p_table_number, p_session_id, p_device_info, true)
    ON CONFLICT (restaurant_id, table_number, is_active)
    DO UPDATE SET
        session_id = EXCLUDED.session_id,
        device_info = EXCLUDED.device_info,
        last_activity = timezone('Africa/Algiers'::text, now());
END;
$$ LANGUAGE plpgsql;

-- Function to check if table is locked
CREATE OR REPLACE FUNCTION is_table_locked(
    p_restaurant_id UUID,
    p_table_number VARCHAR(50),
    p_session_id VARCHAR(255)
)
RETURNS BOOLEAN AS $$
DECLARE
    is_locked BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM public.table_sessions
        WHERE restaurant_id = p_restaurant_id
        AND table_number = p_table_number
        AND is_active = true
        AND session_id != p_session_id
        AND last_activity > timezone('Africa/Algiers'::text, now()) - INTERVAL '30 minutes'
    ) INTO is_locked;

    RETURN is_locked;
END;
$$ LANGUAGE plpgsql;

-- Function to unlock table (by staff)
CREATE OR REPLACE FUNCTION unlock_table(
    p_restaurant_id UUID,
    p_table_number VARCHAR(50)
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.table_sessions
    SET is_active = false
    WHERE restaurant_id = p_restaurant_id
    AND table_number = p_table_number
    AND is_active = true;
END;
$$ LANGUAGE plpgsql;

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

CREATE INDEX idx_restaurant_tables_restaurant ON public.restaurant_tables(restaurant_id, is_active);

-- 12. TAKEAWAY QR CODES
CREATE TABLE IF NOT EXISTS public.takeaway_qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    qr_code_url VARCHAR(512) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('Africa/Algiers'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('Africa/Algiers'::text, now())
);

CREATE INDEX idx_takeaway_qr_restaurant ON public.takeaway_qr_codes(restaurant_id, is_active);

