"""
Dictionary API — multi-source pipeline with smart caching.

Lookup pipeline per word:
  1. SQLite cache (instant — skips all below if cache is fresh)
  2. Parallel fetch: Free Dictionary + Datamuse + Google Translate
  3. AI enrichment via Groq (if user has a key) — runs once, result cached
  4. Save to SQLite — future lookups are instant

Cache invalidation:
  - Words cached > 30 days without AI enrichment get re-enriched in background
  - POST /dictionary/enrich/{word} forces re-enrichment immediately
  - POST /dictionary/refresh/{word} forces full re-fetch from all sources
"""

import json
import uuid
import logging
import asyncio
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel

from backend.app.api.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

db_manager         = None
dictionary_service = None


# ── Models ────────────────────────────────────────────────────────────────────

class WordSearchRequest(BaseModel):
    word: str


# ── Lazy service loader ───────────────────────────────────────────────────────

def _get_service():
    global dictionary_service
    if dictionary_service is None:
        from ai.dictionary.service import DictionaryService
        dictionary_service = DictionaryService()
    return dictionary_service


def _parse_json_fields(entry: dict) -> dict:
    """Deserialise JSON-encoded list fields stored as TEXT in SQLite."""
    for field in (
        "definitions", "how_to_use", "examples",
        "synonyms", "antonyms", "conjugations", "related_words",
    ):
        val = entry.get(field)
        if isinstance(val, str):
            try:
                entry[field] = json.loads(val)
            except (json.JSONDecodeError, TypeError):
                entry[field] = []
    return entry


# ── Main lookup ───────────────────────────────────────────────────────────────

