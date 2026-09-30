# RouteGuard Backup and Recovery Procedures

This document outlines the procedures for backing up and recovering the RouteGuard Supabase database.

## Overview

Supabase provides managed PostgreSQL databases with built-in backup capabilities. However, it's important to implement additional backup strategies for critical data.

## Supabase Built-in Backups

Supabase automatically performs:
- Daily full backups
- Continuous WAL (Write-Ahead Logging) archiving
- Point-in-time recovery (PITR) for up to 7 days

These backups are managed by Supabase and can be restored through the Supabase dashboard or CLI.

## Manual Backup Procedures

### 1. Using pg_dump

To manually backup the database:

```bash
# Install PostgreSQL client tools if not already installed
# On Ubuntu/Debian: sudo apt-get install postgresql-client
# On macOS: brew install libpq

# Get your Supabase connection details
# You can find these in your Supabase project settings under Database > Connection string

# Backup the entire database
pg_dump --host=your-db-host.supabase.co \
        --port=5432 \
        --username=postgres \
        --dbname=postgres \
        --format=custom \
        --file=routeguard-backup-$(date +%Y%m%d-%H%M%S).dump \
        --verbose

# Backup only schema
pg_dump --host=your-db-host.supabase.co \
        --port=5432 \
        --username=postgres \
        --dbname=postgres \
        --schema-only \
        --format=plain \
        --file=routeguard-schema-$(date +%Y%m%d-%H%M%S).sql \
        --verbose

# Backup only data
pg_dump --host=your-db-host.supabase.co \
        --port=5432 \
        --username=postgres \
        --dbname=postgres \
        --data-only \
        --format=custom \
        --file=routeguard-data-$(date +%Y%m%d-%H%M%S).dump \
        --verbose
```

### 2. Using Supabase CLI

Supabase provides a CLI tool for managing backups:

```bash
# Install Supabase CLI
# npm install -g supabase
# Or: brew install supabase/tap/supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Create a backup
supabase db dump --debug

# This creates a backup file in the current directory
```

## Recovery Procedures

### 1. Restoring from pg_dump Backup

```bash
# Restore a full database backup
pg_restore --host=your-db-host.supabase.co \
           --port=5432 \
           --username=postgres \
           --dbname=postgres \
           --verbose \
           routeguard-backup-YYYYMMDD-HHMMSS.dump

# Restore only schema
psql --host=your-db-host.supabase.co \
     --port=5432 \
     --username=postgres \
     --dbname=postgres \
     --file=routeguard-schema-YYYYMMDD-HHMMSS.sql

# Restore only data
pg_restore --host=your-db-host.supabase.co \
           --port=5432 \
           --username=postgres \
           --dbname=postgres \
           --data-only \
           --verbose \
           routeguard-data-YYYYMMDD-HHMMSS.dump
```

### 2. Using Supabase Point-in-Time Recovery

If you need to restore to a specific point in time (within the last 7 days):

1. Navigate to your Supabase project dashboard
2. Go to Database > Backups
3. Select "Point-in-time recovery"
4. Choose the date and time to restore to
5. Follow the prompts to initiate the recovery

### 3. Disaster Recovery

In case of a major incident:

1. Contact Supabase support immediately
2. Use the most recent available backup
3. Verify data integrity after restoration
4. Update application configuration if connection details change
5. Notify users if downtime is expected

## Backup Schedule Recommendations

For RouteGuard, we recommend:

1. **Daily automated backups** using Supabase CLI script
2. **Weekly full backups** stored in multiple locations
3. **Monthly backup verification** by restoring to a test environment
4. **Before major migrations**: Always take a manual backup

### Example Backup Script

Create a script `backup-script.sh`:

```bash
#!/bin/bash
# RouteGuard Database Backup Script

# Configuration
PROJECT_REF="your-project-ref"
BACKUP_DIR="/path/to/backups"
RETENTION_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/routeguard-backup-$TIMESTAMP.dump"

# Perform backup
echo "Starting backup: $BACKUP_FILE"
supabase db dump --project-ref "$PROJECT_REF" --file "$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "Backup completed successfully"
    
    # Upload to remote storage (optional)
    # aws s3 cp "$BACKUP_FILE" s3://your-backup-bucket/
    
    # Clean up old backups
    find "$BACKUP_DIR" -name "routeguard-backup-*" -type f -mtime +$RETENTION_DAYS -delete
    echo "Cleaned up backups older than $RETENTION_DAYS days"
else
    echo "Backup failed!"
    exit 1
fi
```

Make the script executable:
```bash
chmod +x backup-script.sh
```

Schedule it with cron (run daily at 2 AM):
```bash
0 2 * * * /path/to/backup-script.sh >> /var/log/routeguard-backup.log 2>&1
```

## Storage Backup (Hazard Photos)

In addition to the database, hazard photos stored in Supabase Storage should be backed up:

### Using Supabase CLI for Storage

```bash
# List files in a bucket
supabase storage ls hazard-photos

# Download all files from a bucket
mkdir -p hazard-photos-backup
supabase storage cp hazard-photos ./hazard-photos-backup --recursive

# To restore, reverse the process
supabase storage cp ./hazard-photos-backup/* hazard-photos/ --recursive
```

## Testing Backups

Regularly test your backup and recovery procedures:

1. **Monthly**: Restore the most recent backup to a staging environment
2. **Quarterly**: Perform a full disaster recovery drill
3. **After each major migration**: Verify backup integrity
4. **Document**: Keep records of backup tests and recovery times

## Security Considerations

1. **Encrypt backups**: Consider encrypting backup files before storing
2. **Secure transfer**: Use secure protocols (SSH, HTTPS) for transferring backups
3. **Access controls**: Restrict access to backup files
4. **Retention policy**: Define how long to keep backups based on compliance requirements

## Monitoring

Set up monitoring for backup processes:

1. Check backup logs regularly
2. Set up alerts for backup failures
3. Monitor backup size trends
4. Verify backup completeness

## Additional Resources

- Supabase Documentation: https://supabase.com/docs/guides/database/backups
- PostgreSQL Backup and Restore: https://www.postgresql.org/docs/current/backup.html
- Supabase CLI: https://supabase.com/docs/reference/cli