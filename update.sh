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

# 4. Delete old database (needed when schema changes)
if [ -f data/lingualearn.db ]; then
  echo "🗑️  Resetting database..."
  rm data/lingualearn.db
fi

# 5. Ensure directories exist
mkdir -p data logs

# 6. Start everything
echo ""
echo "🚀 Starting LinguaLearn..."
echo ""
./scripts/start_all.sh
