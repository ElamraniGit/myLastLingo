"""
LinguaLearn — Local English Learning Application
Main FastAPI Backend — Production-ready, Termux-compatible
"""

import os
import sys
import logging
from pathlib import Path
from contextlib import asynccontextmanager

# ── Path resolution (works from any CWD including Termux) ────────────────────
_this_file = Path(__file__).resolve()
_possible_roots = [
    _this_file.parent.parent,
    _this_file.parent.parent.parent,
    Path.cwd(),
]
PROJECT_ROOT = next(
    (r for r in _possible_roots if (r / "config" / "settings.py").exists()),
    Path.cwd(),
)
for _p in [str(PROJECT_ROOT), str(PROJECT_ROOT / "backend")]:
    if _p not in sys.path:
        sys.path.insert(0, _p)
os.chdir(str(PROJECT_ROOT))

# ── Imports ───────────────────────────────────────────────────────────────────
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config.settings import load_config
from backend.app.db.database import DatabaseManager
from backend.app.api import router as api_router
from backend.app.api.auth import create_auth_tables
from backend.app.services.cache import CacheManager
from backend.app.utils.logger import setup_logging

db_manager = None
cache_manager = None
config = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_manager, cache_manager, config

    config = load_config()
    setup_logging(config.logging)
    logger = logging.getLogger(__name__)
    logger.info(f"Starting LinguaLearn | root={PROJECT_ROOT}")

    # Database
    db_path = PROJECT_ROOT / config.database.path
    db_path.parent.mkdir(parents=True, exist_ok=True)
    db_manager = DatabaseManager(str(db_path))
    await db_manager.initialize()

    # Create auth tables
    import aiosqlite
    async with aiosqlite.connect(str(db_path)) as conn:
        conn.row_factory = aiosqlite.Row
        await create_auth_tables(conn)

    # Cache
    cache_manager = CacheManager(config.cache)
    await cache_manager.initialize()

    # Directories
    for d in [
        PROJECT_ROOT / config.youtube.download_path,
        PROJECT_ROOT / config.cache.video_cache,
        PROJECT_ROOT / config.cache.transcript_cache,
        PROJECT_ROOT / config.ai.whisper.model_path,
        PROJECT_ROOT / "data/temp",
        PROJECT_ROOT / "data",
        PROJECT_ROOT / "logs",
    ]:
        d.mkdir(parents=True, exist_ok=True)

    # Inject db into modules
    from backend.app.api import videos, transcripts, dictionary, vocabulary, player, auth
    videos.init_api(db_manager)
    transcripts.init_api(db_manager)
    dictionary.init_api(db_manager)
    vocabulary.init_api(db_manager)
    player.init_api(db_manager)
    auth.init_api(db_manager)

    logger.info("LinguaLearn started successfully")
    yield

    logger.info("Shutting down...")
    await db_manager.close()
    await cache_manager.close()


app = FastAPI(
    title="LinguaLearn API",
    description="Local English Learning Platform",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "2.0.0",
        "mode": "local",
        "database": db_manager is not None,
    }


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger = logging.getLogger(__name__)
    logger.error(f"Unhandled: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "message": str(exc)},
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("LINGUALEARN_PORT", 8080))
    host = os.environ.get("LINGUALEARN_HOST", "127.0.0.1")
    print(f"🌐 LinguaLearn v2.0 starting at http://{host}:{port}")
    uvicorn.run("backend.main:app", host=host, port=port, reload=False, workers=1)
