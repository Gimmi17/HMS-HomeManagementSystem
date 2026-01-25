#!/bin/bash
# Database Restore Script for Meal Planner
#
# Usage:
#   ./scripts/restore-db.sh backup_file.sql
#   ./scripts/restore-db.sh --latest    # Restores the most recent backup
#
# WARNING: This will overwrite all existing data!

set -e

# Configuration
CONTAINER_NAME="meal-planner-db"
DB_USER="meal_planner"
DB_NAME="meal_planner_db"

# Get script and project directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"

# Parse arguments
if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file.sql> or $0 --latest"
    echo ""
    echo "Available backups:"
    ls -lt "$BACKUP_DIR"/meal_planner_backup_*.sql 2>/dev/null | head -5 || echo "No backups found"
    exit 1
fi

if [ "$1" = "--latest" ]; then
    BACKUP_FILE=$(ls -t "$BACKUP_DIR"/meal_planner_backup_*.sql 2>/dev/null | head -1)
    if [ -z "$BACKUP_FILE" ]; then
        echo "Error: No backups found in $BACKUP_DIR"
        exit 1
    fi
else
    BACKUP_FILE="$1"
fi

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "========================================"
echo "      DATABASE RESTORE WARNING"
echo "========================================"
echo ""
echo "This will OVERWRITE all existing data!"
echo ""
echo "Backup file: $BACKUP_FILE"
echo "Database: $DB_NAME"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo ""
echo "Starting database restore..."

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Error: Container $CONTAINER_NAME is not running!"
    exit 1
fi

# Restore backup
cat "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"

echo ""
echo "Database restore completed successfully!"
echo "Restored from: $BACKUP_FILE"
