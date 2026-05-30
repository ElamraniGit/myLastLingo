#!/bin/bash
# ================================================================
# LinguaLearn — Start Frontend (production or dev)
# ================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT/frontend"

export PORT="${LINGUALEARN_FRONTEND_PORT:-3000}"

DEV_MODE=false
for arg in "$@"; do
  [ "$arg" = "--dev" ] && DEV_MODE=true
done

# ── Kill old processes ───────────────────────────────────────────
echo "🔍 Checking port ${PORT}..."
pkill -f "next.*dev" 2>/dev/null || true
pkill -f "next.*start" 2>/dev/null || true
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
fi
sleep 1

# ── Ensure node_modules ─────────────────────────────────────────
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi
chmod +x node_modules/.bin/* 2>/dev/null || true

if [ "$DEV_MODE" = true ]; then
  echo "🌐 Starting frontend (DEV) on http://127.0.0.1:${PORT}"
  exec npx next dev -p "$PORT"
fi

# ── Production: build FIRST (blocking), then start ───────────────
if [ ! -d ".next" ] || [ ! -f ".next/BUILD_ID" ]; then
  echo "🔨 Building frontend for production..."
  echo "   (this takes 1-2 minutes on first run)"
  npx next build 2>&1
  if [ $? -ne 0 ]; then
    echo "❌ Build failed! Starting in dev mode instead..."
    exec npx next dev -p "$PORT"
  fi
  echo "✅ Build complete!"
fi

echo "🌐 Starting frontend (PRODUCTION) on http://127.0.0.1:${PORT}"
exec npx next start -p "$PORT"
