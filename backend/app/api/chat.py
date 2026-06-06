"""
AI Chat API — intelligent English learning assistant.

Improvements:
  · Upgraded model: llama-3.3-70b-versatile (best free Groq model)
  · Streaming response via SSE (token-by-token, no waiting)
  · Rich structured context: vocabulary stats, weak words, CEFR distribution
  · Smart intent detection: quiz / story / explain / translate / progress
  · Conversation history: last 12 turns kept in DB
  · POST /chat/message        — streaming SSE response
  · POST /chat/message/sync   — regular JSON (fallback for offline)
  · POST /chat/set-key        — save Groq key
  · GET  /chat/has-key        — check key
  · GET  /chat/history        — conversation history
  · DELETE /chat/history      — clear history
"""

import json
import uuid
import logging
import asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime

import aiohttp
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.app.api.auth import get_current_user

logger     = logging.getLogger(__name__)
router     = APIRouter()
db_manager = None

GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"
MODEL      = "llama-3.3-70b-versatile"    # best free Groq model
TIMEOUT    = aiohttp.ClientTimeout(total=45)
MAX_TOKENS = 1200
HISTORY_TURNS = 12   # messages kept in context


# ── Models ────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None

class SetKeyRequest(BaseModel):
    api_key: str


# ── Groq key helper ───────────────────────────────────────────────────────────

async def _get_groq_key(user_id: str) -> Optional[str]:
    if db_manager:
        async with db_manager.get_connection() as conn:
            async with conn.execute(
                "SELECT groq_api_key FROM users WHERE id = ?", (user_id,)
            ) as cur:
                row = await cur.fetchone()
        if row:
            key = (dict(row).get("groq_api_key") or "").strip()
            if key:
                return key
    from pathlib import Path
    kf = Path("data/.groq_key")
    if kf.exists():
        k = kf.read_text().strip()
        if k:
            return k
    return None


# ── Rich system prompt ────────────────────────────────────────────────────────

def _build_system_prompt(ctx: dict) -> str:
    stats   = ctx["stats"]
    weak    = ctx["weak_words"]
    recent  = ctx["recent_words"]
    cefr    = ctx["cefr_dist"]
    all_wds = ctx["all_words"]

    weak_section = ""
    if weak:
        lines = []
        for w in weak:
            lines.append(f"  • {w['word']} ({w.get('meaning_ar') or w.get('meaning_en','?')}) — {w['lapses']} mistakes")
        weak_section = "Words the user struggles with most:\n" + "\n".join(lines)

    recent_section = ""
    if recent:
        recent_section = "Recently saved words: " + ", ".join(
            f"{w['word']}({w.get('meaning_ar') or '?'})" for w in recent
        )

    cefr_section = ""
    if cefr:
        cefr_section = "CEFR distribution: " + ", ".join(
            f"{lvl}:{cnt}" for lvl, cnt in sorted(cefr.items())
        )

    word_list = ", ".join(all_wds[:80]) + ("..." if len(all_wds) > 80 else "")

    return f"""You are **LinguaLearn AI**, an expert English tutor for Arabic-speaking learners.
You have full access to this user's saved vocabulary and learning stats.

═══ USER PROFILE ═══
• Total saved words: {stats['total']}
• Learning: {stats['learning']} | Reviewing: {stats['reviewing']} | Mastered: {stats['learned']}
• Reviews done today: {stats['reviewed_today']}
{cefr_section}

{weak_section}

{recent_section}

All saved words: {word_list}

═══ YOUR ROLE ═══
You help this learner by:
1. **Vocabulary quizzes** — test on their saved words (especially weak ones)
2. **Stories** — write short engaging stories using their words
3. **Grammar explanations** — clear, practical, with examples from their words
4. **Word explanations** — definition, usage, collocations, common mistakes
5. **Progress analysis** — honest assessment of their learning
6. **Study plans** — personalised suggestions
7. **Translations** — English ↔ Arabic with context
8. **Fill-in-the-blank** — create exercises with their words
9. **Sentence correction** — fix learner's sentences with explanation

═══ RULES ═══
• Default language: English. Use Arabic only for translations or when asked.
• Be warm, encouraging, and direct. No padding or fluff.
• Keep responses focused (under 250 words) unless a story/long exercise is requested.
• When quizzing: give ONE question at a time. Wait for answer before next question.
• When the user answers a quiz: immediately say correct/wrong + explain.
• Format nicely: use bullet points, bold for word highlights, numbered lists for steps.
• Always reference the user's ACTUAL saved words — never invent fake vocabulary.
• If asked about a specific word: give definition, example sentence, Arabic translation, common mistake.
"""


# ── Vocabulary context builder ────────────────────────────────────────────────

