"""
GroqLanguageService — Central AI Language Intelligence Layer
=============================================================

This is the Single Source of Truth for all linguistic content in LinguaLearn.

Architecture:
  ┌─────────────────────────────────────────────────────┐
  │              Application Layer                      │
  │  (dictionary.py, vocabulary.py, SelectionToolbar)   │
  └─────────────────┬───────────────────────────────────┘
                    │ all requests
                    ▼
  ┌─────────────────────────────────────────────────────┐
  │           GroqLanguageService                        │
  │  1. Check SQLite cache → return instantly if hit    │
  │  2. Call Groq API → get unified LanguageEntry       │
  │  3. Store in cache → future hits are instant        │
  └─────────────────┬───────────────────────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────────────────────┐
  │            Groq (llama-3.3-70b-versatile)            │
  │  Single call → complete LanguageEntry JSON          │
  └─────────────────────────────────────────────────────┘

Fallback chain (when Groq unavailable):
  1. Groq (primary)
  2. SQLite cached entry (stale-ok offline)
  3. Basic heuristic entry (structural scaffolding)

Supports: single words, phrasal verbs, idioms, expressions, sentences.
"""

from __future__ import annotations

import json
import hashlib
import logging
import asyncio
from typing import Any, Dict, Optional
from datetime import datetime

import aiohttp

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

GROQ_URL    = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL  = "llama-3.3-70b-versatile"
TIMEOUT     = aiohttp.ClientTimeout(total=30)

# ── Unified Schema ────────────────────────────────────────────────────────────
#
# Every response from GroqLanguageService conforms to this schema.
# All application features (WordPopup, Flashcards, Quiz, Review,
# VocabularyView, WordDetailView) consume this single structure.
#
# {
#   "term":           str   — the original input (word/phrase/idiom)
#   "language":       str   — always "en" for now
#   "translation":    str   — Arabic translation (contextual, not literal)
#   "pronunciation":  str   — IPA phonetic transcription
#   "part_of_speech": str   — noun | verb | adjective | adverb | phrase | idiom | …
#   "cefr_level":     str   — A1 | A2 | B1 | B2 | C1 | C2
#   "definitions": [        — ordered from most common to least
#     {
#       "text":    str       — clear, learner-friendly definition
#       "context": str       — usage context label (formal, informal, business…)
#     }
#   ]
#   "examples": [str]       — 3 natural, native-speaker sentences
#   "synonyms":  [str]      — up to 8 synonyms
#   "antonyms":  [str]      — up to 6 antonyms
#   "collocations": [str]   — common multi-word expressions
#   "usage_notes":   str    — practical tip: register, grammar pattern, common mistake
#   "grammar_notes": str    — grammar explanation (verb forms, uncountable, etc.)
#   "related_words": [str]  — semantically related words
#   "confidence":    float  — model confidence (0.0–1.0)
#   "ai_generated":  bool   — true when data came from Groq
#   "cached_at":     str    — ISO timestamp of when it was cached
# }

SYSTEM_PROMPT = """\
You are LinguaLearn AI, an expert English language assistant for Arabic-speaking learners.
You provide comprehensive, accurate, learner-friendly linguistic data.

Given any English input (word, phrase, idiom, expression, or sentence fragment),
respond ONLY with a valid JSON object matching this exact schema:

{
  "term": "the exact input you received",
  "language": "en",
  "translation": "الترجمة العربية الدقيقة في السياق الصحيح — ليست ترجمة حرفية",
  "pronunciation": "/IPA transcription here/",
  "part_of_speech": "noun|verb|adjective|adverb|phrase|idiom|expression|sentence",
  "cefr_level": "A1|A2|B1|B2|C1|C2",
  "definitions": [
    {
      "text": "Clear, simple definition. No jargon. No circular definitions.",
      "context": "general|formal|informal|business|academic|colloquial|technical"
    }
  ],
  "examples": [
    "First natural sentence using the term exactly as given.",
    "Second example in a different context.",
    "Third example showing advanced or nuanced usage."
  ],
  "synonyms": ["synonym1", "synonym2", "synonym3"],
  "antonyms": ["antonym1", "antonym2"],
  "collocations": [
    "common phrase with the word",
    "another common collocation",
    "verb + noun pattern",
    "adjective + noun pattern"
  ],
  "usage_notes": "One practical tip: register (formal/informal), common learner mistake, or key grammar pattern. Max 30 words.",
  "grammar_notes": "Grammar explanation: irregular forms, countability, prepositions that follow, verb patterns, etc.",
  "related_words": ["related1", "related2", "related3"],
  "confidence": 0.95
}

STRICT RULES:
1. Return ONLY the JSON object. No markdown fences, no explanations, no extra text.
2. translation: must be natural Arabic, not word-for-word. Show the meaning in context.
3. pronunciation: use standard IPA. For multi-word phrases, show stressed form.
4. definitions: always an array. Provide at least 1, up to 4 definitions.
5. examples: all 3 must naturally contain the exact term. Vary the contexts.
6. synonyms/antonyms: empty array [] if none apply. Never null.
7. collocations: real, frequent multi-word patterns. Empty array if input is a sentence.
8. cefr_level: estimate based on term frequency and complexity.
9. confidence: 1.0 for common words, lower for rare terms or ambiguous phrases.
10. For idioms/phrases: part_of_speech = "phrase" or "idiom".
"""


