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

# ── Kill ALL old LinguaLearn processes first ─────────────────────
echo -e "${YELLOW}🧹 Cleaning up old processes...${NC}"
pkill -f "uvicorn.*backend.main" 2>/dev/null || true
pkill -f "next.*dev" 2>/dev/null || true
pkill -f "node.*next" 2>/dev/null || true
if command -v fuser >/dev/null 2>&1; then
  fuser -k 8080/tcp 2>/dev/null || true
  fuser -k 3000/tcp 2>/dev/null || true
fi
sleep 2
echo -e "${GREEN}   ✅ Cleanup done.${NC}"
echo ""

# ── Cleanup on Ctrl+C ───────────────────────────────────────────
cleanup() {
  echo ""
  echo -e "${YELLOW}🛑 Shutting down...${NC}"

  # Kill by PID
  [ -n "${BACKEND_PID:-}" ]  && kill "$BACKEND_PID"  2>/dev/null && echo "   Backend stopped"
  [ -n "${FRONTEND_PID:-}" ] && kill "$FRONTEND_PID" 2>/dev/null && echo "   Frontend stopped"

  # Also kill any children
  pkill -f "uvicorn.*backend.main" 2>/dev/null || true
  pkill -f "next.*dev" 2>/dev/null || true

  wait 2>/dev/null || true
  echo -e "${GREEN}✅ All services stopped. Goodbye!${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# ── Start backend ────────────────────────────────────────────────
echo -e "${GREEN}🚀 Starting backend...${NC}"
bash "$SCRIPT_DIR/start_backend.sh" $DEBUG_FLAG &
BACKEND_PID=$!

# Wait for /health to respond (up to 15 seconds)
echo -n "   Waiting for backend"
READY=0
for i in $(seq 1 15); do
  sleep 1
  echo -n "."

  # Check if process died
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo ""
    echo -e "${RED}❌ Backend process died. Check logs: logs/app.log${NC}"
    exit 1
  fi

  # Check /health
  if command -v curl >/dev/null 2>&1; then
    HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/health 2>/dev/null || echo "000")
    if [ "$HTTP" = "200" ]; then
      READY=1
      break
    fi
  else
    # No curl — try Python
    if python3 -c "
import urllib.request
try:
    r = urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=2)
    exit(0 if r.status == 200 else 1)
except: exit(1)
" 2>/dev/null; then
      READY=1
      break
    fi
  fi
done

echo ""
if [ "$READY" -eq 1 ]; then
  echo -e "${GREEN}   ✅ Backend is ready on http://127.0.0.1:8080${NC}"
else
  echo -e "${YELLOW}   ⚠️  Backend may still be starting...${NC}"
fi

echo ""

# ── Start frontend ───────────────────────────────────────────────
echo -e "${GREEN}🚀 Starting frontend...${NC}"
bash "$SCRIPT_DIR/start_frontend.sh" &
FRONTEND_PID=$!

sleep 4
if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
  echo -e "${RED}❌ Frontend failed to start${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "${GREEN}   ✅ All services running!${NC}"
echo ""
echo -e "   📱 ${YELLOW}Frontend:${NC}  http://127.0.0.1:3000"
echo -e "   🔧 ${YELLOW}Backend:${NC}   http://127.0.0.1:8080"
echo -e "   ❤️  ${YELLOW}Health:${NC}    http://127.0.0.1:8080/health"
echo ""
echo -e "   ${YELLOW}Press Ctrl+C to stop all services${NC}"
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo ""

wait
