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
import sys
from pathlib import Path

# Fix Python path
_PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(_PROJECT_ROOT))
sys.path.insert(0, str(_PROJECT_ROOT / "backend"))
os.chdir(str(_PROJECT_ROOT))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("LINGUALEARN_PORT", 8080))
    host = os.environ.get("LINGUALEARN_HOST", "127.0.0.1")
    
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
