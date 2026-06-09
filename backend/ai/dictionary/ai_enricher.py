"""
ai_enricher.py — Professional AI enrichment via Groq (free tier).

Enriches word data with:
  ✓ Clear learner-friendly English definition
  ✓ Accurate contextual Arabic translation
  ✓ 3 natural native-speaker example sentences
  ✓ Practical usage tip (collocations, register, common mistakes)
  ✓ 4 common collocations / phrases
  ✓ Common mistake to avoid

Uses llama-3.3-70b-versatile — best free model on Groq.
Falls back silently if key absent, rate-limited, or API down.
Result is cached in SQLite — AI runs at most once per word per user.
"""

import json
import logging
from typing import Dict, Any, Optional

import aiohttp

logger = logging.getLogger(__name__)

GROQ_URL    = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL  = "llama-3.3-70b-versatile"
TIMEOUT     = aiohttp.ClientTimeout(total=25)

SYSTEM_PROMPT = """\
You are an expert English dictionary for Arabic-speaking learners (A2–C1 level).
Given an English word with optional context, return ONLY a valid JSON object.

Required format:
{
  "meaning_en": "A single clear sentence defining the word. Simple language, no jargon.",
  "meaning_ar": "الترجمة العربية الدقيقة في سياقها الصحيح — ليس ترجمة حرفية",
  "examples": [
    "First natural sentence using the word — like a native speaker would say it.",
    "Second example in a clearly different context.",
    "Third example, slightly more advanced usage."
  ],
  "usage_tip": "One concrete tip: a common collocation, typical grammatical pattern, register note (formal/informal), or frequent learner mistake to avoid. Max 25 words.",
  "collocations": [
    "collocation phrase 1",
    "collocation phrase 2",
    "collocation phrase 3",
    "collocation phrase 4"
  ],
  "common_mistake": "One sentence describing a typical Arabic-speaker mistake with this word, and the correct usage."
}

Strict rules:
- Return ONLY the JSON object. Zero markdown, zero extra text.
- meaning_en: avoid repeating the word in the definition. Simple vocabulary.
- meaning_ar: context-aware, natural Arabic — NOT dictionary transliteration.
- examples: all 3 must contain the word. Natural, varied contexts. No "textbook" sentences.
- collocations: real multi-word expressions (verb+noun, adj+noun, adverb+verb patterns).
- common_mistake: practical and specific, not generic advice.
"""


async def enrich_word(
    word: str,
    base_data: Dict[str, Any],
    groq_api_key: Optional[str],
) -> Dict[str, Any]:
    """
    Enrich a word entry with AI-generated content.
    Returns base_data unchanged on any failure.
    """
    if not groq_api_key or not groq_api_key.strip():
        return base_data

    # Build rich context for the model
    ctx_parts = [f"Word: {word}"]
    if base_data.get("part_of_speech") not in (None, "", "unknown"):
        ctx_parts.append(f"Part of speech: {base_data['part_of_speech']}")
    if base_data.get("level"):
        ctx_parts.append(f"CEFR level: {base_data['level']}")
    if base_data.get("meaning_en"):
        ctx_parts.append(f"Base definition: {base_data['meaning_en']}")
    if base_data.get("meaning_ar"):
        ctx_parts.append(f"Current Arabic translation: {base_data['meaning_ar']}")

    # Add existing examples as context (model may improve them)
    existing_ex = (base_data.get("examples") or [])[:2]
    if existing_ex:
        ctx_parts.append("Existing examples: " + " | ".join(existing_ex))

    # Add synonyms as context
    syns = (base_data.get("synonyms") or [])[:4]
    if syns:
        ctx_parts.append(f"Synonyms: {', '.join(syns)}")

    user_message = "\n".join(ctx_parts)

    payload = {
        "model":       GROQ_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_message},
        ],
        "temperature":    0.25,   # low for factual accuracy
        "max_tokens":     600,
        "response_format": {"type": "json_object"},
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                GROQ_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {groq_api_key.strip()}",
                    "Content-Type":  "application/json",
                },
                timeout=TIMEOUT,
            ) as resp:

                if resp.status == 429:
                    logger.info(f"Groq rate-limited for '{word}' — using base data")
                    return base_data
                if resp.status == 401:
                    logger.warning("Invalid Groq API key")
                    return base_data
                if resp.status != 200:
                    body = await resp.text()
                    logger.debug(f"Groq {resp.status} for '{word}': {body[:200]}")
                    return base_data

                result = await resp.json()

        content = result["choices"][0]["message"]["content"]
        ai = json.loads(content)

    except json.JSONDecodeError as e:
        logger.debug(f"AI JSON parse error for '{word}': {e}")
        return base_data
    except Exception as e:
        logger.debug(f"AI enrichment failed for '{word}': {e}")
        return base_data

    # ── Merge AI data into base_data ─────────────────────────────────────────
    enriched = dict(base_data)

    # English definition
    new_en = (ai.get("meaning_en") or "").strip()
    if new_en and len(new_en) > 10 and word.lower() not in new_en.lower()[:20]:
        enriched["meaning_en"] = new_en

    # Arabic translation
    new_ar = (ai.get("meaning_ar") or "").strip()
    if new_ar and len(new_ar) > 1:
        enriched["meaning_ar"] = new_ar

    # Examples — AI examples first (better quality), then originals
    ai_examples = [
        e.strip() for e in (ai.get("examples") or [])
        if isinstance(e, str) and e.strip() and word.lower() in e.lower()
    ]
    base_examples = [
        e for e in (enriched.get("examples") or [])
        if e not in ai_examples
    ]
    enriched["examples"] = (ai_examples + base_examples)[:5]

    # Usage tip — replaces heuristic tip as lead item
    tip = (ai.get("usage_tip") or "").strip()
    existing_tips = [
        t for t in (enriched.get("how_to_use") or [])
        if t != tip and "is a verb" not in t and "is a noun" not in t
    ]
    if tip:
        enriched["how_to_use"] = [tip] + existing_tips[:2]

    # Common mistake → add as an additional tip
    mistake = (ai.get("common_mistake") or "").strip()
    if mistake and len(mistake) > 10:
        enriched["how_to_use"] = (enriched.get("how_to_use") or []) + [f"⚠ {mistake}"]

    # Collocations → prepend to related_words
    collocs = [
        c.strip() for c in (ai.get("collocations") or [])
        if isinstance(c, str) and c.strip()
    ]
    existing_related = [r for r in (enriched.get("related_words") or []) if r not in collocs]
    if collocs:
        enriched["related_words"] = (collocs + existing_related)[:8]

    enriched["ai_enriched"] = True
    logger.info(f"AI enriched '{word}' successfully")
    return enriched


async def get_groq_key_for_request(db_manager, user_id: str) -> Optional[str]:
    """Fetch user's Groq API key from DB. Returns None if not set."""
    if not db_manager or not user_id:
        return None
    try:
        async with db_manager.get_connection() as conn:
            async with conn.execute(
                "SELECT groq_api_key FROM users WHERE id = ?", (user_id,)
            ) as cur:
                row = await cur.fetchone()
        if row:
            from backend.app.utils.crypto import decrypt_secret
            key = decrypt_secret((dict(row).get("groq_api_key") or "").strip())
            return key if key else None
    except Exception:
        pass
    return None
