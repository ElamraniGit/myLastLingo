#!/bin/bash
# ================================================================
# LinguaLearn — Update & Rebuild
# ================================================================
# Run this after every update:
#   cd ~/myLastLingo && bash update.sh
# ================================================================

set -e

echo "🔄 Updating LinguaLearn..."
echo ""

# 1. Pull latest code
echo "📥 Pulling latest code..."
git pull
echo ""

# 2. Kill running processes
echo "🛑 Stopping running services..."
pkill -f "uvicorn.*backend.main" 2>/dev/null || true
pkill -f "next" 2>/dev/null || true
sleep 2

# 3. Delete old build
echo "🗑️  Deleting old build..."
rm -rf frontend/.next

# 4. Database: DO NOT delete it.
# FIX-CRIT-2: Previously this script ran `rm data/lingualearn.db` on EVERY update,
# wiping all user accounts, saved words, review history and XP. Schema changes are
# now handled by additive migrations in DatabaseManager._run_migrations(), so the
# database is preserved. A timestamped backup is taken just in case.
if [ -f data/lingualearn.db ]; then
  mkdir -p data/backups
  cp data/lingualearn.db "data/backups/lingualearn-$(date +%Y%m%d-%H%M%S).db" 2>/dev/null || true
  echo "💾 Database preserved (backup written to data/backups/)."
fi

# 5. Ensure directories exist
mkdir -p data logs

# 6. Start everything
echo ""
echo "🚀 Starting LinguaLearn..."
echo ""
./scripts/start_all.sh
