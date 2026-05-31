"""
Smart Review System API.

Endpoints
---------
POST  /review/session/start     → build an interleaved quiz session
POST  /review/session/answer    → record a quiz answer (with error analysis)
POST  /review/flashcard/rate    → rate a flashcard (Again/Hard/Good/Easy)
GET   /review/dashboard         → analytics dashboard
GET   /review/daily             → today's plan
GET   /review/forecast          → upcoming review load (next 14 days)
"""

from __future__ import annotations

import logging
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from backend.app.api.auth import get_current_user
from backend.app.services.srs import MasteryCalculator
from backend.app.services.quiz import QuizGenerator, ErrorAnalyzer

logger = logging.getLogger(__name__)

router = APIRouter()
db_manager = None


# ── Schemas ─────────────────────────────────────────────────────────────

class StartSessionRequest(BaseModel):
    max_questions: int = Field(10, ge=1, le=40)
    include_new: bool = True
    focus_difficult: bool = False  # weight leeches / low-mastery higher
    include_all: bool = False      # ignore SRS due dates → practice any saved word
    sort: str = Field("smart", pattern="^(smart|random|weakest|newest|oldest)$")


class AnswerRequest(BaseModel):
    saved_word_id: str
    question_type: str
    is_correct: bool
    picked_label: Optional[str] = None
    response_ms: int = 0
    rate_card: bool = True  # also apply FSRS update from this answer


class FlashcardRateRequest(BaseModel):
    saved_word_id: str
    rating: int = Field(..., ge=1, le=4)  # FSRS rating: 1=Again .. 4=Easy
    response_ms: int = 0


# Internal: legacy 1..4 → 0..5 quality bridge for update_review()
_RATING_TO_QUALITY = {1: 0, 2: 2, 3: 3, 4: 5}


# ── Helpers ─────────────────────────────────────────────────────────────

async def _enriched_pool(user_id: str, limit: int = 300) -> List[Dict[str, Any]]:
    """Get the user's saved words pool (for distractor mining)."""
    return await db_manager.get_saved_words(limit=limit, page=1, user_id=user_id)


async def _due_target_words(user_id: str, max_questions: int, focus_difficult: bool) -> List[Dict[str, Any]]:
    due = await db_manager.get_due_words(limit=max_questions * 3, user_id=user_id)
    if focus_difficult:
        due.sort(
            key=lambda w: (
                -(int(w.get("is_leech") or 0)),
                int(w.get("mastery_score") or 0),
                -int(w.get("lapses") or 0),
            )
        )
    return due[:max_questions]


async def _all_target_words(
    user_id: str,
    max_questions: int,
    *,
    focus_difficult: bool = False,
    sort: str = "smart",
) -> List[Dict[str, Any]]:
    """
    Practice mode: ignore the SRS due date entirely.

    Lets the user drill any saved word right now — useful when:
      • all cards are scheduled for the future
      • they explicitly want extra practice on something
      • they're cramming before a test / lesson
    """
    # Pull a generous superset; we'll trim & shuffle below
    pool = await db_manager.get_saved_words(
        limit=max(max_questions * 6, 60),
        page=1,
        user_id=user_id,
        sort="next_review",  # underlying SQL sort; we re-rank below
    )
    if not pool:
        return []

    if focus_difficult:
        # Weakest mastery + most lapses first
        pool.sort(
            key=lambda w: (
                -(int(w.get("is_leech") or 0)),
                int(w.get("mastery_score") or 0),
                -int(w.get("lapses") or 0),
            )
        )
    elif sort == "random":
        import random
        random.shuffle(pool)
    elif sort == "weakest":
        pool.sort(key=lambda w: int(w.get("mastery_score") or 0))
    elif sort == "newest":
        pool.sort(key=lambda w: w.get("created_at") or "", reverse=True)
    elif sort == "oldest":
        pool.sort(key=lambda w: w.get("created_at") or "")
    else:
        # "smart": prioritise words whose interval has elapsed the most
        # (true overdue first), then those with the lowest mastery.
        from datetime import datetime
        now = datetime.utcnow()

        def overdue_seconds(w):
            nr = w.get("next_review")
            if not nr:
                return 1e12  # never reviewed → top priority
            try:
                dt = datetime.strptime(str(nr).replace("T", " ")[:19], "%Y-%m-%d %H:%M:%S")
                return (now - dt).total_seconds()
            except Exception:
                return 0
        pool.sort(key=lambda w: (-overdue_seconds(w), int(w.get("mastery_score") or 0)))

    return pool[:max_questions]


# ── Endpoints ───────────────────────────────────────────────────────────

