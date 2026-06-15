"""
Production Practice API — "write a sentence" exercises with AI feedback.

The user writes their own sentence using a target word; Groq evaluates it and
returns structured feedback (correctness, a corrected version, grammar notes,
naturalness, and a short tip). This moves learning from recognition → production.

Endpoint:
  POST /practice/check-sentence  — evaluate a user's sentence using a target word
"""

import json
import logging
from typing import Optional, List

import aiohttp
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.app.api.auth import get_current_user
from backend.app.utils.crypto import decrypt_secret

logger     = logging.getLogger(__name__)
router     = APIRouter()
db_manager = None

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL    = "llama-3.3-70b-versatile"
TIMEOUT  = aiohttp.ClientTimeout(total=30)


# ── Models ────────────────────────────────────────────────────────────────────

class CheckSentenceRequest(BaseModel):
    word: str
    sentence: str
    meaning: Optional[str] = ""   # optional EN meaning to ground the evaluation


class SentenceFeedback(BaseModel):
    correct: bool
    uses_word: bool
    score: int                    # 0–100 overall quality
    corrected: str
    feedback: str                 # one or two friendly sentences
    grammar_notes: List[str]
    naturalness: str              # 'natural' | 'understandable' | 'unnatural'
    tip: str


# ── Groq key helper ───────────────────────────────────────────────────────────

async def _get_groq_key(user_id: str) -> Optional[str]:
    if not db_manager or not user_id:
        return None
    try:
        async with db_manager.get_connection() as conn:
            async with conn.execute(
                "SELECT groq_api_key FROM users WHERE id = ?", (user_id,)
            ) as cur:
                row = await cur.fetchone()
        if row:
            key = decrypt_secret((dict(row).get("groq_api_key") or "").strip())
            return key or None
    except Exception:
        pass
    return None


# ── Prompt ────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = (
    "You are a friendly, encouraging English writing tutor for Arabic-speaking "
    "learners. The student writes a sentence using a target word. Evaluate it and "
    "respond with STRICT JSON only (no markdown, no extra text) using exactly these keys:\n"
    '{\n'
    '  "correct": boolean,            // true if the sentence is grammatically acceptable\n'
    '  "uses_word": boolean,          // true if the target word is used meaningfully (any inflection ok)\n'
    '  "score": number,               // 0-100 overall quality\n'
    '  "corrected": string,           // corrected/improved version; if already perfect, repeat it\n'
    '  "feedback": string,            // 1-2 short encouraging sentences in simple English\n'
    '  "grammar_notes": string[],     // 0-3 concise notes about specific errors (empty if none)\n'
    '  "naturalness": string,         // one of: "natural", "understandable", "unnatural"\n'
    '  "tip": string                  // one short actionable tip to improve\n'
    '}\n'
    "Be supportive. If the word is missing or misused, set uses_word=false and explain kindly. "
    "Keep all text concise."
)


def _fallback(word: str, sentence: str) -> dict:
    """Deterministic offline-ish fallback when the AI is unavailable."""
    uses = word.lower().split(" ")[0] in sentence.lower()
    return {
        "correct": False,
        "uses_word": uses,
        "score": 0,
        "corrected": sentence.strip(),
        "feedback": "AI feedback isn't available right now. Add your Groq API key in "
                    "Settings to get detailed corrections.",
        "grammar_notes": [],
        "naturalness": "understandable",
        "tip": "Try reading your sentence aloud to check it sounds natural.",
    }


def _coerce(raw: dict, word: str, sentence: str) -> dict:
    """Validate/normalise the model output into the expected shape."""
    def _s(v, d=""):  return str(v).strip() if v is not None else d
    def _b(v):        return bool(v)
    naturalness = _s(raw.get("naturalness")).lower()
    if naturalness not in ("natural", "understandable", "unnatural"):
        naturalness = "understandable"
    notes = raw.get("grammar_notes") or []
    if isinstance(notes, str):
        notes = [notes] if notes.strip() else []
    notes = [str(n).strip() for n in notes if str(n).strip()][:3]
    try:
        score = int(round(float(raw.get("score", 0))))
    except (TypeError, ValueError):
        score = 0
    score = max(0, min(100, score))
    return {
        "correct":      _b(raw.get("correct")),
        "uses_word":    _b(raw.get("uses_word")),
        "score":        score,
        "corrected":    _s(raw.get("corrected"), sentence.strip()),
        "feedback":     _s(raw.get("feedback"), "Good effort!"),
        "grammar_notes": notes,
        "naturalness":  naturalness,
        "tip":          _s(raw.get("tip")),
    }


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/check-sentence")
async def check_sentence(
    req: CheckSentenceRequest,
    current_user: dict = Depends(get_current_user),
):
    word = (req.word or "").strip()
    sentence = (req.sentence or "").strip()
    if not word:
        raise HTTPException(400, "Missing target word")
    if len(sentence) < 2:
        raise HTTPException(400, "Please write a sentence first")
    if len(sentence) > 500:
        raise HTTPException(400, "Sentence is too long (max 500 characters)")

    api_key = await _get_groq_key(current_user["sub"])
    if not api_key:
        # Graceful fallback so the feature still gives basic feedback.
        return _fallback(word, sentence)

    user_prompt = (
        f'Target word: "{word}"\n'
        + (f'Meaning: {req.meaning.strip()}\n' if req.meaning else "")
        + f'Student sentence: "{sentence}"\n\n'
        "Evaluate and reply with the JSON object only."
    )

    try:
        async with aiohttp.ClientSession(timeout=TIMEOUT) as session:
            async with session.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": MODEL,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 600,
                    "response_format": {"type": "json_object"},
                },
            ) as resp:
                if resp.status != 200:
                    logger.info("Practice check: Groq status %s", resp.status)
                    return _fallback(word, sentence)
                data = await resp.json()
        content = data["choices"][0]["message"]["content"]
        return _coerce(json.loads(content), word, sentence)
    except Exception as e:
        logger.warning("check_sentence failed: %s", e)
        return _fallback(word, sentence)


