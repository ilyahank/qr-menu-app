# Data Protection & Backup Strategy v2

## Overview
Production-ready data protection strategy for the QR Menu SaaS application.

## Recovery Objectives

- **RTO (Recovery Time Objective)**: 15 minutes
- **RPO (Recovery Point Objective)**: 5 minutes

## 1. Soft Delete Implementation

### Tables with Soft Delete
- `users` - User accounts
- `restaurants` - Restaurant data
- `menu_items` - Menu items
- `categories` - Categories

### Orders: NO Soft Delete
Orders use status field instead:
- `pending`, `confirmed`, `completed`, `cancelled`, `refunded`, `rejected`
Orders are accounting history - keep forever.

### Migration
Run `migration-soft-delete-v2.sql` in Supabase SQL Editor.

### Usage
```sql
-- Generic soft delete (one function for all tables)
SELECT soft_delete_record('users', 'user-id-here');
SELECT soft_delete_record('restaurants', 'restaurant-id-here');

-- Generic restore
SELECT restore_record('users', 'user-id-here');
SELECT restore_record('restaurants', 'restaurant-id-here');

-- Use views for safe data access (recommended)
SELECT * FROM active_users;
SELECT * FROM active_restaurants;
SELECT * FROM active_menu_items;
```

### Views for Safe Access
Frontend should use these views to never accidentally load deleted data:
- `active_users`
- `active_restaurants`
- `active_menu_items`
- `active_categories`

## 2. System Logging

### Log Types
- `error` - Application errors
- `warning` - Warnings
- `info` - Informational events
- `security` - Security events
- `payment` - Payment events
- `order` - Order events
- `login` - Login/logout events
- `audit` - Audit trail

### Migration
Run `migration-system-logs-v2.sql` in Supabase SQL Editor.

### Security
- RLS ENABLED (critical)
- Only authenticated users can insert
- Admins can read all logs
- Restaurant owners can read their own logs
- NO anon access

### Usage in React
```javascript
import { 
  logError, 
  logWarning, 
  logInfo, 
  logSecurity, 
  logPayment, 
  logOrder, 
  logLogin 
} from '../utils/errorLogger';

try {
  // Your code
} catch (error) {
  logError(error, { component: 'OrderForm' }, 'high');
}

logSecurity('Suspicious login attempt', { ip: '192.168.1.1' });
logPayment('Payment received', { orderId: '123', amount: 50.00 });
logLogin('username', true); // successful login
```

### View Logs
```sql
-- Recent errors
SELECT * FROM system_logs 
WHERE log_type = 'error' 
ORDER BY timestamp DESC 
LIMIT 50;

-- Security events
SELECT * FROM system_logs 
WHERE log_type = 'security' 
ORDER BY timestamp DESC;

-- Restaurant's logs
SELECT * FROM system_logs 
WHERE restaurant_id = 'restaurant-id-here' 
ORDER BY timestamp DESC;
```

## 3. Audit Logs

### Purpose
Track all important actions for accountability:
- Who changed the menu?
- Who cancelled order #512?
- Who deleted waiter Ahmed?

### Migration
Run `migration-audit-logs.sql` in Supabase SQL Editor.

### Automatic Logging
Use the `log_audit_event` function in PostgreSQL functions:
```sql
SELECT log_audit_event(
    'update',           -- action
    'menu_items',       -- table_name
    'item-id-here',     -- record_id
    old_value_json,     -- old_value
    new_value_json,     -- new_value
    metadata_json       -- metadata
);
```

### Add Triggers (Optional)
For automatic audit logging on table changes:
```sql
CREATE TRIGGER audit_menu_items_trigger 
AFTER INSERT OR UPDATE OR DELETE ON public.menu_items
FOR EACH ROW EXECUTE FUNCTION audit_trigger();
```

## 4. Multi-Tenancy Security

### Purpose
Ensure Restaurant A can never access Restaurant B's data.

### Migration
Run `migration-multitenancy-rls.sql` in Supabase SQL Editor.

### RLS Policies
- Every table has RLS enabled
- Admins can see all data
- Owners can only see their restaurant's data
- Helper functions: `get_current_restaurant_id()`, `is_admin()`

### Verification
```sql
-- Test multi-tenancy
-- Login as Restaurant A owner, should only see Restaurant A data
SELECT * FROM restaurants; -- Should return only 1 row
```

## 5. Backup Strategy

### Supabase Native Backups (Primary)
1. **Point-in-Time Recovery (PITR)**
   - Enable in Supabase Dashboard > Database > Backups
   - Available on Pro plan
   - Restore to any point in time (up to retention period)

2. **Automatic Daily Backups**
   - Supabase automatically backs up daily
   - 7-day retention on free tier
   - 30-day retention on Pro tier

### External Backups (Secondary)
1. **Database Export**
   - Script: `backup-database.sh`
   - Schedule: Daily via cron
   - Storage: Local + optional S3
   - Retention: 30 days

2. **Storage Backup**
   - Script: `backup-storage.sh`
   - Backs up: logos, QR codes, menu images, receipts
   - Schedule: Daily via cron
   - Storage: Local + optional S3

### Setup Database Backup
```bash
# Edit backup script with database credentials
nano backup-database.sh

# Make executable
chmod +x backup-database.sh

# Add to cron (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /home/ilyas/qr-menu-app/backup-database.sh
```

