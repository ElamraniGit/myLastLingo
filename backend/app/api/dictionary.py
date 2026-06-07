"""
Dictionary API — Groq-first unified language intelligence.

All linguistic data now flows through GroqLanguageService:
  POST /dictionary/lookup           — full word/phrase entry
  POST /dictionary/lookup/phrase    — multi-word phrase (same engine)
  POST /dictionary/refresh/{term}   — force re-fetch from Groq
  GET  /dictionary/search           — search cached terms by prefix
  GET  /dictionary/suggest          — auto-complete suggestions
  GET  /dictionary/level/{word}     — CEFR level estimate

Architecture:
  ┌─ Frontend ──────────────────────────────────────────┐
  │  WordPopup · SelectionToolbar · WordDetailView …    │
  └────────────────────┬────────────────────────────────┘
                       │ POST /dictionary/lookup
                       ▼
  ┌─ dictionary.py ────────────────────────────────────┐
  │  1. Get user's Groq key from DB                    │
  │  2. GroqLanguageService.lookup(term, key)          │
  │     ├─ cache hit  → instant return                 │
  │     ├─ Groq call  → validate → cache → return      │
  │     └─ offline    → cached fallback or empty       │
  └───────────────────────────────────────────────────┘
"""

import json
import logging
import asyncio
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel

from backend.app.api.auth import get_current_user

logger     = logging.getLogger(__name__)
router     = APIRouter()
db_manager = None


# ── Models ────────────────────────────────────────────────────────────────────

class LookupRequest(BaseModel):
    word: str          # kept as 'word' for backwards compat — accepts phrases too


class PhraseRequest(BaseModel):
    phrase: str


# ── Groq key helper ───────────────────────────────────────────────────────────

async def _get_groq_key(user_id: str) -> Optional[str]:
    """Fetch user's Groq API key from DB."""
    if not db_manager or not user_id:
        return None
    try:
        async with db_manager.get_connection() as conn:
            async with conn.execute(
                "SELECT groq_api_key FROM users WHERE id = ?", (user_id,)
            ) as cur:
                row = await cur.fetchone()
        if row:
            key = (dict(row).get("groq_api_key") or "").strip()
            return key if key else None
    except Exception:
        pass
    # Legacy file fallback
    from pathlib import Path
    kf = Path("data/.groq_key")
    if kf.exists():
        k = kf.read_text().strip()
        if k: return k
    return None


# ── Service accessor ──────────────────────────────────────────────────────────

def _svc():
    from ai.groq_language_service import get_service
    return get_service(db_manager)


# ── Legacy compat: convert LanguageEntry → old word dict format ───────────────
# WordPopup, VocabularyView, etc. still expect the old field names.
# This adapter layer is the ONLY place where mapping happens.