# ── Mnemonic (memory hook) generation ────────────────────────────────────────

class MnemonicRequest(BaseModel):
    word: str
    meaning_ar: Optional[str] = ""
    meaning_en: Optional[str] = ""
    refresh: bool = False   # force a new mnemonic instead of the cached one


MNEMONIC_SYSTEM_PROMPT = (
    "You are a memory-technique coach for Arabic-speaking English learners. "
    "Create a vivid, memorable mnemonic that helps the learner remember an English "
    "word and its meaning. Reply with STRICT JSON only (no markdown) using exactly:\n"
    '{\n'
    '  "hook": string,    // 1 short, vivid sentence (English) linking the word\'s sound/spelling to its meaning\n'
    '  "hook_ar": string, // the same memory idea in simple Arabic (this is the key line for the learner)\n'
    '  "sound_link": string, // what English/Arabic word the target SOUNDS like, used in the hook\n'
    '  "image": string,   // a short, concrete mental image to picture\n'
    '  "tip": string      // one short extra tip (English)\n'
    '}\n'
    "Rules: keep it concrete and visual; use sound-alikes; be culturally appropriate "
    "for Arabic speakers; keep every field short. hook_ar MUST be natural Arabic."
)


async def _ensure_mnemonic_table():
    if not db_manager:
        return
    async with db_manager.get_connection() as conn:
        await conn.execute(
            """CREATE TABLE IF NOT EXISTS mnemonics (
                   word        TEXT PRIMARY KEY,
                   data_json   TEXT NOT NULL,
                   created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
               )"""
        )


async def _get_cached_mnemonic(word: str) -> Optional[dict]:
    try:
        async with db_manager.get_connection() as conn:
            async with conn.execute(
                "SELECT data_json FROM mnemonics WHERE word = ?", (word.lower(),)
            ) as cur:
                row = await cur.fetchone()
        return json.loads(dict(row)["data_json"]) if row else None
    except Exception:
        return None


async def _save_mnemonic(word: str, data: dict) -> None:
    try:
        async with db_manager.get_connection() as conn:
            await conn.execute(
                "INSERT OR REPLACE INTO mnemonics (word, data_json) VALUES (?, ?)",
                (word.lower(), json.dumps(data, ensure_ascii=False)),
            )
    except Exception:
        pass


def _mnemonic_coerce(raw: dict) -> dict:
    def _s(v):
        return str(v).strip() if v is not None else ""
    return {
        "hook":       _s(raw.get("hook")),
        "hook_ar":    _s(raw.get("hook_ar")),
        "sound_link": _s(raw.get("sound_link")),
        "image":      _s(raw.get("image")),
        "tip":        _s(raw.get("tip")),
    }


@router.post("/mnemonic")
async def generate_mnemonic(
    req: MnemonicRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Generate (or return a cached) memory hook / mnemonic for a word.
    Mnemonics are reusable, so they are cached and shared across users.
    """
    word = (req.word or "").strip()
    if not word:
        raise HTTPException(400, "Missing word")

    await _ensure_mnemonic_table()

    # Serve from cache unless a fresh one is requested.
    if not req.refresh:
        cached = await _get_cached_mnemonic(word)
        if cached:
            return {**cached, "cached": True}

    api_key = await _get_groq_key(current_user["sub"])
    if not api_key:
        raise HTTPException(
            503, "AI not configured. Add your Groq API key in Settings to generate mnemonics."
        )

    user_prompt = (
        f'Word: "{word}"\n'
        + (f'English meaning: {req.meaning_en.strip()}\n' if req.meaning_en else "")
        + (f'Arabic meaning: {req.meaning_ar.strip()}\n' if req.meaning_ar else "")
        + "Create the memory hook now. Reply with the JSON object only."
    )

    try:
        async with aiohttp.ClientSession(timeout=TIMEOUT) as session:
            async with session.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": MODEL,
                    "messages": [
                        {"role": "system", "content": MNEMONIC_SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    # A touch of creativity helps mnemonics; still bounded.
                    "temperature": 0.7 if req.refresh else 0.5,
                    "max_tokens": 400,
                    "response_format": {"type": "json_object"},
                },
            ) as resp:
                if resp.status != 200:
                    logger.info("Mnemonic: Groq status %s", resp.status)
                    raise HTTPException(502, "AI service error")
                data = await resp.json()
        content = data["choices"][0]["message"]["content"]
        result = _mnemonic_coerce(json.loads(content))
        if not result["hook"] and not result["hook_ar"]:
            raise HTTPException(502, "Could not generate a mnemonic")
        await _save_mnemonic(word, result)
        return {**result, "cached": False}
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("generate_mnemonic failed: %s", e)
        raise HTTPException(500, "Failed to generate mnemonic")


def init_api(db):
    global db_manager
    db_manager = db
