"""
Vocabulary management API.
Handles saved words, flashcards, and spaced repetition.
"""

import uuid
import logging
from typing import Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()
db_manager = None


class SaveWordRequest(BaseModel):
    word: str
    video_id: Optional[str] = None
    sentence: str = ""
    context: str = ""


class ReviewRequest(BaseModel):
    saved_word_id: str
    quality: int  # 0-5


class WordResponse(BaseModel):
    id: str
    word: str
    pronunciation: str
    part_of_speech: str
    meaning_ar: str
    meaning_en: str
    level: str
    sentence: str
    status: str
    next_review: Optional[str]


@router.post("/save")
async def save_word(request: SaveWordRequest):
    """Save a word to user's vocabulary."""
    word = request.word.lower().strip()
    if not word:
        raise HTTPException(status_code=400, detail="Word cannot be empty")

    word_data = await db_manager.get_word(word)
    if not word_data:
        try:
            from ai.dictionary.service import DictionaryService
            svc = DictionaryService()
            word_data = await svc.lookup(word)
            if word_data:
                word_data["id"] = str(uuid.uuid4())
                await db_manager.add_word(word_data)
            else:
                word_data = _make_basic_entry(word)
                await db_manager.add_word(word_data)
        except Exception as e:
            logger.warning(f"Dictionary lookup failed, using basic entry: {e}")
            word_data = _make_basic_entry(word)
            await db_manager.add_word(word_data)

    async with db_manager.get_connection() as conn:
        async with conn.execute(
            "SELECT * FROM saved_words WHERE word_id = ? AND (video_id = ? OR video_id IS NULL)",
            (word_data["id"], request.video_id),
        ) as cursor:
            existing = await cursor.fetchone()

    if existing:
        existing_id = dict(existing)["id"]
        saved_word = await db_manager.get_saved_word(existing_id)
        return {
            "message": "Word already saved",
            "id": existing_id,
            "word": word,
            "status": saved_word.get("status") if saved_word else "learning",
            "saved_word": saved_word,
        }

    saved_id = await db_manager.save_word_to_vocabulary(
        word_data["id"],
        request.video_id,
        request.sentence,
        request.context,
    )
    saved_word = await db_manager.get_saved_word(saved_id)

    return {
        "message": "Word saved successfully",
        "id": saved_id,
        "word": word,
        "status": "learning",
        "saved_word": saved_word,
    }


@router.get("/list")
async def list_vocabulary(
    status: Optional[str] = Query(None, pattern="^(learning|reviewing|learned)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """List saved vocabulary words."""
    words = await db_manager.get_saved_words(status, limit * page)
    start = (page - 1) * limit
    paginated = words[start : start + limit]

    async with db_manager.get_connection() as conn:
        if status:
            async with conn.execute(
                "SELECT COUNT(*) as total FROM saved_words WHERE status = ?", (status,)
            ) as cur:
                row = await cur.fetchone()
        else:
            async with conn.execute("SELECT COUNT(*) as total FROM saved_words") as cur:
                row = await cur.fetchone()
        total = dict(row)["total"] if row else 0

    return {
        "words": paginated,
        "page": page,
        "limit": limit,
        "total": total,
        "pages": max(1, (total + limit - 1) // limit),
    }


@router.post("/review")
async def review_word(request: ReviewRequest):
    """Review a saved word using an improved spaced-repetition flow."""
    if request.quality < 0 or request.quality > 5:
        raise HTTPException(status_code=400, detail="Quality must be between 0 and 5")

    updated = await db_manager.update_review(request.saved_word_id, request.quality)
    if not updated:
        raise HTTPException(status_code=404, detail="Saved word not found")

    summary = await db_manager.get_review_summary()
    return {
        "message": "Review recorded",
        "saved_word_id": request.saved_word_id,
        "quality": request.quality,
        "word": updated,
        "summary": summary,
    }


@router.get("/due")
async def get_due_words(limit: int = Query(20, ge=1, le=100)):
    """Get words due for review."""
    words = await db_manager.get_due_words(limit)
    summary = await db_manager.get_review_summary()
    return {"words": words, "count": len(words), "summary": summary}


@router.get("/review/summary")
async def get_review_summary():
    """Get compact review queue summary."""
    return await db_manager.get_review_summary()


@router.get("/review/history/{saved_word_id}")
async def get_review_history(saved_word_id: str, limit: int = Query(20, ge=1, le=100)):
    """Get review history for one saved word."""
    saved_word = await db_manager.get_saved_word(saved_word_id)
    if not saved_word:
        raise HTTPException(status_code=404, detail="Saved word not found")

    history = await db_manager.get_review_history(saved_word_id, limit)
    return {
        "saved_word_id": saved_word_id,
        "word": saved_word.get("word"),
        "history": history,
        "count": len(history),
    }


@router.get("/stats")
async def get_vocabulary_stats():
    """Get vocabulary learning statistics."""
    async with db_manager.get_connection() as conn:
        due_expr = db_manager._normalized_datetime_expr("next_review")

        async with conn.execute(
            f"""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'learning' THEN 1 ELSE 0 END) as learning,
                SUM(CASE WHEN status = 'reviewing' THEN 1 ELSE 0 END) as reviewing,
                SUM(CASE WHEN status = 'learned' THEN 1 ELSE 0 END) as learned,
                SUM(CASE WHEN next_review IS NULL OR {due_expr} <= datetime('now') THEN 1 ELSE 0 END) as due
            FROM saved_words
            """
        ) as cur:
            row = await cur.fetchone()
            stats = dict(row) if row else {}

        async with conn.execute(
            """
            SELECT COUNT(*) as today_reviews
            FROM word_reviews
            WHERE date(replace(substr(reviewed_at, 1, 19), 'T', ' ')) = date('now')
            """
        ) as cur:
            today = await cur.fetchone()
            stats["reviewed_today"] = dict(today)["today_reviews"] if today else 0

        async with conn.execute(
            """
            SELECT COUNT(DISTINCT date(replace(substr(reviewed_at, 1, 19), 'T', ' '))) as streak
            FROM word_reviews
            WHERE datetime(replace(substr(reviewed_at, 1, 19), 'T', ' ')) >= date('now', '-30 days')
            """
        ) as cur:
            streak_data = await cur.fetchone()
            stats["active_days_30"] = dict(streak_data)["streak"] if streak_data else 0

        async with conn.execute(
            """
            SELECT w.level, COUNT(*) as count
            FROM saved_words sw
            JOIN words w ON sw.word_id = w.id
            GROUP BY w.level
            ORDER BY w.level
            """
        ) as cur:
            rows = await cur.fetchall()
            stats["level_distribution"] = {dict(r)["level"]: dict(r)["count"] for r in rows}

    return stats


@router.delete("/{saved_id}")
async def delete_saved_word(saved_id: str):
    """Remove a word from vocabulary."""
    async with db_manager.get_connection() as conn:
        await conn.execute("DELETE FROM word_reviews WHERE saved_word_id = ?", (saved_id,))
        await conn.execute("DELETE FROM saved_words WHERE id = ?", (saved_id,))
    return {"message": "Word removed from vocabulary"}


def _make_basic_entry(word: str) -> Dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "word": word,
        "pronunciation": f"/{word}/",
        "part_of_speech": "unknown",
        "level": "B1",
        "meaning_ar": "",
        "meaning_en": f'Definition not available locally for "{word}"',
        "examples": [],
        "synonyms": [],
        "antonyms": [],
        "conjugations": {},
        "related_words": [],
        "frequency": 1,
    }


def init_api(db):
    global db_manager
    db_manager = db