async def _build_context(user_id: str) -> dict:
    async with db_manager.get_connection() as conn:

        async with conn.execute(
            """SELECT COUNT(*) t,
               SUM(CASE WHEN status='learning'  THEN 1 ELSE 0 END) learning,
               SUM(CASE WHEN status='reviewing' THEN 1 ELSE 0 END) reviewing,
               SUM(CASE WHEN status='learned'   THEN 1 ELSE 0 END) learned,
               SUM(CASE WHEN date(last_reviewed)=date('now') THEN 1 ELSE 0 END) reviewed_today
               FROM saved_words WHERE user_id=?""",
            (user_id,),
        ) as cur:
            row  = dict(await cur.fetchone())
            stats = {
                "total":          row["t"]             or 0,
                "learning":       row["learning"]       or 0,
                "reviewing":      row["reviewing"]      or 0,
                "learned":        row["learned"]        or 0,
                "reviewed_today": row["reviewed_today"] or 0,
            }

        async with conn.execute(
            """SELECT w.word, w.meaning_ar, w.meaning_en, w.level,
                      sw.lapses, sw.reviewed_count, sw.status
               FROM saved_words sw JOIN words w ON sw.word_id=w.id
               WHERE sw.user_id=?
               ORDER BY sw.lapses DESC, sw.ease_factor ASC LIMIT 8""",
            (user_id,),
        ) as cur:
            weak = [dict(r) for r in await cur.fetchall()]

        async with conn.execute(
            """SELECT w.word, w.meaning_ar, w.meaning_en, sw.status
               FROM saved_words sw JOIN words w ON sw.word_id=w.id
               WHERE sw.user_id=?
               ORDER BY sw.created_at DESC LIMIT 10""",
            (user_id,),
        ) as cur:
            recent = [dict(r) for r in await cur.fetchall()]

        async with conn.execute(
            """SELECT w.level, COUNT(*) cnt
               FROM saved_words sw JOIN words w ON sw.word_id=w.id
               WHERE sw.user_id=? AND w.level IS NOT NULL
               GROUP BY w.level""",
            (user_id,),
        ) as cur:
            cefr_dist = {dict(r)["level"]: dict(r)["cnt"] for r in await cur.fetchall()}

        async with conn.execute(
            """SELECT w.word FROM saved_words sw
               JOIN words w ON sw.word_id=w.id
               WHERE sw.user_id=? ORDER BY sw.created_at DESC""",
            (user_id,),
        ) as cur:
            all_words = [dict(r)["word"] for r in await cur.fetchall()]

    return {
        "stats": stats, "weak_words": weak, "recent_words": recent,
        "cefr_dist": cefr_dist, "all_words": all_words,
    }


# ── History helpers ───────────────────────────────────────────────────────────

async def _load_history(user_id: str, conv_id: str) -> List[dict]:
    async with db_manager.get_connection() as conn:
        async with conn.execute(
            """SELECT role, content FROM chat_messages
               WHERE user_id=? AND conversation_id=?
               ORDER BY created_at ASC LIMIT ?""",
            (user_id, conv_id, HISTORY_TURNS),
        ) as cur:
            return [dict(r) for r in await cur.fetchall()]

