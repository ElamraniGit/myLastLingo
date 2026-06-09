"""
Tests for Arabic-translation validation in the dictionary service.

The free translation providers (esp. MyMemory) sometimes return English warning
strings or passthrough text instead of a real translation. `_is_valid_arabic`
must reject anything that isn't genuinely Arabic so it never gets stored as a
word's meaning_ar.
"""

import pytest

from backend.ai.dictionary.service import _is_valid_arabic


@pytest.mark.parametrize("text", [
    "يحسن",
    "تحسين",
    "ظاهرة",
    "نجز, أتم, كمل",     # comma-separated Arabic options
    "run يجري",          # mixed but Arabic dominates the alphabetic content
])
def test_accepts_real_arabic(text):
    assert _is_valid_arabic(text) is True


@pytest.mark.parametrize("text", [
    "",
    "   ",
    "improve",                                   # English passthrough
    "hello world this is english",
    "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY",
    "INVALID LANGUAGE PAIR",
    "12345",
    "ـ",                                         # lone tatweel, not a real letter
    "hello ظاهرة world test",                    # Latin dominates
])
def test_rejects_non_arabic_or_junk(text):
    assert _is_valid_arabic(text) is False
