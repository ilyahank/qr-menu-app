# Data Protection & Backup Strategy

## Overview
This document outlines the comprehensive data protection strategy for the QR Menu application to ensure data integrity, availability, and security.

## 1. Database Backups

### Automated Daily Backups
- **Script**: `backup-database.sh`
- **Schedule**: Daily via cron job
- **Retention**: 30 days
- **Storage**: Local + optional S3 bucket

### Setup Instructions

1. **Configure Backup Script**
```bash
# Edit backup-database.sh with your credentials
nano backup-database.sh

# Make it executable
chmod +x backup-database.sh
```

2. **Set Up Cron Job**
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /path/to/qr-menu-app/backup-database.sh
```

3. **Optional S3 Storage**
```bash
# Install AWS CLI
pip install awscli

# Configure AWS credentials
aws configure

# Update backup script with your S3 bucket name
```

### Manual Backup
```bash
./backup-database.sh
```

### Restore from Backup
```bash
# Decompress backup
gunzip backups/qr_menu_backup_YYYYMMDD_HHMMSS.sql.gz

# Restore to database
psql -h db.hdbewuhbpkfbhowaduun.supabase.co -U postgres -d postgres -f backups/qr_menu_backup_YYYYMMDD_HHMMSS.sql
```

## 2. Soft Delete Implementation

### Tables with Soft Delete
- `users` - User accounts
- `restaurants` - Restaurant data
- `orders` - Order history
- `menu_items` - Menu items
- `categories` - Categories

### Migration
Run `migration-soft-delete.sql` in Supabase SQL Editor.

### Usage
Instead of permanent deletion:
```sql
-- Soft delete a user
SELECT soft_delete_user('user-id-here');

-- Soft delete a restaurant
SELECT soft_delete_restaurant('restaurant-id-here');

-- Query only non-deleted records
SELECT * FROM users WHERE deleted_at IS NULL;
```

### Restore Soft-Deleted Data
```sql
-- Restore a user
UPDATE users SET deleted_at = NULL WHERE id = 'user-id-here';

-- Restore a restaurant
UPDATE restaurants SET deleted_at = NULL WHERE id = 'restaurant-id-here';
```

## 3. Error Logging System

### Implementation
- **File**: `src/utils/errorLogger.js`
- **Table**: `error_logs`

### Migration
Run `migration-error-logs.sql` in Supabase SQL Editor.

### Usage in Components
```javascript
import { logError, logInfo } from '../utils/errorLogger';

try {
  // Your code
} catch (error) {
  logError(error, { 
    component: 'OrderForm',
    action: 'submitOrder' 
  });
}

// Log important events
logInfo('Order completed', { orderId: '123', total: 50.00 });
```

### View Error Logs
```sql
-- Recent errors
SELECT * FROM error_logs 
WHERE log_type = 'error' 
ORDER BY timestamp DESC 
LIMIT 50;

-- Errors by user
SELECT * FROM error_logs 
WHERE user_id = 'user-id-here' 
ORDER BY timestamp DESC;

-- Unresolved errors
SELECT * FROM error_logs 
WHERE resolved = FALSE 
ORDER BY timestamp DESC;
```

### Clean Old Logs
```sql
-- Keep last 30 days
SELECT clean_old_error_logs();
```

## 4. Database Transactions

### Critical Operations
Use PostgreSQL functions for transaction-safe operations:

```sql
-- Example: Safe restaurant deletion
CREATE OR REPLACE FUNCTION safe_delete_restaurant(p_restaurant_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Soft delete restaurant
    UPDATE public.restaurants 
    SET deleted_at = NOW() 
    WHERE id = p_restaurant_id;
    
    -- Log the action
    INSERT INTO public.error_logs (log_type, message, context)
    VALUES ('info', 'Restaurant soft deleted', 
            jsonb_build_object('restaurant_id', p_restaurant_id));
END;
$$ LANGUAGE plpgsql;
```

### Usage
```javascript
const { data, error } = await supabase
  .rpc('safe_delete_restaurant', { 
    p_restaurant_id: restaurantId 
  });
```

## 5. Security & HTTPS

### Vercel Configuration
The `vercel.json` file includes:
- **Strict-Transport-Security**: Enforce HTTPS
- **Content-Security-Policy**: Prevent XSS attacks
- **X-Frame-Options**: Prevent clickjacking
- **X-Content-Type-Options**: Prevent MIME sniffing

### Environment Variables
Set these in Vercel:
```
REACT_APP_SUPABASE_URL=your-supabase-url
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

## 6. High Availability

### Deployment Architecture
- **Frontend**: Vercel (CDN, automatic HTTPS, global edge network)
- **Backend**: Supabase (PostgreSQL, automatic backups, 99.9% SLA)
- **Storage**: Supabase Storage (redundant storage)

### Disaster Recovery Plan

1. **Database Recovery**
   - Use automated backups
   - Restore time: < 30 minutes
   - Point-in-time recovery available via Supabase

2. **Application Recovery**
   - Vercel automatic deployments
   - Rollback to previous versions
   - Zero-downtime deployments

3. **Monitoring**
   - Error logs track all issues
   - Supabase dashboard for database health
   - Vercel analytics for application performance

## 7. Testing & Validation

### Backup Testing
```bash
# Monthly: Test backup restoration
# 1. Create test database
# 2. Restore latest backup
# 3. Verify data integrity
# 4. Test application functionality
```

### Error Log Review
- Weekly review of error logs
- Investigate recurring errors
- Update code to prevent common issues

### Security Audit
- Monthly security review
- Check for vulnerabilities
- Update dependencies

## 8. Data Retention Policy

- **Error logs**: 30 days
- **Database backups**: 30 days
- **Soft-deleted data**: Indefinite (manual cleanup)
- **Order data**: 90 days (then archive)
- **Subscription history**: Indefinite

## 9. Emergency Contacts

- **Database Admin**: [Your contact]
- **Hosting Provider**: Vercel Support, Supabase Support
- **Backup Location**: [S3 bucket / local path]

## 10. Compliance

- **GDPR**: Data deletion requests handled via soft delete
- **Data Encryption**: HTTPS for all connections
- **Access Control**: Role-based permissions in Supabase
- **Audit Trail**: Error logs track all operations
