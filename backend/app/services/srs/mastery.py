"""
Mastery score (0..100) for each saved word.

Combines accuracy, FSRS stability, retrievability, response time and lapses
into a single human-readable number, plus a leech detector.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Any, Tuple


@dataclass
class MasteryResult:
    score: int                # 0..100
    accuracy: float           # 0..1
    avg_response_ms: float
    is_leech: bool
    stage: str                # new | learning | familiar | mastered
    confidence: float         # 0..1


class MasteryCalculator:
    """
    Score = w1 * accuracy
          + w2 * normalized_stability     (capped at 60 days)
          + w3 * normalized_response_time (faster = better)
          - w4 * lapse_penalty
          - w5 * recent_error_penalty

    Weights sum to 1.0 for the positive part.
    """

    # Weights — tuned for typical language learners
    W_ACCURACY = 0.45
    W_STABILITY = 0.35
    W_SPEED = 0.20
    LAPSE_PENALTY = 3.0          # points per lapse, capped
    RECENT_ERROR_PENALTY = 8.0   # points per recent (last 3) error

    LEECH_THRESHOLD = 6          # ≥ 6 lapses → leech, surface to user

    @classmethod
    def compute(
        cls,
        *,
        correct_count: int,
        total_attempts: int,
        lapses: int,
        stability_days: float,
        avg_response_ms: float,
        recent_errors: int = 0,
        stage: str = "new",
    ) -> MasteryResult:
        # Accuracy with Laplace smoothing so new cards don't sit at 0 or 100.
        if total_attempts == 0:
            accuracy = 0.0
        else:
            accuracy = (correct_count + 1) / (total_attempts + 2)

        # Normalised stability (0..1)
        norm_stab = min(1.0, stability_days / 60.0)

        # Speed: 2s = perfect, ≥ 12s = 0.  Unknown ⇒ neutral 0.5.
        if avg_response_ms <= 0:
            speed_score = 0.5
        else:
            speed_score = max(0.0, min(1.0, 1.0 - (avg_response_ms - 2000) / 10000))

        positive = (
            cls.W_ACCURACY * accuracy
            + cls.W_STABILITY * norm_stab
            + cls.W_SPEED * speed_score
        ) * 100.0

        penalty = (
            min(lapses, 10) * cls.LAPSE_PENALTY
            + min(recent_errors, 3) * cls.RECENT_ERROR_PENALTY
        )

        score = int(max(0, min(100, round(positive - penalty))))

        # Confidence: how reliable the score is (depends on sample size).
        confidence = min(1.0, total_attempts / 8.0)

        return MasteryResult(
            score=score,
            accuracy=round(accuracy, 3),
            avg_response_ms=round(avg_response_ms, 1),
            is_leech=lapses >= cls.LEECH_THRESHOLD,
            stage=stage,
            confidence=round(confidence, 2),
        )

    @classmethod
    def from_row(cls, row: Dict[str, Any], recent_errors: int = 0) -> MasteryResult:
        correct = int(row.get("correct_count") or 0)
        total = int(row.get("total_attempts") or row.get("reviewed_count") or 0)
        lapses = int(row.get("lapses") or 0)
        stability = float(row.get("fsrs_stability") or row.get("interval") or 0.0)
        avg_rt = float(row.get("avg_response_ms") or 0.0)
        stage = str(row.get("stage") or "new")
        return cls.compute(
            correct_count=correct,
            total_attempts=total,
            lapses=lapses,
            stability_days=stability,
            avg_response_ms=avg_rt,
            recent_errors=recent_errors,
            stage=stage,
        )
