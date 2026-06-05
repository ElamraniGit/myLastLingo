#!/bin/bash
# =================================================================
# LinguaLearn — Start Everything
# =================================================================
# Usage:
#   ./scripts/start_all.sh          → dev mode (default; works on Termux/ARM)
#   ./scripts/start_all.sh --prod   → production mode
# =================================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

DEV_FLAG="--dev"
MODE="DEVELOPMENT"
for arg in "$@"; do
  [ "$arg" = "--prod" ] && DEV_FLAG="" && MODE="PRODUCTION"
  [ "$arg" = "--dev" ]  && DEV_FLAG="--dev" && MODE="DEVELOPMENT"
done

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║     LinguaLearn — $MODE"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# ── Kill old processes ───────────────────────────────────────────
echo -e "${YELLOW}🧹 Cleaning up...${NC}"
pkill -f "uvicorn.*backend.main" 2>/dev/null || true
pkill -f "next" 2>/dev/null || true
if command -v fuser >/dev/null 2>&1; then
  fuser -k 8080/tcp 2>/dev/null || true
  fuser -k 3000/tcp 2>/dev/null || true
fi
sleep 2
echo -e "${GREEN}   ✅ Done${NC}"
echo ""

# ── Cleanup on exit ──────────────────────────────────────────────
cleanup() {
  echo ""
  echo -e "${YELLOW}🛑 Shutting down...${NC}"
  [ -n "${BACKEND_PID:-}" ]  && kill "$BACKEND_PID"  2>/dev/null
  [ -n "${FRONTEND_PID:-}" ] && kill "$FRONTEND_PID" 2>/dev/null
  pkill -f "uvicorn.*backend.main" 2>/dev/null || true
  pkill -f "next" 2>/dev/null || true
  wait 2>/dev/null || true
  echo -e "${GREEN}✅ Stopped.${NC}"
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# ── Start backend ────────────────────────────────────────────────
echo -e "${GREEN}🚀 Starting backend...${NC}"
bash "$SCRIPT_DIR/start_backend.sh" &
BACKEND_PID=$!

echo -n "   Waiting"
READY=0
for i in $(seq 1 15); do
  sleep 1; echo -n "."
  kill -0 "$BACKEND_PID" 2>/dev/null || { echo ""; echo -e "${RED}❌ Backend died${NC}"; exit 1; }
  if command -v curl >/dev/null 2>&1; then
    HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/health 2>/dev/null || echo "000")
    [ "$HTTP" = "200" ] && READY=1 && break
  else
    python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health',timeout=2)" 2>/dev/null && READY=1 && break
  fi
done
echo ""
[ "$READY" -eq 1 ] && echo -e "${GREEN}   ✅ Backend ready${NC}" || echo -e "${YELLOW}   ⚠️  Backend starting...${NC}"
echo ""

# ── Build check helper ───────────────────────────────────────────
is_build_valid() {
  # A valid production build needs ALL these files
  [ -f ".next/BUILD_ID" ] &&
  [ -f ".next/prerender-manifest.json" ] &&
  [ -f ".next/routes-manifest.json" ] &&
  [ -f ".next/build-manifest.json" ] &&
  [ -d ".next/server" ] &&
  [ -d ".next/static" ]
}

# ── Build frontend (production only) ─────────────────────────────
if [ -z "$DEV_FLAG" ]; then
  cd "$PROJECT_ROOT/frontend"

  if is_build_valid; then
    echo -e "${GREEN}   ✅ Using cached build${NC}"
  else
    echo -e "${YELLOW}🔨 Building frontend for production...${NC}"
    echo -e "${YELLOW}   (first build takes 2-4 min on Termux)${NC}"
    echo ""

    # Clean incomplete build artifacts first
    rm -rf .next 2>/dev/null || true

    export NEXT_TELEMETRY_DISABLED=1
    export NODE_OPTIONS="--max-old-space-size=1024"

    # Run build — on ARM64 next build may exit non-zero due to SWC
    # but the actual output files are still created correctly
    npx next build 2>&1 || true

    # Fix: if prerender-manifest.json is missing, create a valid empty one
    # This happens on some ARM builds where static generation finishes
    # but the manifest write fails due to SWC exit
    if [ -f ".next/BUILD_ID" ] && [ ! -f ".next/prerender-manifest.json" ]; then
      echo -e "${YELLOW}   🔧 Fixing missing prerender-manifest...${NC}"
      echo '{"version":4,"routes":{},"dynamicRoutes":{},"preview":{"previewModeId":"termux-arm64","previewModeSigningKey":"termux","previewModeEncryptionKey":"termux"},"notFoundRoutes":[]}' \
        > .next/prerender-manifest.json
    fi

    if is_build_valid; then
      echo ""
      echo -e "${GREEN}   ✅ Build complete!${NC}"
    else
      echo ""
      echo -e "${RED}   ❌ Build incomplete — missing required files${NC}"
      echo -e "${YELLOW}   ↩️  Falling back to dev mode (safe, same features)${NC}"
      rm -rf .next 2>/dev/null || true
      DEV_FLAG="--dev"
    fi
  fi

  cd "$PROJECT_ROOT"
fi
echo ""

# ── Start frontend ───────────────────────────────────────────────
FMODE=$( [ -z "$DEV_FLAG" ] && echo "PRODUCTION ⚡" || echo "DEVELOPMENT 🔧" )
echo -e "${GREEN}🚀 Starting frontend ($FMODE)...${NC}"
bash "$SCRIPT_DIR/start_frontend.sh" $DEV_FLAG &
FRONTEND_PID=$!

sleep 4
if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
  echo -e "${RED}❌ Frontend failed to start${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "${GREEN}   ✅ LinguaLearn is running!${NC}"
echo ""
echo -e "   📱 ${YELLOW}App:${NC}      http://127.0.0.1:3000"
echo -e "   🔧 ${YELLOW}Backend:${NC}  http://127.0.0.1:8080"
echo -e "   ⚡ ${YELLOW}Mode:${NC}     $FMODE"
echo ""
echo -e "   ${YELLOW}Press Ctrl+C to stop${NC}"
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo ""

wait
