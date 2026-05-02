#!/usr/bin/env bash
#
# Automated Backup Script for REMI Bloom
#
# This script creates timestamped backups of:
#   1. The PostgreSQL database (via pg_dump inside the running container)
#   2. The persistent uploads directory (./public/uploads)
#
# Backups older than 7 days are automatically deleted.
#
# ── Crontab usage ──
# To run this script daily at 2:00 AM, add the following line to your crontab
# (`crontab -e`):
#
#   0 2 * * * /path/to/remi-bloom/scripts/backup.sh >> /path/to/remi-bloom/backups/cron.log 2>&1
#
# Make sure the script is executable:
#   chmod +x /path/to/remi-bloom/scripts/backup.sh
#
# ── Environment ──
# The script expects a .env file in the project root with at least:
#   DB_PASSWORD=your_database_password
# ──────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/backups"
ENV_FILE="$PROJECT_ROOT/.env"

# Load environment variables from .env
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
else
  echo "WARNING: .env file not found at $ENV_FILE — relying on already-set env vars."
fi

# Ensure the backups directory exists
mkdir -p "$BACKUP_DIR"

DATE_TAG="$(date +%F)"
DB_BACKUP_FILE="$BACKUP_DIR/db_backup_$DATE_TAG.sql"
UPLOADS_ARCHIVE="$BACKUP_DIR/uploads_$DATE_TAG.tar.gz"

echo "=== REMI Bloom Backup — $DATE_TAG ==="

# ── 1. Database backup ────────────────────────
echo ""
echo "[1/3] Dumping database..."
if docker exec remi-bloom-db pg_dump -U remi_bloom remi_bloom > "$DB_BACKUP_FILE"; then
  gzip -f "$DB_BACKUP_FILE"
  echo "      Database backup saved: ${DB_BACKUP_FILE}.gz"
else
  echo "      WARNING: Database dump failed (is the container running?)."
  rm -f "$DB_BACKUP_FILE"
fi

# ── 2. Uploads backup ─────────────────────────
echo "[2/3] Archiving uploads directory..."
UPLOADS_DIR="$PROJECT_ROOT/public/uploads"
if [ -d "$UPLOADS_DIR" ] && [ "$(ls -A "$UPLOADS_DIR" 2>/dev/null)" ]; then
  tar -czf "$UPLOADS_ARCHIVE" -C "$PROJECT_ROOT/public" uploads
  echo "      Uploads archive saved: $UPLOADS_ARCHIVE"
else
  echo "      Skipping (uploads directory is empty or missing)."
fi

# ── 3. Cleanup old backups (> 7 days) ─────────
echo "[3/3] Cleaning up backups older than 7 days..."
DELETED=0
while IFS= read -r -d '' f; do
  rm -f "$f"
  echo "      Deleted old backup: $(basename "$f")"
  DELETED=$((DELETED + 1))
done < <(find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'db_backup_*.sql.gz' -o -name 'uploads_*.tar.gz' \) -mtime +7 -print0)

if [ "$DELETED" -eq 0 ]; then
  echo "      No old backups to clean up."
fi

echo ""
echo "=== Backup complete ==="
