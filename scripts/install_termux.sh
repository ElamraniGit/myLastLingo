#!/bin/bash
"""
================================================================
LinguaLearn - Termux Installation Script
================================================================

يقوم هذا السكريبت بتثبيت جميع المتطلبات لتشغيل تطبيق
LinguaLearn بالكامل على Termux (أندرويد)

المتطلبات:
- Termux مثبت من F-Droid (وليس Google Play)
- اتصال إنترنت قوي (لتحميل الحزم)
- 2GB مساحة تخزين على الأقل
- أندرويد 8+ (API 26+)

الاستخدام:
    chmod +x install_termux.sh
    ./install_termux.sh

================================================================
"""

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════╗"
echo "║         LinguaLearn Installer            ║"
echo "║     English Learning App for Termux      ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# Check if running in Termux
if [ -z "$PREFIX" ] || [ ! -d "$PREFIX" ]; then
    echo -e "${RED}❌ This script must be run in Termux on Android${NC}"
    exit 1
fi

echo -e "${BLUE}📱 Detected Termux environment${NC}"
echo -e "${BLUE}📦 Starting installation...${NC}"
echo ""

# Check storage permission
if [ ! -d "$HOME/storage" ]; then
    echo -e "${YELLOW}⚠️  Storage permission not granted${NC}"
    echo -e "${YELLOW}   Running: termux-setup-storage${NC}"
    termux-setup-storage || true
fi

# Step 1: Update packages
echo -e "${CYAN}[1/8] تحديث الحزم...${NC}"
pkg update -y && pkg upgrade -y

# Step 2: Install core dependencies
echo -e "${CYAN}[2/8] تثبيت المتطلبات الأساسية...${NC}"
pkg install -y \
    python \
    python-pip \
    nodejs \
    nodejs-lts \
    git \
    wget \
    curl \
    ffmpeg \
    build-essential \
    cmake \
    rust \
    binutils \
    libxml2 \
    libxslt \
    libzmq \
    openssl \
    sqlite \
    which \
    termux-tools \
    tur-repo \
    x11-repo

# Step 3: Install Python packages
echo -e "${CYAN}[3/8] تثبيت حزم Python...${NC}"

# Core backend
pip install --upgrade pip
pip install fastapi uvicorn[standard] websockets

# Database
pip install aiosqlite

# Configuration
pip install pyyaml

# HTTP client
pip install aiohttp

# Step 4: Install AI/ML packages
echo -e "${CYAN}[4/8] تثبيت حزم الذكاء الاصطناعي...${NC}"
echo -e "${YELLOW}   سيتم تثبيت faster-whisper للنسخ الصوتي المحلي${NC}"

# faster-whisper for local transcription
pip install faster-whisper

# For numpy support
pip install numpy

# Step 5: Install yt-dlp for YouTube
echo -e "${CYAN}[5/8] تثبيت أدوات YouTube...${NC}"
pip install yt-dlp

# Step 6: Install Node.js dependencies
echo -e "${CYAN}[6/8] تثبيت حزم الواجهة الأمامية...${NC}"
cd frontend
npm install
cd ..

# Step 7: Setup directories and models
echo -e "${CYAN}[7/8] إعداد المجلدات والنماذج...${NC}"

# Create required directories
mkdir -p data/{downloads,cache/{videos,transcripts,thumbnails},dictionary}
mkdir -p models/whisper
mkdir -p logs
mkdir -p frontend/public/icons

# Download Whisper model (base - small enough for mobile)
echo -e "${YELLOW}   تحميل نموذج Whisper (base)...${NC}"
python -c "
from faster_whisper import WhisperModel
model = WhisperModel('base', device='cpu', compute_type='int8', download_root='models/whisper/')
print('✅ Whisper model loaded successfully')
" || echo -e "${RED}⚠️  Whisper model download failed, will download on first use${NC}"

# Step 8: Build frontend
echo -e "${CYAN}[8/8] بناء الواجهة الأمامية...${NC}"
cd frontend
npm run build || npm run export
cd ..

# Create start script
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════╗"
echo "║          ✅ التثبيت اكتمل بنجاح           ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "${GREEN}📋 لتشغيل التطبيق:${NC}"
echo ""
echo -e "  ${YELLOW}1. تشغيل الخادم الخلفي:${NC}"
echo -e "     ${CYAN}./scripts/start_backend.sh${NC}"
echo ""
echo -e "  ${YELLOW}2. تشغيل الواجهة الأمامية:${NC}"
echo -e "     ${CYAN}./scripts/start_frontend.sh${NC}"
echo ""
echo -e "  ${YELLOW}3. فتح التطبيق:${NC}"
echo -e "     ${CYAN}http://127.0.0.1:3000${NC}"
echo ""
echo -e "  ${YELLOW}أو تشغيل الكل مرة واحدة:${NC}"
echo -e "     ${CYAN}./scripts/start_all.sh${NC}"
echo ""
echo -e "${PURPLE}Happy Learning! 🎉${NC}"