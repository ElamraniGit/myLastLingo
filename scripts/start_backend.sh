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

echo "🚀 Starting LinguaLearn backend on http://${HOST}:${PORT}"
echo "📂 Project root: ${PROJECT_ROOT}"
echo "🪵 Log level: ${LOG_LEVEL}"

python3 -m uvicorn backend.main:app \
  --host "$HOST" \
  --port "$PORT" \
  --workers 1 \
  --log-level "$LOG_LEVEL" \
  $ACCESS_LOG_FLAG
