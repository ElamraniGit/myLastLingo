#!/bin/bash
# ================================================================
# LinguaLearn — Start Frontend
# ================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT/frontend"

export PORT="${LINGUALEARN_FRONTEND_PORT:-3000}"

# ── Kill old frontend processes ──────────────────────────────────
echo "🔍 Checking port ${PORT}..."

if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null && sleep 1 || true
fi

pkill -f "next.*dev" 2>/dev/null && echo "   Killed old Next.js dev server" && sleep 1 || true
pkill -f "node.*next" 2>/dev/null && sleep 1 || true

# ── Ensure node_modules exists and binaries are executable ───────
if [ ! -d "node_modules" ]; then
  echo "📦 node_modules not found. Running npm install..."
  npm install
fi

# Fix permissions on .bin (common issue after git operations)
chmod +x node_modules/.bin/* 2>/dev/null || true

echo "🌐 Starting LinguaLearn frontend on http://127.0.0.1:${PORT}"

exec npx next dev -p "$PORT"
