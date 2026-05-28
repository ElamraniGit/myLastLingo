#!/bin/bash
# =================================================================
# LinguaLearn - Quick Install & Start for Termux
# =================================================================
# سكريبت سريع للتثبيت من داخل مجلد المشروع الحالي.
# الاستخدام:
#   chmod +x scripts/quick_install.sh
#   ./scripts/quick_install.sh
# =================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "╔══════════════════════════════════════════╗"
echo "║      LinguaLearn Quick Install 🚀        ║"
echo "╚══════════════════════════════════════════╝"
echo ""

if [ -z "$PREFIX" ]; then
  echo "❌ This script requires Termux on Android"
  exit 1
fi

echo "📱 Termux detected"
echo "📂 Project root: $PROJECT_ROOT"
echo ""

echo "[1/5] Installing system dependencies..."
pkg update -y && pkg upgrade -y
pkg install -y python nodejs-lts git ffmpeg build-essential cmake rust binutils curl wget sqlite

echo ""
echo "[2/5] Installing Python packages..."
pip install --upgrade pip
pip install -r requirements.txt

read -p "Install Whisper for offline transcription? (y/N, requires ~1GB): " install_whisper
if [ "$install_whisper" = "y" ] || [ "$install_whisper" = "Y" ]; then
  echo "Installing faster-whisper..."
  pip install numpy faster-whisper
fi

echo ""
echo "[3/5] Installing frontend packages..."
cd frontend
npm install
cd ..

echo ""
echo "[4/5] Creating runtime directories..."
mkdir -p data/downloads
mkdir -p data/cache/videos
mkdir -p data/cache/transcripts
mkdir -p data/cache/thumbnails
mkdir -p data/dictionary
mkdir -p data/temp
mkdir -p models/whisper
mkdir -p logs

echo ""
echo "[5/5] Building frontend..."
cd frontend
npm run build || echo "⚠️ Build failed — you can still use: npm run dev"
cd ..

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║      ✅ Ready to go!                     ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Start everything with:"
echo "  ./scripts/start_all.sh"
echo ""
echo "Or manually:"
echo "  ./scripts/start_backend.sh"
echo "  ./scripts/start_frontend.sh"
echo ""
echo "Then open: http://127.0.0.1:3000"