def _cache_key(term: str) -> str:
    """Deterministic cache key from the term."""
    return hashlib.sha256(term.lower().strip().encode()).hexdigest()[:24]


def _empty_entry(term: str) -> Dict[str, Any]:
    """Minimal structural entry when nothing is available."""
    return {
        "term":           term,
        "language":       "en",
        "translation":    "",
        "pronunciation":  "",
        "part_of_speech": "unknown",
        "cefr_level":     "B1",
        "definitions":    [],
        "examples":       [],
        "synonyms":       [],
        "antonyms":       [],
        "collocations":   [],
        "usage_notes":    "",
        "grammar_notes":  "",
        "related_words":  [],
        "confidence":     0.0,
        "ai_generated":   False,
        "cached_at":      datetime.utcnow().isoformat(),
    }


def _validate_and_clean(raw: Dict[str, Any], term: str) -> Dict[str, Any]:
    """Ensure all required fields exist and have correct types."""
    entry = _empty_entry(term)

    entry["term"]           = raw.get("term", term) or term
    entry["language"]       = "en"
    entry["translation"]    = str(raw.get("translation", "")).strip()
    entry["pronunciation"]  = str(raw.get("pronunciation", "")).strip()
    entry["part_of_speech"] = str(raw.get("part_of_speech", "unknown")).strip()
    entry["cefr_level"]     = str(raw.get("cefr_level", "B1")).strip()
    entry["usage_notes"]    = str(raw.get("usage_notes", "")).strip()
    entry["grammar_notes"]  = str(raw.get("grammar_notes", "")).strip()
    entry["confidence"]     = float(raw.get("confidence", 0.8))
    entry["ai_generated"]   = True
    entry["cached_at"]      = datetime.utcnow().isoformat()

    # Validate cefr_level
    if entry["cefr_level"] not in {"A1","A2","B1","B2","C1","C2"}:
        entry["cefr_level"] = "B1"

    # List fields — ensure they are lists of strings
    for field in ("synonyms", "antonyms", "related_words"):
        val = raw.get(field, [])
        entry[field] = [str(x) for x in val if x][:10] if isinstance(val, list) else []

    entry["collocations"] = [str(x) for x in raw.get("collocations", []) if x][:8] \
        if isinstance(raw.get("collocations"), list) else []

    # Examples — must contain term
    raw_examples = raw.get("examples", [])
    if isinstance(raw_examples, list):
        entry["examples"] = [str(x) for x in raw_examples if x][:5]
    else:
        entry["examples"] = []

    # Definitions — array of {text, context}
    raw_defs = raw.get("definitions", [])
    if isinstance(raw_defs, list):
        clean_defs = []
        for d in raw_defs[:4]:
            if isinstance(d, dict):
                clean_defs.append({
                    "text":    str(d.get("text", "")).strip(),
                    "context": str(d.get("context", "general")).strip(),
                })
            elif isinstance(d, str) and d.strip():
                clean_defs.append({"text": d.strip(), "context": "general"})
        entry["definitions"] = clean_defs
    else:
        entry["definitions"] = []

    return entry


# ══════════════════════════════════════════════════════════════════════════════
# GroqLanguageService
# ══════════════════════════════════════════════════════════════════════════════

