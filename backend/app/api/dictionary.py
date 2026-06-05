"""
Dictionary API for LinguaLearn.
Fetches word data from online APIs with SQLite caching.

Pipeline (per word lookup):
  1. SQLite cache (instant — skip all below if hit)
  2. Free Dictionary API (dictionaryapi.dev) — definitions, examples, synonyms
  3. MyMemory API — Arabic translation
  4. Groq AI enrichment (optional, uses user's own key) — better definition,
     better Arabic translation, native examples, usage tip, collocations
  5. SQLite save — future lookups are instant

If the user has a Groq key saved, every NEW word gets AI-enriched automatically.
Already-cached words can be re-enriched via POST /dictionary/enrich/{word}.
"""

import json
import uuid
import logging
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel

from backend.app.api.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()
db_manager = None
dictionary_service = None


class WordSearchRequest(BaseModel):
    word: str


# ── Lookup ────────────────────────────────────────────────────────────────────

@router.post("/lookup")
async def lookup_word(
    request: WordSearchRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Look up a word — returns cached result or fetches from APIs + AI enrichment.

    Note: endpoint is authenticated so we can use the user's Groq key for AI
    enrichment. The authentication requirement is a change from the original
    public endpoint — all callers in the frontend already send Bearer tokens.
    """
    word = request.word.lower().strip()
    if not word:
        raise HTTPException(status_code=400, detail="Word cannot be empty")

    user_id = current_user.get("sub", "")

    # ── 1. Cache hit ──────────────────────────────────────────────────────────
    cached = await db_manager.get_word(word)
    if cached:
        # Bump frequency
        async with db_manager.get_connection() as conn:
            await conn.execute(
                "UPDATE words SET frequency = frequency + 1 WHERE word = ?", (word,)
            )
        # Parse JSON fields
        for field in ("definitions", "how_to_use", "examples", "synonyms",
                      "antonyms", "conjugations", "related_words"):
            val = cached.get(field)
            if isinstance(val, str):
                try:
                    cached[field] = json.loads(val)
                except (json.JSONDecodeError, TypeError):
                    pass

        # If cached but never AI-enriched, enrich now in background
        if not cached.get("ai_enriched") and user_id:
            import asyncio
            asyncio.create_task(_background_enrich(word, cached, user_id))

        return cached

    # ── 2. Fetch from dictionary service ─────────────────────────────────────
    global dictionary_service
    if dictionary_service is None:
        from ai.dictionary.service import DictionaryService
        from config.settings import load_config
        config = load_config()
        dictionary_service = DictionaryService(config.ai.dictionary)

    try:
        word_data = await dictionary_service.lookup(word)

        if not word_data:
            raise HTTPException(status_code=404, detail=f"No data found for '{word}'")

        # ── 3. AI enrichment (synchronous — user waits but gets better data) ──
        if user_id:
            word_data = await _ai_enrich(word, word_data, user_id)

        word_data["id"] = str(uuid.uuid4())
        word_data["frequency"] = 1
        await db_manager.add_word(word_data)
        return word_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Dictionary lookup failed for '{word}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Dictionary lookup failed")


# ── Re-enrich endpoint (for already-cached words) ─────────────────────────────

@router.post("/enrich/{word}")
async def enrich_word(
    word: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Re-enrich a cached word with AI data.
    Useful if the user sets a Groq key after the word was already cached.
    """
    word = word.lower().strip()
    cached = await db_manager.get_word(word)
    if not cached:
        raise HTTPException(status_code=404, detail=f"Word '{word}' not in cache")

    user_id = current_user.get("sub", "")
    enriched = await _ai_enrich(word, cached, user_id)

    if enriched.get("ai_enriched"):
        # Update cache
        async with db_manager.get_connection() as conn:
            await conn.execute(
                """UPDATE words SET
                    meaning_en  = ?,
                    meaning_ar  = ?,
                    examples    = ?,
                    how_to_use  = ?,
                    related_words = ?
                WHERE word = ?""",
                (
                    enriched.get("meaning_en", ""),
                    enriched.get("meaning_ar", ""),
                    json.dumps(enriched.get("examples", []),      ensure_ascii=False),
                    json.dumps(enriched.get("how_to_use", []),    ensure_ascii=False),
                    json.dumps(enriched.get("related_words", []), ensure_ascii=False),
                    word,
                ),
            )
        return {"message": "Word enriched successfully", "word": enriched}

    return {"message": "AI enrichment skipped (no Groq key or API unavailable)", "word": cached}


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _ai_enrich(word: str, word_data: dict, user_id: str) -> dict:
    """Fetch user's Groq key and enrich word_data. Returns word_data unchanged on failure."""
    try:
        from ai.dictionary.ai_enricher import enrich_word, get_groq_key_for_request
        groq_key = await get_groq_key_for_request(db_manager, user_id)
        if not groq_key:
            return word_data
        return await enrich_word(word, word_data, groq_key)
    except Exception as e:
        logger.debug(f"AI enrichment error for '{word}': {e}")
        return word_data


async def _background_enrich(word: str, cached: dict, user_id: str) -> None:
    """Background task: enrich + update DB for already-cached words."""
    try:
        enriched = await _ai_enrich(word, cached, user_id)
        if enriched.get("ai_enriched"):
            async with db_manager.get_connection() as conn:
                await conn.execute(
                    """UPDATE words SET
                        meaning_en    = ?,
                        meaning_ar    = ?,
                        examples      = ?,
                        how_to_use    = ?,
                        related_words = ?
                    WHERE word = ?""",
                    (
                        enriched.get("meaning_en", ""),
                        enriched.get("meaning_ar", ""),
                        json.dumps(enriched.get("examples", []),      ensure_ascii=False),
                        json.dumps(enriched.get("how_to_use", []),    ensure_ascii=False),
                        json.dumps(enriched.get("related_words", []), ensure_ascii=False),
                        word,
                    ),
                )
            logger.info(f"Background enriched '{word}'")
    except Exception as e:
        logger.debug(f"Background enrich failed for '{word}': {e}")


# ── Standard endpoints ────────────────────────────────────────────────────────

@router.get("/search")
async def search_dictionary(
    query: str = Query(..., min_length=2),
    limit: int = Query(10, ge=1, le=50),
):
    async with db_manager.get_connection() as conn:
        async with conn.execute(
            "SELECT word, part_of_speech, meaning_ar, meaning_en, level, frequency "
            "FROM words WHERE word LIKE ? ORDER BY frequency DESC, word ASC LIMIT ?",
            (f"{query}%", limit),
        ) as cursor:
            rows = await cursor.fetchall()
    return {"results": [dict(r) for r in rows], "count": len(rows), "query": query}


@router.get("/suggest")
async def suggest_words(
    prefix: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=30),
):
    async with db_manager.get_connection() as conn:
        async with conn.execute(
            "SELECT word, part_of_speech, frequency FROM words "
            "WHERE word LIKE ? ORDER BY frequency DESC LIMIT ?",
            (f"{prefix}%", limit),
        ) as cursor:
            rows = await cursor.fetchall()
    return {"suggestions": [dict(r) for r in rows]}


@router.get("/level/{word}")
async def get_word_level(word: str):
    from ai.dictionary.level_estimator import estimate_level
    word_data = await db_manager.get_word(word.lower())
    if word_data and word_data.get("level"):
        return {"word": word, "level": word_data["level"]}
    return {"word": word, "level": estimate_level(word)}


def init_api(db):
    global db_manager
    db_manager = db
