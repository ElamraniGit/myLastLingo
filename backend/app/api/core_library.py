"""
Core English 3000 Library API
==============================
System-managed built-in vocabulary available to all users.
Architecture:
  core_words          — shared word data (system-level, read-only for users)
  user_core_progress  — per-user SM-2 learning progress

Endpoints:
  GET  /core/words              — browse/search/filter the library
  GET  /core/words/{word_id}    — single word detail
  GET  /core/stats              — library statistics
  GET  /core/progress           — current user's progress
  POST /core/progress/{word_id} — record a review (SM-2)
  GET  /core/due                — words due for review (user-specific)
  GET  /core/levels             — words grouped by CEFR level
"""

import json
import uuid
import logging
import math
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel

from backend.app.api.auth import get_current_user

logger     = logging.getLogger(__name__)
router     = APIRouter()
db_manager = None


# ── Pydantic models ───────────────────────────────────────────────────────────

class ReviewRequest(BaseModel):
    quality: int          # 0-5 (SM-2 quality rating)


# ── SM-2 algorithm (same as existing vocabulary system) ──────────────────────

def _apply_sm2(
    ease_factor: float,
    interval: int,
    repetitions: int,
    lapses: int,
    quality: int,
) -> tuple:
    """Apply SM-2 spaced repetition. Returns (ease, interval, reps, lapses, next_review_dt)."""
    now = datetime.utcnow()

    if quality <= 1:
        new_ease  = max(1.3, ease_factor - 0.20)
        new_int   = 0
        new_reps  = 0
        new_laps  = lapses + 1
        next_rev  = now + timedelta(minutes=10)
    elif quality == 2:
        new_ease  = max(1.3, ease_factor - 0.15)
        new_int   = 0
        new_reps  = 0
        new_laps  = lapses
        next_rev  = now + timedelta(minutes=30)
    elif quality == 3:
        new_ease  = min(3.0, max(1.3, ease_factor - 0.02))
        if repetitions < 1:
            new_reps = 1; new_int = 1
        else:
            new_reps = repetitions + 1
            new_int  = max(2, round(max(1, interval) * ease_factor))
        new_laps  = lapses
        next_rev  = now + timedelta(days=new_int)
    elif quality == 4:
        new_ease  = min(3.0, max(1.3, ease_factor + 0.05))
        if repetitions < 1:
            new_reps = 2; new_int = 3
        else:
            new_reps = repetitions + 1
            new_int  = max(interval + 1, round(max(1, interval) * (ease_factor + 0.15)))
        new_laps  = lapses
        next_rev  = now + timedelta(days=new_int)
    else:  # 5
        new_ease  = min(3.0, max(1.3, ease_factor + 0.10))
        if repetitions < 1:
            new_reps = 2; new_int = 4
        else:
            new_reps = repetitions + 1
            new_int  = max(interval + 2, round(max(1, interval) * (ease_factor + 0.30)))
        new_laps  = lapses
        next_rev  = now + timedelta(days=new_int)

    status = "learned" if new_int >= 30 else "reviewing" if new_reps >= 2 else "learning"
    return new_ease, new_int, new_reps, new_laps, next_rev, status


