"""
Video management API endpoints for LinguaLearn.
Handles YouTube video info fetching and local storage.

FIXES APPLIED:
 - Bug #A2: Replaced shell string f-string with subprocess exec list (safer).
 - BUG-6:   delete_video now uses absolute path via PROJECT_ROOT.
 - Improved error handling and logging.
"""

import os
import re
import json
import uuid
import logging
import asyncio
from pathlib import Path
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, BackgroundTasks, Query, Depends
from backend.app.api.auth import get_current_user
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()
db_manager = None

# FIX BUG-6: Use absolute path so file deletion works regardless of CWD
_DOWNLOADS_DIR = (Path(__file__).resolve().parent.parent.parent.parent / "data" / "downloads").resolve()


class VideoURLInput(BaseModel):
    url: str
    quality: Optional[str] = "720p"


class VideoResponse(BaseModel):
    id: str
    youtube_id: str
    title: str
    channel: str
    duration: int
    thumbnail_url: str
    status: str


def extract_youtube_id(url: str) -> Optional[str]:
    """Extract YouTube video ID from various URL formats."""
    patterns = [
        r"(?:v=|/v/|youtu\.be/|/embed/)([a-zA-Z0-9_-]{11})",
        r"(?:shorts/)([a-zA-Z0-9_-]{11})",
        r"^([a-zA-Z0-9_-]{11})$",
    ]
    for pattern in patterns:
        match = re.search(pattern, url.strip())
        if match:
            return match.group(1)
    return None


@router.post("/process", response_model=VideoResponse)
async def process_video(input_data: VideoURLInput, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Process a YouTube video: extract ID, fetch info, prepare for playback."""

    youtube_id = extract_youtube_id(input_data.url)
    if not youtube_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")

    # Return cached record if already processed
    existing = await db_manager.get_video_by_youtube_id(youtube_id, current_user["sub"])
    if existing:
        logger.info(f"Video already exists: {youtube_id}")
        return VideoResponse(**existing)

    # Fetch video metadata via yt-dlp (list args — Bug #A2 fix)
    try:
        cmd = [
            "yt-dlp",
            "--dump-json",
            "--no-download",
            "--no-playlist",
            f"https://www.youtube.com/watch?v={youtube_id}",
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30.0)
        except asyncio.TimeoutError:
            proc.kill()
            raise HTTPException(status_code=504, detail="yt-dlp timed out fetching video info")

        if proc.returncode != 0:
            err = stderr.decode(errors="replace")
            logger.error(f"yt-dlp error: {err[:300]}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch video info: {err[:200]}")

        info = json.loads(stdout.decode())

        video_id = str(uuid.uuid4())
        video_data = {
            "id": video_id,
            "youtube_id": youtube_id,
            "title": info.get("title", "Unknown Title"),
            "channel": info.get("channel", info.get("uploader", "Unknown")),
            "duration": info.get("duration", 0),
            "thumbnail_url": info.get("thumbnail", ""),
            "description": info.get("description", "")[:2000],  # trim long descriptions
            "status": "ready",
            "user_id": current_user["sub"],
        }

        await db_manager.add_video(video_data)
        logger.info(f"Video processed: {info.get('title')}")

        return VideoResponse(**video_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing video: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process video")


@router.get("/list")
async def list_videos(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """List all processed videos."""
    offset = (page - 1) * limit
    async with db_manager.get_connection() as conn:
        async with conn.execute(
            "SELECT * FROM videos WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (current_user["sub"], limit, offset),
        ) as cursor:
            rows = await cursor.fetchall()
            videos = [dict(r) for r in rows]

        async with conn.execute("SELECT COUNT(*) as total FROM videos WHERE user_id = ?", (current_user["sub"],)) as cursor:
            row = await cursor.fetchone()
            total = dict(row)["total"] if row else 0

    return {
        "videos": videos,
        "page": page,
        "limit": limit,
        "total": total,
        "pages": max(1, (total + limit - 1) // limit),
    }


@router.get("/{video_id}")
async def get_video(video_id: str, current_user: dict = Depends(get_current_user)):
    """Get video details (scoped to the owner — FIX-SEC-9)."""
    video = await db_manager.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    # Only the owner may read a video record. Legacy rows with empty user_id
    # (pre-multi-user data) remain accessible for backward compatibility.
    owner = video.get("user_id") or ""
    if owner and owner != current_user["sub"]:
        raise HTTPException(status_code=404, detail="Video not found")
    return video


@router.delete("/{video_id}")
async def delete_video(video_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a video and its associated data."""
    video = await db_manager.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Verify ownership
    if video.get("user_id") and video["user_id"] != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this video")

    # FIX BUG-6: Use absolute path
    _DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
    video_path = (_DOWNLOADS_DIR / f"{video_id}.mp4").resolve()
    if video_path.exists():
        video_path.unlink()

    async with db_manager.get_connection() as conn:
        await conn.execute("DELETE FROM transcripts WHERE video_id = ?", (video_id,))
        await conn.execute("DELETE FROM sessions WHERE video_id = ?", (video_id,))
        await conn.execute("DELETE FROM videos WHERE id = ?", (video_id,))

    return {"message": "Video deleted successfully"}


def init_api(db):
    global db_manager
    db_manager = db
