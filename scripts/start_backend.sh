#!/bin/bash
"""
================================================================
LinguaLearn - Backend Server Starter for Termux
================================================================

يقوم بتشغيل خادم FastAPI الخلفي محليًا على المنفذ 8080

الاستخدام:
    ./scripts/start_backend.sh             # تشغيل عادي
    ./scripts/start_backend.sh --debug     # وضع التصحيح
    ./scripts/start_backend.sh --port 9090 # منفذ مخصص

================================================================
"""

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Default values
PORT=8080
HOST="127.0.0.1"
WORKERS=1
DEBUG=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --debug)
            DEBUG=true
            shift
            ;;
        --port=*)
            PORT="${arg#*=}"
            shift
            ;;
        --host=*)
            HOST="${arg#*=}"
            shift
            ;;
        *)
            echo -e "${YELLOW}⚠️  Unknown argument: $arg${NC}"
            ;;
    esac
done

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║     LinguaLearn Backend Server           ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}❌ Python3 not found. Please run install_termux.sh first.${NC}"
    exit 1
fi

# Check if required directories exist
if [ ! -d "data" ]; then
    echo -e "${YELLOW}📁 Creating data directories...${NC}"
    mkdir -p data/{downloads,cache/{videos,transcripts,thumbnails},dictionary}
    mkdir -p models/whisper
    mkdir -p logs
fi

# Set environment variables
export LINGUALEARN_DEBUG=$DEBUG
export LINGUALEARN_PORT=$PORT
export LINGUALEARN_HOST=$HOST
export PYTHONPATH="$PROJECT_ROOT:$PYTHONPATH"

echo -e "${GREEN}🚀 Starting backend server...${NC}"
echo -e "   Host: ${YELLOW}$HOST${NC}"
echo -e "   Port: ${YELLOW}$PORT${NC}"
echo -e "   Mode: ${YELLOW}$([ "$DEBUG" = true ] && echo 'Debug' || echo 'Production')${NC}"
echo ""

# Run the FastAPI server
if [ "$DEBUG" = true ]; then
    python3 -m uvicorn backend.main:app \
        --host $HOST \
        --port $PORT \
        --reload \
        --log-level debug
else
    python3 -m uvicorn backend.main:app \
        --host $HOST \
        --port $PORT \
        --workers $WORKERS \
        --log-level info
fi