### Setup Storage Backup
```bash
# Install Supabase CLI
npm install -g supabase

# Edit backup script
nano backup-storage.sh

# Make executable
chmod +x backup-storage.sh

# Add to cron (daily at 3 AM)
crontab -e
# Add: 0 3 * * * /home/ilyas/qr-menu-app/backup-storage.sh
```

### Restore from Backup
```bash
# Database
gunzip backups/qr_menu_backup_YYYYMMDD_HHMMSS.sql.gz
psql -h db.hdbewuhbpkfbhowaduun.supabase.co -U postgres -d postgres -f backups/qr_menu_backup_YYYYMMDD_HHMMSS.sql

# Storage
tar -xzf storage-backups/storage_backup_YYYYMMDD_HHMMSS.tar.gz
supabase storage upload --bucket logos --local-path storage_backup_YYYYMMDD_HHMMSS/logos/*
```

## 6. Database Transactions

### Implementation
Use PostgreSQL functions/RPCs for transaction-safe operations:

```sql
CREATE OR REPLACE FUNCTION safe_delete_restaurant(p_restaurant_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Transaction starts automatically
    
    -- Soft delete restaurant
    UPDATE public.restaurants 
    SET deleted_at = NOW() 
    WHERE id = p_restaurant_id;
    
    -- Log the action
    INSERT INTO public.audit_logs (action, table_name, record_id)
    VALUES ('delete', 'restaurants', p_restaurant_id);
    
    -- Transaction commits on success
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Usage
```javascript
const { data, error } = await supabase
  .rpc('safe_delete_restaurant', { 
    p_restaurant_id: restaurantId 
  });
```

## 7. Security & HTTPS

### Vercel Configuration
`vercel.json` includes:
- **Strict-Transport-Security**: Enforce HTTPS
- **Content-Security-Policy**: Prevent XSS
- **X-Frame-Options**: Prevent clickjacking
- **X-Content-Type-Options**: Prevent MIME sniffing
- **Referrer-Policy**: Control referrer information
- **Permissions-Policy**: Restrict browser features

### Additional Security
- Secure cookies (if using cookies)
- HttpOnly cookies (if using cookies)
- Rate limiting (implement in API)
- SQL injection protection (Supabase parameterizes queries)
- XSS protection (CSP headers)

## 8. High Availability

### Deployment Architecture
- **Frontend**: Vercel (CDN, automatic HTTPS, global edge network)
- **Backend**: Supabase (PostgreSQL, automatic backups, 99.9% SLA)
- **Storage**: Supabase Storage (redundant storage)

### Disaster Recovery Plan

1. **Database Recovery**
   - Use Supabase PITR (primary)
   - Use external backups (secondary)
   - Recovery time: < 15 minutes

2. **Application Recovery**
   - Vercel automatic deployments
   - Rollback to previous versions
   - Zero-downtime deployments

3. **Storage Recovery**
   - Use storage backups
   - Re-upload to Supabase Storage
   - Recovery time: < 30 minutes

## 9. Monitoring

### What to Monitor
- Failed orders
- Database response time
- CPU usage
- Storage usage
- Uptime
- API latency
- Error rate
- Security events

### Tools
- Supabase Dashboard (database health)
- Vercel Analytics (application performance)
- Future: Sentry or OpenTelemetry for application monitoring

## 10. Data Retention Policy

- **System logs**: 30 days
- **Audit logs**: 90 days
- **Database backups**: 30 days (external)
- **Storage backups**: 30 days (external)
- **Soft-deleted data**: Indefinite (manual cleanup)
- **Order data**: Forever (accounting history)
- **Subscription history**: Forever

## 11. Testing & Validation

### Backup Testing (Monthly)
1. Create test database
2. Restore latest backup
3. Verify data integrity
4. Test application functionality
5. Document results

### RLS Testing (Weekly)
1. Test as admin (should see all)
2. Test as restaurant owner (should see only their data)
3. Test as anonymous (should see nothing)
4. Document results

### Error Log Review (Weekly)
1. Review recent errors
2. Investigate recurring issues
3. Update code to prevent common errors
4. Resolve critical errors

## 12. Emergency Contacts

- **Database Admin**: [Your contact]
- **Hosting Provider**: Vercel Support, Supabase Support
- **Backup Location**: [S3 bucket / local path]

## 13. Compliance

- **GDPR**: Data deletion requests handled via soft delete
- **Data Encryption**: HTTPS for all connections
- **Access Control**: Role-based permissions + RLS
- **Audit Trail**: Audit logs track all operations
- **Multi-tenancy**: Restaurant isolation enforced by RLS

## 14. Migration Order

Run migrations in this order:
1. `migration-soft-delete-v2.sql`
2. `migration-system-logs-v2.sql`
3. `migration-audit-logs.sql`
4. `migration-multitenancy-rls.sql`
5. `backup-strategy-v2.sql` (optional - for reference)

## 15. Code Updates Required

After running migrations, update code to:
1. Use views (`active_users`, `active_restaurants`, etc.) instead of direct table access
2. Use new logging functions (`logError`, `logSecurity`, etc.)
3. Use generic soft delete functions
4. Add audit logging to critical operations
5. Remove old logging code that used `error_logs` table
