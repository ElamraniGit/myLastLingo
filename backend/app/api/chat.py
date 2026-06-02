"""
AI Chat API — conversational learning assistant.
Uses Groq API (free, fast) with full access to user's vocabulary data.
"""

import json
import uuid
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime

import aiohttp
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from backend.app.api.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()
db_manager = None

# Groq API — free tier, fast inference
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-8b-instant"

# FIX-SEC-4: Groq API keys are now stored PER USER in the users table.
#
# Previously a single key lived in data/.groq_key and a module global, which meant
# every user shared one key and any user could overwrite it via /chat/set-key.
# A legacy file key (if present) is used only as a last-resort fallback so existing
# single-user installs keep working.

async def _get_groq_key(user_id: str) -> Optional[str]:
    """Return this user's saved Groq key, falling back to a legacy file key."""
    if db_manager is not None:
        async with db_manager.get_connection() as conn:
            async with conn.execute(
                "SELECT groq_api_key FROM users WHERE id = ?", (user_id,)
            ) as cur:
                row = await cur.fetchone()
        if row:
            key = (dict(row).get("groq_api_key") or "").strip()
            if key:
                return key
    # Legacy fallback (single-user installs created before per-user keys)
    from pathlib import Path
    key_file = Path("data/.groq_key")
    if key_file.exists():
        legacy = key_file.read_text().strip()
        if legacy:
            return legacy
    return None


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None


class SetKeyRequest(BaseModel):
    api_key: str


