#!/bin/bash
# ================================================================
# LinguaLearn — Start Backend
# ================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Create required directories
mkdir -p data/downloads
mkdir -p data/cache/videos
mkdir -p data/cache/transcripts
mkdir -p data/cache/thumbnails
mkdir -p data/dictionary
mkdir -p data/temp
mkdir -p models/whisper
mkdir -p logs

PORT="${LINGUALEARN_PORT:-8080}"
HOST="${LINGUALEARN_HOST:-127.0.0.1}"
LOG_LEVEL="info"
ACCESS_LOG_FLAG="--no-access-log"

for arg in "$@"; do
  if [ "$arg" = "--debug" ]; then
    LOG_LEVEL="debug"
    ACCESS_LOG_FLAG="--access-log"
  fi
done

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

echo "🚀 Starting LinguaLearn backend on http://${HOST}:${PORT}"
echo "📂 Project root: ${PROJECT_ROOT}"
echo "🪵 Log level: ${LOG_LEVEL}"

python3 -m uvicorn backend.main:app \
  --host "$HOST" \
  --port "$PORT" \
  --workers 1 \
  --log-level "$LOG_LEVEL" \
  $ACCESS_LOG_FLAG
