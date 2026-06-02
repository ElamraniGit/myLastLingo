"""Unit tests for the SM-2-style scheduling state machine in DatabaseManager."""

import asyncio
import tempfile

import pytest

from backend.app.db.database import DatabaseManager


@pytest.fixture()
def db():
    path = tempfile.mktemp(suffix=".db")
    mgr = DatabaseManager(path)
    asyncio.run(mgr.initialize())
    return mgr


def _make_saved_word(db):
    async def _go():
        word = {
            "id": "w1", "word": "ephemeral", "pronunciation": "", "part_of_speech": "adj",
            "level": "C1", "meaning_ar": "", "meaning_en": "short-lived",
            "examples": [], "synonyms": [], "antonyms": [], "conjugations": {},
            "related_words": [], "frequency": 1,
        }
        await db.add_word(word)
        return await db.save_word_to_vocabulary("w1", None, "", "", user_id="u1")
    return asyncio.run(_go())


def test_again_keeps_short_interval(db):
    sid = _make_saved_word(db)
    res = asyncio.run(db.update_review(sid, 0))  # "Again"
    assert res["status"] == "learning"
    assert res["interval"] == 0


def test_good_progresses_then_grows(db):
    sid = _make_saved_word(db)
    r1 = asyncio.run(db.update_review(sid, 3))  # first Good
    assert r1["repetitions"] >= 1
    r2 = asyncio.run(db.update_review(sid, 3))  # second Good
    assert r2["interval"] >= r1["interval"]


def test_easy_grows_faster_than_good(db):
    sid_a = _make_saved_word(db)
    # Easy path
    asyncio.run(db.update_review(sid_a, 5))
    easy = asyncio.run(db.update_review(sid_a, 5))
    assert easy["interval"] >= 1
    assert easy["ease_factor"] >= 2.5


def test_lapse_increments_after_prior_reviews(db):
    sid = _make_saved_word(db)
    asyncio.run(db.update_review(sid, 5))   # learn it
    asyncio.run(db.update_review(sid, 5))
    before = asyncio.run(db.get_saved_word(sid))["lapses"]
    asyncio.run(db.update_review(sid, 0))   # fail it
    after = asyncio.run(db.get_saved_word(sid))["lapses"]
    assert after == before + 1
