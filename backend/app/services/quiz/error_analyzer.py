"""
Error analysis — classifies why the user missed a question, so the
adaptive engine can resurface the word in the most useful way.
"""

from __future__ import annotations

from enum import Enum
from dataclasses import dataclass
from typing import Dict, Any, Optional


class ErrorType(str, Enum):
    SEMANTIC_CONFUSION = "semantic_confusion"   # picked a synonym/related word
    OPPOSITE_MEANING = "opposite_meaning"        # picked an antonym
    SURFACE_SIMILARITY = "surface_similarity"    # picked a word that looks/sounds alike
    CONTEXT_MISMATCH = "context_mismatch"        # fill-blank: wrong register
    UNKNOWN_WORD = "unknown_word"                # no idea, probably new
    SLOW_RECALL = "slow_recall"                  # right but too slow (still counts)
    TIMEOUT = "timeout"


@dataclass
class ErrorClassification:
    type: ErrorType
    reason: str
    suggested_action: str   # e.g. "show_more_examples", "add_to_focus_deck"


class ErrorAnalyzer:
    """Lightweight heuristic classifier (no ML needed for MVP)."""

    @classmethod
    def classify(
        cls,
        *,
        target_word: Dict[str, Any],
        picked_label: Optional[str],
        question_type: str,
        response_ms: int,
    ) -> ErrorClassification:
        if picked_label is None:
            return ErrorClassification(
                ErrorType.TIMEOUT,
                "لم يتم الإجابة في الوقت المناسب.",
                "shorten_session",
            )

        picked = picked_label.strip().lower()
        synonyms = {s.lower() for s in (target_word.get("synonyms") or [])}
        antonyms = {a.lower() for a in (target_word.get("antonyms") or [])}
        related = {r.lower() for r in (target_word.get("related_words") or [])}
        target = (target_word.get("word") or "").lower()

        if picked in antonyms:
            return ErrorClassification(
                ErrorType.OPPOSITE_MEANING,
                "اخترت كلمة معاكسة في المعنى.",
                "review_antonyms",
            )

        if picked in synonyms or picked in related:
            return ErrorClassification(
                ErrorType.SEMANTIC_CONFUSION,
                "اخترت كلمة قريبة في المعنى لكنها ليست المطلوبة.",
                "compare_synonyms",
            )

        if target and _similar(picked, target):
            return ErrorClassification(
                ErrorType.SURFACE_SIMILARITY,
                "الكلمة المختارة تشبه الكلمة الصحيحة في الشكل أو النطق.",
                "drill_spelling",
            )

        if question_type == "fill_blank":
            return ErrorClassification(
                ErrorType.CONTEXT_MISMATCH,
                "الكلمة لا تناسب سياق الجملة.",
                "show_more_examples",
            )

        return ErrorClassification(
            ErrorType.UNKNOWN_WORD,
            "يبدو أن هذه الكلمة لا تزال غير مألوفة.",
            "add_to_focus_deck",
        )


def _similar(a: str, b: str) -> bool:
    """Cheap surface-similarity heuristic (Levenshtein ratio ≥ 0.6)."""
    if not a or not b:
        return False
    if abs(len(a) - len(b)) > 4:
        return False
    # quick Levenshtein
    m, n = len(a), len(b)
    dp = list(range(n + 1))
    for i in range(1, m + 1):
        prev, dp[0] = dp[0], i
        for j in range(1, n + 1):
            cur = dp[j]
            cost = 0 if a[i - 1] == b[j - 1] else 1
            dp[j] = min(dp[j] + 1, dp[j - 1] + 1, prev + cost)
            prev = cur
    distance = dp[n]
    ratio = 1 - distance / max(m, n)
    return ratio >= 0.6
