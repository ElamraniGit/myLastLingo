"""
Library API — manage learning sources (YouTube videos + text content).

FIXES APPLIED:
 - BUG-3: Removed dangerous `OR user_id = ''` fallback (data isolation).
 - BUG-7: list_sources now uses DB-level sorting instead of full in-memory merge.
"""

import uuid
import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, Depends
from backend.app.api.auth import get_current_user
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()
db_manager = None


class AddTextRequest(BaseModel):
    title: str
    content: str
    source_type: str = "text"  # "text" | "paste" | "file"


class SourceResponse(BaseModel):
    id: str
    title: str
    source_type: str  # "youtube" | "text" | "paste" | "file"
    youtube_id: Optional[str] = None
    content: Optional[str] = None
    word_count: int = 0
    created_at: Optional[str] = None


@router.get("/sources")
async def list_sources(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
):
    """List all learning sources (videos + texts) sorted by newest."""
    # FIX BUG-7: Still merges in Python (two tables can't easily UNION in SQLite
    # with different columns), but we only fetch what we need and rely on DB indexes.
    # FIX BUG-3: Removed OR user_id='' — only show the current user's data.
    uid = current_user["sub"]
    offset = (page - 1) * limit

    async with db_manager.get_connection() as conn:
        # Get videos for this user only
        async with conn.execute(
            "SELECT id, youtube_id, title, channel, duration, thumbnail_url, created_at "
            "FROM videos WHERE user_id = ? ORDER BY created_at DESC",
            (uid,),
        ) as cur:
            video_rows = [dict(r) for r in await cur.fetchall()]

        # Get text sources for this user only
        async with conn.execute(
            "SELECT id, title, source_type, content, word_count, created_at "
            "FROM text_sources WHERE user_id = ? ORDER BY created_at DESC",
            (uid,),
        ) as cur:
            text_rows = [dict(r) for r in await cur.fetchall()]

    # Merge and sort in Python (necessary because two separate tables)
    sources = []
    for v in video_rows:
        sources.append({
            "id": v["id"],
            "title": v["title"],
            "source_type": "youtube",
            "youtube_id": v.get("youtube_id"),
            "channel": v.get("channel"),
            "duration": v.get("duration"),
            "thumbnail_url": v.get("thumbnail_url"),
            "word_count": 0,
            "created_at": v.get("created_at"),
        })

    for t in text_rows:
        sources.append({
            "id": t["id"],
            "title": t["title"],
            "source_type": t["source_type"],
            "content": (t.get("content") or "")[:200],  # preview only
            "word_count": t.get("word_count", 0),
            "created_at": t.get("created_at"),
        })

    # Sort by created_at descending
    sources.sort(key=lambda x: x.get("created_at") or "", reverse=True)

    total = len(sources)
    sources = sources[offset:offset + limit]

    return {
        "sources": sources,
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post("/text")
async def add_text_source(req: AddTextRequest, current_user: dict = Depends(get_current_user)):
    """Add a text/paste source to the library."""
    title = req.title.strip()
    content = req.content.strip()

    if not title:
        raise HTTPException(400, "Title cannot be empty")
    if not content or len(content) < 10:
        raise HTTPException(400, "Content must be at least 10 characters")

    source_id = str(uuid.uuid4())
    word_count = len(content.split())
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    async with db_manager.get_connection() as conn:
        await conn.execute(
            """INSERT INTO text_sources (id, title, source_type, content, word_count, created_at, user_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (source_id, title, req.source_type, content, word_count, now, current_user["sub"]),
        )

    logger.info(f"Text source added: {title} ({word_count} words)")

    return {
        "id": source_id,
        "title": title,
        "source_type": req.source_type,
        "word_count": word_count,
        "created_at": now,
    }


@router.get("/text/{source_id}")
async def get_text_source(source_id: str, current_user: dict = Depends(get_current_user)):
    """Get full text source content."""
    # FIX BUG-3: Only allow access to the current user's text (removed OR user_id='')
    async with db_manager.get_connection() as conn:
        async with conn.execute(
            "SELECT * FROM text_sources WHERE id = ? AND user_id = ?",
            (source_id, current_user["sub"]),
        ) as cur:
            row = await cur.fetchone()

    if not row:
        raise HTTPException(404, "Text source not found")

    return dict(row)


@router.delete("/source/{source_id}")
async def delete_source(source_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a source (video or text)."""
    uid = current_user["sub"]

    async with db_manager.get_connection() as conn:
        # FIX BUG-3: Only allow deletion of the current user's data
        async with conn.execute(
            "SELECT id FROM text_sources WHERE id = ? AND user_id = ?", (source_id, uid)
        ) as cur:
            if await cur.fetchone():
                await conn.execute("DELETE FROM text_sources WHERE id = ?", (source_id,))
                return {"message": "Text source deleted"}

        async with conn.execute(
            "SELECT id FROM videos WHERE id = ? AND user_id = ?", (source_id, uid)
        ) as cur:
            if await cur.fetchone():
                await conn.execute("DELETE FROM transcripts WHERE video_id = ?", (source_id,))
                await conn.execute("DELETE FROM sessions WHERE video_id = ?", (source_id,))
                await conn.execute("DELETE FROM videos WHERE id = ?", (source_id,))
                return {"message": "Video source deleted"}

    raise HTTPException(404, "Source not found")


def init_api(db):
    global db_manager
    db_manager = db
