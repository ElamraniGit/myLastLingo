# -*- coding: utf-8 -*-
"""
LinguaLearn - Simple Runner
---------------------------
Run from the project root:
    python3 run.py

To stop: Ctrl+C
"""

import os
import signal
import socket
import sys
from pathlib import Path

# Fix Python path
_PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(_PROJECT_ROOT))
sys.path.insert(0, str(_PROJECT_ROOT / "backend"))
os.chdir(str(_PROJECT_ROOT))


def _kill_old_backend(host: str, port: int) -> None:
    """Kill any existing process on the port before starting."""
    import subprocess

    # Method 1: pkill
    try:
        subprocess.run(
            ["pkill", "-f", "uvicorn.*backend.main"],
            capture_output=True, timeout=5
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    # Method 2: fuser
    try:
        subprocess.run(
            ["fuser", "-k", f"{port}/tcp"],
            capture_output=True, timeout=5
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    # Method 3: scan /proc for uvicorn processes (works on Termux/Linux)
    my_pid = os.getpid()
    for entry in Path("/proc").iterdir():
        if not entry.name.isdigit():
            continue
        pid = int(entry.name)
        if pid == my_pid:
            continue
        try:
            cmdline = (entry / "cmdline").read_text()
            if "uvicorn" in cmdline and "backend" in cmdline:
                os.kill(pid, signal.SIGKILL)
                print(f"  ⚠️  Killed old backend (PID {pid})")
        except (PermissionError, FileNotFoundError, ProcessLookupError, OSError):
            pass

    # Wait a moment for port to release
    import time
    time.sleep(1)


def _is_port_available(host: str, port: int) -> bool:
    """Return True when host:port can be bound by this process."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
            return True
        except OSError:
            return False


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("LINGUALEARN_PORT", 8080))
    host = os.environ.get("LINGUALEARN_HOST", "127.0.0.1")

    # Auto-kill old processes if port is busy
    if not _is_port_available(host, port):
        print(f"⚠️  Port {port} is busy. Killing old process...")
        _kill_old_backend(host, port)

        if not _is_port_available(host, port):
            print(f"\n❌ Port {port} is STILL busy after cleanup.")
            print(f"\n💡 Try manually:")
            print(f"   pkill -f uvicorn")
            print(f"   python3 run.py")
            raise SystemExit(1)
        print(f"  ✅ Port {port} is now free.\n")

    print("=" * 50)
    print("  🌐 LinguaLearn Backend Server")
    print(f"  📍 http://{host}:{port}")
    print(f"  📂 Root: {_PROJECT_ROOT}")
    print("=" * 50)

    os.environ["LINGUALEARN_ROOT"] = str(_PROJECT_ROOT)

    uvicorn.run(
        "backend.main:app",
        host=host,
        port=port,
        reload=False,
        workers=1,
        log_level="info",
    )
