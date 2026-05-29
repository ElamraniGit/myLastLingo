#!/bin/bash
# =================================================================
# LinguaLearn — Start Everything
# =================================================================
# Usage:
#   ./scripts/start_all.sh          → production mode
#   ./scripts/start_all.sh --dev    → development mode (hot reload)
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

# Parse args
DEV_FLAG=""
MODE="PRODUCTION"
for arg in "$@"; do
  if [ "$arg" = "--dev" ]; then
    DEV_FLAG="--dev"
    MODE="DEVELOPMENT"
  fi
done

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║     LinguaLearn — $MODE           "
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# ── Kill old processes ───────────────────────────────────────────
echo -e "${YELLOW}🧹 Cleaning up old processes...${NC}"
pkill -f "uvicorn.*backend.main" 2>/dev/null || true
pkill -f "next.*dev" 2>/dev/null || true
pkill -f "next.*start" 2>/dev/null || true
if command -v fuser >/dev/null 2>&1; then
  fuser -k 8080/tcp 2>/dev/null || true
  fuser -k 3000/tcp 2>/dev/null || true
fi
sleep 2
echo -e "${GREEN}   ✅ Cleanup done.${NC}"
echo ""

# ── Cleanup on exit ──────────────────────────────────────────────
cleanup() {
  echo ""
  echo -e "${YELLOW}🛑 Shutting down...${NC}"
  [ -n "${BACKEND_PID:-}" ]  && kill "$BACKEND_PID"  2>/dev/null && echo "   Backend stopped"
  [ -n "${FRONTEND_PID:-}" ] && kill "$FRONTEND_PID" 2>/dev/null && echo "   Frontend stopped"
  pkill -f "uvicorn.*backend.main" 2>/dev/null || true
  pkill -f "next" 2>/dev/null || true
  wait 2>/dev/null || true
  echo -e "${GREEN}✅ All services stopped.${NC}"
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# ── Start backend ────────────────────────────────────────────────
echo -e "${GREEN}🚀 Starting backend...${NC}"
bash "$SCRIPT_DIR/start_backend.sh" &
BACKEND_PID=$!

echo -n "   Waiting for backend"
READY=0
for i in $(seq 1 15); do
  sleep 1; echo -n "."
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo ""; echo -e "${RED}❌ Backend died${NC}"; exit 1
  fi
  if command -v curl >/dev/null 2>&1; then
    HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/health 2>/dev/null || echo "000")
    [ "$HTTP" = "200" ] && READY=1 && break
  else
    python3 -c "
import urllib.request
try:
    r = urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=2)
    exit(0 if r.status == 200 else 1)
except: exit(1)
" 2>/dev/null && READY=1 && break
  fi
done
echo ""
[ "$READY" -eq 1 ] && echo -e "${GREEN}   ✅ Backend ready${NC}" || echo -e "${YELLOW}   ⚠️ Backend may still be starting${NC}"
echo ""

# ── Start frontend ───────────────────────────────────────────────
echo -e "${GREEN}🚀 Starting frontend ($MODE)...${NC}"
bash "$SCRIPT_DIR/start_frontend.sh" $DEV_FLAG &
FRONTEND_PID=$!

sleep 5
if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
  echo -e "${RED}❌ Frontend failed${NC}"; exit 1
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "${GREEN}   ✅ LinguaLearn is running! ($MODE)${NC}"
echo ""
echo -e "   📱 ${YELLOW}App:${NC}      http://127.0.0.1:3000"
echo -e "   🔧 ${YELLOW}Backend:${NC}  http://127.0.0.1:8080"
echo -e "   ❤️  ${YELLOW}Health:${NC}   http://127.0.0.1:8080/health"
echo ""
echo -e "   ${YELLOW}Press Ctrl+C to stop${NC}"
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo ""

wait
