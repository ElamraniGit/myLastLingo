#!/bin/bash
# ================================================================
# LinguaLearn — Start Frontend
# ================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT/frontend"

PORT="${LINGUALEARN_FRONTEND_PORT:-3000}"

echo "🌐 Starting LinguaLearn frontend on http://127.0.0.1:${PORT}"

# Use dev mode (hot reload) — for production use: npm run build && npm run start
PORT="$PORT" npm run dev
