#!/bin/bash
# ================================================================
# LinguaLearn — Start Frontend (production, dev, or fast mobile mode)
# ================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT/frontend"

export PORT="${LINGUALEARN_FRONTEND_PORT:-3000}"

DEV_MODE=false
FAST_MODE=false
for arg in "$@"; do
  [ "$arg" = "--dev" ]  && DEV_MODE=true
  [ "$arg" = "--fast" ] && FAST_MODE=true && DEV_MODE=true
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
  if [ -f "package-lock.json" ]; then
    npm ci --prefer-offline --no-audit --no-fund || npm install --prefer-offline --no-audit --no-fund
  else
    npm install --prefer-offline --no-audit --no-fund
  fi
fi
chmod +x node_modules/.bin/* 2>/dev/null || true

IS_TERMUX_ANDROID=false
if [ -n "${PREFIX:-}" ] && echo "$PREFIX" | grep -qi "com.termux"; then
  IS_TERMUX_ANDROID=true
elif uname -o 2>/dev/null | grep -qi "android"; then
  IS_TERMUX_ANDROID=true
fi

if [ "$IS_TERMUX_ANDROID" = true ] && [ "$DEV_MODE" = false ]; then
  echo "⚠️  Termux/Android detected — forcing frontend to MOBILE FAST mode (production build unsupported)."
  DEV_MODE=true
  FAST_MODE=true
fi

export NEXT_TELEMETRY_DISABLED=1
export NODE_CHANNEL_SERIALIZATION=json
if [ "$FAST_MODE" = true ]; then
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1024}"
fi

if [ "$DEV_MODE" = true ]; then
  if [ "$FAST_MODE" = true ]; then
    echo "🌐 Starting frontend (MOBILE FAST) on http://127.0.0.1:${PORT}"
  else
    echo "🌐 Starting frontend (DEV) on http://127.0.0.1:${PORT}"
  fi
  exec npx next dev -H 127.0.0.1 -p "$PORT"
fi

# ── Production: build FIRST (blocking), then start ───────────────
if [ ! -d ".next" ] || [ ! -f ".next/BUILD_ID" ]; then
  echo "🔨 Building frontend for production..."
  echo "   (this takes 1-2 minutes on first run)"
  # Fix for Node.js v22+: IPC serialization change breaks next build worker
  export NEXT_TELEMETRY_DISABLED=1
  export NODE_CHANNEL_SERIALIZATION=json
  npx next build 2>&1 || true
  if [ ! -f ".next/BUILD_ID" ]; then
    echo "❌ Build failed! Starting in dev mode instead..."
    exec npx next dev -H 127.0.0.1 -p "$PORT"
  fi
  echo "✅ Build complete!"
fi

echo "🌐 Starting frontend (PRODUCTION) on http://127.0.0.1:${PORT}"
exec npx next start -p "$PORT"
