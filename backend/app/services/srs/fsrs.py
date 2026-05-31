"""
FSRS (Free Spaced Repetition Scheduler) — v4 simplified.

A modern, science-based scheduler used by Anki since 23.10.
Reference: https://github.com/open-spaced-repetition/fsrs4anki

Concepts
--------
Each card has two latent variables:
  - Stability (S):  how long the memory will last (in days) before recall
                    probability drops to the desired retention.
  - Difficulty (D): intrinsic hardness of the item (1..10, 1 = easiest).

After each review with rating r in {Again=1, Hard=2, Good=3, Easy=4}, we
update (S, D) and schedule the next review at an interval that targets the
user-defined retention (default 0.9 ⇒ 90% recall probability).

This module is fully pure — no I/O. It is consumed by the DB layer.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import IntEnum
import math
from typing import Optional


# ────────────────────────────────────────────────────────────────────────────
# Public enums / constants
# ────────────────────────────────────────────────────────────────────────────

class Rating(IntEnum):
    AGAIN = 1
    HARD = 2
    GOOD = 3
    EASY = 4


class LearningStage(str):
    """Pedagogical stages exposed to the UI."""
    NEW = "new"
    LEARNING = "learning"
    FAMILIAR = "familiar"
    MASTERED = "mastered"


# Legacy 0..5 SM-2 → FSRS 1..4 mapping, for backward compatibility.
_QUALITY_TO_RATING = {
    0: Rating.AGAIN, 1: Rating.AGAIN,
    2: Rating.HARD,
    3: Rating.GOOD, 4: Rating.GOOD,
    5: Rating.EASY,
}


def quality_to_rating(quality: int) -> Rating:
    """Map legacy 0..5 quality to FSRS Rating."""
    return _QUALITY_TO_RATING.get(int(quality), Rating.GOOD)


# Default FSRS weights (w0..w16) — calibrated on the public FSRS dataset.
# These can later be re-fit per-user via FSRS-Optimizer.
DEFAULT_WEIGHTS = (
    0.40, 0.60, 2.40, 5.80,
    4.93, 0.94, 0.86, 0.01,
    1.49, 0.14, 0.94, 2.18,
    0.05, 0.34, 1.26, 0.29,
    2.61,
)

REQUEST_RETENTION = 0.90  # target probability of recall when the next review is due
MAX_INTERVAL_DAYS = 365 * 3
DECAY = -0.5
FACTOR = 19 / 81  # = 0.234567...   such that R(t)=(1+FACTOR*t/S)^DECAY


# ────────────────────────────────────────────────────────────────────────────
# Card state
# ────────────────────────────────────────────────────────────────────────────

@dataclass
class FSRSCard:
    """Represents the SRS state of one saved word."""
    stability: float = 0.0          # days
    difficulty: float = 0.0         # 1..10
    elapsed_days: float = 0.0       # since last review (computed)
    scheduled_days: float = 0.0     # interval scheduled at last review
    reps: int = 0                   # total reviews
    lapses: int = 0                 # times rated "Again" after graduating
    state: str = "new"              # "new" | "learning" | "review" | "relearning"
    last_review: Optional[datetime] = None


@dataclass
class SchedulingResult:
    """Output of one scheduling step."""
    stability: float
    difficulty: float
    interval_days: float
    next_review: datetime
    state: str
    reps: int
    lapses: int
    rating: int
    stage: str
    retrievability: float           # probability of recall at review time
    review_log: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["next_review"] = self.next_review.strftime("%Y-%m-%d %H:%M:%S")
        return d


# ────────────────────────────────────────────────────────────────────────────
# Scheduler
# ────────────────────────────────────────────────────────────────────────────

class FSRSScheduler:
    """Pure FSRS-v4 scheduler. Stateless — pass card state in/out."""

    def __init__(
        self,
        weights: tuple = DEFAULT_WEIGHTS,
        request_retention: float = REQUEST_RETENTION,
        maximum_interval: int = MAX_INTERVAL_DAYS,
    ):
        self.w = weights
        self.request_retention = request_retention
        self.maximum_interval = maximum_interval

    # ── public API ────────────────────────────────────────────────────────
    def review(self, card: FSRSCard, rating: Rating, now: Optional[datetime] = None) -> SchedulingResult:
        """Apply a rating and return the updated scheduling result."""
        now = now or datetime.utcnow()
        rating = Rating(int(rating))

        # 1) Compute elapsed time since last review (clamped to >= 0)
        if card.last_review:
            card.elapsed_days = max(0.0, (now - card.last_review).total_seconds() / 86400.0)
        else:
            card.elapsed_days = 0.0

        # 2) Retrievability before this review (for analytics & adaptive D updates)
        retrievability = self._retrievability(card.elapsed_days, card.stability) if card.stability > 0 else 0.0

        # 3) Update Stability and Difficulty
        if card.state == "new" or card.reps == 0:
            new_d = self._init_difficulty(rating)
            new_s = self._init_stability(rating)
            new_state = "learning" if rating != Rating.EASY else "review"
        else:
            new_d = self._next_difficulty(card.difficulty, rating)
            if rating == Rating.AGAIN:
                new_s = self._next_forget_stability(card.difficulty, card.stability, retrievability)
                new_state = "relearning"
            else:
                new_s = self._next_recall_stability(card.difficulty, card.stability, retrievability, rating)
                new_state = "review"

        # 4) Schedule next interval
        if rating == Rating.AGAIN:
            # Short relearning step: 10 minutes, ignore S for interval
            interval_days = 10 / (60 * 24)
            lapses = card.lapses + 1
        elif new_state == "learning":
            # Learning ladder: Hard ≈ 30m, Good ≈ 1d, Easy ≈ 4d
            if rating == Rating.HARD:
                interval_days = 30 / (60 * 24)
            elif rating == Rating.GOOD:
                interval_days = 1.0
            else:  # EASY
                interval_days = 4.0
            lapses = card.lapses
        else:
            interval_days = self._next_interval(new_s)
            lapses = card.lapses

        interval_days = max(1 / (60 * 24), min(interval_days, self.maximum_interval))
        next_review = now + timedelta(days=interval_days)

        # 5) Pedagogical stage shown to the user
        stage = self._stage_for(new_s, new_state, card.reps + 1)

        return SchedulingResult(
            stability=round(new_s, 4),
            difficulty=round(new_d, 4),
            interval_days=round(interval_days, 4),
            next_review=next_review,
            state=new_state,
            reps=card.reps + 1,
            lapses=lapses,
            rating=int(rating),
            stage=stage,
            retrievability=round(retrievability, 4),
            review_log={
                "elapsed_days": round(card.elapsed_days, 4),
                "scheduled_days": round(card.scheduled_days, 4),
                "old_stability": round(card.stability, 4),
                "old_difficulty": round(card.difficulty, 4),
                "old_state": card.state,
            },
        )

    # ── internals ──────────────────────────────────────────────────────────
    def _init_difficulty(self, r: Rating) -> float:
        d = self.w[4] - (int(r) - 3) * self.w[5]
        return self._clamp_d(d)

    def _init_stability(self, r: Rating) -> float:
        return max(self.w[int(r) - 1], 0.1)

    def _next_difficulty(self, d: float, r: Rating) -> float:
        next_d = d - self.w[6] * (int(r) - 3)
        # Mean-reverting towards initial Good-difficulty
        mean_reversion = self.w[7] * (self._init_difficulty(Rating.GOOD) - next_d)
        return self._clamp_d(next_d + mean_reversion)

    def _next_recall_stability(self, d: float, s: float, r_t: float, rating: Rating) -> float:
        hard_penalty = self.w[15] if rating == Rating.HARD else 1.0
        easy_bonus = self.w[16] if rating == Rating.EASY else 1.0
        return s * (
            1
            + math.exp(self.w[8])
            * (11 - d)
            * math.pow(s, -self.w[9])
            * (math.exp((1 - r_t) * self.w[10]) - 1)
            * hard_penalty
            * easy_bonus
        )

    def _next_forget_stability(self, d: float, s: float, r_t: float) -> float:
        return (
            self.w[11]
            * math.pow(d, -self.w[12])
            * (math.pow(s + 1, self.w[13]) - 1)
            * math.exp((1 - r_t) * self.w[14])
        )

    def _next_interval(self, s: float) -> float:
        # Solve R(t) = request_retention for t.
        # R(t) = (1 + FACTOR * t / S) ^ DECAY
        return (s / FACTOR) * (math.pow(self.request_retention, 1 / DECAY) - 1)

    def _retrievability(self, t: float, s: float) -> float:
        if s <= 0:
            return 0.0
        return math.pow(1 + FACTOR * t / s, DECAY)

    @staticmethod
    def _clamp_d(d: float) -> float:
        return max(1.0, min(10.0, d))

    @staticmethod
    def _stage_for(stability: float, state: str, reps: int) -> str:
        """Map FSRS internals → user-facing stage."""
        if reps == 0 or state == "new":
            return LearningStage.NEW
        if state in ("learning", "relearning") or stability < 7:
            return LearningStage.LEARNING
        if stability < 30:
            return LearningStage.FAMILIAR
        return LearningStage.MASTERED


# ────────────────────────────────────────────────────────────────────────────
# Helpers to bridge legacy DB rows ↔ FSRSCard
# ────────────────────────────────────────────────────────────────────────────

def card_from_row(row: dict) -> FSRSCard:
    """Build an FSRSCard from a saved_words row (supporting legacy SM-2 rows)."""
    stability = float(row.get("fsrs_stability") or 0.0)
    difficulty = float(row.get("fsrs_difficulty") or 0.0)
    reps = int(row.get("reviewed_count") or 0)
    lapses = int(row.get("lapses") or 0)
    state = (row.get("fsrs_state") or ("review" if reps > 0 else "new"))
    last_reviewed = row.get("last_reviewed")
    last_review_dt: Optional[datetime] = None
    if last_reviewed:
        try:
            s = str(last_reviewed).replace("T", " ")[:19]
            last_review_dt = datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
        except Exception:
            last_review_dt = None

    # Cold-start from SM-2 columns the first time we see a card.
    if stability == 0.0 and reps > 0:
        ease = float(row.get("ease_factor") or 2.5)
        interval = float(row.get("interval") or 1.0)
        # Heuristic: pre-seed stability from previous SM-2 interval; difficulty from ease.
        stability = max(1.0, interval)
        difficulty = max(1.0, min(10.0, 11.0 - 3.0 * (ease - 1.3)))
        state = "review"

    return FSRSCard(
        stability=stability,
        difficulty=difficulty,
        scheduled_days=float(row.get("interval") or 0.0),
        reps=reps,
        lapses=lapses,
        state=state,
        last_review=last_review_dt,
    )
