"""
XP & Rewards System API.

XP Actions (server-authoritative amounts):
  save_word        +5    review_word      +3    review_perfect   +5
  game_correct     +4    game_complete    +10   pronunciation    +4
  chat_message     +1    watch_minute     +2    daily_login      +10
  game_spelling    +5    game_scramble    +4    game_matching    +3

POST /xp/add           — single action (online)
POST /xp/batch         — flush offline-queued actions (sync on reconnect)
GET  /xp/status        — current totals
"""

import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.app.api.auth import get_current_user

logger     = logging.getLogger(__name__)
router     = APIRouter()
db_manager = None

XP_ACTIONS = {
    "watch_minute":   2,
    "save_word":      5,
    "review_word":    3,
    "review_perfect": 5,
    "pronunciation":  4,
    "chat_message":   1,
    "daily_login":   10,
    # Games
    "game_correct":   4,
    "game_complete":  10,
    "game_spelling":  5,
    "game_scramble":  4,
    "game_matching":  3,
}

DAILY_GOAL_XP = 50


# ── Pydantic models ───────────────────────────────────────────────────────────

class AddXPRequest(BaseModel):
    action: str
    amount: Optional[int] = None


class BatchXPItem(BaseModel):
    action:      str
    amount:      Optional[int] = None
    occurred_at: Optional[str] = None   # ISO timestamp of when action happened


class BatchXPRequest(BaseModel):
    items: List[BatchXPItem]


# ── Core helper ───────────────────────────────────────────────────────────────

async def _apply_xp(conn, user_id: str, action: str, xp: int, occurred_at: str | None = None):
    """Add `xp` to user_id, update streak, log the action. Returns updated totals dict."""
    now   = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    today = datetime.utcnow().strftime("%Y-%m-%d")
    # Use occurred_at date for streak calculation when provided (offline actions)
    event_date = occurred_at[:10] if occurred_at else today

    async with conn.execute("SELECT * FROM user_xp WHERE user_id = ?", (user_id,)) as cur:
        row = await cur.fetchone()

    if row:
        data       = dict(row)
        total_xp   = data["total_xp"] + xp
        level      = total_xp // 100 + 1
        last_active = data.get("last_active_date", "")

        # Streak
        streak = data.get("streak_days", 0)
        yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
        if last_active == yesterday or last_active == event_date:
            if last_active != event_date:
                streak += 1
        elif last_active != today and last_active != event_date:
            streak = 1

        # Daily XP — always count toward today
        daily_xp = data.get("daily_xp", 0)
        if last_active == today:
            daily_xp += xp
        else:
            daily_xp = xp

        await conn.execute(
            """UPDATE user_xp
               SET total_xp=?, level=?, streak_days=?, daily_xp=?,
                   last_active_date=?, updated_at=?
               WHERE user_id=?""",
            (total_xp, level, streak, daily_xp, today, now, user_id),
        )
    else:
        total_xp = xp; level = 1; streak = 1; daily_xp = xp
        await conn.execute(
            """INSERT INTO user_xp
               (id, user_id, total_xp, level, streak_days, daily_xp, last_active_date, updated_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (str(uuid.uuid4()), user_id, total_xp, level, streak, daily_xp, today, now),
        )

    # Log action
    await conn.execute(
        "INSERT INTO xp_log (id, user_id, action, xp_earned, created_at) VALUES (?,?,?,?,?)",
        (str(uuid.uuid4()), user_id, action, xp, occurred_at or now),
    )

    return {
        "total_xp":      total_xp,
        "level":         level,
        "streak_days":   streak,
        "daily_xp":      daily_xp,
        "next_level_xp": level * 100,
        "progress":      total_xp % 100,
        "daily_goal":    DAILY_GOAL_XP,
        "daily_goal_met": daily_xp >= DAILY_GOAL_XP,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/add")
async def add_xp(req: AddXPRequest, current_user: dict = Depends(get_current_user)):
    """Award XP for a single online action."""
    user_id = current_user["sub"]
    xp = req.amount if req.amount is not None else XP_ACTIONS.get(req.action, 1)
    async with db_manager.get_connection() as conn:
        result = await _apply_xp(conn, user_id, req.action, xp)
    return {"xp_earned": xp, **result}


@router.post("/batch")
async def batch_xp(req: BatchXPRequest, current_user: dict = Depends(get_current_user)):
    """
    Flush a list of offline-queued XP actions in one request.
    Called automatically when the device comes back online.
    Returns total XP awarded and updated status.
    """
    user_id    = current_user["sub"]
    total_awarded = 0
    last_result   = None

    async with db_manager.get_connection() as conn:
        for item in req.items:
            xp = item.amount if item.amount is not None else XP_ACTIONS.get(item.action, 1)
            # Server-side cap: no single action can award > 50 XP (anti-cheat)
            xp = min(xp, 50)
            if xp <= 0:
                continue
            try:
                last_result   = await _apply_xp(conn, user_id, item.action, xp, item.occurred_at)
                total_awarded += xp
            except Exception as e:
                logger.warning(f"batch_xp item failed ({item.action}): {e}")

    if last_result is None:
        # Nothing processed — return current status
        return await _get_status(user_id)

    return {"total_xp_awarded": total_awarded, **last_result}


@router.get("/status")
async def get_xp_status(current_user: dict = Depends(get_current_user)):
    return await _get_status(current_user["sub"])


async def _get_status(user_id: str) -> dict:
    today = datetime.utcnow().strftime("%Y-%m-%d")
    async with db_manager.get_connection() as conn:
        async with conn.execute("SELECT * FROM user_xp WHERE user_id=?", (user_id,)) as cur:
            row = await cur.fetchone()
        # Count today's review actions so the client can tell whether the user
        # already practised today (used for accurate streak-warning reminders).
        async with conn.execute(
            """SELECT COUNT(*) FROM xp_log
               WHERE user_id=? AND action IN ('review_word','review_perfect')
                 AND substr(created_at,1,10)=?""",
            (user_id, today),
        ) as cur2:
            reviewed_today = (await cur2.fetchone())[0]

    if not row:
        return {
            "total_xp": 0, "level": 1, "streak_days": 0, "daily_xp": 0,
            "next_level_xp": 100, "progress": 0,
            "daily_goal": DAILY_GOAL_XP, "daily_goal_met": False,
            "reviewed_today": reviewed_today,
        }
    data  = dict(row)
    total = data["total_xp"]
    level = total // 100 + 1
    daily_xp = data.get("daily_xp", 0) if data.get("last_active_date") == today else 0
    return {
        "total_xp":      total,
        "level":         level,
        "streak_days":   data.get("streak_days", 0),
        "daily_xp":      daily_xp,
        "next_level_xp": level * 100,
        "progress":      total % 100,
        "daily_goal":    DAILY_GOAL_XP,
        "daily_goal_met": daily_xp >= DAILY_GOAL_XP,
        "reviewed_today": reviewed_today,
    }


def init_api(db):
    global db_manager
    db_manager = db
