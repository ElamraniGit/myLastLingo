#!/bin/bash
"""
================================================================
LinguaLearn - Quick Install & Start for Termux
================================================================

سكريبت سريع للتثبيت والتشغيل مباشرة

الاستخدام:
    pkg install -y curl
    curl -sL https://raw.githubusercontent.com/... | bash
    
    أو:
    chmod +x quick_install.sh
    ./quick_install.sh

================================================================
"""

set -e

echo "╔══════════════════════════════════════════╗"
echo "║      LinguaLearn Quick Install 🚀        ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check Termux
if [ -z "$PREFIX" ]; then
    echo "❌ This script requires Termux on Android"
    exit 1
fi

echo "📱 Termux detected"
echo ""

# 1. Install basic dependencies
echo "[1/4] Installing dependencies..."
pkg update -y && pkg upgrade -y
pkg install -y python nodejs-lts git ffmpeg build-essential cmake rust binutils

# 2. Clone project (if not already)
if [ ! -d "english-learning-app" ]; then
    echo ""
    echo "[2/4] Creating project..."
    mkdir -p english-learning-app
fi

cd english-learning-app

# 3. Install Python packages
echo ""
echo "[3/4] Installing Python packages..."
pip install --upgrade pip
pip install fastapi uvicorn[standard] websockets aiosqlite pyyaml aiohttp yt-dlp

# Install Whisper (optional - for offline transcription)
read -p "Install Whisper for offline transcription? (y/N, requires ~1GB): " install_whisper
if [ "$install_whisper" = "y" ] || [ "$install_whisper" = "Y" ]; then
    echo "Installing faster-whisper..."
    pip install faster-whisper numpy
fi

# Create directories
mkdir -p data/{downloads,cache/{videos,transcripts,thumbnails},dictionary}
mkdir -p models/whisper logs

# 4. Start the app
echo ""
echo "[4/4] Starting..."
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║      ✅ Ready to go!                     ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Run the following commands:"
echo ""
echo "  cd english-learning-app"
echo "  python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8080"
echo ""
echo "Then open: http://127.0.0.1:8080