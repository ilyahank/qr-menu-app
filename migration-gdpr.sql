-- GDPR Compliance Migration

-- Allow users to delete their data
ALTER TABLE users ADD COLUMN IF NOT EXISTS data_deletion_requested BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS data_deletion_requested_at TIMESTAMP;

-- Data retention policy
CREATE TABLE IF NOT EXISTS data_retention_policy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(255),
  retention_days INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO data_retention_policy (table_name, retention_days) VALUES
  ('audit_logs', 365),
  ('orders', 2555), -- 7 years for financial records
  ('users', NULL); -- Keep indefinitely unless requested

-- 2FA support
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255);

-- Backup codes for 2FA
CREATE TABLE IF NOT EXISTS backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  code VARCHAR(20),
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
