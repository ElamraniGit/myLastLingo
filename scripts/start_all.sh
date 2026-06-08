#!/bin/bash
# =================================================================
# LinguaLearn — Start Everything
# =================================================================
# Usage:
#   ./scripts/start_all.sh                → dev mode
#   ./scripts/start_all.sh --fast         → fast mobile-safe mode
#   ./scripts/start_all.sh --prod         → production mode
#   ./scripts/start_all.sh --prod --rebuild  → force rebuild
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
FORCE_REBUILD=false
FAST_FLAG=""
for arg in "$@"; do
  [ "$arg" = "--prod" ]    && DEV_FLAG="" && MODE="PRODUCTION" && FAST_FLAG=""
  [ "$arg" = "--dev" ]     && DEV_FLAG="--dev" && MODE="DEVELOPMENT" && FAST_FLAG=""
  [ "$arg" = "--fast" ]    && DEV_FLAG="--dev" && MODE="MOBILE FAST" && FAST_FLAG="--fast"
  [ "$arg" = "--rebuild" ] && FORCE_REBUILD=true
done

IS_TERMUX_ANDROID=false
if [ -n "${PREFIX:-}" ] && echo "$PREFIX" | grep -qi "com.termux"; then
  IS_TERMUX_ANDROID=true
elif uname -o 2>/dev/null | grep -qi "android"; then
  IS_TERMUX_ANDROID=true
fi

# Next.js production builds are not reliable on Termux/Android ARM because SWC
# binaries are unavailable. Downgrade to dev immediately instead of wasting time
# on a build that will fail and then fall back anyway.
if [ "$IS_TERMUX_ANDROID" = true ] && [ -z "$DEV_FLAG" ]; then
  echo -e "${YELLOW}⚠️  Termux/Android detected — production Next.js build is unsupported on this platform.${NC}"
  echo -e "${YELLOW}   Switching to MOBILE FAST mode automatically.${NC}"
  DEV_FLAG="--dev"
  MODE="MOBILE FAST"
  FAST_FLAG="--fast"
fi

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

# ── Build check helpers ──────────────────────────────────────────

current_frontend_hash() {
  git log -1 --format="%H" -- frontend/ 2>/dev/null || echo "unknown"
}

built_frontend_hash() {
  cat "frontend/.next/.git_hash" 2>/dev/null || echo ""
}

is_build_valid() {
  [ -f "frontend/.next/BUILD_ID" ] &&
  [ -f "frontend/.next/routes-manifest.json" ] &&
  [ -f "frontend/.next/build-manifest.json" ] &&
  [ -d "frontend/.next/server" ] &&
  [ -d "frontend/.next/static" ]
}

is_build_fresh() {
  is_build_valid && [ "$(current_frontend_hash)" = "$(built_frontend_hash)" ]
}

# ── Single build function — tries one approach, fixes manifest ───
do_build() {
  export NEXT_TELEMETRY_DISABLED=1
  export NODE_CHANNEL_SERIALIZATION=json
  export NODE_OPTIONS="--max-old-space-size=1024"
  export NEXT_PRIVATE_SKIP_SIZE_LIMITING=1

  # Clean old build
  rm -rf .next 2>/dev/null || true

  # Run build (the only reliable way on Termux ARM64)
  npx next build 2>&1

  # Fix missing prerender-manifest (common on ARM64 after SWC fallback)
  if [ -f ".next/BUILD_ID" ] && [ ! -f ".next/prerender-manifest.json" ]; then
    echo -e "${YELLOW}   🔧 Fixing prerender-manifest...${NC}"
    echo '{"version":4,"routes":{},"dynamicRoutes":{},"preview":{"previewModeId":"termux-arm64","previewModeSigningKey":"termux","previewModeEncryptionKey":"termux"},"notFoundRoutes":[]}' \
      > .next/prerender-manifest.json
  fi
}

# ── Build frontend (production only) ─────────────────────────────
if [ -z "$DEV_FLAG" ]; then
  cd "$PROJECT_ROOT/frontend"

  NEED_BUILD=false
  if [ "$FORCE_REBUILD" = true ]; then
    echo -e "${YELLOW}🔨 Force rebuild requested...${NC}"
    NEED_BUILD=true
  elif ! is_build_fresh; then
    if is_build_valid; then
      echo -e "${YELLOW}🔄 Source changed since last build — rebuilding...${NC}"
    else
      echo -e "${YELLOW}🔨 No valid build found — building now...${NC}"
    fi
    NEED_BUILD=true
  else
    echo -e "${GREEN}   ✅ Build is up to date ($(current_frontend_hash | cut -c1-8))${NC}"
  fi

  if [ "$NEED_BUILD" = true ]; then
    echo -e "${YELLOW}   (takes 2-4 min on Termux — please wait)${NC}"
    echo ""

    do_build

    if is_build_valid; then
      current_frontend_hash > .next/.git_hash
      echo ""
      echo -e "${GREEN}   ✅ Build complete! ($(current_frontend_hash | cut -c1-8))${NC}"
    else
      echo ""
      echo -e "${YELLOW}   ↩️  Falling back to development mode...${NC}"
      rm -rf .next 2>/dev/null || true
      DEV_FLAG="--dev"
    fi
  fi

  cd "$PROJECT_ROOT"
fi
echo ""

# ── Start frontend ───────────────────────────────────────────────
if [ -z "$DEV_FLAG" ]; then
  FMODE="PRODUCTION ⚡"
elif [ -n "$FAST_FLAG" ]; then
  FMODE="MOBILE FAST ⚡"
else
  FMODE="DEVELOPMENT 🔧"
fi
echo -e "${GREEN}🚀 Starting frontend ($FMODE)...${NC}"
bash "$SCRIPT_DIR/start_frontend.sh" $DEV_FLAG $FAST_FLAG &
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
