"""
Smoke tests for the FSRS scheduler, mastery score, quiz generator
and error analyzer.

Run with:
    PYTHONPATH=. python -m pytest backend/tests -q
or simply:
    PYTHONPATH=. python backend/tests/test_srs.py
"""

from datetime import datetime, timedelta

from backend.app.services.srs import (
    FSRSScheduler, FSRSCard, Rating, MasteryCalculator, LearningStage,
)
from backend.app.services.srs.fsrs import card_from_row
from backend.app.services.quiz import QuizGenerator, QuestionType, ErrorAnalyzer
from backend.app.services.quiz.error_analyzer import ErrorType


# ── FSRS basic behaviour ────────────────────────────────────────────────

def test_new_card_good_advances_state():
    s = FSRSScheduler()
    res = s.review(FSRSCard(), Rating.GOOD)
    assert res.stability > 0
    assert res.difficulty > 0
    assert res.state in ("learning", "review")
    assert res.stage in (LearningStage.NEW, LearningStage.LEARNING, LearningStage.FAMILIAR, LearningStage.MASTERED)
    assert res.interval_days > 0


def test_again_increases_lapses_and_short_interval():
    s = FSRSScheduler()
    card = FSRSCard(stability=10, difficulty=5, reps=3, state="review",
                    last_review=datetime.utcnow() - timedelta(days=5))
    res = s.review(card, Rating.AGAIN)
    assert res.lapses == 1
    assert res.state == "relearning"
    # Relearning step should be very short (< 1 hour)
    assert res.interval_days < 0.05


def test_easy_grows_stability_faster_than_good():
    s = FSRSScheduler()
    base = FSRSCard(stability=10, difficulty=5, reps=3, state="review",
                    last_review=datetime.utcnow() - timedelta(days=5))
    good = s.review(FSRSCard(**base.__dict__), Rating.GOOD)
    easy = s.review(FSRSCard(**base.__dict__), Rating.EASY)
    assert easy.stability > good.stability
    assert easy.interval_days > good.interval_days


def test_progression_to_mastered():
    s = FSRSScheduler()
    card = FSRSCard()
    now = datetime.utcnow()
    for _ in range(8):
        res = s.review(card, Rating.GOOD, now=now)
        card = FSRSCard(
            stability=res.stability, difficulty=res.difficulty,
            reps=res.reps, lapses=res.lapses, state=res.state, last_review=now,
        )
        now = res.next_review
    assert card.stability > 30
    assert res.stage in (LearningStage.MASTERED, LearningStage.FAMILIAR)


# ── Mastery score ───────────────────────────────────────────────────────

def test_mastery_basic_range():
    m = MasteryCalculator.compute(
        correct_count=8, total_attempts=10, lapses=1,
        stability_days=20, avg_response_ms=3500,
    )
    assert 0 <= m.score <= 100
    assert 0 < m.accuracy < 1
    assert m.is_leech is False


def test_mastery_perfect():
    m = MasteryCalculator.compute(
        correct_count=20, total_attempts=20, lapses=0,
        stability_days=120, avg_response_ms=1500,
    )
    assert m.score >= 90


def test_mastery_leech_detection():
    m = MasteryCalculator.compute(
        correct_count=2, total_attempts=12, lapses=8,
        stability_days=2, avg_response_ms=9000, recent_errors=3,
    )
    assert m.is_leech is True
    assert m.score < 30


# ── Card import from legacy row ─────────────────────────────────────────

def test_card_from_row_cold_start():
    row = {"ease_factor": 2.5, "interval": 7, "reviewed_count": 3, "lapses": 0,
           "last_reviewed": "2025-01-01 10:00:00"}
    c = card_from_row(row)
    # Cold-started from SM-2: stability seeded from previous interval
    assert c.stability >= 1.0
    assert c.state == "review"


# ── Quiz generator ──────────────────────────────────────────────────────

def _mk(i, word, ar, en, sentence=""):
    return {
        "id": f"id-{i}", "word_id": f"w-{i}", "word": word,
        "meaning_ar": ar, "meaning_en": en, "sentence": sentence,
        "examples": [], "synonyms": [], "antonyms": [], "related_words": [],
        "mastery_score": 40,
    }


def test_quiz_session_interleaves_types():
    pool = [
        _mk(1, "apple",  "تفاحة",   "a fruit", "I ate an apple yesterday."),
        _mk(2, "banana", "موزة",    "a yellow fruit"),
        _mk(3, "house",  "منزل",    "a place to live in"),
        _mk(4, "river",  "نهر",     "flowing water"),
        _mk(5, "happy",  "سعيد",    "feeling pleasure"),
        _mk(6, "fast",   "سريع",    "moving with high speed"),
    ]
    gen = QuizGenerator(seed=42)
    session = gen.build_session(pool, pool, max_questions=6)
    types = [q.type for q in session.questions]
    # Interleaving: no two consecutive questions share the same type (when possible)
    consecutive_same = sum(1 for a, b in zip(types, types[1:]) if a == b)
    assert consecutive_same <= 1


def test_quiz_choices_unique_and_correct_marked():
    pool = [_mk(i, w, ar, "def") for i, (w, ar) in enumerate(
        [("apple", "تفاحة"), ("banana", "موزة"), ("house", "منزل"),
         ("river", "نهر"), ("happy", "سعيد"), ("fast", "سريع")])]
    gen = QuizGenerator(seed=1)
    session = gen.build_session(pool, pool, max_questions=4)
    for q in session.questions:
        labels = [c["label"] for c in q.choices]
        assert len(labels) == len(set(labels))   # no dup distractors
        assert sum(1 for c in q.choices if c["is_correct"]) == 1


# ── Error analyzer ──────────────────────────────────────────────────────

def test_error_classifier_antonym():
    target = {"word": "hot", "antonyms": ["cold"], "synonyms": ["warm"], "related_words": []}
    c = ErrorAnalyzer.classify(target_word=target, picked_label="cold",
                               question_type="en_to_ar", response_ms=4000)
    assert c.type == ErrorType.OPPOSITE_MEANING


def test_error_classifier_synonym_confusion():
    target = {"word": "happy", "antonyms": [], "synonyms": ["joyful"], "related_words": []}
    c = ErrorAnalyzer.classify(target_word=target, picked_label="joyful",
                               question_type="ar_to_en", response_ms=3000)
    assert c.type == ErrorType.SEMANTIC_CONFUSION


def test_error_classifier_surface_similarity():
    target = {"word": "though", "antonyms": [], "synonyms": [], "related_words": []}
    c = ErrorAnalyzer.classify(target_word=target, picked_label="through",
                               question_type="en_to_ar", response_ms=2500)
    assert c.type == ErrorType.SURFACE_SIMILARITY


def test_error_classifier_unknown():
    target = {"word": "ephemeral", "antonyms": [], "synonyms": [], "related_words": []}
    c = ErrorAnalyzer.classify(target_word=target, picked_label="banana",
                               question_type="en_to_ar", response_ms=8000)
    assert c.type == ErrorType.UNKNOWN_WORD


if __name__ == "__main__":
    import sys, traceback
    tests = [v for k, v in list(globals().items()) if k.startswith("test_") and callable(v)]
    fail = 0
    for t in tests:
        try:
            t()
            print(f"✓ {t.__name__}")
        except Exception:
            fail += 1
            print(f"✗ {t.__name__}")
            traceback.print_exc()
    print(f"\n{len(tests) - fail}/{len(tests)} passed")
    sys.exit(1 if fail else 0)
