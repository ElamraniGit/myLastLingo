#!/bin/bash
"""
================================================================
LinguaLearn - Environment Check Script
================================================================

يتحقق من جميع المتطلبات ويقدم تقريرًا بحالة النظام

الاستخدام:
    ./scripts/check_environment.sh

================================================================
"""

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║   LinguaLearn Environment Check          ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

check() {
    local name=$1
    local command=$2
    local hint=$3
    
    if eval "$command" &>/dev/null 2>&1; then
        echo -e "  ${GREEN}✅${NC} $name"
        return 0
    else
        echo -e "  ${RED}❌${NC} $name"
        [ -n "$hint" ] && echo -e "     ${YELLOW}ℹ️  $hint${NC}"
        return 1
    fi
}

echo ""
echo -e "${BLUE}📱 System:${NC}"
check "Termux detected" "[ -d '$PREFIX' ]" "Run this in Termux on Android"
check "Storage permission" "[ -d '$HOME/storage' ]" "Run: termux-setup-storage"
check "Free space (>=1GB)" "[ \$(df /data | awk 'NR==2 {print \$4}') -gt 1048576 ]" "Free up storage space"

echo ""
echo -e "${BLUE}🔧 Core Tools:${NC}"
check "Python 3" "python3 --version" "pkg install python"
check "Node.js" "node --version" "pkg install nodejs-lts"
check "Git" "git --version" "pkg install git"
check "FFmpeg" "ffmpeg -version" "pkg install ffmpeg"
check "CURL" "curl --version" "pkg install curl"
check "Wget" "wget --version" "pkg install wget"
check "SQLite" "sqlite3 --version" "pkg install sqlite"

echo ""
echo -e "${BLUE}🐍 Python Packages:${NC}"
check "FastAPI" "python3 -c 'import fastapi; print(fastapi.__version__)'"
check "Uvicorn" "python3 -c 'import uvicorn'"
check "yt-dlp" "python3 -c 'import yt_dlp'"
check "yaml" "python3 -c 'import yaml'"
check "aiohttp" "python3 -c 'import aiohttp'"
check "websockets" "python3 -c 'import websockets'"

# Optional
if python3 -c "import faster_whisper" &>/dev/null 2>&1; then
    echo -e "  ${GREEN}✅${NC} faster-whisper (AI transcription - OPTIONAL)"
else
    echo -e "  ${YELLOW}⚠️${NC} faster-whisper (AI transcription - OPTIONAL)"
    echo -e "     ${YELLOW}ℹ️  Install: pip install faster-whisper${NC}"
fi

echo ""
echo -e "${BLUE}📦 Node.js Packages:${NC}"
if [ -d "frontend/node_modules" ]; then
    check "React" "cd frontend && node -e 'require(\"react\")'"
    check "Next.js" "cd frontend && node -e 'require(\"next\")'"
    check "TailwindCSS" "cd frontend && node -e 'require(\"tailwindcss\")'"
    check "Zustand" "cd frontend && node -e 'require(\"zustand\")'"
else
    echo -e "  ${YELLOW}⚠️${NC} Frontend dependencies not installed"
    echo -e "     ${YELLOW}ℹ️  Run: cd frontend && npm install${NC}"
fi

echo ""
echo -e "${BLUE}📁 Project Structure:${NC}"
check "Backend entry" "[ -f 'backend/main.py' ]"
check "Frontend entry" "[ -f 'frontend/src/pages/_app.tsx' ]"
check "Config file" "[ -f 'config/settings.yaml' ]"
check "Install script" "[ -f 'scripts/install_termux.sh' ]"
check "Data directory" "[ -d 'data' ]"

echo ""
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════╗"
echo "║           ✅ Check Complete              ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"