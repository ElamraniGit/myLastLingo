#!/bin/bash
"""
================================================================
LinguaLearn - Start Everything
================================================================

تشغيل الخادم الخلفي والواجهة الأمامية في وقت واحد

الاستخدام:
    ./scripts/start_all.sh
    ./scripts/start_all.sh --debug

للإيقاف: Ctrl+C
================================================================
"""

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Parse arguments
DEBUG=""
for arg in "$@"; do
    if [ "$arg" = "--debug" ]; then
        DEBUG="--debug"
    fi
done

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║     LinguaLearn - Starting All           ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# Check if already running
if lsof -i :8080 &>/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port 8080 is already in use. Backend may already be running.${NC}"
fi

if lsof -i :3000 &>/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port 3000 is already in use. Frontend may already be running.${NC}"
fi

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down...${NC}"
    
    # Kill background processes
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        echo -e "   Backend stopped (PID: $BACKEND_PID)"
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
        echo -e "   Frontend stopped (PID: $FRONTEND_PID)"
    fi
    
    echo -e "${GREEN}✅ All services stopped. Goodbye!${NC}"
    exit 0
}

# Trap exit signals
trap cleanup SIGINT SIGTERM

# Start backend
echo -e "${GREEN}🚀 Starting backend server on port 8080...${NC}"
bash "$SCRIPT_DIR/start_backend.sh $DEBUG" &
BACKEND_PID=$!
echo -e "   PID: $BACKEND_PID"

# Wait for backend to be ready
sleep 3

# Check if backend started successfully
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}❌ Backend failed to start${NC}"
    cleanup
    exit 1
fi

# Start frontend
echo -e "${GREEN}🚀 Starting frontend server on port 3000...${NC}"
bash "$SCRIPT_DIR/start_frontend.sh" &
FRONTEND_PID=$!
echo -e "   PID: $FRONTEND_PID"

sleep 2

echo ""
echo -e "${GREEN}✅ All services running!${NC}"
echo ""
echo -e "   📱 ${YELLOW}Frontend:${NC}  http://127.0.0.1:3000"
echo -e "   🔧 ${YELLOW}Backend:${NC}   http://127.0.0.1:8080"
echo -e "   ❤️  ${YELLOW}Health:${NC}    http://127.0.0.1:8080/health"
echo ""
echo -e "${YELLOW}   Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for any process to exit
wait