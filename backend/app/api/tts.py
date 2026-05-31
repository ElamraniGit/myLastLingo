"""
Text-to-Speech API for LinguaLearn.

Provides NATURAL, human-like neural voices for free using Microsoft Edge's
online TTS service (via the `edge-tts` package). No API key required, works
on Termux. Falls back gracefully on the frontend to the browser's built-in
SpeechSynthesis if this endpoint is unavailable (e.g. offline).

Endpoint:
  GET  /api/v1/tts?text=...&voice=...&rate=...   -> audio/mpeg (MP3)
  GET  /api/v1/tts/voices                        -> list of recommended voices

Caching: synthesized clips are cached on disk by a hash of (text, voice, rate)
so repeated playback of the same word/sentence is instant and offline-friendly.
"""

import os
import re
import hashlib
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import FileResponse, Response

from backend.app.api.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()
db_manager = None

# Recommended natural English neural voices (free via edge-tts)
RECOMMENDED_VOICES = [
    {"id": "en-US-AriaNeural",    "label": "Aria (US, female)",    "gender": "female"},
    {"id": "en-US-GuyNeural",     "label": "Guy (US, male)",       "gender": "male"},
    {"id": "en-US-JennyNeural",   "label": "Jenny (US, female)",   "gender": "female"},
    {"id": "en-GB-SoniaNeural",   "label": "Sonia (UK, female)",   "gender": "female"},
    {"id": "en-GB-RyanNeural",    "label": "Ryan (UK, male)",      "gender": "male"},
    {"id": "en-AU-NatashaNeural", "label": "Natasha (AU, female)", "gender": "female"},
]
_VALID_VOICE_IDS = {v["id"] for v in RECOMMENDED_VOICES}
DEFAULT_VOICE = "en-US-AriaNeural"

# On-disk cache for synthesized audio
_CACHE_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "tts_cache"


def _rate_to_edge(rate: float) -> str:
    """Convert a multiplier (0.5–2.0) to edge-tts percentage string, e.g. '-15%'."""
    try:
        rate = float(rate)
    except (TypeError, ValueError):
        rate = 1.0
    rate = max(0.5, min(2.0, rate))
    pct = round((rate - 1.0) * 100)
    return f"+{pct}%" if pct >= 0 else f"{pct}%"


def _cache_key(text: str, voice: str, rate: str) -> str:
    h = hashlib.sha256(f"{voice}|{rate}|{text}".encode("utf-8")).hexdigest()[:32]
    return h


@router.get("/voices")
async def list_voices(current_user: dict = Depends(get_current_user)):
    """Return the curated list of natural voices for the client to choose from."""
    return {"voices": RECOMMENDED_VOICES, "default": DEFAULT_VOICE}


@router.get("")
@router.get("/")
async def synthesize(
    text: str = Query(..., min_length=1, max_length=5000),
    voice: str = Query(DEFAULT_VOICE),
    rate: float = Query(1.0, ge=0.5, le=2.0),
    current_user: dict = Depends(get_current_user),
):
    """
    Synthesize `text` to natural neural speech and return an MP3.

    Cached on disk so repeated requests are instant.
    """
    text = text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    # Validate voice (defend against arbitrary input)
    if voice not in _VALID_VOICE_IDS:
        voice = DEFAULT_VOICE

    edge_rate = _rate_to_edge(rate)

    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    key = _cache_key(text, voice, edge_rate)
    cache_path = _CACHE_DIR / f"{key}.mp3"

    # Serve from cache if present
    if cache_path.exists() and cache_path.stat().st_size > 0:
        return FileResponse(
            str(cache_path),
            media_type="audio/mpeg",
            headers={"Cache-Control": "public, max-age=604800"},
        )

    # Lazy import so the app still boots if edge-tts isn't installed
    try:
        import edge_tts  # noqa
    except ModuleNotFoundError:
        raise HTTPException(
            status_code=503,
            detail=(
                "Natural TTS unavailable: edge-tts is not installed. "
                "Run: pip install edge-tts  (the app will use the browser voice meanwhile)."
            ),
        )

    try:
        communicate = edge_tts.Communicate(text, voice, rate=edge_rate)
        audio = bytearray()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio.extend(chunk["data"])

        if not audio:
            raise RuntimeError("Empty audio returned from TTS service")

        # Write cache atomically
        tmp = cache_path.with_suffix(".part")
        tmp.write_bytes(bytes(audio))
        tmp.replace(cache_path)

        return Response(
            content=bytes(audio),
            media_type="audio/mpeg",
            headers={"Cache-Control": "public, max-age=604800"},
        )

    except Exception as e:
        logger.warning(f"Edge TTS failed ({voice}): {e}")
        # 502 tells the frontend to fall back to the browser's built-in voice
        raise HTTPException(
            status_code=502,
            detail="TTS service unreachable (likely offline). Falling back to browser voice.",
        )


def init_api(db):
    global db_manager
    db_manager = db
