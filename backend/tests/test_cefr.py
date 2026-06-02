"""CEFR level estimation (FIX-QUAL-1): the graded estimator should be used."""

from ai.dictionary.service import DictionaryService


def test_common_words_are_low_level():
    svc = DictionaryService()
    assert svc._estimate_level("the") == "A1"
    assert svc._estimate_level("run") in ("A1", "A2")


def test_rare_words_are_high_level():
    svc = DictionaryService()
    assert svc._estimate_level("serendipity") in ("C1", "C2")
    assert svc._estimate_level("photosynthesis") in ("C1", "C2")


def test_returns_valid_cefr_band():
    svc = DictionaryService()
    valid = {"A1", "A2", "B1", "B2", "C1", "C2"}
    for w in ["cat", "house", "develop", "ubiquitous", "x"]:
        assert svc._estimate_level(w) in valid
