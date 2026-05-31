"""
XP & Rewards System API.
Tracks user activity and awards experience points.

XP Actions:
  - Watch video (per minute):     +2 XP
  - Save a word:                  +5 XP
  - Review a word:                +3 XP
  - Perfect review (Easy):        +5 XP
  - Pronunciation practice:       +4 XP
  - AI chat message:              +1 XP
  - Daily login streak:           +10 XP

Levels: every 100 XP = 1 level
"""

import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from backend.app.api.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()
db_manager = None

# XP rewards per action
XP_ACTIONS = {
    "watch_minute": 2,
    "save_word": 5,
    "review_word": 3,
    "review_perfect": 5,
    "pronunciation": 4,
    "chat_message": 1,
    "daily_login": 10,
}


class AddXPRequest(BaseModel):
    action: str
    amount: Optional[int] = None


@router.post("/add")
async def add_xp(req: AddXPRequest, current_user: dict = Depends(get_current_user)):
    """Add XP for a user action."""
    user_id = current_user["sub"]
    action = req.action

    # Get XP amount
    xp = req.amount if req.amount is not None else XP_ACTIONS.get(action, 1)
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    today = datetime.utcnow().strftime("%Y-%m-%d")

    async with db_manager.get_connection() as conn:
        # Get or create user XP record
        async with conn.execute(
            "SELECT * FROM user_xp WHERE user_id = ?", (user_id,)
        ) as cur:
            row = await cur.fetchone()

        if row:
            data = dict(row)
            total_xp = data["total_xp"] + xp
            level = total_xp // 100 + 1
            last_active = data.get("last_active_date", "")

            # Streak logic
            streak = data.get("streak_days", 0)
            yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
            if last_active == yesterday:
                streak += 1
            elif last_active != today:
                streak = 1

            # Track best-ever streak (never decreases)
            longest_streak = max(int(data.get("longest_streak") or 0), streak)

            # Daily XP
            daily_xp = data.get("daily_xp", 0)
            if last_active == today:
                daily_xp += xp
            else:
                daily_xp = xp

            await conn.execute(
                """UPDATE user_xp SET total_xp = ?, level = ?, streak_days = ?,
                   longest_streak = ?, daily_xp = ?, last_active_date = ?, updated_at = ?
                   WHERE user_id = ?""",
                (total_xp, level, streak, longest_streak, daily_xp, today, now, user_id),
            )
        else:
            total_xp = xp
            level = 1
            streak = 1
            longest_streak = 1
            daily_xp = xp
            await conn.execute(
                """INSERT INTO user_xp
                   (id, user_id, total_xp, level, streak_days, longest_streak,
                    daily_xp, last_active_date, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (str(uuid.uuid4()), user_id, total_xp, level, streak,
                 longest_streak, daily_xp, today, now),
            )

        # Log the action
        await conn.execute(
            """INSERT INTO xp_log (id, user_id, action, xp_earned, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (str(uuid.uuid4()), user_id, action, xp, now),
        )

    # ── Achievement check ────────────────────────────────────────
    new_achievements: list = []
    try:
        from backend.app.services.achievements import check_and_unlock
        stats = await _build_user_stats_for_achievements(user_id, total_xp, level, streak)
        new_achievements = await check_and_unlock(db_manager, user_id, stats)
    except Exception as e:
        logger.warning(f"achievement check failed: {e}")

    return {
        "xp_earned": xp,
        "total_xp": total_xp,
        "level": level,
        "streak_days": streak,
        "longest_streak": longest_streak,
        "daily_xp": daily_xp,
        "next_level_xp": level * 100,
        "progress": total_xp % 100,
        "new_achievements": new_achievements,
    }


async def _build_user_stats_for_achievements(
    user_id: str, total_xp: int, level: int, streak: int
) -> dict:
    """Aggregate everything the achievement conditions might need."""
    async with db_manager.get_connection() as conn:
        async with conn.execute(
            """
            SELECT
                COUNT(*) AS total_saved,
                COALESCE(SUM(CASE WHEN mastery_score >= 80 THEN 1 ELSE 0 END), 0) AS mastered,
                COALESCE(SUM(reviewed_count), 0) AS total_reviews
            FROM saved_words WHERE (user_id = ? OR user_id = '')
            """, (user_id,),
        ) as cur:
            row = dict((await cur.fetchone()) or {})

        # Retention rate over last 30 days
        async with conn.execute(
            """
            SELECT
                COUNT(*) AS total,
                COALESCE(SUM(is_correct), 0) AS correct
            FROM quiz_attempts
            WHERE user_id = ? AND datetime(created_at) >= datetime('now','-30 days')
            """, (user_id,),
        ) as cur:
            r = dict((await cur.fetchone()) or {})
            total30 = int(r.get("total") or 0)
            correct30 = int(r.get("correct") or 0)

    return {
        "total_saved": int(row.get("total_saved") or 0),
        "mastered": int(row.get("mastered") or 0),
        "total_reviews": int(row.get("total_reviews") or 0),
        "level": level,
        "total_xp": total_xp,
        "streak_days": streak,
        "quiz_attempts_30d": total30,
        "retention_rate_30d": (correct30 / total30) if total30 else 0,
    }


@router.get("/status")
async def get_xp_status(current_user: dict = Depends(get_current_user)):
    """Get user's XP status."""
    user_id = current_user["sub"]

    async with db_manager.get_connection() as conn:
        async with conn.execute(
            "SELECT * FROM user_xp WHERE user_id = ?", (user_id,)
        ) as cur:
            row = await cur.fetchone()

    if not row:
        return {
            "total_xp": 0, "level": 1, "streak_days": 0,
            "daily_xp": 0, "next_level_xp": 100, "progress": 0,
        }

    data = dict(row)
    total = data["total_xp"]
    level = total // 100 + 1

    return {
        "total_xp": total,
        "level": level,
        "streak_days": data.get("streak_days", 0),
        "longest_streak": data.get("longest_streak", 0),
        "daily_xp": data.get("daily_xp", 0),
        "next_level_xp": level * 100,
        "progress": total % 100,
    }


@router.get("/achievements")
async def list_achievements(current_user: dict = Depends(get_current_user)):
    """Full achievement catalogue with the current user's unlock state."""
    from backend.app.services.achievements import list_user_achievements
    return await list_user_achievements(db_manager, current_user["sub"])


def init_api(db):
    global db_manager
    db_manager = db
