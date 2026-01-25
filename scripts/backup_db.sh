#!/bin/bash

# ==============================================================================
# Meal Planner - Database Backup Script
# ==============================================================================
# This script creates a backup of the PostgreSQL database
#
# Features:
# - Creates timestamped backup files
# - Compresses backups with gzip
# - Stores backups in ./backups directory
# - Optionally keeps only last N backups
# - Can be run manually or via cron
#
# Usage:
#   ./scripts/backup_db.sh [keep_count]
#
# Arguments:
#   keep_count  - Number of backups to keep (default: 7)
#
# Examples:
#   ./scripts/backup_db.sh        # Keep last 7 backups
#   ./scripts/backup_db.sh 14     # Keep last 14 backups
#
# Cron example (daily at 3 AM):
#   0 3 * * * /path/to/meal-planner/scripts/backup_db.sh >> /var/log/meal-planner-backup.log 2>&1
# ==============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Configuration
BACKUP_DIR="./backups"
KEEP_BACKUPS=${1:-7}  # Default: keep last 7 backups
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="meal_planner_backup_${TIMESTAMP}.sql"
BACKUP_FILE_GZ="${BACKUP_FILE}.gz"

# Database configuration (from docker-compose)
DB_CONTAINER="meal-planner-db"
DB_USER="meal_planner"
DB_NAME="meal_planner_db"

# Change to project root directory
cd "$(dirname "$0")/.."

print_info "Meal Planner - Database Backup"
print_info "$(date)"
echo ""

# ==============================================================================
# Step 1: Check if Docker container is running
# ==============================================================================
print_info "Checking if database container is running..."

if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    print_error "Database container '${DB_CONTAINER}' is not running!"
    print_info "Start it with: docker-compose up -d postgres"
    exit 1
fi

print_success "Database container is running"

# ==============================================================================
# Step 2: Create backup directory
# ==============================================================================
print_info "Creating backup directory..."

mkdir -p "${BACKUP_DIR}"
print_success "Backup directory ready: ${BACKUP_DIR}"

# ==============================================================================
# Step 3: Create database dump
# ==============================================================================
print_info "Creating database backup..."
print_info "Database: ${DB_NAME}"
print_info "File: ${BACKUP_DIR}/${BACKUP_FILE_GZ}"

# Run pg_dump inside the container
docker exec -t "${DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" \
    --clean \
    --if-exists \
    --create \
    --verbose \
    2>&1 | gzip > "${BACKUP_DIR}/${BACKUP_FILE_GZ}"

# Check if backup was successful
if [ $? -eq 0 ] && [ -f "${BACKUP_DIR}/${BACKUP_FILE_GZ}" ]; then
    # Get file size
    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE_GZ}" | cut -f1)
    print_success "Backup created successfully"
    print_info "Size: ${BACKUP_SIZE}"
else
    print_error "Backup failed!"
    exit 1
fi

# ==============================================================================
# Step 4: Verify backup integrity
# ==============================================================================
print_info "Verifying backup integrity..."

if gzip -t "${BACKUP_DIR}/${BACKUP_FILE_GZ}" 2>/dev/null; then
    print_success "Backup file integrity verified"
else
    print_error "Backup file is corrupted!"
    exit 1
fi

# ==============================================================================
# Step 5: Clean up old backups
# ==============================================================================
print_info "Cleaning up old backups (keeping last ${KEEP_BACKUPS})..."

# Count existing backups
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/meal_planner_backup_*.sql.gz 2>/dev/null | wc -l)

if [ "${BACKUP_COUNT}" -gt "${KEEP_BACKUPS}" ]; then
    # Remove oldest backups
    REMOVE_COUNT=$((BACKUP_COUNT - KEEP_BACKUPS))
    ls -1t "${BACKUP_DIR}"/meal_planner_backup_*.sql.gz | tail -n "${REMOVE_COUNT}" | xargs rm -f
    print_success "Removed ${REMOVE_COUNT} old backup(s)"
else
    print_info "No old backups to remove (${BACKUP_COUNT} total)"
fi

# ==============================================================================
# Step 6: List existing backups
# ==============================================================================
print_info "Current backups:"
ls -lh "${BACKUP_DIR}"/meal_planner_backup_*.sql.gz | awk '{print "  " $9 " (" $5 ")"}'

# ==============================================================================
# Summary
# ==============================================================================
echo ""
print_success "Backup completed successfully!"
print_info "Backup location: ${BACKUP_DIR}/${BACKUP_FILE_GZ}"
print_info "Total backups: $(ls -1 "${BACKUP_DIR}"/meal_planner_backup_*.sql.gz 2>/dev/null | wc -l)"
echo ""
print_info "To restore this backup, run:"
echo "  gunzip < ${BACKUP_DIR}/${BACKUP_FILE_GZ} | docker exec -i ${DB_CONTAINER} psql -U ${DB_USER} -d postgres"
echo ""