@router.post("/message")
async def send_message(req: ChatRequest, current_user: dict = Depends(get_current_user)):
    """Send a message to the AI assistant with vocabulary context."""
    user_id = current_user["sub"]
    message = req.message.strip()

    if not message:
        raise HTTPException(400, "Message cannot be empty")

    api_key = await _get_groq_key(user_id)
    if not api_key:
        raise HTTPException(
            503,
            "AI not configured. Add your free Groq API key in Settings. "
            "Get one at: https://console.groq.com/keys"
        )

    # Gather user's vocabulary context
    context = await _build_user_context(user_id)

    # Build conversation
    conv_id = req.conversation_id or str(uuid.uuid4())

    # Get conversation history
    history = await _get_conversation_history(user_id, conv_id)

    system_prompt = f"""You are LinguaLearn AI, a friendly and expert English language tutor.
You help the user learn English through their saved vocabulary.

IMPORTANT RULES:
- Respond in English by default, but you can use Arabic for translations when asked.
- Keep responses concise and helpful (max 200 words unless asked for more).
- Use the user's saved words in examples when relevant.
- When creating stories or exercises, use words from their vocabulary.
- Be encouraging and supportive.

USER'S VOCABULARY DATA:
{context}

You can help with:
- Reviewing weak/difficult words
- Creating stories using their saved words
- Explaining grammar related to their words
- Creating exercises and quizzes
- Analyzing their learning progress
- Suggesting study strategies
- Translating and explaining word usage"""

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": message})

    # Call Groq API
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": messages,
                    "max_tokens": 1024,
                    "temperature": 0.7,
                },
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    logger.error(f"Groq API error: {resp.status} {error_text[:200]}")
                    raise HTTPException(502, "AI service error. Check your API key.")

                data = await resp.json()

        ai_reply = data["choices"][0]["message"]["content"].strip()

        # Save to conversation history
        await _save_message(user_id, conv_id, "user", message)
        await _save_message(user_id, conv_id, "assistant", ai_reply)

        return {
            "reply": ai_reply,
            "conversation_id": conv_id,
        }

    except aiohttp.ClientError as e:
        logger.error(f"Groq API connection error: {e}")
        raise HTTPException(502, "Could not connect to AI service. Check your internet.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(500, "Chat failed")


@router.post("/set-key")
async def set_api_key(req: SetKeyRequest, current_user: dict = Depends(get_current_user)):
    """Save the Groq API key for the CURRENT user only (FIX-SEC-4)."""
    key = req.api_key.strip()
    if not key or len(key) < 10:
        raise HTTPException(400, "Invalid API key")

    async with db_manager.get_connection() as conn:
        await conn.execute(
            "UPDATE users SET groq_api_key = ? WHERE id = ?",
            (key, current_user["sub"]),
        )

    return {"message": "API key saved"}


@router.get("/has-key")
async def check_api_key(current_user: dict = Depends(get_current_user)):
    """Check if the current user has an API key configured."""
    return {"has_key": bool(await _get_groq_key(current_user["sub"]))}


@router.get("/history")
async def get_history(
    conversation_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Get conversation history."""
    user_id = current_user["sub"]
    if conversation_id:
        messages = await _get_conversation_history(user_id, conversation_id)
    else:
        messages = await _get_recent_conversations(user_id)
    return {"messages": messages}


@router.delete("/history")
async def clear_history(current_user: dict = Depends(get_current_user)):
    """Clear all conversation history."""
    async with db_manager.get_connection() as conn:
        await conn.execute(
            "DELETE FROM chat_messages WHERE user_id = ?",
            (current_user["sub"],),
        )
    return {"message": "History cleared"}


# ── Internal helpers ─────────────────────────────────────────────

async def _build_user_context(user_id: str) -> str:
    """Build a summary of user's vocabulary for the AI."""
    async with db_manager.get_connection() as conn:
        # Total words
        async with conn.execute(
            "SELECT COUNT(*) as total FROM saved_words WHERE (user_id = ? OR user_id = '')",
            (user_id,),
        ) as cur:
            total = dict(await cur.fetchone())["total"]

        # Status breakdown
        async with conn.execute(
            """SELECT status, COUNT(*) as count FROM saved_words
               WHERE (user_id = ? OR user_id = '')
               GROUP BY status""",
            (user_id,),
        ) as cur:
            statuses = {dict(r)["status"]: dict(r)["count"] for r in await cur.fetchall()}

        # Weak words (most lapses)
        async with conn.execute(
            """SELECT w.word, w.meaning_ar, w.meaning_en, sw.lapses, sw.reviewed_count, sw.status
               FROM saved_words sw JOIN words w ON sw.word_id = w.id
               WHERE (sw.user_id = ? OR sw.user_id = '')
               ORDER BY sw.lapses DESC, sw.reviewed_count ASC
               LIMIT 10""",
            (user_id,),
        ) as cur:
            weak = [dict(r) for r in await cur.fetchall()]

        # Recent words
        async with conn.execute(
            """SELECT w.word, w.meaning_ar, w.meaning_en, sw.status
               FROM saved_words sw JOIN words w ON sw.word_id = w.id
               WHERE (sw.user_id = ? OR sw.user_id = '')
               ORDER BY sw.created_at DESC LIMIT 10""",
            (user_id,),
        ) as cur:
            recent = [dict(r) for r in await cur.fetchall()]

        # All words list (for story generation)
        async with conn.execute(
            """SELECT w.word FROM saved_words sw
               JOIN words w ON sw.word_id = w.id
               WHERE (sw.user_id = ? OR sw.user_id = '')
               ORDER BY w.word""",
            (user_id,),
        ) as cur:
            all_words = [dict(r)["word"] for r in await cur.fetchall()]

    lines = [
        f"Total saved words: {total}",
        f"Learning: {statuses.get('learning', 0)}, Reviewing: {statuses.get('reviewing', 0)}, Learned: {statuses.get('learned', 0)}",
        "",
        "All saved words: " + ", ".join(all_words[:50]) + ("..." if len(all_words) > 50 else ""),
        "",
        "Weakest words (most mistakes):",
    ]
    for w in weak[:5]:
        lines.append(f"  - {w['word']} ({w['meaning_ar'] or w['meaning_en']}) — {w['lapses']} lapses, status: {w['status']}")

    lines.append("")
    lines.append("Most recently saved:")
    for w in recent[:5]:
        lines.append(f"  - {w['word']} ({w['meaning_ar'] or w['meaning_en']}) — {w['status']}")

    return "\n".join(lines)


async def _get_conversation_history(user_id: str, conv_id: str) -> List[Dict]:
    """Get last 20 messages of a conversation."""
    async with db_manager.get_connection() as conn:
        async with conn.execute(
            """SELECT role, content FROM chat_messages
               WHERE user_id = ? AND conversation_id = ?
               ORDER BY created_at ASC LIMIT 20""",
            (user_id, conv_id),
        ) as cur:
            return [dict(r) for r in await cur.fetchall()]


async def _get_recent_conversations(user_id: str) -> List[Dict]:
    """Get last 30 messages across all conversations."""
    async with db_manager.get_connection() as conn:
        async with conn.execute(
            """SELECT role, content, conversation_id, created_at
               FROM chat_messages WHERE user_id = ?
               ORDER BY created_at DESC LIMIT 30""",
            (user_id,),
        ) as cur:
            return [dict(r) for r in await cur.fetchall()]


async def _save_message(user_id: str, conv_id: str, role: str, content: str):
    """Save a message to the database."""
    async with db_manager.get_connection() as conn:
        await conn.execute(
            """INSERT INTO chat_messages (id, user_id, conversation_id, role, content, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (str(uuid.uuid4()), user_id, conv_id, role, content,
             datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")),
        )


def init_api(db):
    global db_manager
    db_manager = db