@router.post("/session/start")
async def start_session(
    req: StartSessionRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Build a fresh interleaved quiz session for the current user.

    Two modes:
      • default            — only words that are due per the SRS schedule.
      • include_all=True   — practice mode: any saved word, ignoring due dates.
    """
    uid = current_user["sub"]

    if req.include_all:
        targets = await _all_target_words(
            uid, req.max_questions,
            focus_difficult=req.focus_difficult,
            sort=req.sort,
        )
        if not targets:
            return {
                "session": None,
                "message": "ليس لديك أي كلمات محفوظة بعد. ابدأ بحفظ كلمات من الفيديو أو القارئ.",
                "mode": "practice",
            }
        mode_label = "practice"
    else:
        targets = await _due_target_words(uid, req.max_questions, req.focus_difficult)
        if not targets:
            # Check if any saved words exist at all (helpful hint for the UI)
            summary = await db_manager.get_review_summary(uid)
            has_any = (summary.get("total_saved") or 0) > 0
            return {
                "session": None,
                "message": (
                    "لا توجد كلمات مستحقة للمراجعة الآن — يمكنك استعمال وضع الممارسة لمراجعة أي كلمة."
                    if has_any else
                    "لا توجد كلمات محفوظة بعد. ابدأ بإضافة كلمات من الفيديو أو القارئ."
                ),
                "can_practice": has_any,
                "summary": summary,
                "mode": "due",
            }
        mode_label = "due"

    pool = await _enriched_pool(uid)
    gen = QuizGenerator()
    session = gen.build_session(targets, pool, max_questions=req.max_questions)

    return {
        "session": session.to_dict(),
        "summary": await db_manager.get_review_summary(uid),
        "mode": mode_label,
    }


@router.post("/session/answer")
async def submit_answer(req: AnswerRequest, current_user: dict = Depends(get_current_user)):
    """Record a single quiz answer + (optionally) update FSRS state."""
    uid = current_user["sub"]
    saved = await db_manager.get_saved_word(req.saved_word_id)
    if not saved:
        raise HTTPException(status_code=404, detail="Saved word not found")

    # 1) Classify error if wrong
    error_type = error_reason = None
    if not req.is_correct:
        classification = ErrorAnalyzer.classify(
            target_word=saved,
            picked_label=req.picked_label,
            question_type=req.question_type,
            response_ms=req.response_ms,
        )
        error_type = classification.type.value
        error_reason = classification.reason

    # 2) Persist the attempt
    attempt_id = await db_manager.record_quiz_attempt(
        saved_word_id=req.saved_word_id,
        user_id=uid,
        question_type=req.question_type,
        is_correct=req.is_correct,
        response_ms=req.response_ms,
        picked_label=req.picked_label,
        error_type=error_type,
        error_reason=error_reason,
    )

    # 3) Optionally drive FSRS from the answer (recommended)
    updated_word = None
    if req.rate_card:
        # Map quiz outcome → FSRS rating heuristically
        if not req.is_correct:
            rating = 1   # Again
        elif req.response_ms > 8000:
            rating = 2   # Hard (correct but slow)
        elif req.response_ms < 3000:
            rating = 4   # Easy
        else:
            rating = 3   # Good
        quality = _RATING_TO_QUALITY[rating]
        updated_word = await db_manager.update_review(
            req.saved_word_id, quality,
            response_ms=req.response_ms,
            review_type="quiz",
            is_correct=req.is_correct,
        )

    return {
        "attempt_id": attempt_id,
        "is_correct": req.is_correct,
        "error_type": error_type,
        "error_reason": error_reason,
        "word": updated_word,
    }


@router.post("/flashcard/rate")
async def rate_flashcard(req: FlashcardRateRequest, current_user: dict = Depends(get_current_user)):
    """Rate a flashcard with the Anki-style Again/Hard/Good/Easy buttons."""
    saved = await db_manager.get_saved_word(req.saved_word_id)
    if not saved:
        raise HTTPException(status_code=404, detail="Saved word not found")

    quality = _RATING_TO_QUALITY[req.rating]
    is_correct = req.rating >= 3
    updated = await db_manager.update_review(
        req.saved_word_id, quality,
        response_ms=req.response_ms,
        review_type="flashcard",
        is_correct=is_correct,
    )
    summary = await db_manager.get_review_summary(current_user["sub"])
    return {"word": updated, "summary": summary}


@router.get("/dashboard")
async def dashboard(current_user: dict = Depends(get_current_user)):
    """Rich analytics dashboard for the Review screen."""
    uid = current_user["sub"]
    stats = await _aggregate_stats(uid)
    errors = await db_manager.get_error_analytics(uid, days=30)
    forecast = await _forecast(uid, days=14)
    retention = await _retention_rate(uid, days=30)
    return {
        "stats": stats,
        "errors": errors,
        "forecast": forecast,
        "retention_rate": retention,
    }


@router.get("/daily")
async def daily_plan(current_user: dict = Depends(get_current_user)):
    """A balanced daily review plan: due now + new + leech recovery."""
    uid = current_user["sub"]
    summary = await db_manager.get_review_summary(uid)
    due = await db_manager.get_due_words(limit=30, user_id=uid)

    # Pick a few leeches to mix in
    pool = await db_manager.get_saved_words(limit=300, page=1, user_id=uid)
    leeches = [w for w in pool if w.get("is_leech")][:5]

    return {
        "summary": summary,
        "due_count": len(due),
        "recommended": due[:20],
        "leeches": leeches,
        "estimated_minutes": max(1, round(len(due[:20]) * 0.5)),
    }


@router.get("/forecast")
async def forecast(days: int = Query(14, ge=1, le=60), current_user: dict = Depends(get_current_user)):
    """How many reviews fall on each of the next N days."""
    return await _forecast(current_user["sub"], days=days)


# ── Aggregations ────────────────────────────────────────────────────────

async def _aggregate_stats(uid: str) -> Dict[str, Any]:
    async with db_manager.get_connection() as conn:
        async with conn.execute(
            """
            SELECT
              COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN stage = 'mastered' THEN 1 ELSE 0 END), 0) AS mastered,
              COALESCE(SUM(CASE WHEN stage = 'familiar' THEN 1 ELSE 0 END), 0) AS familiar,
              COALESCE(SUM(CASE WHEN stage = 'learning' THEN 1 ELSE 0 END), 0) AS learning,
              COALESCE(SUM(CASE WHEN stage = 'new' OR stage IS NULL THEN 1 ELSE 0 END), 0) AS new_count,
              COALESCE(SUM(CASE WHEN is_leech = 1 THEN 1 ELSE 0 END), 0) AS leeches,
              COALESCE(AVG(mastery_score), 0) AS avg_mastery,
              COALESCE(AVG(avg_response_ms), 0) AS avg_response_ms
            FROM saved_words WHERE (user_id = ? OR user_id = '')
            """, (uid,),
        ) as cur:
            row = dict((await cur.fetchone()) or {})

        # Last 7 days new words & reviews per day
        async with conn.execute(
            """
            SELECT date(replace(substr(created_at,1,19),'T',' ')) AS day, COUNT(*) AS n
            FROM saved_words
            WHERE (user_id = ? OR user_id = '')
              AND datetime(replace(substr(created_at,1,19),'T',' ')) >= datetime('now','-7 days')
            GROUP BY day ORDER BY day
            """, (uid,),
        ) as cur:
            row["new_per_day_7d"] = {dict(r)["day"]: dict(r)["n"] for r in await cur.fetchall()}

        async with conn.execute(
            """
            SELECT date(replace(substr(reviewed_at,1,19),'T',' ')) AS day, COUNT(*) AS n
            FROM word_reviews
            WHERE datetime(replace(substr(reviewed_at,1,19),'T',' ')) >= datetime('now','-7 days')
            GROUP BY day ORDER BY day
            """,
        ) as cur:
            row["reviews_per_day_7d"] = {dict(r)["day"]: dict(r)["n"] for r in await cur.fetchall()}

    return row


async def _forecast(uid: str, days: int = 14) -> Dict[str, Any]:
    async with db_manager.get_connection() as conn:
        async with conn.execute(
            """
            SELECT date(replace(substr(next_review,1,19),'T',' ')) AS day, COUNT(*) AS n
            FROM saved_words
            WHERE (user_id = ? OR user_id = '')
              AND next_review IS NOT NULL
              AND datetime(replace(substr(next_review,1,19),'T',' ')) BETWEEN datetime('now') AND datetime('now', ?)
            GROUP BY day ORDER BY day
            """, (uid, f"+{int(days)} days"),
        ) as cur:
            rows = await cur.fetchall()
    return {"days": days, "per_day": {dict(r)["day"]: dict(r)["n"] for r in rows}}


async def _retention_rate(uid: str, days: int = 30) -> Dict[str, Any]:
    """Retention = correct / total in the last N days."""
    async with db_manager.get_connection() as conn:
        async with conn.execute(
            """
            SELECT
              COALESCE(SUM(is_correct), 0) AS correct,
              COUNT(*) AS total
            FROM quiz_attempts
            WHERE user_id = ?
              AND datetime(created_at) >= datetime('now', ?)
            """, (uid, f"-{int(days)} days"),
        ) as cur:
            row = dict((await cur.fetchone()) or {})
        total = int(row.get("total") or 0)
        correct = int(row.get("correct") or 0)
        rate = (correct / total) if total else 0.0

        # Also include rating-based retention (>=3 considered remembered) for flashcards
        async with conn.execute(
            """
            SELECT
              COUNT(*) AS total,
              SUM(CASE WHEN quality >= 3 THEN 1 ELSE 0 END) AS remembered
            FROM word_reviews
            WHERE datetime(replace(substr(reviewed_at,1,19),'T',' ')) >= datetime('now', ?)
            """, (f"-{int(days)} days",),
        ) as cur:
            r2 = dict((await cur.fetchone()) or {})
        t2 = int(r2.get("total") or 0)
        r2_rate = (int(r2.get("remembered") or 0) / t2) if t2 else 0.0

    return {
        "window_days": days,
        "quiz_accuracy": round(rate, 3),
        "flashcard_recall": round(r2_rate, 3),
        "quiz_attempts": total,
    }


def init_api(db):
    global db_manager
    db_manager = db
