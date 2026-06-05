"""
ai_enricher.py — AI-powered dictionary enrichment using Groq (free).

Uses the user's own Groq API key (stored per-user in DB) to enrich
word data from dictionaryapi.dev with:
  - Better English definition (cleaner, more learner-friendly)
  - Better Arabic translation (context-aware, not literal)
  - 2 native example sentences
  - Usage tip (common mistakes, collocations, register)
  - Related phrases / collocations

Falls back silently if:
  - User has no Groq key
  - Groq API is down or rate-limited
  - Network is unavailable

The enriched data is merged into the existing word entry and
cached in SQLite — so AI enrichment runs at most ONCE per word.
"""

import json
import logging
from typing import Dict, Any, Optional

import aiohttp

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL   = "llama-3.3-70b-versatile"   # best free model on Groq
TIMEOUT      = aiohttp.ClientTimeout(total=20)

SYSTEM_PROMPT = """You are an expert English dictionary AI for language learners.
When given an English word, respond ONLY with a valid JSON object in this exact format:

{
  "meaning_en": "A clear, simple definition suitable for intermediate English learners. One sentence, plain language.",
  "meaning_ar": "الترجمة العربية الدقيقة في سياقها الصحيح",
  "examples": [
    "A natural example sentence using the word naturally.",
    "Another example in a different context."
  ],
  "usage_tip": "One practical tip: common collocations, register (formal/informal), common mistakes, or grammar pattern.",
  "collocations": ["common phrase 1", "common phrase 2", "common phrase 3"]
}

Rules:
- Return ONLY the JSON object. No markdown, no explanation, no extra text.
- meaning_en: simple, clear, avoid circular definitions
- meaning_ar: accurate contextual Arabic translation (not literal word-for-word)
- examples: natural native-speaker sentences, not textbook boring
- usage_tip: practical, actionable, short (max 20 words)
- collocations: 3 common multi-word expressions with this word
"""


async def enrich_word(
    word: str,
    base_data: Dict[str, Any],
    groq_api_key: Optional[str],
) -> Dict[str, Any]:
    """
    Enrich a word entry with AI-generated content.

    Args:
        word:         The English word to enrich.
        base_data:    Existing word data (from dictionaryapi.dev or heuristic).
        groq_api_key: User's Groq API key (may be None).

    Returns:
        Merged dict — base_data updated with AI improvements.
        On any failure, returns base_data unchanged.
    """
    if not groq_api_key or not groq_api_key.strip():
        return base_data

    # Build context for the AI
    context_parts = [f"Word: {word}"]
    if base_data.get("part_of_speech") and base_data["part_of_speech"] != "unknown":
        context_parts.append(f"Part of speech: {base_data['part_of_speech']}")
    if base_data.get("meaning_en"):
        context_parts.append(f"Base definition: {base_data['meaning_en']}")
    if base_data.get("meaning_ar"):
        context_parts.append(f"Current Arabic: {base_data['meaning_ar']}")

    user_message = "\n".join(context_parts)

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_message},
        ],
        "temperature": 0.3,   # low temp for factual accuracy
        "max_tokens":  400,
        "response_format": {"type": "json_object"},
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                GROQ_API_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {groq_api_key}",
                    "Content-Type":  "application/json",
                },
                timeout=TIMEOUT,
            ) as resp:
                if resp.status == 429:
                    logger.info(f"Groq rate-limited for '{word}' — using base data")
                    return base_data
                if resp.status != 200:
                    logger.debug(f"Groq API {resp.status} for '{word}'")
                    return base_data

                result = await resp.json()

        content = result["choices"][0]["message"]["content"]
        ai = json.loads(content)

        # Merge AI data into base_data (AI wins if better)
        enriched = dict(base_data)

        if ai.get("meaning_en") and len(ai["meaning_en"]) > 5:
            enriched["meaning_en"] = ai["meaning_en"]

        if ai.get("meaning_ar") and len(ai["meaning_ar"]) > 1:
            enriched["meaning_ar"] = ai["meaning_ar"]

        # Prepend AI examples (they're usually better) then keep originals
        ai_examples = [e for e in (ai.get("examples") or []) if isinstance(e, str) and e.strip()]
        base_examples = enriched.get("examples") or []
        merged_examples = ai_examples + [e for e in base_examples if e not in ai_examples]
        enriched["examples"] = merged_examples[:5]

        # Add usage tip to how_to_use
        tip = (ai.get("usage_tip") or "").strip()
        if tip:
            existing = enriched.get("how_to_use") or []
            enriched["how_to_use"] = [tip] + [h for h in existing if h != tip][:3]

        # Add collocations to related_words
        collocations = [c for c in (ai.get("collocations") or []) if isinstance(c, str) and c.strip()]
        if collocations:
            existing_related = enriched.get("related_words") or []
            enriched["related_words"] = (collocations + existing_related)[:6]

        enriched["ai_enriched"] = True
        logger.info(f"AI enriched '{word}' successfully")
        return enriched

    except json.JSONDecodeError as e:
        logger.debug(f"AI enrichment JSON parse error for '{word}': {e}")
        return base_data
    except Exception as e:
        logger.debug(f"AI enrichment failed for '{word}': {e}")
        return base_data


async def get_groq_key_for_request(db_manager, user_id: str) -> Optional[str]:
    """
    Fetch the user's Groq API key from the database.
    Returns None if not set.
    """
    if db_manager is None or not user_id:
        return None
    try:
        async with db_manager.get_connection() as conn:
            async with conn.execute(
                "SELECT groq_api_key FROM users WHERE id = ?", (user_id,)
            ) as cur:
                row = await cur.fetchone()
        if row:
            key = (dict(row).get("groq_api_key") or "").strip()
            return key if key else None
    except Exception:
        pass
    return None