@router.post("/lookup")
async def lookup_word(
    request: WordSearchRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Look up a word — cached result or full pipeline fetch.
    Always returns the richest available data.
    """
    word    = request.word.lower().strip()
    if not word:
        raise HTTPException(status_code=400, detail="Word cannot be empty")

    user_id = current_user.get("sub", "")

    # ── 1. Cache hit ──────────────────────────────────────────────────────────
    cached = await db_manager.get_word(word)
    if cached:
        # Increment frequency counter
        async with db_manager.get_connection() as conn:
            await conn.execute(
                "UPDATE words SET frequency = frequency + 1 WHERE word = ?", (word,)
            )

        cached = _parse_json_fields(cached)

        # Background AI enrichment for old un-enriched entries
        if not cached.get("ai_enriched") and user_id:
            asyncio.create_task(_bg_enrich(word, cached, user_id))

        return cached

    # ── 2. Full fetch from multi-source pipeline ───────────────────────────────
    svc = _get_service()
    try:
        word_data = await svc.lookup(word)
    except Exception as e:
        logger.error(f"Service lookup failed for '{word}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Dictionary lookup failed")

    if not word_data:
        raise HTTPException(status_code=404, detail=f"No data found for '{word}'")

    # ── 3. AI enrichment (synchronous — user waits, but result is much better) ─
    if user_id:
        word_data = await _ai_enrich(word, word_data, user_id)

    # ── 4. Save to cache ──────────────────────────────────────────────────────
    word_data["id"] = str(uuid.uuid4())
    word_data.setdefault("frequency", 1)
    await db_manager.add_word(word_data)

    return word_data


# ── Force re-enrichment ───────────────────────────────────────────────────────

@router.post("/enrich/{word}")
async def enrich_word(
    word: str,
    current_user: dict = Depends(get_current_user),
):
    """Re-enrich a cached word with AI (e.g. after user sets Groq key)."""
    word   = word.lower().strip()
    cached = await db_manager.get_word(word)
    if not cached:
        raise HTTPException(status_code=404, detail=f"'{word}' not in cache — look it up first")

    cached   = _parse_json_fields(cached)
    user_id  = current_user.get("sub", "")
    enriched = await _ai_enrich(word, cached, user_id)

    if enriched.get("ai_enriched"):
        await _save_enriched(word, enriched)
        return {"message": "Enriched successfully", "word": enriched}

    return {"message": "AI enrichment skipped (no Groq key or API unavailable)", "word": cached}


# ── Force full re-fetch (clears cache entry) ──────────────────────────────────

@router.post("/refresh/{word}")
async def refresh_word(
    word: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete cached entry and re-fetch from all sources + AI."""
    word = word.lower().strip()

    # Delete old cache entry
    async with db_manager.get_connection() as conn:
        await conn.execute("DELETE FROM words WHERE word = ?", (word,))

    # Re-lookup (will go through full pipeline)
    return await lookup_word(WordSearchRequest(word=word), current_user)


# ── Standard dictionary endpoints ─────────────────────────────────────────────

@router.get("/search")
async def search_dictionary(
    query: str = Query(..., min_length=2),
    limit: int = Query(10, ge=1, le=50),
):
    """Search cached words by prefix."""
    async with db_manager.get_connection() as conn:
        async with conn.execute(
            "SELECT word, part_of_speech, meaning_ar, meaning_en, level, frequency "
            "FROM words WHERE word LIKE ? ORDER BY frequency DESC, word ASC LIMIT ?",
            (f"{query}%", limit),
        ) as cur:
            rows = await cur.fetchall()
    return {"results": [dict(r) for r in rows], "count": len(rows), "query": query}


@router.get("/suggest")
async def suggest_words(
    prefix: str = Query(..., min_length=1),
    limit: int  = Query(10, ge=1, le=30),
):
    """Auto-complete suggestions from cache."""
    async with db_manager.get_connection() as conn:
        async with conn.execute(
            "SELECT word, part_of_speech, level, frequency FROM words "
            "WHERE word LIKE ? ORDER BY frequency DESC LIMIT ?",
            (f"{prefix}%", limit),
        ) as cur:
            rows = await cur.fetchall()
    return {"suggestions": [dict(r) for r in rows]}


@router.get("/level/{word}")
async def get_word_level(word: str):
    """Return CEFR level — from cache or local estimator."""
    from ai.dictionary.level_estimator import estimate_level
    cached = await db_manager.get_word(word.lower())
    if cached and cached.get("level"):
        return {"word": word, "level": cached["level"]}
    return {"word": word, "level": estimate_level(word)}


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _ai_enrich(word: str, word_data: dict, user_id: str) -> dict:
    """Run AI enrichment with the user's Groq key."""
    try:
        from ai.dictionary.ai_enricher import enrich_word, get_groq_key_for_request
        key = await get_groq_key_for_request(db_manager, user_id)
        if not key:
            return word_data
        return await enrich_word(word, word_data, key)
    except Exception as e:
        logger.debug(f"AI enrichment error for '{word}': {e}")
        return word_data


async def _bg_enrich(word: str, cached: dict, user_id: str) -> None:
    """Background task: enrich old cached words."""
    try:
        enriched = await _ai_enrich(word, cached, user_id)
        if enriched.get("ai_enriched"):
            await _save_enriched(word, enriched)
            logger.info(f"Background enriched '{word}'")
    except Exception as e:
        logger.debug(f"Background enrich failed for '{word}': {e}")


async def _save_enriched(word: str, enriched: dict) -> None:
    """Persist AI-enriched fields to the SQLite cache."""
    async with db_manager.get_connection() as conn:
        await conn.execute(
            """UPDATE words SET
                meaning_en    = ?,
                meaning_ar    = ?,
                examples      = ?,
                how_to_use    = ?,
                related_words = ?,
                ai_enriched   = 1
               WHERE word = ?""",
            (
                enriched.get("meaning_en", ""),
                enriched.get("meaning_ar", ""),
                json.dumps(enriched.get("examples",      []), ensure_ascii=False),
                json.dumps(enriched.get("how_to_use",    []), ensure_ascii=False),
                json.dumps(enriched.get("related_words", []), ensure_ascii=False),
                word,
            ),
        )


def init_api(db):
    global db_manager
    db_manager = db
