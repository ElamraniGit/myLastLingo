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

    # Seed Core English 3000 built-in vocabulary
    await db_manager.seed_core_words()

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
    from backend.app.api import videos, transcripts, dictionary, vocabulary, player, auth, library, chat, xp, tts
    from backend.app.api.core_library import init_api as core_library_init
    videos.init_api(db_manager)
    transcripts.init_api(db_manager)
    dictionary.init_api(db_manager)
    vocabulary.init_api(db_manager)
    player.init_api(db_manager)
    auth.init_api(db_manager)
    library.init_api(db_manager)
    chat.init_api(db_manager)
    xp.init_api(db_manager)
    tts.init_api(db_manager)
    core_library_init(db_manager)

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

# ── FIX BUG-1: Restrict CORS to localhost only (this is a local app) ──────────
# Allowing "*" would let any website make authenticated requests with the user's token.
_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    # Add your Termux LAN IP if needed, e.g.: "http://192.168.1.x:3000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── FIX-SEC-7: Security headers on every response ─────────────────────────────
@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "geolocation=(), camera=(), microphone=(self)")
    # API responses must never be cached by shared caches (may contain user data).
    if request.url.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")
    return response


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
    # FIX-SEC-8: log the real error server-side, but never leak internals
    # (exception text / stack details) to the client.
    logger = logging.getLogger(__name__)
    logger.error(f"Unhandled error on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("LINGUALEARN_PORT", 8080))
    host = os.environ.get("LINGUALEARN_HOST", "127.0.0.1")
    print(f"🌐 LinguaLearn v2.0 starting at http://{host}:{port}")
    uvicorn.run("backend.main:app", host=host, port=port, reload=False, workers=1)