class GroqLanguageService:
    """
    Central AI language intelligence service.

    Usage:
        service = GroqLanguageService(db_manager)
        entry   = await service.lookup("make a decision", groq_key)
        # entry is a fully validated LanguageEntry dict

    All lookup results are cached in the 'ai_language_cache' SQLite table.
    Subsequent lookups for the same term return instantly from cache.
    """

    def __init__(self, db_manager):
        self.db = db_manager
        self._ensure_table_task: Optional[asyncio.Task] = None

    async def ensure_table(self):
        """Create the cache table if it doesn't exist (idempotent)."""
        async with self.db.get_connection() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS ai_language_cache (
                    cache_key    TEXT PRIMARY KEY,
                    term         TEXT NOT NULL,
                    data_json    TEXT NOT NULL,
                    groq_used    INTEGER DEFAULT 0,
                    lookup_count INTEGER DEFAULT 0,
                    created_at   TEXT,
                    updated_at   TEXT
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_alc_term ON ai_language_cache(term)"
            )

    # ── Public API ────────────────────────────────────────────────────────────

    async def lookup(
        self,
        term: str,
        groq_key: Optional[str] = None,
        force_refresh: bool = False,
    ) -> Dict[str, Any]:
        """
        Look up any English term (word, phrase, idiom).

        Flow:
          1. Cache hit  → return immediately
          2. Groq call  → validate → cache → return
          3. Fallback   → empty structural entry
        """
        term = term.strip()
        if not term:
            return _empty_entry("")

        key = _cache_key(term)

        # ── 1. Cache hit ──────────────────────────────────────────────────────
        if not force_refresh:
            cached = await self._get_cached(key)
            if cached:
                await self._bump_count(key)
                return cached

        # ── 2. Groq call ──────────────────────────────────────────────────────
        if groq_key:
            entry = await self._call_groq(term, groq_key)
            if entry:
                await self._save_cache(key, term, entry, groq_used=True)
                return entry

        # ── 3. Return structural fallback (offline / no key) ──────────────────
        existing = await self._get_cached(key)
        if existing:
            return existing

        fallback = _empty_entry(term)
        # Don't cache the fallback — it has no real data
        return fallback

    async def lookup_phrase(
        self,
        phrase: str,
        groq_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Look up a multi-word phrase or sentence fragment.
        Identical to lookup() — the model handles all input types.
        """
        return await self.lookup(phrase, groq_key)

    async def get_cached(self, term: str) -> Optional[Dict[str, Any]]:
        """Return cached entry or None — never calls Groq."""
        return await self._get_cached(_cache_key(term))

    async def invalidate(self, term: str) -> None:
        """Remove a term from cache — next lookup will re-fetch."""
        key = _cache_key(term)
        async with self.db.get_connection() as conn:
            await conn.execute(
                "DELETE FROM ai_language_cache WHERE cache_key = ?", (key,)
            )

    # ── Internal helpers ──────────────────────────────────────────────────────

    async def _get_cached(self, key: str) -> Optional[Dict[str, Any]]:
        try:
            async with self.db.get_connection() as conn:
                async with conn.execute(
                    "SELECT data_json FROM ai_language_cache WHERE cache_key = ?",
                    (key,),
                ) as cur:
                    row = await cur.fetchone()
            if row:
                return json.loads(dict(row)["data_json"])
        except Exception as e:
            logger.debug(f"Cache read error: {e}")
        return None

    async def _save_cache(
        self, key: str, term: str, entry: Dict[str, Any], groq_used: bool = False
    ) -> None:
        try:
            now = datetime.utcnow().isoformat()
            async with self.db.get_connection() as conn:
                await conn.execute(
                    """INSERT INTO ai_language_cache
                       (cache_key, term, data_json, groq_used, lookup_count, created_at, updated_at)
                       VALUES (?, ?, ?, ?, 1, ?, ?)
                       ON CONFLICT(cache_key) DO UPDATE SET
                         data_json    = excluded.data_json,
                         groq_used    = excluded.groq_used,
                         lookup_count = lookup_count + 1,
                         updated_at   = excluded.updated_at""",
                    (key, term, json.dumps(entry, ensure_ascii=False),
                     1 if groq_used else 0, now, now),
                )
        except Exception as e:
            logger.debug(f"Cache write error: {e}")

    async def _bump_count(self, key: str) -> None:
        try:
            async with self.db.get_connection() as conn:
                await conn.execute(
                    "UPDATE ai_language_cache SET lookup_count = lookup_count + 1 WHERE cache_key = ?",
                    (key,),
                )
        except Exception:
            pass

    async def _call_groq(
        self, term: str, groq_key: str
    ) -> Optional[Dict[str, Any]]:
        """Call Groq and return a validated LanguageEntry or None."""
        payload = {
            "model":           GROQ_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": f"Look up: {term}"},
            ],
            "temperature":     0.2,
            "max_tokens":      800,
            "response_format": {"type": "json_object"},
        }
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    GROQ_URL,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {groq_key.strip()}",
                        "Content-Type":  "application/json",
                    },
                    timeout=TIMEOUT,
                ) as resp:
                    if resp.status == 429:
                        logger.info(f"Groq rate-limited for '{term}'")
                        return None
                    if resp.status == 401:
                        logger.warning("Invalid Groq API key")
                        return None
                    if resp.status != 200:
                        logger.debug(f"Groq {resp.status} for '{term}'")
                        return None
                    result = await resp.json()

            content = result["choices"][0]["message"]["content"]
            raw     = json.loads(content)
            return _validate_and_clean(raw, term)

        except json.JSONDecodeError as e:
            logger.debug(f"Groq JSON parse error for '{term}': {e}")
        except Exception as e:
            logger.debug(f"Groq call failed for '{term}': {e}")
        return None


# ── Singleton accessor (used by all API endpoints) ────────────────────────────

_service_instance: Optional[GroqLanguageService] = None


def get_service(db_manager=None) -> GroqLanguageService:
    """Return the singleton GroqLanguageService, initialising if needed."""
    global _service_instance
    if _service_instance is None:
        if db_manager is None:
            raise RuntimeError("GroqLanguageService not yet initialised — pass db_manager")
        _service_instance = GroqLanguageService(db_manager)
    return _service_instance


def init_service(db_manager) -> GroqLanguageService:
    """Initialise the singleton. Call once from main.py lifespan."""
    global _service_instance
    _service_instance = GroqLanguageService(db_manager)
    return _service_instance
