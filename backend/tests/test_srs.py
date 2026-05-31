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
        # SENTENCE_BUILDING has no MC choices; skip those.
        if not q.choices:
            continue
        labels = [c["label"] for c in q.choices]
        assert len(labels) == len(set(labels))   # no dup distractors
        assert sum(1 for c in q.choices if c["is_correct"]) == 1


# ── v2 question types ───────────────────────────────────────────────────

def _mk_rich(i, word, ar, en, sentence, synonyms=()):
    return {
        "id": f"id-{i}", "word_id": f"w-{i}", "word": word,
        "meaning_ar": ar, "meaning_en": en, "sentence": sentence,
        "examples": [], "synonyms": list(synonyms), "antonyms": [], "related_words": [],
        "mastery_score": 85,  # push the adaptive picker toward hard types
    }


_RICH_POOL = [
    _mk_rich(1, "happy", "سعيد", "feeling pleasure",
             "She felt happy when she saw her old friend yesterday morning.",
             ("joyful", "glad")),
    _mk_rich(2, "fast", "سريع", "moving quickly",
             "The car moved very fast down the empty highway.",
             ("quick",)),
    _mk_rich(3, "big", "كبير", "large in size",
             "They live in a big house near the central park.",
             ("large",)),
    _mk_rich(4, "walk", "يمشي", "go on foot",
             "I walk to school every morning before classes.",
             ("stroll",)),
    _mk_rich(5, "run", "يجري", "move fast",
             "Children love to run in the green park.",
             ("sprint",)),
    _mk_rich(6, "small", "صغير", "little",
             "The small cat played with a tiny rubber ball.",
             ("tiny",)),
]


def test_synonym_match_generates():
    gen = QuizGenerator(seed=11)
    found = False
    for _ in range(10):
        session = gen.build_session(_RICH_POOL, _RICH_POOL, max_questions=15)
        for q in session.questions:
            if q.type == QuestionType.SYNONYM_MATCH:
                found = True
                # Correct choice must equal one of the word's synonyms.
                w = next(p for p in _RICH_POOL if p["id"] == q.saved_word_id)
                correct = next(c["label"] for c in q.choices if c["is_correct"])
                assert correct in w["synonyms"]
                break
        if found:
            break
    assert found, "SYNONYM_MATCH was never generated"


def test_listening_hides_word_form():
    gen = QuizGenerator(seed=21)
    for _ in range(10):
        session = gen.build_session(_RICH_POOL, _RICH_POOL, max_questions=15)
        for q in session.questions:
            if q.type == QuestionType.LISTENING:
                assert q.audio_word, "listening must carry audio text"
                assert q.prompt_meta.get("hide_word") is True
                return
    assert False, "LISTENING was never generated"


def test_reverse_listening_blanks_target_word():
    gen = QuizGenerator(seed=31)
    for _ in range(10):
        session = gen.build_session(_RICH_POOL, _RICH_POOL, max_questions=15)
        for q in session.questions:
            if q.type == QuestionType.REVERSE_LISTENING:
                assert "______" in q.prompt_meta.get("sentence_blanked", "")
                assert q.audio_word  # sentence to TTS
                return
    assert False, "REVERSE_LISTENING was never generated"


def test_sentence_building_correct_order_round_trips():
    gen = QuizGenerator(seed=42)
    found = 0
    for _ in range(10):
        session = gen.build_session(_RICH_POOL, _RICH_POOL, max_questions=15)
        for q in session.questions:
            if q.type == QuestionType.SENTENCE_BUILDING:
                found += 1
                # Reconstruction round-trip
                rebuilt = [q.tokens[i] for i in q.correct_order]
                expected = q.prompt_meta["original_sentence"].split()
                assert rebuilt == expected, f"{rebuilt} != {expected}"
        if found >= 1:
            break
    assert found >= 1, "SENTENCE_BUILDING was never generated"


def test_error_detection_marks_swapped_token():
    gen = QuizGenerator(seed=55)
    for _ in range(10):
        session = gen.build_session(_RICH_POOL, _RICH_POOL, max_questions=15)
        for q in session.questions:
            if q.type == QuestionType.ERROR_DETECTION:
                # Exactly one correct token
                corrects = [c for c in q.choices if c["is_correct"]]
                assert len(corrects) == 1
                # And it must NOT match the same token in the original sentence
                original = q.prompt_meta["original_sentence"].split()
                pos = corrects[0]["position"]
                assert corrects[0]["label"] != original[pos], "swap didn't actually change the token"
                return
    assert False, "ERROR_DETECTION was never generated"


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
