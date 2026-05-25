"""
LinguaLearn - Local English Learning Application
Main FastAPI Backend Application
100% Local - No External APIs or Cloud Services
Fixed path resolution for Termux
"""

import os
import sys
import logging
from pathlib import Path
from contextlib import asynccontextmanager

# ------------------------------------------------------------
# Fix path: find the project root no matter where we're run from
# ------------------------------------------------------------
_this_file = Path(__file__).resolve()
# Try going up from backend/main.py -> project root
_possible_roots = [
    _this_file.parent.parent,          # backend/../ = project root
    _this_file.parent.parent.parent,   # backend/main.py/../../ = in case of nesting
    Path.cwd(),                        # current working directory
]
PROJECT_ROOT = None
for _root in _possible_roots:
    if (_root / "config" / "settings.py").exists():
        PROJECT_ROOT = _root
        break

if PROJECT_ROOT is None:
    # Fallback: assume current directory
    PROJECT_ROOT = Path.cwd()

# Add project root to Python path
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
    sys.path.insert(0, str(PROJECT_ROOT / "backend"))

# Also add the backend dir directly for app imports
_backend_dir = str(PROJECT_ROOT / "backend")
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

os.chdir(str(PROJECT_ROOT))  # Always work from project root

# ------------------------------------------------------------
# Now safe to import project modules
# ------------------------------------------------------------
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config.settings import load_config
from backend.app.db.database import DatabaseManager
from backend.app.api import router as api_router
from backend.app.services.cache import CacheManager
from backend.app.utils.logger import setup_logging

# Global instances
db_manager = None
cache_manager = None
config = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management."""
    global db_manager, cache_manager, config
    
    # Load configuration
    config = load_config()
    
    # Setup logging
    setup_logging(config.logging)
    logger = logging.getLogger(__name__)
    logger.info(f"Starting LinguaLearn application | Root: {PROJECT_ROOT}")
    
    # Initialize database
    db_path = PROJECT_ROOT / config.database.path
    db_path.parent.mkdir(parents=True, exist_ok=True)
    db_manager = DatabaseManager(str(db_path))
    await db_manager.initialize()
    
    # Initialize cache
    cache_manager = CacheManager(config.cache)
    await cache_manager.initialize()
    
    # Ensure required directories exist
    dirs = [
        PROJECT_ROOT / config.youtube.download_path,
        PROJECT_ROOT / config.cache.video_cache,
        PROJECT_ROOT / config.cache.transcript_cache,
        PROJECT_ROOT / config.ai.whisper.model_path,
        PROJECT_ROOT / "data/temp",
        PROJECT_ROOT / "logs"
    ]
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)
    
    # Inject DB into API modules
    from backend.app.api import videos, transcripts, dictionary, vocabulary, player
    videos.init_api(db_manager)
    transcripts.init_api(db_manager)
    dictionary.init_api(db_manager)
    vocabulary.init_api(db_manager)
    player.init_api(db_manager)
    
    logger.info("LinguaLearn started successfully")
    yield
    
    # Cleanup
    logger.info("Shutting down LinguaLearn...")
    await db_manager.close()
    await cache_manager.close()
    logger.info("Shutdown complete")


# Create FastAPI application
app = FastAPI(
    title="LinguaLearn API",
    description="Local English Learning Application Backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API router
app.include_router(api_router, prefix="/api/v1")

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "mode": "local",
        "database": db_manager is not None,
        "cache": cache_manager is not None,
        "project_root": str(PROJECT_ROOT)
    }

# Error handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler."""
    logger = logging.getLogger(__name__)
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "message": str(exc)}
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("LINGUALEARN_PORT", 8080))
    host = os.environ.get("LINGUALEARN_HOST", "127.0.0.1")
    print(f"🌐 LinguaLearn backend starting at http://{host}:{port}")
    print(f"📂 Project root: {PROJECT_ROOT}")
    uvicorn.run(
        "backend.main:app",
        host=host,
        port=port,
        reload=False,
        workers=1,
        log_level="info"
    )
