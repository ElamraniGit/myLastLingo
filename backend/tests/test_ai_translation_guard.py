"""
Tests for the AI Arabic-translation guard in LanguageAIService.

The LLM can return Arabic-looking but non-existent words (e.g. 'ملكوع' for
'trap'). For short terms we prefer the verified dictionary translation. We mock
the dictionary fetch so the test is deterministic and offline.
"""

import asyncio

from backend.ai.language.service import LanguageAIService


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.run(coro)


def test_short_term_prefers_verified_dictionary(monkeypatch):
    svc = LanguageAIService(db_manager=None)

    async def fake_fetch(self, term):
        return "فخ"

    import ai.dictionary.service as dictsvc
    monkeypatch.setattr(dictsvc.DictionaryService, "_fetch_arabic", fake_fetch, raising=True)

    entry = {"term": "trap", "translation": "ملكوع",
             "meanings": [{"rank": 1, "arabic": "ملكوع"}]}
    _run(svc._ensure_valid_translation(entry, "trap"))

    assert entry["translation"] == "فخ"
    assert entry["meanings"][0]["arabic"] == "فخ"


def test_non_arabic_ai_value_repaired(monkeypatch):
    svc = LanguageAIService(db_manager=None)

    async def fake_fetch(self, term):
        return "العدو"

    import ai.dictionary.service as dictsvc
    monkeypatch.setattr(dictsvc.DictionaryService, "_fetch_arabic", fake_fetch, raising=True)

    entry = {"term": "nemesis", "translation": "xyz123", "meanings": []}
    _run(svc._ensure_valid_translation(entry, "nemesis"))
    assert entry["translation"] == "العدو"


def test_sentence_keeps_ai_translation(monkeypatch):
    """Full sentences are NOT second-guessed by the word dictionary."""
    svc = LanguageAIService(db_manager=None)

    called = {"n": 0}

    async def fake_fetch(self, term):
        called["n"] += 1
        return "شيء"

    import ai.dictionary.service as dictsvc
    monkeypatch.setattr(dictsvc.DictionaryService, "_fetch_arabic", fake_fetch, raising=True)

    entry = {"term": "I want to improve my English",
             "translation": "أريد أن أحسن لغتي الإنجليزية", "meanings": []}
    _run(svc._ensure_valid_translation(entry, "I want to improve my English"))

    # Dictionary not consulted for a long sentence; AI translation preserved.
    assert called["n"] == 0
    assert entry["translation"] == "أريد أن أحسن لغتي الإنجليزية"
