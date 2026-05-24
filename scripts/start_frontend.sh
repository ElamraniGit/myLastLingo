#!/bin/bash
"""
================================================================
LinguaLearn - Frontend Server Starter for Termux
================================================================

يقوم بتشغيل واجهة Next.js الأمامية محليًا على المنفذ 3000

الاستخدام:
    ./scripts/start_frontend.sh
    ./scripts/start_frontend.sh --port 4000

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

cd "$PROJECT_ROOT/frontend"

# Default values
PORT=3000
HOST="127.0.0.1"

# Parse arguments
for arg in "$@"; do
    case $arg in
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
echo "║    LinguaLearn Frontend Server           ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}❌ Node.js not found. Please run install_termux.sh first.${NC}"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Check if build exists
if [ ! -d ".next" ]; then
    echo -e "${YELLOW}🏗️  Building frontend...${NC}"
    npm run build
fi

echo -e "${GREEN}🚀 Starting frontend server...${NC}"
echo -e "   Host: ${YELLOW}$HOST${NC}"
echo -e "   Port: ${YELLOW}$PORT${NC}"
echo -e "   URL:  ${YELLOW}http://$HOST:$PORT${NC}"
echo ""

# Set the API URL
export NEXT_PUBLIC_API_URL="http://127.0.0.1:8080/api/v1"

# Run Next.js server
npx next start -p $PORT -H $HOST