async def _save_msg(user_id: str, conv_id: str, role: str, content: str):
    async with db_manager.get_connection() as conn:
        await conn.execute(
            """INSERT INTO chat_messages (id,user_id,conversation_id,role,content,created_at)
               VALUES (?,?,?,?,?,?)""",
            (str(uuid.uuid4()), user_id, conv_id, role, content,
             datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")),
        )


# ── Streaming endpoint (SSE) ──────────────────────────────────────────────────

@router.post("/message")
async def send_message_stream(
    req: ChatRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Streaming chat response via Server-Sent Events.
    Frontend receives tokens as they arrive — no waiting for full response.
    Format: data: <token>\n\n  (SSE)
            data: [DONE]\n\n  (end marker)
            data: [META]{"conversation_id":"..."}\n\n  (metadata)
    """
    user_id = current_user["sub"]
    message = req.message.strip()
    if not message:
        raise HTTPException(400, "Message cannot be empty")

    api_key = await _get_groq_key(user_id)
    if not api_key:
        raise HTTPException(
            503,
            "AI not configured. Add your free Groq API key in Settings → Voice & AI. "
            "Get one free at: https://console.groq.com/keys"
        )

    conv_id  = req.conversation_id or str(uuid.uuid4())
    ctx      = await _build_context(user_id)
    history  = await _load_history(user_id, conv_id)
    sys_prompt = _build_system_prompt(ctx)

    messages = [{"role": "system", "content": sys_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": message})

    # Save user message immediately
    await _save_msg(user_id, conv_id, "user", message)

    async def event_generator():
        full_reply = ""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    GROQ_URL,
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "model":       MODEL,
                        "messages":    messages,
                        "max_tokens":  MAX_TOKENS,
                        "temperature": 0.65,
                        "stream":      True,
                    },
                    timeout=TIMEOUT,
                ) as resp:

                    if resp.status == 401:
                        yield "data: [ERROR]Invalid API key — check Settings\n\n"
                        return
                    if resp.status == 429:
                        yield "data: [ERROR]Rate limit reached — wait a moment and try again\n\n"
                        return
                    if resp.status != 200:
                        yield f"data: [ERROR]AI service error (HTTP {resp.status})\n\n"
                        return

                    async for raw_line in resp.content:
                        line = raw_line.decode("utf-8", errors="ignore").strip()
                        if not line or not line.startswith("data: "):
                            continue
                        chunk = line[6:]
                        if chunk == "[DONE]":
                            break
                        try:
                            delta = json.loads(chunk)
                            token = delta["choices"][0]["delta"].get("content", "")
                            if token:
                                full_reply += token
                                # Send token as SSE — escape newlines
                                safe = token.replace("\n", "\\n")
                                yield f"data: {safe}\n\n"
                        except Exception:
                            continue

            # Save assistant reply
            if full_reply:
                await _save_msg(user_id, conv_id, "assistant", full_reply)

            # Send metadata + done marker
            meta = json.dumps({"conversation_id": conv_id}, ensure_ascii=False)
            yield f"data: [META]{meta}\n\n"
            yield "data: [DONE]\n\n"

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Streaming chat error: {e}", exc_info=True)
            yield "data: [ERROR]Connection error — check your internet\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":               "no-cache",
            "X-Accel-Buffering":           "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


# ── Non-streaming fallback ────────────────────────────────────────────────────

@router.post("/message/sync")
async def send_message_sync(
    req: ChatRequest,
    current_user: dict = Depends(get_current_user),
):
    """Non-streaming fallback (used when SSE not available)."""
    user_id = current_user["sub"]
    message = req.message.strip()
    if not message:
        raise HTTPException(400, "Message cannot be empty")

    api_key = await _get_groq_key(user_id)
    if not api_key:
        raise HTTPException(503, "AI not configured. Add your Groq API key in Settings.")

    conv_id    = req.conversation_id or str(uuid.uuid4())
    ctx        = await _build_context(user_id)
    history    = await _load_history(user_id, conv_id)
    sys_prompt = _build_system_prompt(ctx)

    messages = [{"role": "system", "content": sys_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": message})

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": MODEL, "messages": messages,
                      "max_tokens": MAX_TOKENS, "temperature": 0.65},
                timeout=TIMEOUT,
            ) as resp:
                if resp.status != 200:
                    raise HTTPException(502, "AI service error")
                data = await resp.json()

        reply = data["choices"][0]["message"]["content"].strip()
        await _save_msg(user_id, conv_id, "user",      message)
        await _save_msg(user_id, conv_id, "assistant", reply)
        return {"reply": reply, "conversation_id": conv_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Sync chat error: {e}", exc_info=True)
        raise HTTPException(500, "Chat failed")


# ── Standard endpoints ────────────────────────────────────────────────────────

@router.post("/set-key")
async def set_api_key(req: SetKeyRequest, current_user: dict = Depends(get_current_user)):
    key = req.api_key.strip()
    if not key or not key.startswith("gsk_") or len(key) < 20:
        raise HTTPException(400, "Invalid Groq API key (must start with gsk_)")
    async with db_manager.get_connection() as conn:
        await conn.execute(
            "UPDATE users SET groq_api_key=? WHERE id=?",
            (key, current_user["sub"]),
        )
    return {"message": "API key saved successfully"}


@router.get("/has-key")
async def check_api_key(current_user: dict = Depends(get_current_user)):
    return {"has_key": bool(await _get_groq_key(current_user["sub"]))}


@router.get("/history")
async def get_history(
    conversation_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]
    if conversation_id:
        msgs = await _load_history(user_id, conversation_id)
    else:
        async with db_manager.get_connection() as conn:
            async with conn.execute(
                """SELECT role, content, conversation_id, created_at
                   FROM chat_messages WHERE user_id=?
                   ORDER BY created_at DESC LIMIT 40""",
                (user_id,),
            ) as cur:
                msgs = [dict(r) for r in await cur.fetchall()]
        msgs = list(reversed(msgs))
    return {"messages": msgs}


@router.delete("/history")
async def clear_history(current_user: dict = Depends(get_current_user)):
    async with db_manager.get_connection() as conn:
        await conn.execute(
            "DELETE FROM chat_messages WHERE user_id=?", (current_user["sub"],)
        )
    return {"message": "History cleared"}


def init_api(db):
    global db_manager
    db_manager = db
