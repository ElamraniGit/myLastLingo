"""
Tests for transcript sentence merging — captions should be combined into
complete sentences for natural synchronized reading.
"""

from backend.app.api.transcripts import _merge_into_sentences


def _runs_from(text, per=2, step=1.0):
    words = text.split()
    runs = []
    t = 0.0
    for i in range(0, len(words), per):
        runs.append({"start": t, "end": t + step, "words": words[i:i + per]})
        t += step
    return runs


def test_splits_into_complete_sentences():
    text = ("Hello everyone, welcome to the channel. "
            "Today we will learn about photosynthesis. "
            "It is the process by which plants make food using sunlight. "
            "Let's begin!")
    segs = _merge_into_sentences(_runs_from(text))
    texts = [s["text"] for s in segs]
    assert "Hello everyone, welcome to the channel." in texts
    assert "Today we will learn about photosynthesis." in texts
    assert "Let's begin!" in texts
    # every non-final sentence should end with sentence punctuation
    for s in segs:
        assert s["text"][-1] in ".!?…"


def test_each_segment_has_word_timings_and_order():
    text = "First sentence here. Second sentence follows. Third one ends it."
    segs = _merge_into_sentences(_runs_from(text))
    assert len(segs) == 3
    # timings are ordered and each word carries start/end
    prev_end = -1
    for s in segs:
        assert s["start"] >= prev_end - 0.001
        prev_end = s["end"]
        assert s["words"] and all("start" in w and "end" in w for w in s["words"])


def test_no_punctuation_is_capped_not_one_blob():
    text = ("word " * 100).strip()
    segs = _merge_into_sentences(_runs_from(text, per=1, step=0.4))
    assert len(segs) > 1
    assert max(len(s["words"]) for s in segs) <= 40
