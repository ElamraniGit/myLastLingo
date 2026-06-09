"""
Vocabulary management API.
Handles saved words, flashcards, and spaced repetition.
"""

import io
import csv
import uuid
import logging
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import StreamingResponse
from backend.app.api.auth import get_current_user
from backend.app.utils.crypto import decrypt_secret
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()
db_manager = None


async def _get_groq_key(user_id: str) -> Optional[str]:
    if not db_manager or not user_id:
        return None
    try:
        async with db_manager.get_connection() as conn:
            async with conn.execute(
                "SELECT groq_api_key FROM users WHERE id = ?", (user_id,)
            ) as cursor:
                row = await cursor.fetchone()
        if row:
            key = decrypt_secret((dict(row).get("groq_api_key") or "").strip())
            return key or None
    except Exception:
        return None
    return None


async def _lookup_or_build_word_entry(
    word: str,
    user_id: str,
    sentence: str = "",
    context: str = "",
) -> Dict[str, Any]:
    from ai.language.service import get_service

    cached = await db_manager.get_word(word)
    if cached:
        return cached

    groq_key = await _get_groq_key(user_id)
    try:
        entry = await get_service(db_manager).lookup(word, groq_key, sentence=sentence, context=context)
        word_data = _language_entry_to_word_record(entry)
    except Exception as exc:
        logger.warning("Unified language lookup failed for %r: %s", word, exc)
        word_data = _make_basic_entry(word)

    word_data.setdefault("id", str(uuid.uuid4()))
    await db_manager.add_word(word_data)
    return word_data


async def _assert_owns_saved_word(saved_id: str, user_id: str) -> None:
    """
    FIX-SEC-2 (IDOR): Verify the saved word belongs to the current user before
    allowing review / update / delete / history access. Without this, any
    authenticated user could mutate or read another user's words by guessing IDs.
    """
    async with db_manager.get_connection() as conn:
        async with conn.execute(
            "SELECT user_id FROM saved_words WHERE id = ?", (saved_id,)
        ) as cursor:
            row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Saved word not found")
    owner = dict(row).get("user_id") or ""
    # Allow legacy rows with empty user_id (pre-multi-user data); reject only if
    # a *different* user owns the row.
    if owner and owner != user_id:
        raise HTTPException(status_code=403, detail="Not authorized for this word")


class SaveWordRequest(BaseModel):
    word: str
    video_id: Optional[str] = None
    sentence: str = ""
    context: str = ""


class ReviewRequest(BaseModel):
    saved_word_id: str
    quality: int  # 0-5


