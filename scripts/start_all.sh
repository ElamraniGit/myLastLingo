#!/bin/bash
# =================================================================
# LinguaLearn - Start Everything
# =================================================================
# تشغيل الخادم الخلفي والواجهة الأمامية في وقت واحد
# الاستخدام:
#   ./scripts/start_all.sh
#   ./scripts/start_all.sh --debug
# للإيقاف: Ctrl+C
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

check_port() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -i ":${port}" >/dev/null 2>&1
  elif command -v ss >/dev/null 2>&1; then
    ss -ltn "sport = :${port}" | grep -q LISTEN
  else
    return 1
  fi
}

if check_port 8080; then
  echo -e "${YELLOW}⚠️  Port 8080 is already in use. Backend may already be running.${NC}"
fi

if check_port 3000; then
  echo -e "${YELLOW}⚠️  Port 3000 is already in use. Frontend may already be running.${NC}"
fi

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

echo -e "${GREEN}🚀 Starting backend server on port 8080...${NC}"
if [ -n "$DEBUG_FLAG" ]; then
  bash "$SCRIPT_DIR/start_backend.sh" "$DEBUG_FLAG" &
else
  bash "$SCRIPT_DIR/start_backend.sh" &
fi
BACKEND_PID=$!
echo -e "   PID: $BACKEND_PID"

sleep 3
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  echo -e "${RED}❌ Backend failed to start${NC}"
  cleanup
fi

echo -e "${GREEN}🚀 Starting frontend server on port 3000...${NC}"
bash "$SCRIPT_DIR/start_frontend.sh" &
FRONTEND_PID=$!
echo -e "   PID: $FRONTEND_PID"

sleep 2
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
