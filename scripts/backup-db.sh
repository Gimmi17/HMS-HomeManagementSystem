#!/bin/bash
# Database Backup Script for Meal Planner
#
# Usage:
#   ./scripts/backup-db.sh              # Creates backup in ./backups/
#   ./scripts/backup-db.sh /path/to    # Creates backup in specified directory
#
# Backup file format: meal_planner_backup_YYYY-MM-DD_HH-MM-SS.sql

set -e

# Configuration
CONTAINER_NAME="meal-planner-db"
DB_USER="meal_planner"
DB_NAME="meal_planner_db"

# Backup directory (default: ./backups relative to project root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${1:-$PROJECT_DIR/backups}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/meal_planner_backup_$TIMESTAMP.sql"

echo "Starting database backup..."
echo "Container: $CONTAINER_NAME"
echo "Database: $DB_NAME"
echo "Backup file: $BACKUP_FILE"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Error: Container $CONTAINER_NAME is not running!"
    exit 1
fi

# Create backup using pg_dump inside container
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists > "$BACKUP_FILE"

# Check if backup was created successfully
if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
    echo "Backup completed successfully!"
    echo "File: $BACKUP_FILE"
    echo "Size: $BACKUP_SIZE"

    # Keep only last 10 backups
    cd "$BACKUP_DIR"
    ls -t meal_planner_backup_*.sql 2>/dev/null | tail -n +11 | xargs -r rm --
    REMAINING=$(ls meal_planner_backup_*.sql 2>/dev/null | wc -l)
    echo "Total backups retained: $REMAINING"
else
    echo "Error: Backup failed or file is empty!"
    exit 1
fi
