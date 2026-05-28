#!/bin/bash
# ================================================================
# LinguaLearn — Start Backend
# ================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Create required directories
mkdir -p data/downloads data/cache/videos data/cache/transcripts \
         data/cache/thumbnails data/dictionary data/temp models/whisper logs

PORT="${LINGUALEARN_PORT:-8080}"
HOST="${LINGUALEARN_HOST:-127.0.0.1}"
LOG_LEVEL="info"
ACCESS_LOG_FLAG="--no-access-log"

for arg in "$@"; do
  if [ "$arg" = "--debug" ]; then
    LOG_LEVEL="debug"
    ACCESS_LOG_FLAG="--access-log"
  fi
done

# ── Kill ALL python/uvicorn processes using this port ────────────
echo "🔍 Checking port ${PORT}..."

# Method 1: fuser (available on some Termux setups)
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null && echo "   Killed process on port ${PORT} via fuser" && sleep 1
fi

# Method 2: lsof
if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti ":${PORT}" 2>/dev/null)
  if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    echo "   Killed PIDs: $PIDS via lsof"
    sleep 1
  fi
fi

# Method 3: grep for any running uvicorn/python with our app (works everywhere)
PIDS=$(ps aux 2>/dev/null | grep -E "[u]vicorn.*backend\.main" | awk '{print $2}' || \
       ps 2>/dev/null | grep -E "[u]vicorn.*backend\.main" | awk '{print $1}' || true)
if [ -n "$PIDS" ]; then
  echo "   Found existing backend processes: $PIDS"
  echo "$PIDS" | xargs kill -9 2>/dev/null || true
  sleep 1
  echo "   ✅ Killed old backend processes."
fi

# Method 4: pkill as last resort
pkill -f "uvicorn.*backend.main" 2>/dev/null && echo "   Killed via pkill" && sleep 1 || true

# Final check: try to bind the port with Python
python3 -c "
import socket, sys
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
try:
    s.bind(('${HOST}', ${PORT}))
    s.close()
    print('   ✅ Port ${PORT} is free.')
except OSError:
    print('   ❌ Port ${PORT} is STILL busy. Trying harder...')
    # Nuclear option: kill everything on that port via /proc
    import os, re
    for pid_dir in os.listdir('/proc'):
        if not pid_dir.isdigit():
            continue
        try:
            fd_dir = f'/proc/{pid_dir}/fd'
            for fd in os.listdir(fd_dir):
                link = os.readlink(f'{fd_dir}/{fd}')
                if 'socket' in link:
                    pass
            # Check cmdline
            with open(f'/proc/{pid_dir}/cmdline', 'r') as f:
                cmd = f.read()
            if 'uvicorn' in cmd or ('python' in cmd and 'backend' in cmd):
                pid = int(pid_dir)
                if pid != os.getpid() and pid != os.getppid():
                    os.kill(pid, 9)
                    print(f'   Killed PID {pid} ({cmd[:60]})')
        except (PermissionError, FileNotFoundError, ProcessLookupError, OSError):
            pass
    import time; time.sleep(1)
    # Verify again
    s2 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s2.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        s2.bind(('${HOST}', ${PORT}))
        s2.close()
        print('   ✅ Port ${PORT} is now free.')
    except OSError:
        print('   ❌ Could not free port ${PORT}. Please run manually:')
        print('      kill \$(ps | grep uvicorn | awk \"{print \\\$1}\")')
        sys.exit(1)
" || exit 1

echo ""
echo "🚀 Starting LinguaLearn backend on http://${HOST}:${PORT}"
echo "📂 Project root: ${PROJECT_ROOT}"
echo "🪵 Log level: ${LOG_LEVEL}"
echo ""

exec python3 -m uvicorn backend.main:app \
  --host "$HOST" \
  --port "$PORT" \
  --workers 1 \
  --log-level "$LOG_LEVEL" \
  $ACCESS_LOG_FLAG
