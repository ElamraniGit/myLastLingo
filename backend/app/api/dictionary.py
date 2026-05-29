"""
Dictionary API for LinguaLearn.
Fetches word data from online APIs with SQLite caching.
"""

import json
import uuid
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()
db_manager = None
dictionary_service = None


class WordSearchRequest(BaseModel):
    word: str


@router.post("/lookup")
async def lookup_word(request: WordSearchRequest):
    """Look up a word — returns cached result or fetches from APIs."""
    word = request.word.lower().strip()
    if not word:
        raise HTTPException(status_code=400, detail="Word cannot be empty")

    # Check database cache first (instant)
    cached = await db_manager.get_word(word)
    if cached:
        # Bump frequency
        async with db_manager.get_connection() as conn:
            await conn.execute(
                "UPDATE words SET frequency = frequency + 1 WHERE word = ?", (word,)
            )
        # Parse JSON fields that may be stored as strings
        for field in ("definitions", "how_to_use", "examples", "synonyms", "antonyms", "conjugations", "related_words"):
            val = cached.get(field)
            if isinstance(val, str):
                try:
                    cached[field] = json.loads(val)
                except (json.JSONDecodeError, TypeError):
                    pass
        return cached

    # Fetch from dictionary service (online APIs → fallback)
    global dictionary_service
    if dictionary_service is None:
        from ai.dictionary.service import DictionaryService
        from config.settings import load_config
        config = load_config()
        dictionary_service = DictionaryService(config.ai.dictionary)

    try:
        word_data = await dictionary_service.lookup(word)

        if word_data:
            word_data["id"] = str(uuid.uuid4())
            word_data["frequency"] = 1
            await db_manager.add_word(word_data)
            return word_data

        raise HTTPException(status_code=404, detail=f"No data found for '{word}'")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Dictionary lookup failed for '{word}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Dictionary lookup failed")


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
