"""
Smart Review System (SRS) package.

Exposes:
  - FSRSScheduler: Free Spaced Repetition Scheduler (state-of-the-art).
  - MasteryCalculator: 0-100 mastery score for each saved word.
  - LearningStage: New / Learning / Familiar / Mastered.
  - Rating: Again / Hard / Good / Easy (1..4) — Anki-compatible.
"""

from .fsrs import (
    FSRSScheduler,
    FSRSCard,
    Rating,
    SchedulingResult,
    LearningStage,
    quality_to_rating,
)
from .mastery import MasteryCalculator

__all__ = [
    "FSRSScheduler",
    "FSRSCard",
    "Rating",
    "SchedulingResult",
    "LearningStage",
    "MasteryCalculator",
    "quality_to_rating",
]
