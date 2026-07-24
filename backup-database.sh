#!/bin/bash

# Automated Database Backup Script
# Run this daily via cron to backup Supabase database
# Usage: ./backup-database.sh

# Configuration
SUPABASE_URL="https://hdbewuhbpkfbhowaduun.supabase.co"
SUPABASE_DB_URL="postgresql://postgres:[YOUR-PASSWORD]@db.hdbewuhbpkfbhowaduun.supabase.co:5432/postgres"
BACKUP_DIR="./backups"
RETENTION_DAYS=30
S3_BUCKET="your-backup-bucket"  # Optional: for S3 storage

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/qr_menu_backup_$TIMESTAMP.sql"

echo "Starting database backup at $(date)"

# Export database schema and data
pg_dump "$SUPABASE_DB_URL" > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "Backup successful: $BACKUP_FILE"
    
    # Compress the backup
    gzip "$BACKUP_FILE"
    COMPRESSED_FILE="${BACKUP_FILE}.gz"
    echo "Compressed backup: $COMPRESSED_FILE"
    
    # Optional: Upload to S3 (requires AWS CLI configured)
    # aws s3 cp "$COMPRESSED_FILE" s3://$S3_BUCKET/qr_menu_backups/
    
    # Clean old backups (keep last RETENTION_DAYS)
    find "$BACKUP_DIR" -name "qr_menu_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
    echo "Cleaned backups older than $RETENTION_DAYS days"
    
    # Log success
    echo "Backup completed successfully at $(date)" >> "$BACKUP_DIR/backup.log"
else
    echo "Backup failed at $(date)" >> "$BACKUP_DIR/error.log"
    exit 1
fi
