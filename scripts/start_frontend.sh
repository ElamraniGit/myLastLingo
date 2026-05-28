#!/bin/bash
# ================================================================
# LinguaLearn — Start Frontend
# ================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT/frontend"

PORT="${LINGUALEARN_FRONTEND_PORT:-3000}"

# ── Kill any existing process on the port ────────────────────────
kill_port() {
  local pid=""
  if command -v lsof >/dev/null 2>&1; then
    pid=$(lsof -ti ":${PORT}" 2>/dev/null | head -1)
  elif command -v fuser >/dev/null 2>&1; then
    pid=$(fuser "${PORT}/tcp" 2>/dev/null | awk '{print $1}')
  elif command -v ss >/dev/null 2>&1; then
    pid=$(ss -tlnp "sport = :${PORT}" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -1)
  fi
  if [ -n "$pid" ]; then
    echo "⚠️  Port ${PORT} occupied by PID ${pid}. Killing..."
    kill "$pid" 2>/dev/null || true
    sleep 2
    kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
    sleep 1
    echo "   Port ${PORT} freed."
  fi
}

kill_port

echo "🌐 Starting LinguaLearn frontend on http://127.0.0.1:${PORT}"

# Use dev mode (hot reload) — for production use: npm run build && npm run start
PORT="$PORT" npm run dev
