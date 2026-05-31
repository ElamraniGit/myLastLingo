"""
Achievement system — pure-data definitions and a single async checker.

We deliberately keep the achievement list as a Python constant (not a DB
table) so deploying new achievements is just a code change, and so the
list is queryable without hitting the DB.

How it works
------------
After any meaningful user event (review answered, word saved, streak
updated …), call `check_and_unlock(db, user_id, stats)` with the latest
user stats. The function computes which achievements the user has just
earned (and weren't yet unlocked), inserts them, and returns the list of
newly-unlocked ones so the UI can celebrate.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Dict, Any, List, Optional


@dataclass(frozen=True)
class Achievement:
    id: str
    title_ar: str
    title_en: str
    description_ar: str
    icon: str        # emoji
    tier: str        # 'bronze' | 'silver' | 'gold' | 'legendary'
    xp_reward: int
    # condition(stats) -> bool
    condition: Callable[[Dict[str, Any]], bool]


# ────────────────────────────────────────────────────────────────────
#  Achievement catalogue
# ────────────────────────────────────────────────────────────────────

ACHIEVEMENTS: List[Achievement] = [
    # ── First steps ──────────────────────────────────────────────
    Achievement(
        id="first_word",
        title_ar="الكلمة الأولى",
        title_en="First Word",
        description_ar="احفظ أول كلمة في قاموسك",
        icon="🌱",
        tier="bronze",
        xp_reward=10,
        condition=lambda s: s.get("total_saved", 0) >= 1,
    ),
    Achievement(
        id="first_review",
        title_ar="أول مراجعة",
        title_en="First Review",
        description_ar="راجع كلمتك الأولى",
        icon="📖",
        tier="bronze",
        xp_reward=10,
        condition=lambda s: s.get("total_reviews", 0) >= 1,
    ),
    # ── Vocabulary milestones ────────────────────────────────────
    Achievement(
        id="vocab_10",
        title_ar="مبتدئ",
        title_en="Novice",
        description_ar="احفظ 10 كلمات",
        icon="📗",
        tier="bronze",
        xp_reward=25,
        condition=lambda s: s.get("total_saved", 0) >= 10,
    ),
    Achievement(
        id="vocab_50",
        title_ar="هاوٍ",
        title_en="Apprentice",
        description_ar="احفظ 50 كلمة",
        icon="📘",
        tier="silver",
        xp_reward=50,
        condition=lambda s: s.get("total_saved", 0) >= 50,
    ),
    Achievement(
        id="vocab_100",
        title_ar="عاشق اللغة",
        title_en="Wordsmith",
        description_ar="احفظ 100 كلمة",
        icon="📕",
        tier="gold",
        xp_reward=100,
        condition=lambda s: s.get("total_saved", 0) >= 100,
    ),
    Achievement(
        id="vocab_500",
        title_ar="خبير المفردات",
        title_en="Vocabulary Master",
        description_ar="احفظ 500 كلمة",
        icon="🏆",
        tier="legendary",
        xp_reward=500,
        condition=lambda s: s.get("total_saved", 0) >= 500,
    ),
    # ── Mastered words ───────────────────────────────────────────
    Achievement(
        id="mastered_10",
        title_ar="أتقنت 10",
        title_en="Mastered 10",
        description_ar="أتقن 10 كلمات (Mastery ≥ 80)",
        icon="✨",
        tier="silver",
        xp_reward=50,
        condition=lambda s: s.get("mastered", 0) >= 10,
    ),
    Achievement(
        id="mastered_50",
        title_ar="أتقنت 50",
        title_en="Mastered 50",
        description_ar="أتقن 50 كلمة",
        icon="💎",
        tier="gold",
        xp_reward=150,
        condition=lambda s: s.get("mastered", 0) >= 50,
    ),
    # ── Streaks ──────────────────────────────────────────────────
    Achievement(
        id="streak_3",
        title_ar="3 أيام متتالية",
        title_en="3-Day Streak",
        description_ar="راجع 3 أيام متتالية",
        icon="🔥",
        tier="bronze",
        xp_reward=20,
        condition=lambda s: s.get("streak_days", 0) >= 3,
    ),
    Achievement(
        id="streak_7",
        title_ar="أسبوع كامل",
        title_en="Full Week",
        description_ar="راجع 7 أيام متتالية",
        icon="🔥",
        tier="silver",
        xp_reward=50,
        condition=lambda s: s.get("streak_days", 0) >= 7,
    ),
    Achievement(
        id="streak_30",
        title_ar="شهر من المثابرة",
        title_en="30-Day Streak",
        description_ar="راجع 30 يوماً متتالياً",
        icon="🏅",
        tier="gold",
        xp_reward=200,
        condition=lambda s: s.get("streak_days", 0) >= 30,
    ),
    Achievement(
        id="streak_100",
        title_ar="100 يوم!",
        title_en="Century",
        description_ar="راجع 100 يوم متتالٍ",
        icon="👑",
        tier="legendary",
        xp_reward=1000,
        condition=lambda s: s.get("streak_days", 0) >= 100,
    ),
    # ── Accuracy ─────────────────────────────────────────────────
    Achievement(
        id="perfect_session",
        title_ar="جلسة مثالية",
        title_en="Perfect Session",
        description_ar="أكمل جلسة مراجعة بنسبة 100%",
        icon="🎯",
        tier="silver",
        xp_reward=40,
        condition=lambda s: s.get("had_perfect_session", False),
    ),
    Achievement(
        id="retention_90",
        title_ar="ذاكرة فولاذية",
        title_en="Steel Memory",
        description_ar="حافظ على معدل احتفاظ ≥ 90% (آخر 30 يوم، 30 محاولة على الأقل)",
        icon="🧠",
        tier="gold",
        xp_reward=150,
        condition=lambda s: (
            s.get("quiz_attempts_30d", 0) >= 30
            and s.get("retention_rate_30d", 0) >= 0.90
        ),
    ),
    # ── Volume ───────────────────────────────────────────────────
    Achievement(
        id="reviews_100",
        title_ar="100 مراجعة",
        title_en="100 Reviews",
        description_ar="أكمل 100 مراجعة",
        icon="📚",
        tier="silver",
        xp_reward=50,
        condition=lambda s: s.get("total_reviews", 0) >= 100,
    ),
    Achievement(
        id="reviews_1000",
        title_ar="1000 مراجعة!",
        title_en="1000 Reviews",
        description_ar="أكمل 1000 مراجعة",
        icon="🌟",
        tier="legendary",
        xp_reward=500,
        condition=lambda s: s.get("total_reviews", 0) >= 1000,
    ),
    # ── XP / Level ───────────────────────────────────────────────
    Achievement(
        id="level_10",
        title_ar="المستوى 10",
        title_en="Level 10",
        description_ar="ابلغ المستوى 10",
        icon="⭐",
        tier="silver",
        xp_reward=50,
        condition=lambda s: s.get("level", 1) >= 10,
    ),
    Achievement(
        id="level_50",
        title_ar="المستوى 50",
        title_en="Level 50",
        description_ar="ابلغ المستوى 50",
        icon="🌟",
        tier="gold",
        xp_reward=300,
        condition=lambda s: s.get("level", 1) >= 50,
    ),
]


# ────────────────────────────────────────────────────────────────────
#  Public API
# ────────────────────────────────────────────────────────────────────

def to_dict(a: Achievement, unlocked: bool, unlocked_at: Optional[str] = None) -> Dict[str, Any]:
    return {
        "id": a.id,
        "title": a.title_ar,
        "title_en": a.title_en,
        "description": a.description_ar,
        "icon": a.icon,
        "tier": a.tier,
        "xp_reward": a.xp_reward,
        "unlocked": unlocked,
        "unlocked_at": unlocked_at,
    }


async def check_and_unlock(
    db_manager,
    user_id: str,
    stats: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Insert any newly-earned achievements for the user.
    Returns the list of *new* unlocks (so the UI can show a toast).
    """
    if not user_id:
        return []

    import uuid as _uuid

    async with db_manager.get_connection() as conn:
        async with conn.execute(
            "SELECT achievement_id FROM user_achievements WHERE user_id = ?",
            (user_id,),
        ) as cur:
            already = {dict(r)["achievement_id"] for r in await cur.fetchall()}

        newly_unlocked: List[Achievement] = []
        for ach in ACHIEVEMENTS:
            if ach.id in already:
                continue
            try:
                if ach.condition(stats):
                    newly_unlocked.append(ach)
            except Exception:
                # Defensive: a broken condition shouldn't crash the request.
                continue

        if not newly_unlocked:
            return []

        now = db_manager._now_str()
        for ach in newly_unlocked:
            try:
                await conn.execute(
                    """
                    INSERT OR IGNORE INTO user_achievements
                    (id, user_id, achievement_id, unlocked_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (str(_uuid.uuid4()), user_id, ach.id, now),
                )
            except Exception:
                continue

    return [to_dict(a, unlocked=True, unlocked_at=now) for a in newly_unlocked]


async def list_user_achievements(db_manager, user_id: str) -> Dict[str, Any]:
    """
    Return the full achievement list with `unlocked` flag per item,
    plus aggregate counters.
    """
    async with db_manager.get_connection() as conn:
        async with conn.execute(
            "SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?",
            (user_id,),
        ) as cur:
            unlocked_map = {
                dict(r)["achievement_id"]: dict(r)["unlocked_at"]
                for r in await cur.fetchall()
            }

    items = [
        to_dict(a, unlocked=a.id in unlocked_map, unlocked_at=unlocked_map.get(a.id))
        for a in ACHIEVEMENTS
    ]
    return {
        "achievements": items,
        "unlocked_count": len(unlocked_map),
        "total_count": len(ACHIEVEMENTS),
    }