def _fmt_dt(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S")


# ── Helper: parse a core word row into dict ───────────────────────────────────

def _parse_core_word(row, progress_row=None) -> dict:
    d = dict(row)
    for f in ("synonyms", "antonyms", "collocations", "definitions", "grammar_notes"):
        val = d.get(f)
        if isinstance(val, str):
            try:
                d[f] = json.loads(val)
            except Exception:
                d[f] = []

    # Attach user progress if provided
    if progress_row:
        p = dict(progress_row)
        d["progress"] = {
            "status":         p.get("status", "new"),
            "ease_factor":    p.get("ease_factor", 2.5),
            "interval":       p.get("interval", 0),
            "repetitions":    p.get("repetitions", 0),
            "lapses":         p.get("lapses", 0),
            "reviewed_count": p.get("reviewed_count", 0),
            "last_reviewed":  p.get("last_reviewed"),
            "next_review":    p.get("next_review"),
        }
    else:
        d["progress"] = None

    return d


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/words")
async def list_core_words(
    search:  Optional[str] = Query(None, description="Search term"),
    level:   Optional[str] = Query(None, description="CEFR level: A1,A2,B1,B2,C1,C2"),
    pos:     Optional[str] = Query(None, description="Part of speech"),
    page:    int           = Query(1, ge=1),
    limit:   int           = Query(50, ge=1, le=200),
    sort:    str           = Query("freq", description="freq | alpha | level"),
    current_user: dict = Depends(get_current_user),
):
    """Browse the Core English 3000 library with search and filtering."""
    user_id = current_user["sub"]
    offset  = (page - 1) * limit

    # Build WHERE clause
    conditions = ["1=1"]
    params: list = []

    if search:
        conditions.append(
            "(cw.word LIKE ? OR cw.meaning_en LIKE ? OR cw.meaning_ar LIKE ?)"
        )
        like = f"%{search}%"
        params += [like, like, like]

    if level:
        levels = [l.strip().upper() for l in level.split(",")]
        ph = ",".join("?" * len(levels))
        conditions.append(f"cw.level IN ({ph})")
        params += levels

    if pos:
        conditions.append("cw.part_of_speech = ?")
        params.append(pos)

    where = " AND ".join(conditions)

    # Sort order
    order = {
        "alpha": "cw.word ASC",
        "level": "CASE cw.level WHEN 'A1' THEN 1 WHEN 'A2' THEN 2 WHEN 'B1' THEN 3 WHEN 'B2' THEN 4 WHEN 'C1' THEN 5 ELSE 6 END, cw.freq_rank ASC",
        "freq":  "cw.freq_rank ASC",
    }.get(sort, "cw.freq_rank ASC")

    async with db_manager.get_connection() as conn:
        # Total count
        async with conn.execute(
            f"SELECT COUNT(*) FROM core_words cw WHERE {where}", params
        ) as cur:
            total = (await cur.fetchone())[0]

        # Fetch page
        async with conn.execute(
            f"""SELECT cw.*,
                       ucp.status, ucp.ease_factor, ucp.interval,
                       ucp.repetitions, ucp.lapses, ucp.reviewed_count,
                       ucp.last_reviewed, ucp.next_review
                FROM core_words cw
                LEFT JOIN user_core_progress ucp
                  ON ucp.core_word_id = cw.id AND ucp.user_id = ?
               WHERE {where}
               ORDER BY {order}
               LIMIT ? OFFSET ?""",
            [user_id] + params + [limit, offset],
        ) as cur:
            rows = await cur.fetchall()

    words = []
    for row in rows:
        d = dict(row)
        for f in ("synonyms", "antonyms", "collocations"):
            v = d.get(f)
            if isinstance(v, str):
                try: d[f] = json.loads(v)
                except: d[f] = []
        d["progress"] = {
            "status":         d.pop("status", None) or "new",
            "ease_factor":    d.pop("ease_factor", 2.5),
            "interval":       d.pop("interval", 0),
            "repetitions":    d.pop("repetitions", 0),
            "lapses":         d.pop("lapses", 0),
            "reviewed_count": d.pop("reviewed_count", 0),
            "last_reviewed":  d.pop("last_reviewed", None),
            "next_review":    d.pop("next_review", None),
        }
        words.append(d)

    return {
        "words":      words,
        "total":      total,
        "page":       page,
        "limit":      limit,
        "pages":      math.ceil(total / limit),
    }


@router.get("/words/{word_id}")
async def get_core_word(
    word_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get full details of a single Core 3000 word."""
    user_id = current_user["sub"]
    async with db_manager.get_connection() as conn:
        async with conn.execute(
            """SELECT cw.*,
                      ucp.status, ucp.ease_factor, ucp.interval,
                      ucp.repetitions, ucp.lapses, ucp.reviewed_count,
                      ucp.last_reviewed, ucp.next_review
               FROM core_words cw
               LEFT JOIN user_core_progress ucp
                 ON ucp.core_word_id = cw.id AND ucp.user_id = ?
               WHERE cw.id = ?""",
            (user_id, word_id),
        ) as cur:
            row = await cur.fetchone()

    if not row:
        raise HTTPException(404, f"Word not found: {word_id}")

    d = dict(row)
    for f in ("synonyms", "antonyms", "collocations", "definitions", "grammar_notes"):
        v = d.get(f)
        if isinstance(v, str):
            try: d[f] = json.loads(v)
            except: d[f] = []

    d["progress"] = {
        "status":         d.pop("status", None) or "new",
        "ease_factor":    d.pop("ease_factor", 2.5),
        "interval":       d.pop("interval", 0),
        "repetitions":    d.pop("repetitions", 0),
        "lapses":         d.pop("lapses", 0),
        "reviewed_count": d.pop("reviewed_count", 0),
        "last_reviewed":  d.pop("last_reviewed", None),
        "next_review":    d.pop("next_review", None),
    }
    return d


@router.get("/due")
async def get_due_words(
    limit: int = Query(50, ge=1, le=200),
    level: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Return Core 3000 words due for review for the current user."""
    user_id = current_user["sub"]

    level_filter = ""
    level_params: list = []
    if level:
        levels = [l.strip().upper() for l in level.split(",")]
        ph = ",".join("?" * len(levels))
        level_filter = f"AND cw.level IN ({ph})"
        level_params = levels

    async with db_manager.get_connection() as conn:
        async with conn.execute(
            f"""SELECT cw.*,
                       ucp.status, ucp.ease_factor, ucp.interval,
                       ucp.repetitions, ucp.lapses, ucp.reviewed_count,
                       ucp.last_reviewed, ucp.next_review
                FROM core_words cw
                INNER JOIN user_core_progress ucp
                  ON ucp.core_word_id = cw.id AND ucp.user_id = ?
               WHERE (ucp.next_review IS NULL OR ucp.next_review <= datetime('now'))
                 AND ucp.status != 'learned'
                 {level_filter}
               ORDER BY
                 CASE ucp.status WHEN 'learning' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,
                 ucp.lapses DESC,
                 ucp.next_review ASC
               LIMIT ?""",
            [user_id] + level_params + [limit],
        ) as cur:
            rows = await cur.fetchall()

    words = []
    for row in rows:
        d = dict(row)
        for f in ("synonyms", "antonyms", "collocations"):
            v = d.get(f)
            if isinstance(v, str):
                try: d[f] = json.loads(v)
                except: d[f] = []
        d["progress"] = {
            "status":         d.pop("status", "new"),
            "ease_factor":    d.pop("ease_factor", 2.5),
            "interval":       d.pop("interval", 0),
            "repetitions":    d.pop("repetitions", 0),
            "lapses":         d.pop("lapses", 0),
            "reviewed_count": d.pop("reviewed_count", 0),
            "last_reviewed":  d.pop("last_reviewed", None),
            "next_review":    d.pop("next_review", None),
        }
        # Reshape to look like SavedWord for frontend compatibility
        d["saved_word_id"]  = f"core_{d['id']}"
        d["is_core"]        = True
        d["part_of_speech"] = d.get("part_of_speech", "")
        d["examples"]       = [d.get("example", "")] if d.get("example") else []
        d["status"]         = d["progress"]["status"]
        d["ease_factor"]    = d["progress"]["ease_factor"]
        d["interval"]       = d["progress"]["interval"]
        d["repetitions"]    = d["progress"]["repetitions"]
        d["lapses"]         = d["progress"]["lapses"]
        d["reviewed_count"] = d["progress"]["reviewed_count"]
        d["next_review"]    = d["progress"]["next_review"]
        words.append(d)

    return {"words": words, "count": len(words)}


@router.post("/progress/{word_id}")
async def record_review(
    word_id: str,
    req: ReviewRequest,
    current_user: dict = Depends(get_current_user),
):
    """Record a review result for a Core 3000 word and update SM-2 state."""
    user_id = current_user["sub"]
    quality = max(0, min(5, req.quality))

    async with db_manager.get_connection() as conn:
        # Verify word exists
        async with conn.execute(
            "SELECT id FROM core_words WHERE id = ?", (word_id,)
        ) as cur:
            if not await cur.fetchone():
                raise HTTPException(404, "Word not found")

        # Get existing progress (or create defaults)
        async with conn.execute(
            "SELECT * FROM user_core_progress WHERE user_id=? AND core_word_id=?",
            (user_id, word_id),
        ) as cur:
            prog = await cur.fetchone()

        if prog:
            p = dict(prog)
            ease   = float(p.get("ease_factor", 2.5))
            intv   = int(p.get("interval", 0))
            reps   = int(p.get("repetitions", 0))
            laps   = int(p.get("lapses", 0))
            rev_ct = int(p.get("reviewed_count", 0))
        else:
            ease = 2.5; intv = 0; reps = 0; laps = 0; rev_ct = 0

        new_ease, new_int, new_reps, new_laps, next_rev, status = _apply_sm2(
            ease, intv, reps, laps, quality
        )

        now_str     = _fmt_dt(datetime.utcnow())
        next_str    = _fmt_dt(next_rev)
        review_id   = str(uuid.uuid4())

        if prog:
            await conn.execute(
                """UPDATE user_core_progress SET
                     status=?, ease_factor=?, interval=?, repetitions=?,
                     lapses=?, reviewed_count=?, last_reviewed=?, next_review=?,
                     updated_at=?
                   WHERE user_id=? AND core_word_id=?""",
                (status, new_ease, new_int, new_reps, new_laps,
                 rev_ct + 1, now_str, next_str, now_str,
                 user_id, word_id),
            )
        else:
            await conn.execute(
                """INSERT INTO user_core_progress
                   (id, user_id, core_word_id, status, ease_factor, interval,
                    repetitions, lapses, reviewed_count, last_reviewed, next_review,
                    created_at, updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (str(uuid.uuid4()), user_id, word_id, status, new_ease, new_int,
                 new_reps, new_laps, rev_ct + 1, now_str, next_str,
                 now_str, now_str),
            )

        # Log review
        await conn.execute(
            """INSERT INTO core_word_reviews
               (id, user_id, core_word_id, quality, reviewed_at)
               VALUES (?,?,?,?,?)""",
            (review_id, user_id, word_id, quality, now_str),
        )

    return {
        "word_id":    word_id,
        "quality":    quality,
        "status":     status,
        "ease_factor": new_ease,
        "interval":   new_int,
        "next_review": next_str,
    }


@router.get("/progress")
async def get_user_progress(
    current_user: dict = Depends(get_current_user),
):
    """Return the current user's Core 3000 learning progress summary."""
    user_id = current_user["sub"]
    async with db_manager.get_connection() as conn:
        async with conn.execute(
            """SELECT
                 COUNT(DISTINCT ucp.core_word_id) as started,
                 COALESCE(SUM(CASE WHEN ucp.status='learning'  THEN 1 ELSE 0 END),0) as learning,
                 COALESCE(SUM(CASE WHEN ucp.status='reviewing' THEN 1 ELSE 0 END),0) as reviewing,
                 COALESCE(SUM(CASE WHEN ucp.status='learned'   THEN 1 ELSE 0 END),0) as learned,
                 COALESCE(SUM(CASE WHEN ucp.next_review <= datetime('now') AND ucp.status!='learned' THEN 1 ELSE 0 END),0) as due_now,
                 (SELECT COUNT(*) FROM core_words) as total_words
               FROM user_core_progress ucp
               WHERE ucp.user_id = ?""",
            (user_id,),
        ) as cur:
            row = dict(await cur.fetchone())

        # Per-level breakdown — driven by ALL core_words so every CEFR level is
        # always present with its true total, even before the user reviews
        # anything. User progress is LEFT-joined in (started/learned counts).
        async with conn.execute(
            """SELECT cw.level,
                      COUNT(*) AS total,
                      COALESCE(SUM(CASE WHEN ucp.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS started,
                      COALESCE(SUM(CASE WHEN ucp.status='learned' THEN 1 ELSE 0 END), 0) AS learned
               FROM core_words cw
               LEFT JOIN user_core_progress ucp
                 ON ucp.core_word_id = cw.id AND ucp.user_id = ?
               GROUP BY cw.level
               ORDER BY CASE cw.level
                          WHEN 'A1' THEN 1 WHEN 'A2' THEN 2 WHEN 'B1' THEN 3
                          WHEN 'B2' THEN 4 WHEN 'C1' THEN 5 ELSE 6 END""",
            (user_id,),
        ) as cur:
            level_rows = [dict(r) for r in await cur.fetchall()]

    return {
        "total_words":  row["total_words"],
        "started":      row["started"],
        "learning":     row["learning"],
        "reviewing":    row["reviewing"],
        "learned":      row["learned"],
        "due_now":      row["due_now"],
        "not_started":  row["total_words"] - row["started"],
        "by_level":     level_rows,
    }


@router.get("/stats")
async def get_library_stats():
    """Return overall library statistics (no auth required)."""
    async with db_manager.get_connection() as conn:
        async with conn.execute(
            """SELECT level, COUNT(*) as count
               FROM core_words GROUP BY level ORDER BY
               CASE level WHEN 'A1' THEN 1 WHEN 'A2' THEN 2 WHEN 'B1' THEN 3
               WHEN 'B2' THEN 4 WHEN 'C1' THEN 5 ELSE 6 END"""
        ) as cur:
            by_level = [dict(r) for r in await cur.fetchall()]

        async with conn.execute(
            "SELECT COUNT(*) as total FROM core_words"
        ) as cur:
            total = (await cur.fetchone())[0]

    return {"total": total, "by_level": by_level}


@router.get("/levels")
async def get_words_by_level(
    level: str = Query(..., description="CEFR level"),
    page:  int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
):
    """Get all words for a specific CEFR level."""
    return await list_core_words(
        search=None, level=level, pos=None,
        page=page, limit=limit, sort="freq",
        current_user=current_user,
    )



@router.get("/practice")
async def get_practice_words(
    limit: int         = Query(100, ge=10, le=400),
    level: Optional[str] = Query(None),
    mode:  str         = Query("smart", description="smart | new | review | random"),
    current_user: dict = Depends(get_current_user),
):
    """
    Get words for practice sessions (flashcards, quiz, games).
    Unlike /due, this returns ALL relevant words — not just overdue ones.
    
    Modes:
      smart  — SM-2 priority: due > learning > new (best for study)
      new    — only words not yet started (expanding vocabulary)
      review — only words in progress (reviewing existing knowledge)
      random — random shuffle across all words
    """
    user_id = current_user["sub"]

    level_filter = ""
    level_params: list = []
    if level:
        levels = [l.strip().upper() for l in level.split(",")]
        ph     = ",".join("?" * len(levels))
        level_filter = f"AND cw.level IN ({ph})"
        level_params = levels

    async with db_manager.get_connection() as conn:
        if mode == "new":
            # Words with no progress yet
            sql = f"""
                SELECT cw.*,
                       NULL as status, 2.5 as ease_factor, 0 as interval_,
                       0 as repetitions, 0 as lapses, 0 as reviewed_count,
                       NULL as last_reviewed, NULL as next_review
                FROM core_words cw
                WHERE NOT EXISTS (
                    SELECT 1 FROM user_core_progress ucp
                    WHERE ucp.core_word_id=cw.id AND ucp.user_id=?
                )
                {level_filter}
                ORDER BY cw.freq_rank ASC
                LIMIT ?
            """
            params = [user_id] + level_params + [limit]

        elif mode == "review":
            # Words already started
            sql = f"""
                SELECT cw.*,
                       ucp.status, ucp.ease_factor, ucp.interval as interval_,
                       ucp.repetitions, ucp.lapses, ucp.reviewed_count,
                       ucp.last_reviewed, ucp.next_review
                FROM core_words cw
                INNER JOIN user_core_progress ucp
                  ON ucp.core_word_id=cw.id AND ucp.user_id=?
                WHERE 1=1 {level_filter}
                ORDER BY
                  CASE ucp.status WHEN 'learning' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,
                  ucp.lapses DESC, ucp.next_review ASC
                LIMIT ?
            """
            params = [user_id] + level_params + [limit]

        elif mode == "random":
            sql = f"""
                SELECT cw.*,
                       ucp.status, ucp.ease_factor, ucp.interval as interval_,
                       ucp.repetitions, ucp.lapses, ucp.reviewed_count,
                       ucp.last_reviewed, ucp.next_review
                FROM core_words cw
                LEFT JOIN user_core_progress ucp
                  ON ucp.core_word_id=cw.id AND ucp.user_id=?
                WHERE 1=1 {level_filter}
                ORDER BY RANDOM()
                LIMIT ?
            """
            params = [user_id] + level_params + [limit]

        else:  # smart — due first, then learning, then new
            sql = f"""
                SELECT cw.*,
                       ucp.status, ucp.ease_factor, ucp.interval as interval_,
                       ucp.repetitions, ucp.lapses, ucp.reviewed_count,
                       ucp.last_reviewed, ucp.next_review
                FROM core_words cw
                LEFT JOIN user_core_progress ucp
                  ON ucp.core_word_id=cw.id AND ucp.user_id=?
                WHERE 1=1 {level_filter}
                ORDER BY
                  -- Due first
                  CASE WHEN ucp.next_review IS NULL OR ucp.next_review <= datetime('now')
                            AND (ucp.status IS NULL OR ucp.status != 'learned')
                       THEN 0 ELSE 1 END,
                  -- Then by status: learning > reviewing > new > learned
                  CASE COALESCE(ucp.status,'new')
                       WHEN 'learning'  THEN 0
                       WHEN 'reviewing' THEN 1
                       WHEN 'new'       THEN 2
                       ELSE 3
                  END,
                  -- Then by difficulty (most lapses first)
                  COALESCE(ucp.lapses, 0) DESC,
                  -- Then by frequency rank
                  cw.freq_rank ASC
                LIMIT ?
            """
            params = [user_id] + level_params + [limit]

        async with conn.execute(sql, params) as cur:
            rows = await cur.fetchall()

    words = []
    for row in rows:
        d = dict(row)
        # rename interval_ back to interval if needed
        if "interval_" in d:
            d["interval"] = d.pop("interval_")
        for f in ("synonyms", "antonyms", "collocations"):
            v = d.get(f)
            if isinstance(v, str):
                try: d[f] = json.loads(v)
                except: d[f] = []
        d["progress"] = {
            "status":         d.pop("status", None) or "new",
            "ease_factor":    d.pop("ease_factor", 2.5) or 2.5,
            "interval":       d.pop("interval", 0) or 0,
            "repetitions":    d.pop("repetitions", 0) or 0,
            "lapses":         d.pop("lapses", 0) or 0,
            "reviewed_count": d.pop("reviewed_count", 0) or 0,
            "last_reviewed":  d.pop("last_reviewed", None),
            "next_review":    d.pop("next_review", None),
        }
        # Flatten for frontend compatibility
        d["status"]         = d["progress"]["status"]
        d["ease_factor"]    = d["progress"]["ease_factor"]
        d["interval"]       = d["progress"]["interval"]
        d["repetitions"]    = d["progress"]["repetitions"]
        d["lapses"]         = d["progress"]["lapses"]
        d["reviewed_count"] = d["progress"]["reviewed_count"]
        d["next_review"]    = d["progress"]["next_review"]
        d["examples"]       = [d.get("example", "")] if d.get("example") else []
        d["is_core"]        = True
        words.append(d)

    return {"words": words, "count": len(words), "mode": mode}

def init_api(db):
    global db_manager
    db_manager = db
