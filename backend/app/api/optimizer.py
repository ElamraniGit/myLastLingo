"""
FSRS-Optimizer + Adaptive Intro + Heatmap API.

Endpoints
---------
  POST /v3/optimizer/run        → run a tune pass on the user's history
  GET  /v3/optimizer/status     → current tuned weights + sample size
  POST /v3/optimizer/reset      → drop tuning, revert to defaults

  GET  /v3/intro/settings       → adaptive intro settings + today's count
  PATCH /v3/intro/settings      → update target / auto-adjust
  GET  /v3/intro/recommendation → suggested next batch size for *now*

  GET  /v3/activity/heatmap     → daily activity for the last N days
                                   (default 365 — yearly heatmap)
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from backend.app.api.auth import get_current_user
from backend.app.services.srs import optimizer as srs_opt

logger = logging.getLogger(__name__)

router = APIRouter()
db_manager = None


# ────────────────────────────────────────────────────────────────────
#  Schemas
# ────────────────────────────────────────────────────────────────────

class IntroSettingsRequest(BaseModel):
    daily_new_target: Optional[int] = Field(None, ge=1, le=50)
    auto_adjust: Optional[bool] = None


# ────────────────────────────────────────────────────────────────────
#  FSRS-Optimizer
# ────────────────────────────────────────────────────────────────────

@router.post("/optimizer/run")
async def run_optimizer(current_user: dict = Depends(get_current_user)):
    """Re-tune the user's FSRS weights from their full review history."""
    uid = current_user["sub"]
    records = await srs_opt.build_records_from_db(db_manager, uid, limit=2000)
    result = srs_opt.optimize(records)

    if result.converged:
        await db_manager.save_user_fsrs_params(
            uid,
            weights=result.weights,
            request_retention=result.request_retention,
            sample_size=result.sample_size,
            improvement_pct=result.improvement_pct,
        )

    return {
        "sample_size": result.sample_size,
        "converged": result.converged,
        "baseline_loss": round(result.baseline_loss, 4),
        "optimized_loss": round(result.optimized_loss, 4),
        "improvement_pct": round(result.improvement_pct, 2),
        "request_retention": result.request_retention,
        "weights": result.weights,
        "notes": result.notes,
    }


@router.get("/optimizer/status")
async def optimizer_status(current_user: dict = Depends(get_current_user)):
    """Returns the user's currently active tuned params (or null if defaults)."""
    uid = current_user["sub"]
    params = await db_manager.get_user_fsrs_params(uid)
    if not params:
        return {
            "is_tuned": False,
            "message": "تستخدم الأوزان الافتراضية لـ FSRS. شغّل المُحسِّن لضبطها على بياناتك.",
        }
    return {
        "is_tuned": True,
        "sample_size": params.get("sample_size"),
        "improvement_pct": params.get("improvement_pct"),
        "request_retention": params.get("request_retention"),
        "weights": params.get("weights", {}),
        "updated_at": params.get("updated_at"),
    }


@router.post("/optimizer/reset")
async def optimizer_reset(current_user: dict = Depends(get_current_user)):
    """Drop the user's tuned weights so future reviews use FSRS defaults."""
    await db_manager.reset_user_fsrs_params(current_user["sub"])
    return {"ok": True, "message": "تم استعادة الأوزان الافتراضية."}


# ────────────────────────────────────────────────────────────────────
#  Adaptive new-word introduction
# ────────────────────────────────────────────────────────────────────

# Heuristic constants (research-backed defaults).
MIN_DAILY_NEW = 1
MAX_DAILY_NEW = 30
# Workload soft-cap: if due_count > this, recommend fewer new words today.
DUE_LOAD_THRESHOLD = 50


@router.get("/intro/settings")
async def get_intro_settings(current_user: dict = Depends(get_current_user)):
    """Current intro target + how many new words the user has added today."""
    uid = current_user["sub"]
    s = await db_manager.get_intro_settings(uid)
    today = datetime.utcnow().strftime("%Y-%m-%d")
    if s.get("last_introduced_date") != today:
        s["last_introduced_today"] = 0
    return {
        "daily_new_target": s["daily_new_target"],
        "auto_adjust": s["auto_adjust"],
        "introduced_today": s.get("last_introduced_today", 0),
        "remaining_today": max(0, s["daily_new_target"] - s.get("last_introduced_today", 0)),
    }