def _to_legacy(entry: dict) -> dict:
    """
    Convert unified LanguageEntry schema → legacy 'words' table schema.
    Allows existing UI components to work without changes.
    """
    defs      = entry.get("definitions", [])
    main_def  = defs[0]["text"] if defs else ""
    defs_list = [{"part_of_speech": entry.get("part_of_speech",""), "definition": d["text"], "example": ""} for d in defs]

    return {
        "word":           entry.get("term", ""),
        "pronunciation":  entry.get("pronunciation", ""),
        "part_of_speech": entry.get("part_of_speech", ""),
        "level":          entry.get("cefr_level", "B1"),
        "meaning_ar":     entry.get("translation", ""),
        "meaning_en":     main_def,
        "definitions":    defs_list,
        "how_to_use":     [entry["usage_notes"]] if entry.get("usage_notes") else [],
        "grammar_notes":  [entry["grammar_notes"]] if entry.get("grammar_notes") else [],
        "examples":       entry.get("examples", []),
        "synonyms":       entry.get("synonyms", []),
        "antonyms":       entry.get("antonyms", []),
        "collocations":   entry.get("collocations", []),
        "related_words":  entry.get("related_words", []),
        "conjugations":   {},
        "root_form":      entry.get("term", ""),
        "frequency":      1,
        "ai_enriched":    entry.get("ai_generated", False),
        "confidence":     entry.get("confidence", 0.0),
        # Keep full entry accessible
        "_ai_entry":      entry,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/lookup")
async def lookup_word(
    request: LookupRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Look up any English term — word, phrase, idiom, or expression.
    Returns unified LanguageEntry (also compatible with legacy field names).
    """
    term    = request.word.strip()
    if not term:
        raise HTTPException(400, "Term cannot be empty")

    user_id  = current_user.get("sub", "")
    groq_key = await _get_groq_key(user_id)

    try:
        entry = await _svc().lookup(term, groq_key)
        # If no AI data and no Groq key, fall back to multi-source pipeline
        if not entry.get("ai_generated") and not groq_key:
            entry = await _fallback_lookup(term, entry)
    except Exception as e:
        logger.error(f"Lookup failed for '{term}': {e}", exc_info=True)
        raise HTTPException(500, "Language lookup failed")

    return _to_legacy(entry)


@router.post("/lookup/phrase")
async def lookup_phrase(
    request: PhraseRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Look up a multi-word phrase, idiom, or expression.
    Returns the same LanguageEntry schema as /lookup.
    """
    phrase   = request.phrase.strip()
    if not phrase:
        raise HTTPException(400, "Phrase cannot be empty")

    user_id  = current_user.get("sub", "")
    groq_key = await _get_groq_key(user_id)

    try:
        entry = await _svc().lookup_phrase(phrase, groq_key)
    except Exception as e:
        logger.error(f"Phrase lookup failed for '{phrase}': {e}", exc_info=True)
        raise HTTPException(500, "Phrase lookup failed")

    return _to_legacy(entry)


@router.post("/refresh/{term:path}")
async def refresh_term(
    term: str,
    current_user: dict = Depends(get_current_user),
):
    """Force re-fetch from Groq, bypassing cache."""
    term     = term.strip()
    user_id  = current_user.get("sub", "")
    groq_key = await _get_groq_key(user_id)

    if not groq_key:
        raise HTTPException(503, "Groq API key not configured")

    try:
        await _svc().invalidate(term)
        entry = await _svc().lookup(term, groq_key, force_refresh=True)
    except Exception as e:
        logger.error(f"Refresh failed for '{term}': {e}")
        raise HTTPException(500, "Refresh failed")

    return _to_legacy(entry)


@router.get("/search")
async def search_dictionary(
    query: str = Query(..., min_length=2),
    limit: int = Query(10, ge=1, le=50),
):
    """Search cached terms by prefix."""
    try:
        async with db_manager.get_connection() as conn:
            async with conn.execute(
                """SELECT term, data_json FROM ai_language_cache
                   WHERE term LIKE ? ORDER BY lookup_count DESC LIMIT ?""",
                (f"{query.lower()}%", limit),
            ) as cur:
                rows = await cur.fetchall()

        results = []
        for row in rows:
            d = dict(row)
            entry = json.loads(d["data_json"])
            results.append({
                "word":           entry.get("term", ""),
                "part_of_speech": entry.get("part_of_speech", ""),
                "meaning_ar":     entry.get("translation", ""),
                "meaning_en":     entry["definitions"][0]["text"] if entry.get("definitions") else "",
                "level":          entry.get("cefr_level", ""),
            })
        return {"results": results, "count": len(results), "query": query}
    except Exception as e:
        logger.error(f"Search error: {e}")
        return {"results": [], "count": 0, "query": query}


@router.get("/suggest")
async def suggest_words(
    prefix: str = Query(..., min_length=1),
    limit: int  = Query(10, ge=1, le=30),
):
    """Auto-complete suggestions from AI cache."""
    try:
        async with db_manager.get_connection() as conn:
            async with conn.execute(
                """SELECT term FROM ai_language_cache
                   WHERE term LIKE ? ORDER BY lookup_count DESC LIMIT ?""",
                (f"{prefix.lower()}%", limit),
            ) as cur:
                rows = await cur.fetchall()
        return {"suggestions": [{"word": dict(r)["term"]} for r in rows]}
    except Exception:
        return {"suggestions": []}


@router.get("/level/{word}")
async def get_word_level(word: str):
    """Return CEFR level — from cache or local estimator."""
    try:
        entry = await _svc().get_cached(word.lower())
        if entry and entry.get("cefr_level"):
            return {"word": word, "level": entry["cefr_level"]}
    except Exception:
        pass
    # Local fallback
    from ai.dictionary.level_estimator import estimate_level
    return {"word": word, "level": estimate_level(word)}


@router.post("/enrich/{word}")
async def enrich_word(
    word: str,
    current_user: dict = Depends(get_current_user),
):
    """Re-fetch a word from Groq (alias for /refresh)."""
    return await refresh_term(word, current_user)



async def _fallback_lookup(term: str, existing_entry: dict) -> dict:
    """
    Fallback multi-source lookup for users without a Groq key.
    Uses Free Dictionary + Datamuse + Google Translate in parallel.
    Result is merged into the existing LanguageEntry structure.
    """
    from ai.dictionary.service import DictionaryService
    from ai.groq_language_service import _cache_key, _empty_entry
    import uuid

    svc = DictionaryService()
    try:
        word_data = await svc.lookup(term)
        if not word_data:
            return existing_entry

        # Map old schema → unified LanguageEntry
        defs = word_data.get("definitions", [])
        unified = {
            "term":           term,
            "language":       "en",
            "translation":    word_data.get("meaning_ar", ""),
            "pronunciation":  word_data.get("pronunciation", ""),
            "part_of_speech": word_data.get("part_of_speech", ""),
            "cefr_level":     word_data.get("level", "B1"),
            "definitions":    [{"text": d.get("definition",""), "context": "general"} for d in defs if d.get("definition")],
            "examples":       word_data.get("examples", []),
            "synonyms":       word_data.get("synonyms", []),
            "antonyms":       word_data.get("antonyms", []),
            "collocations":   word_data.get("related_words", []),
            "usage_notes":    word_data.get("how_to_use", [""])[0] if word_data.get("how_to_use") else "",
            "grammar_notes":  "",
            "related_words":  word_data.get("related_words", []),
            "confidence":     0.6,
            "ai_generated":   False,
            "cached_at":      __import__("datetime").datetime.utcnow().isoformat(),
        }

        # Cache this result in the AI language cache for consistency
        key = _cache_key(term)
        try:
            from ai.groq_language_service import get_service
            await get_service().ensure_table()
            await get_service()._save_cache(key, term, unified, groq_used=False)
        except Exception:
            pass

        return unified
    except Exception as e:
        logger.debug(f"Fallback lookup failed for '{term}': {e}")
        return existing_entry


def init_api(db):
    global db_manager
    db_manager = db
