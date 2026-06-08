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
python3 << PYEOF
import socket, sys, os, signal, time

host = "${HOST}"
port = ${PORT}

def try_bind():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        s.bind((host, port))
        s.close()
        return True
    except OSError:
        s.close()
        return False

if try_bind():
    print(f"   ✅ Port {port} is free.")
    sys.exit(0)

print(f"   ❌ Port {port} is STILL busy. Scanning /proc...")

my_pid = os.getpid()
my_ppid = os.getppid()

for entry in os.listdir("/proc"):
    if not entry.isdigit():
        continue
    pid = int(entry)
    if pid in (my_pid, my_ppid):
        continue
    try:
        with open(f"/proc/{pid}/cmdline", "r") as f:
            cmd = f.read()
        if "uvicorn" in cmd and "backend" in cmd:
            os.kill(pid, signal.SIGKILL)
            print(f"   Killed PID {pid}")
    except (PermissionError, FileNotFoundError, ProcessLookupError, OSError):
        pass

time.sleep(1)

if try_bind():
    print(f"   ✅ Port {port} is now free.")
else:
    print(f"   ❌ Could not free port {port}.")
    print(f"   Try: pkill -f uvicorn")
    sys.exit(1)
PYEOF

if [ $? -ne 0 ]; then
  exit 1
fi

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