@router.patch("/intro/settings")
async def patch_intro_settings(
    req: IntroSettingsRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update target / auto-adjust toggle."""
    uid = current_user["sub"]
    await db_manager.save_intro_settings(
        uid,
        daily_new_target=req.daily_new_target,
        auto_adjust=req.auto_adjust,
    )
    return await get_intro_settings(current_user=current_user)


@router.get("/intro/recommendation")
async def intro_recommendation(current_user: dict = Depends(get_current_user)):
    """
    How many new words should the user introduce *right now*?

    Logic
    -----
    Base = the user's daily_new_target.
    Then we adjust based on:
      • Due-words workload  — too many reviews → recommend fewer new
      • Recent retention    — strong retention (>92%) → allow more
                              weak retention (<70%) → recommend fewer
      • Today's pace        — already at target? → recommend 0
    Returns a clamped suggestion + per-step explanation.
    """
    uid = current_user["sub"]
    settings = await db_manager.get_intro_settings(uid)
    target = int(settings.get("daily_new_target", 5))
    introduced = int(settings.get("last_introduced_today") or 0)
    today = datetime.utcnow().strftime("%Y-%m-%d")
    if settings.get("last_introduced_date") != today:
        introduced = 0

    notes: List[str] = []
    suggested = max(0, target - introduced)
    base = suggested

    auto_adjust = bool(settings.get("auto_adjust", True))

    if auto_adjust:
        # Due-words workload
        summary = await db_manager.get_review_summary(uid)
        due = int(summary.get("due_now") or 0)
        if due > DUE_LOAD_THRESHOLD:
            penalty = min(suggested, max(1, (due - DUE_LOAD_THRESHOLD) // 10))
            suggested = max(0, suggested - penalty)
            notes.append(f"📚 لديك {due} مراجعة مستحقة — تقليل {penalty} كلمة جديدة لتخفيف الحمل.")

        # Recent retention (last 30 days)
        analytics = await db_manager.get_error_analytics(uid, days=30)
        # Use error-analytics indirectly: too many recent errors ⇒ shrink.
        recent_errors = sum(int(b.get("n") or 0) for b in (analytics.get("by_type") or []))
        if recent_errors > 30:
            shrink = min(suggested, recent_errors // 20)
            if shrink > 0:
                suggested = max(0, suggested - shrink)
                notes.append(f"⚠️ أخطاء كثيرة مؤخراً ({recent_errors}) — تقليل {shrink} كلمة جديدة لتعزيز ما لديك.")

    if introduced >= target:
        notes.append(f"✅ أكملت هدفك اليومي ({target} كلمات). أحسنت!")
        suggested = 0
    else:
        notes.append(f"🎯 هدفك اليومي: {target} | أضفت اليوم: {introduced} | المقترح الآن: {suggested}")

    return {
        "target": target,
        "introduced_today": introduced,
        "base_remaining": base,
        "suggested_now": min(MAX_DAILY_NEW, max(0, suggested)),
        "notes": notes,
        "auto_adjust_active": auto_adjust,
    }


# ────────────────────────────────────────────────────────────────────
#  Yearly activity heatmap
# ────────────────────────────────────────────────────────────────────

@router.get("/activity/heatmap")
async def activity_heatmap(
    days: int = Query(365, ge=7, le=730),
    current_user: dict = Depends(get_current_user),
):
    """
    Daily activity for the last N days (default = year).

    Response shape is GitHub-style: a flat list of `{ day, reviews,
    new_words, correct, intensity }` ordered chronologically. The
    frontend bins this into weeks for the heatmap grid.
    """
    uid = current_user["sub"]
    today = datetime.utcnow().date()
    from_dt = today - timedelta(days=days - 1)

    rows = await db_manager.get_daily_activity_range(
        uid,
        from_day=from_dt.strftime("%Y-%m-%d"),
        to_day=today.strftime("%Y-%m-%d"),
    )
    by_day = {r["day"]: r for r in rows}

    # Build full list (fills gaps with zeros so the heatmap has every cell)
    out: List[Dict[str, Any]] = []
    max_total = 0
    for i in range(days):
        d = from_dt + timedelta(days=i)
        key = d.strftime("%Y-%m-%d")
        r = by_day.get(key, {})
        reviews = int(r.get("reviews_count") or 0)
        new_words = int(r.get("new_words_count") or 0)
        total = reviews + new_words
        if total > max_total:
            max_total = total
        out.append({
            "day": key,
            "reviews": reviews,
            "new_words": new_words,
            "correct": int(r.get("correct_count") or 0),
            "total": total,
        })

    # Intensity bucket 0..4 (GitHub-style)
    def bucket(total: int) -> int:
        if total == 0:
            return 0
        if max_total == 0:
            return 0
        ratio = total / max_total
        if ratio <= 0.25:
            return 1
        if ratio <= 0.5:
            return 2
        if ratio <= 0.75:
            return 3
        return 4

    for d in out:
        d["intensity"] = bucket(d["total"])

    # Aggregates
    total_reviews = sum(d["reviews"] for d in out)
    total_new = sum(d["new_words"] for d in out)
    active_days = sum(1 for d in out if d["total"] > 0)
    longest_streak = _longest_streak(out)
    current_streak = _current_streak(out)

    return {
        "days": days,
        "from": from_dt.strftime("%Y-%m-%d"),
        "to": today.strftime("%Y-%m-%d"),
        "total_reviews": total_reviews,
        "total_new_words": total_new,
        "active_days": active_days,
        "longest_streak": longest_streak,
        "current_streak": current_streak,
        "cells": out,
    }


def _longest_streak(cells: List[Dict[str, Any]]) -> int:
    best = current = 0
    for c in cells:
        if c["total"] > 0:
            current += 1
            best = max(best, current)
        else:
            current = 0
    return best


def _current_streak(cells: List[Dict[str, Any]]) -> int:
    streak = 0
    for c in reversed(cells):
        if c["total"] > 0:
            streak += 1
        else:
            break
    return streak


def init_api(db):
    global db_manager
    db_manager = db
