#!/bin/bash
# ================================================================
# LinguaLearn — Termux Installation Script
# ================================================================
#
# Installs all requirements to run LinguaLearn fully on Android
# via Termux (from F-Droid — NOT Google Play).
#
# Requirements:
#   - Termux from F-Droid
#   - Strong internet connection (first install only)
#   - 2GB+ free storage
#   - Android 8+ (API 26+)
#
# Usage:
#   chmod +x scripts/install_termux.sh
#   ./scripts/install_termux.sh
# ================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════╗"
echo "║         LinguaLearn Installer            ║"
echo "║    English Learning App for Termux       ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# Verify Termux environment
if [ -z "$PREFIX" ] || [ ! -d "$PREFIX" ]; then
  echo -e "${RED}❌ This script must be run inside Termux on Android${NC}"
  exit 1
fi

echo -e "${BLUE}📱 Termux environment detected${NC}"

# Grant storage permission if not already granted
if [ ! -d "$HOME/storage" ]; then
  echo -e "${YELLOW}⚠️  Requesting storage permission...${NC}"
  termux-setup-storage || true
  sleep 2
fi

# ──────────────────────────────────────────────────────────
# STEP 1: Update packages
# ──────────────────────────────────────────────────────────
echo -e "\n${CYAN}[1/8] Updating packages...${NC}"
pkg update -y && pkg upgrade -y

# ──────────────────────────────────────────────────────────
# STEP 2: Core system packages
# ──────────────────────────────────────────────────────────
echo -e "\n${CYAN}[2/8] Installing core packages...${NC}"
pkg install -y \
  python \
  python-pip \
  nodejs \
  git \
  wget \
  curl \
  ffmpeg \
  build-essential \
  cmake \
  binutils \
  openssl \
  sqlite \
  termux-tools

# ──────────────────────────────────────────────────────────
# STEP 3: Python packages (core)
# ──────────────────────────────────────────────────────────
echo -e "\n${CYAN}[3/8] Installing Python packages...${NC}"
pip install --upgrade pip

pip install \
  fastapi \
  "uvicorn[standard]" \
  websockets \
  aiosqlite \
  pyyaml \
  aiohttp \
  python-multipart

# ──────────────────────────────────────────────────────────
# STEP 4: yt-dlp (YouTube extraction)
# ──────────────────────────────────────────────────────────
echo -e "\n${CYAN}[4/8] Installing yt-dlp...${NC}"
pip install "yt-dlp>=2024.1.0"

# Verify yt-dlp works
if yt-dlp --version > /dev/null 2>&1; then
  echo -e "${GREEN}✅ yt-dlp installed: $(yt-dlp --version)${NC}"
else
  echo -e "${RED}⚠️  yt-dlp may not be in PATH. Try: pip install yt-dlp${NC}"
fi

# ──────────────────────────────────────────────────────────
# STEP 5: Whisper (optional — ~500MB)
# ──────────────────────────────────────────────────────────
echo -e "\n${CYAN}[5/8] Installing Whisper (optional local STT)...${NC}"
echo -e "${YELLOW}  This downloads ~500MB. Skip with Ctrl+C if not needed.${NC}"

pip install numpy || echo -e "${YELLOW}⚠️  numpy install failed (optional)${NC}"
pip install faster-whisper || echo -e "${YELLOW}⚠️  faster-whisper install failed (optional)${NC}"

# ──────────────────────────────────────────────────────────
# STEP 6: Frontend dependencies
# ──────────────────────────────────────────────────────────
echo -e "\n${CYAN}[6/8] Installing frontend dependencies...${NC}"
cd frontend
npm install
cd ..

# ──────────────────────────────────────────────────────────
# STEP 7: Create directories
# ──────────────────────────────────────────────────────────
echo -e "\n${CYAN}[7/8] Creating directories...${NC}"
mkdir -p data/{downloads,cache/{videos,transcripts,thumbnails},dictionary,temp}
mkdir -p models/whisper
mkdir -p logs
mkdir -p frontend/public/icons

echo -e "${GREEN}✅ Directories created${NC}"

# ──────────────────────────────────────────────────────────
# STEP 8: Build frontend
# ──────────────────────────────────────────────────────────
echo -e "\n${CYAN}[8/8] Building frontend...${NC}"
cd frontend
npm run build || {
  echo -e "${YELLOW}⚠️  Production build failed. Will use dev mode.${NC}"
}
cd ..

# ──────────────────────────────────────────────────────────
# Done!
# ──────────────────────────────────────────────────────────
echo -e "\n${GREEN}"
echo "╔══════════════════════════════════════════╗"
echo "║      ✅ Installation Complete!           ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "${GREEN}To start the app:${NC}"
echo ""
echo -e "  ${YELLOW}Terminal 1 — Backend:${NC}"
echo -e "  ${CYAN}chmod +x scripts/start_backend.sh && ./scripts/start_backend.sh${NC}"
echo ""
echo -e "  ${YELLOW}Terminal 2 — Frontend:${NC}"
echo -e "  ${CYAN}chmod +x scripts/start_frontend.sh && ./scripts/start_frontend.sh${NC}"
echo ""
echo -e "  ${YELLOW}Then open in Android browser:${NC}"
echo -e "  ${CYAN}http://127.0.0.1:3000${NC}"
echo ""
echo -e "${PURPLE}Happy Learning! 🎉${NC}"
