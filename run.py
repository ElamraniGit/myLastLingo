# -*- coding: utf-8 -*-
"""
LinguaLearn - Simple Runner
---------------------------
قم بتشغيل هذا الملف من مجلد المشروع الرئيسي:
    python3 run.py

أو فقط:
    cd english-learning-app && python3 run.py
"""

import os
import socket
import sys
from pathlib import Path

# Fix Python path
_PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(_PROJECT_ROOT))
sys.path.insert(0, str(_PROJECT_ROOT / "backend"))
os.chdir(str(_PROJECT_ROOT))


def _is_port_available(host: str, port: int) -> bool:
    """Return True when host:port can be bound by this process."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
            return True
        except OSError:
            return False


def _pick_port(host: str, requested_port: int) -> int:
    """Select a runnable port according to env strategy."""
    if _is_port_available(host, requested_port):
        return requested_port

    strategy = os.environ.get("LINGUALEARN_PORT_STRATEGY", "fail").strip().lower()
    if strategy != "auto":
        print("\n❌ المنفذ مشغول بالفعل")
        print(f"   - Host: {host}")
        print(f"   - Port: {requested_port}")
        print("\n💡 الحلول:")
        print(f"   1) اغلق العملية: fuser -k {requested_port}/tcp")
        print(f"   2) غيّر المنفذ مؤقتًا: LINGUALEARN_PORT=8081 python3 run.py")
        print("   3) اختيار تلقائي لمنفذ متاح:")
        print("      LINGUALEARN_PORT_STRATEGY=auto python3 run.py")
        raise SystemExit(1)

    max_tries = int(os.environ.get("LINGUALEARN_PORT_SCAN_MAX", "20"))
    for candidate in range(requested_port + 1, requested_port + 1 + max_tries):
        if _is_port_available(host, candidate):
            print(f"⚠️  Port {requested_port} is busy. Falling back to {candidate}.")
            return candidate

    print(f"❌ Could not find a free port in range {requested_port + 1}-{requested_port + max_tries}.")
    raise SystemExit(1)


if __name__ == "__main__":
    import uvicorn

    requested_port = int(os.environ.get("LINGUALEARN_PORT", 8080))
    host = os.environ.get("LINGUALEARN_HOST", "127.0.0.1")
    port = _pick_port(host, requested_port)

    print("=" * 50)
    print("  🌐 LinguaLearn Backend Server")
    print(f"  📍 http://{host}:{port}")
    print(f"  📂 Root: {_PROJECT_ROOT}")
    print("=" * 50)

    # Run the app using uvicorn directly with the module path
    os.environ["LINGUALEARN_ROOT"] = str(_PROJECT_ROOT)

    uvicorn.run(
        "backend.main:app",
        host=host,
        port=port,
        reload=False,
        workers=1,
        log_level="info"
    )
