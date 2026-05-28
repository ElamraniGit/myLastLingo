#!/bin/bash
# =================================================================
# LinguaLearn - Start Everything
# =================================================================
# Starts backend + frontend together.
# Usage:
#   ./scripts/start_all.sh
#   ./scripts/start_all.sh --debug
# To stop: Ctrl+C
# =================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

DEBUG_FLAG=""
for arg in "$@"; do
  if [ "$arg" = "--debug" ]; then
    DEBUG_FLAG="--debug"
  fi
done

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║     LinguaLearn - Starting All           ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# ── Helper: find PID occupying a port ────────────────────────────
get_port_pid() {
  local port="$1"
  local pid=""
  if command -v lsof >/dev/null 2>&1; then
    pid=$(lsof -ti ":${port}" 2>/dev/null | head -1)
  elif command -v ss >/dev/null 2>&1; then
    pid=$(ss -tlnp "sport = :${port}" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -1)
  elif command -v fuser >/dev/null 2>&1; then
    pid=$(fuser "${port}/tcp" 2>/dev/null | awk '{print $1}')
  fi
  echo "$pid"
}

# ── Kill any process already on a port ───────────────────────────
free_port() {
  local port="$1"
  local name="$2"
  local pid
  pid=$(get_port_pid "$port")
  if [ -n "$pid" ]; then
    echo -e "${YELLOW}⚠️  Port ${port} is busy (PID ${pid}). Killing old ${name}...${NC}"
    kill "$pid" 2>/dev/null || true
    # Wait up to 3 seconds for it to die
    for i in 1 2 3; do
      sleep 1
      if ! kill -0 "$pid" 2>/dev/null; then
        break
      fi
    done
    # Force-kill if still alive
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
      sleep 1
    fi
    echo -e "${GREEN}   ✅ Port ${port} freed.${NC}"
  fi
}

# Free ports before starting
free_port 8080 "backend"
free_port 3000 "frontend"

# ── Cleanup on exit ──────────────────────────────────────────────
cleanup() {
  echo ""
  echo -e "${YELLOW}🛑 Shutting down...${NC}"

  if [ -n "${BACKEND_PID:-}" ]; then
    kill "$BACKEND_PID" 2>/dev/null || true
    echo -e "   Backend stopped (PID: $BACKEND_PID)"
  fi

  if [ -n "${FRONTEND_PID:-}" ]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
    echo -e "   Frontend stopped (PID: $FRONTEND_PID)"
  fi

  wait 2>/dev/null || true
  echo -e "${GREEN}✅ All services stopped. Goodbye!${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

# ── Start backend ────────────────────────────────────────────────
echo -e "${GREEN}🚀 Starting backend server on port 8080...${NC}"
if [ -n "$DEBUG_FLAG" ]; then
  bash "$SCRIPT_DIR/start_backend.sh" "$DEBUG_FLAG" &
else
  bash "$SCRIPT_DIR/start_backend.sh" &
fi
BACKEND_PID=$!
echo -e "   PID: $BACKEND_PID"

# Wait for backend to be ready (up to 10 seconds)
echo -e "   Waiting for backend to be ready..."
READY=0
for i in $(seq 1 10); do
  sleep 1
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo -e "${RED}❌ Backend process died unexpectedly${NC}"
    cleanup
  fi
  # Check if /health responds
  if command -v curl >/dev/null 2>&1; then
    if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/health 2>/dev/null | grep -q "200"; then
      READY=1
      break
    fi
  else
    # No curl — just check if port is bound
    if get_port_pid 8080 | grep -q .; then
      READY=1
      break
    fi
  fi
done

if [ "$READY" -eq 0 ]; then
  echo -e "${YELLOW}⚠️  Backend may still be starting (no /health response yet). Continuing...${NC}"
else
  echo -e "${GREEN}   ✅ Backend is ready!${NC}"
fi

# ── Start frontend ───────────────────────────────────────────────
echo -e "${GREEN}🚀 Starting frontend server on port 3000...${NC}"
bash "$SCRIPT_DIR/start_frontend.sh" &
FRONTEND_PID=$!
echo -e "   PID: $FRONTEND_PID"

sleep 3
if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
  echo -e "${RED}❌ Frontend failed to start${NC}"
  cleanup
fi

echo ""
echo -e "${GREEN}✅ All services running!${NC}"
echo ""
echo -e "   📱 ${YELLOW}Frontend:${NC}  http://127.0.0.1:3000"
echo -e "   🔧 ${YELLOW}Backend:${NC}   http://127.0.0.1:8080"
echo -e "   ❤️  ${YELLOW}Health:${NC}    http://127.0.0.1:8080/health"
echo ""
echo -e "${YELLOW}   Press Ctrl+C to stop all services${NC}"
echo ""

wait