class UpdateSavedWordRequest(BaseModel):
    tags: Optional[List[str]] = None
    notes: Optional[str] = None
    favorite: Optional[bool] = None


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
async def save_word(request: SaveWordRequest, current_user: dict = Depends(get_current_user)):
    """Save a word to user's vocabulary."""
    word = request.word.lower().strip()
    if not word:
        raise HTTPException(status_code=400, detail="Word cannot be empty")

    word_data = await _lookup_or_build_word_entry(word, current_user["sub"], request.sentence, request.context)

    async with db_manager.get_connection() as conn:
        async with conn.execute(
            "SELECT * FROM saved_words WHERE word_id = ? AND user_id = ? AND (video_id = ? OR video_id IS NULL)",
            (word_data["id"], current_user["sub"], request.video_id),
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
        user_id=current_user["sub"],
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
    limit: int = Query(20, ge=1, le=200),
    search: Optional[str] = Query(None),
    level: Optional[str] = Query(None),
    video_id: Optional[str] = Query(None),
    due_only: bool = Query(False),
    tag: Optional[str] = Query(None),
    favorite_only: bool = Query(False),
    sort: str = Query("next_review", pattern="^(next_review|newest|oldest|alphabetical|level|difficulty)$"),
    current_user: dict = Depends(get_current_user),
):
    """List saved vocabulary words with rich filtering."""
    uid = current_user["sub"]
    words = await db_manager.get_saved_words(
        status=status,
        limit=limit,
        page=page,
        search=search,
        level=level,
        video_id=video_id,
        due_only=due_only,
        tag=tag,
        favorite_only=favorite_only,
        sort=sort,
        user_id=uid,
    )
    total = await db_manager.count_saved_words(
        status=status,
        search=search,
        level=level,
        video_id=video_id,
        due_only=due_only,
        tag=tag,
        favorite_only=favorite_only,
        user_id=uid,
    )

    return {
        "words": words,
        "page": page,
        "limit": limit,
        "total": total,
        "pages": max(1, (total + limit - 1) // limit),
        "filters": {
            "status": status,
            "search": search,
            "level": level,
            "video_id": video_id,
            "due_only": due_only,
            "tag": tag,
            "favorite_only": favorite_only,
            "sort": sort,
        },
    }


@router.get("/filters")
async def get_vocabulary_filters(current_user: dict = Depends(get_current_user)):
    """Get available levels, source videos, and tags for filtering (scoped to this user)."""
    return await db_manager.get_vocabulary_facets(user_id=current_user["sub"])


@router.patch("/{saved_id}")
async def update_saved_word(saved_id: str, request: UpdateSavedWordRequest, current_user: dict = Depends(get_current_user)):
    """Update tags / notes / favorite metadata for a saved word."""
    await _assert_owns_saved_word(saved_id, current_user["sub"])
    updated = await db_manager.update_saved_word_metadata(
        saved_id,
        tags=request.tags,
        notes=request.notes,
        favorite=request.favorite,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Saved word not found")
    return {"message": "Saved word updated", "word": updated}


@router.post("/review")
async def review_word(request: ReviewRequest, current_user: dict = Depends(get_current_user)):
    """Review a saved word using an improved spaced-repetition flow."""
    if request.quality < 0 or request.quality > 5:
        raise HTTPException(status_code=400, detail="Quality must be between 0 and 5")

    await _assert_owns_saved_word(request.saved_word_id, current_user["sub"])
    updated = await db_manager.update_review(request.saved_word_id, request.quality)
    if not updated:
        raise HTTPException(status_code=404, detail="Saved word not found")

    summary = await db_manager.get_review_summary(user_id=current_user["sub"])
    return {
        "message": "Review recorded",
        "saved_word_id": request.saved_word_id,
        "quality": request.quality,
        "word": updated,
        "summary": summary,
    }


@router.get("/due")
async def get_due_words(limit: int = Query(20, ge=1, le=100), current_user: dict = Depends(get_current_user)):
    """Get words due for review."""
    uid = current_user["sub"]
    words = await db_manager.get_due_words(limit, user_id=uid)
    summary = await db_manager.get_review_summary(user_id=uid)
    return {"words": words, "count": len(words), "summary": summary}


@router.get("/review/summary")
async def get_review_summary(current_user: dict = Depends(get_current_user)):
    """Get compact review queue summary."""
    return await db_manager.get_review_summary(user_id=current_user["sub"])


@router.get("/review/history/{saved_word_id}")
async def get_review_history(saved_word_id: str, limit: int = Query(20, ge=1, le=100), current_user: dict = Depends(get_current_user)):
    """Get review history for one saved word."""
    await _assert_owns_saved_word(saved_word_id, current_user["sub"])
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
async def get_vocabulary_stats(current_user: dict = Depends(get_current_user)):
    """Get rich vocabulary and review statistics."""
    async with db_manager.get_connection() as conn:
        due_expr = db_manager._normalized_datetime_expr("next_review")

        uid = current_user["sub"]
        # Strict user scoping — removed OR user_id='' to prevent cross-user data leaks.
        async with conn.execute(
            f"""
            SELECT
                COUNT(*) as total,
                COALESCE(SUM(CASE WHEN status = 'learning' THEN 1 ELSE 0 END), 0) as learning,
                COALESCE(SUM(CASE WHEN status = 'reviewing' THEN 1 ELSE 0 END), 0) as reviewing,
                COALESCE(SUM(CASE WHEN status = 'learned' THEN 1 ELSE 0 END), 0) as learned,
                COALESCE(SUM(CASE WHEN next_review IS NULL OR {due_expr} <= datetime('now') THEN 1 ELSE 0 END), 0) as due,
                COALESCE(SUM(CASE WHEN reviewed_count = 0 THEN 1 ELSE 0 END), 0) as never_reviewed,
                COALESCE(SUM(CASE WHEN COALESCE(favorite, 0) = 1 THEN 1 ELSE 0 END), 0) as favorite_count,
                COALESCE(SUM(lapses), 0) as total_lapses,
                COALESCE(SUM(reviewed_count), 0) as total_reviews,
                ROUND(COALESCE(AVG(ease_factor), 0), 2) as avg_ease
            FROM saved_words WHERE user_id = ?
            """, (uid,)
        ) as cur:
            row = await cur.fetchone()
            stats = dict(row) if row else {}

        # reviewed_today scoped to this user's reviews
        async with conn.execute(
            """
            SELECT COUNT(*) as today_reviews
            FROM word_reviews wr
            JOIN saved_words sw ON wr.saved_word_id = sw.id
            WHERE sw.user_id = ?
              AND date(replace(substr(wr.reviewed_at, 1, 19), 'T', ' ')) = date('now')
            """, (uid,)
        ) as cur:
            today = await cur.fetchone()
            stats["reviewed_today"] = dict(today)["today_reviews"] if today else 0

        # active days in last 30 — scoped to this user
        async with conn.execute(
            """
            SELECT COUNT(DISTINCT date(replace(substr(wr.reviewed_at, 1, 19), 'T', ' '))) as streak
            FROM word_reviews wr
            JOIN saved_words sw ON wr.saved_word_id = sw.id
            WHERE sw.user_id = ?
              AND datetime(replace(substr(wr.reviewed_at, 1, 19), 'T', ' ')) >= date('now', '-30 days')
            """, (uid,)
        ) as cur:
            streak_data = await cur.fetchone()
            stats["active_days_30"] = dict(streak_data)["streak"] if streak_data else 0

        async with conn.execute(
            """
            SELECT w.level, COUNT(*) as count
            FROM saved_words sw
            JOIN words w ON sw.word_id = w.id
            WHERE sw.user_id = ?
            GROUP BY w.level
            ORDER BY w.level
            """, (uid,)
        ) as cur:
            rows = await cur.fetchall()
            stats["level_distribution"] = {dict(r)["level"]: dict(r)["count"] for r in rows}

        # quality breakdown scoped to this user
        async with conn.execute(
            """
            SELECT wr.quality, COUNT(*) as count
            FROM word_reviews wr
            JOIN saved_words sw ON wr.saved_word_id = sw.id
            WHERE sw.user_id = ?
            GROUP BY wr.quality
            ORDER BY wr.quality
            """, (uid,)
        ) as cur:
            rows = await cur.fetchall()
            stats["recent_quality_breakdown"] = {str(dict(r)["quality"]): dict(r)["count"] for r in rows}

        async with conn.execute(
            f"""
            SELECT w.word, sw.status, sw.lapses, sw.reviewed_count, sw.next_review
            FROM saved_words sw
            JOIN words w ON sw.word_id = w.id
            WHERE sw.user_id = ?
            ORDER BY sw.lapses DESC, sw.reviewed_count DESC, {due_expr} ASC
            LIMIT 5
            """, (uid,)
        ) as cur:
            rows = await cur.fetchall()
            stats["hardest_words"] = [dict(r) for r in rows]

        async with conn.execute(
            f"""
            SELECT date({due_expr}) as review_day, COUNT(*) as count
            FROM saved_words
            WHERE user_id = ?
              AND next_review IS NOT NULL
              AND {due_expr} <= datetime('now', '+7 days')
            GROUP BY date({due_expr})
            ORDER BY date({due_expr}) ASC
            """, (uid,)
        ) as cur:
            rows = await cur.fetchall()
            stats["upcoming_review_days"] = {dict(r)["review_day"]: dict(r)["count"] for r in rows if dict(r)["review_day"]}

        async with conn.execute(
            "SELECT tags FROM saved_words WHERE user_id = ? AND tags IS NOT NULL AND tags != ''",
            (uid,)
        ) as cur:
            rows = await cur.fetchall()
            top_tags: Dict[str, int] = {}
            for row in rows:
                for tag in db_manager._decode_json_field(dict(row).get("tags"), []):
                    key = str(tag).strip().lower()
                    if key:
                        top_tags[key] = top_tags.get(key, 0) + 1
            stats["top_tags"] = [
                {"tag": tag, "count": count}
                for tag, count in sorted(top_tags.items(), key=lambda item: (-item[1], item[0]))[:10]
            ]

    return stats


@router.delete("/{saved_id}")
async def delete_saved_word(saved_id: str, current_user: dict = Depends(get_current_user)):
    """Remove a word from vocabulary."""
    await _assert_owns_saved_word(saved_id, current_user["sub"])
    async with db_manager.get_connection() as conn:
        await conn.execute("DELETE FROM word_reviews WHERE saved_word_id = ?", (saved_id,))
        await conn.execute("DELETE FROM saved_words WHERE id = ?", (saved_id,))
    return {"message": "Word removed from vocabulary"}


class ImportWord(BaseModel):
    word: str
    sentence: str = ""
    context: str = ""


class ImportRequest(BaseModel):
    words: List[ImportWord]


@router.get("/export")
async def export_vocabulary(
    format: str = Query("csv", pattern="^(csv|json)$"),
    current_user: dict = Depends(get_current_user),
):
    """
    Phase 5: export the user's vocabulary for backup / portability.

    CSV columns are Anki-friendly (word, meaning, example, level, status).
    """
    uid = current_user["sub"]
    # Pull everything (cap high to keep it bounded).
    words = await db_manager.get_saved_words(limit=10000, page=1, sort="newest", user_id=uid)

    if format == "json":
        payload = {
            "version": 1,
            "exported_by": current_user.get("username", ""),
            "count": len(words),
            "words": [
                {
                    "word": w.get("word", ""),
                    "meaning_en": w.get("meaning_en", ""),
                    "meaning_ar": w.get("meaning_ar", ""),
                    "level": w.get("level", ""),
                    "part_of_speech": w.get("part_of_speech", ""),
                    "sentence": w.get("sentence", ""),
                    "status": w.get("status", ""),
                    "examples": w.get("examples", []),
                }
                for w in words
            ],
        }
        import json as _json
        data = _json.dumps(payload, ensure_ascii=False, indent=2)
        return StreamingResponse(
            iter([data]),
            media_type="application/json",
            headers={"Content-Disposition": 'attachment; filename="lingualearn-vocabulary.json"'},
        )

    # CSV
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["word", "meaning_en", "meaning_ar", "level", "part_of_speech", "example", "status"])
    for w in words:
        example = ""
        ex = w.get("examples") or []
        if isinstance(ex, list) and ex:
            example = str(ex[0])
        writer.writerow([
            w.get("word", ""),
            w.get("meaning_en", ""),
            w.get("meaning_ar", ""),
            w.get("level", ""),
            w.get("part_of_speech", ""),
            example,
            w.get("status", ""),
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="lingualearn-vocabulary.csv"'},
    )


@router.post("/import")
async def import_vocabulary(request: ImportRequest, current_user: dict = Depends(get_current_user)):
    """
    Phase 5: bulk-import words into the user's vocabulary.

    Each word is looked up (cached dictionary → online → basic entry) and added
    if the user doesn't already have it. Returns counts. Capped at 500 per call.
    """
    uid = current_user["sub"]
    if not request.words:
        raise HTTPException(status_code=400, detail="No words provided")
    if len(request.words) > 500:
        raise HTTPException(status_code=400, detail="Too many words (max 500 per import)")

    added, skipped, failed = 0, 0, 0
    for item in request.words:
        word = (item.word or "").lower().strip()
        if not word:
            failed += 1
            continue
        try:
            word_data = await _lookup_or_build_word_entry(word, uid, item.sentence, item.context)

            # Skip if the user already has this word
            async with db_manager.get_connection() as conn:
                async with conn.execute(
                    "SELECT id FROM saved_words WHERE word_id = ? AND user_id = ?",
                    (word_data["id"], uid),
                ) as cur:
                    if await cur.fetchone():
                        skipped += 1
                        continue

            await db_manager.save_word_to_vocabulary(
                word_data["id"], None, item.sentence, item.context, user_id=uid,
            )
            added += 1
        except Exception as e:
            logger.warning(f"Import failed for '{word}': {e}")
            failed += 1

    return {"message": "Import complete", "added": added, "skipped": skipped, "failed": failed}


def _language_entry_to_word_record(entry: Dict[str, Any]) -> Dict[str, Any]:
    meanings = entry.get("meanings") or []
    definitions = entry.get("definitions") or []
    example_details = entry.get("example_details") or []
    synonym_details = entry.get("synonym_details") or []
    antonym_details = entry.get("antonym_details") or []
    collocation_details = entry.get("collocation_details") or []
    word_family = entry.get("word_family") or []
    grammar_analysis = entry.get("grammar_analysis") or {}
    teaching_notes = entry.get("teaching_notes") or []

    primary_definition = ""
    if meanings:
        primary_definition = str((meanings[0] or {}).get("english_simple") or (meanings[0] or {}).get("english_advanced") or "").strip()

    mapped_definitions = []
    for item in definitions:
        text = str((item or {}).get("text", "")).strip()
        if not text:
            continue
        if not primary_definition:
            primary_definition = text
        mapped_definitions.append({
            "part_of_speech": entry.get("part_of_speech", "unknown"),
            "definition": text,
            "example": "",
        })

    examples = entry.get("examples") or [
        str((item or {}).get("english") or "").strip()
        for item in example_details
    ]
    examples = [item for item in examples if item][:10]

    synonyms = entry.get("synonyms") or [
        str((item or {}).get("term") or "").strip()
        for item in synonym_details
    ]
    synonyms = [item for item in synonyms if item][:10]

    antonyms = entry.get("antonyms") or [
        str((item or {}).get("term") or "").strip()
        for item in antonym_details
    ]
    antonyms = [item for item in antonyms if item][:10]

    collocations = entry.get("collocations") or [
        str((item or {}).get("expression") or "").strip()
        for item in collocation_details
    ]
    collocations = [item for item in collocations if item][:8]

    related_words = entry.get("related_words") or [
        str((item or {}).get("term") or "").strip()
        for item in word_family
    ]
    related_words = [item for item in related_words if item][:10]

    usage_notes = str(entry.get("usage_notes", "")).strip()
    how_to_use = []
    if str(entry.get("word_explanation") or "").strip():
        how_to_use.append(str(entry.get("word_explanation") or "").strip())
    if usage_notes and usage_notes not in how_to_use:
        how_to_use.append(usage_notes)
    for note in teaching_notes:
        note_text = str(note or "").strip()
        if note_text and note_text not in how_to_use:
            how_to_use.append(note_text)
        if len(how_to_use) >= 4:
            break

    grammar_note_parts = []
    if str(entry.get("grammar_notes") or "").strip():
        grammar_note_parts.append(str(entry.get("grammar_notes") or "").strip())
    if str(grammar_analysis.get("summary") or "").strip() and str(grammar_analysis.get("summary") or "").strip() not in grammar_note_parts:
        grammar_note_parts.append(str(grammar_analysis.get("summary") or "").strip())
    for note in (grammar_analysis.get("notes") or []):
        note_text = str(note or "").strip()
        if note_text and note_text not in grammar_note_parts:
            grammar_note_parts.append(note_text)
        if len(grammar_note_parts) >= 4:
            break
    grammar_notes = " ".join(grammar_note_parts).strip()

    difficulty = float(entry.get("learning_difficulty", 0.5) or 0.5)
    priority = float(entry.get("priority_score", 0.5) or 0.5)
    frequency = int(entry.get("frequency_score") or max(1, round(priority * 100)))

    return {
        "id": str(uuid.uuid4()),
        "word": (entry.get("term") or "").lower().strip(),
        "pronunciation": entry.get("pronunciation", ""),
        "part_of_speech": entry.get("part_of_speech", "unknown"),
        "level": entry.get("cefr_level", "B1"),
        "meaning_ar": entry.get("translation", ""),
        "meaning_en": primary_definition,
        "definitions": mapped_definitions,
        "how_to_use": how_to_use,
        "usage_notes": usage_notes,
        "grammar_notes": grammar_notes,
        "examples": examples,
        "synonyms": synonyms,
        "antonyms": antonyms,
        "collocations": collocations,
        "conjugations": grammar_analysis.get("inflected_forms") or {},
        "related_words": related_words,
        "entry_type": entry.get("entry_type", "word"),
        "difficulty_score": difficulty,
        "priority_score": priority,
        "frequency": max(1, min(100, frequency)),
        "ai_enriched": bool(entry.get("ai_generated")),
        "root_form": str(grammar_analysis.get("base_form") or entry.get("term") or "").strip(),
        "ai_payload": entry,
    }


def _make_basic_entry(word: str) -> Dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "word": word,
        "pronunciation": f"/{word}/",
        "part_of_speech": "unknown",
        "level": "B1",
        "meaning_ar": "",
        "meaning_en": f'Definition not available locally for "{word}"',
        "definitions": [],
        "how_to_use": [],
        "usage_notes": "",
        "grammar_notes": "",
        "examples": [],
        "synonyms": [],
        "antonyms": [],
        "collocations": [],
        "conjugations": {},
        "related_words": [],
        "entry_type": "word",
        "difficulty_score": 0.5,
        "priority_score": 0.5,
        "frequency": 1,
    }


@router.get("/{saved_id}")
async def get_saved_word_by_id(saved_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single saved word by ID — must be LAST to avoid shadowing /export etc."""
    await _assert_owns_saved_word(saved_id, current_user["sub"])
    word = await db_manager.get_saved_word(saved_id)
    if not word:
        raise HTTPException(status_code=404, detail="Saved word not found")
    return word


def init_api(db):
    global db_manager
    db_manager = db
