from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

import aiohttp

from .cache import LanguageCache
from .normalizer import cache_key, empty_entry, infer_entry_type, normalize_ai_response, normalize_multisource
from .prompts import LOOKUP_SYSTEM_PROMPT, build_lookup_user_prompt

logger = logging.getLogger(__name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"
TIMEOUT = aiohttp.ClientTimeout(total=30)


class LanguageAIService:
    """Central language intelligence orchestration layer.

    Flow:
    1. Read-through SQLite cache
    2. Groq provider (optional, per-user key)
    3. Multi-source deterministic fallback
    4. Structural empty entry
    """

    def __init__(self, db_manager):
        self.db = db_manager
        self.cache = LanguageCache(db_manager)

    async def ensure_table(self) -> None:
        await self.cache.ensure_table()

    async def get_cached(self, term: str) -> Optional[Dict[str, Any]]:
        return await self.cache.get(cache_key(term))

    async def invalidate(self, term: str) -> None:
        await self.cache.invalidate(cache_key(term))

    async def lookup(
        self,
        term: str,
        groq_key: Optional[str] = None,
        *,
        sentence: str = "",
        context: str = "",
        force_refresh: bool = False,
    ) -> Dict[str, Any]:
        clean = (term or "").strip()
        if not clean:
            return empty_entry("")
        key = cache_key(clean)

        if not force_refresh:
            cached = await self.cache.get(key)
            if cached:
                await self.cache.bump(key)
                return cached

        if groq_key:
            ai_entry = await self._lookup_with_groq(clean, groq_key, sentence=sentence, context=context)
            if ai_entry:
                await self.cache.set(key, clean.lower(), ai_entry, groq_used=True)
                return ai_entry

        fallback = await self._lookup_fallback(clean)
        if fallback:
            await self.cache.set(key, clean.lower(), fallback, groq_used=False)
            return fallback

        cached = await self.cache.get(key)
        if cached:
            return cached
        return empty_entry(clean)

    async def lookup_phrase(
        self,
        phrase: str,
        groq_key: Optional[str] = None,
        *,
        sentence: str = "",
        context: str = "",
    ) -> Dict[str, Any]:
        return await self.lookup(phrase, groq_key, sentence=sentence, context=context)

    async def _lookup_fallback(self, term: str) -> Optional[Dict[str, Any]]:
        try:
            from ai.dictionary.service import DictionaryService

            svc = DictionaryService()
            word_data = await svc.lookup(term)
            if not word_data:
                return None
            return normalize_multisource(word_data, term)
        except Exception as exc:
            logger.debug("Fallback language lookup failed for %r: %s", term, exc)
            return None

    async def _lookup_with_groq(
        self,
        term: str,
        groq_key: str,
        *,
        sentence: str = "",
        context: str = "",
    ) -> Optional[Dict[str, Any]]:
        payload = {
            "model": GROQ_MODEL,
            "messages": [
                {"role": "system", "content": LOOKUP_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": build_lookup_user_prompt(
                        term,
                        sentence=sentence,
                        context=context,
                        inferred_type=infer_entry_type(term),
                    ),
                },
            ],
            "temperature": 0.28,
            "max_tokens": 2200,
            "response_format": {"type": "json_object"},
        }
        try:
            async with aiohttp.ClientSession(timeout=TIMEOUT) as session:
                async with session.post(
                    GROQ_URL,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {groq_key.strip()}",
                        "Content-Type": "application/json",
                    },
                ) as resp:
                    if resp.status in {401, 429}:
                        logger.info("Groq lookup unavailable for %r (status=%s)", term, resp.status)
                        return None
                    if resp.status != 200:
                        logger.debug("Groq lookup failed for %r (status=%s)", term, resp.status)
                        return None
                    result = await resp.json()
            content = result["choices"][0]["message"]["content"]
            return normalize_ai_response(json.loads(content), term)
        except Exception as exc:
            logger.debug("Groq language lookup failed for %r: %s", term, exc)
            return None


_service_instance: Optional[LanguageAIService] = None


def get_service(db_manager=None) -> LanguageAIService:
    global _service_instance
    if _service_instance is None:
        if db_manager is None:
            raise RuntimeError("LanguageAIService not initialised")
        _service_instance = LanguageAIService(db_manager)
    return _service_instance


def init_service(db_manager) -> LanguageAIService:
    global _service_instance
    _service_instance = LanguageAIService(db_manager)
    return _service_instance
