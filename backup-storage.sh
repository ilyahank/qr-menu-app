#!/bin/bash

# Supabase Storage Backup Script
# Backs up all storage buckets (logos, QR codes, menu images, receipts)

# Configuration
SUPABASE_URL="https://hdbewuhbpkfbhowaduun.supabase.co"
SUPABASE_ANON_KEY="your-anon-key-here"
BACKUP_DIR="./storage-backups"
RETENTION_DAYS=30
S3_BUCKET="your-backup-bucket"  # Optional

# Storage buckets to backup
BUCKETS=("logos" "qr-codes" "menu-images" "receipts" "reports")

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_SUBDIR="$BACKUP_DIR/storage_backup_$TIMESTAMP"
mkdir -p "$BACKUP_SUBDIR"

echo "Starting storage backup at $(date)"

# Backup each bucket
for bucket in "${BUCKETS[@]}"; do
    echo "Backing up bucket: $bucket"
    
    # Create bucket directory
    mkdir -p "$BACKUP_SUBDIR/$bucket"
    
    # List and download files using Supabase CLI
    # Requires: npm install -g supabase
    supabase storage download --bucket "$bucket" --local-path "$BACKUP_SUBDIR/$bucket"
    
    if [ $? -eq 0 ]; then
        echo "✅ Bucket $bucket backed up successfully"
    else
        echo "❌ Failed to backup bucket $bucket"
    fi
done

# Create archive
cd "$BACKUP_DIR"
tar -czf "storage_backup_$TIMESTAMP.tar.gz" "storage_backup_$TIMESTAMP"
rm -rf "storage_backup_$TIMESTAMP"

echo "Storage backup completed: storage_backup_$TIMESTAMP.tar.gz"

# Optional: Upload to S3
# aws s3 cp "$BACKUP_DIR/storage_backup_$TIMESTAMP.tar.gz" s3://$S3_BUCKET/storage-backups/

# Clean old backups
find "$BACKUP_DIR" -name "storage_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete
echo "Cleaned storage backups older than $RETENTION_DAYS days"

echo "Storage backup finished at $(date)"
