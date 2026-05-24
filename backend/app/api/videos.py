"""
Video management API endpoints for LinguaLearn.
Handles YouTube video downloading and local storage.
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

from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

# Video models
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

# In-memory references to services (set from main)
db_manager = None

def extract_youtube_id(url: str) -> Optional[str]:
    """Extract YouTube video ID from various URL formats."""
    patterns = [
        r'(?:v=|/v/|youtu\.be/|/embed/)([a-zA-Z0-9_-]{11})',
        r'(?:shorts/)([a-zA-Z0-9_-]{11})',
        r'^([a-zA-Z0-9_-]{11})$'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

@router.post("/process", response_model=VideoResponse)
async def process_video(input_data: VideoURLInput, background_tasks: BackgroundTasks):
    """Process a YouTube video: extract ID, download info, and prepare for streaming."""
    
    youtube_id = extract_youtube_id(input_data.url)
    if not youtube_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")
    
    # Check if already exists
    existing = await db_manager.get_video_by_youtube_id(youtube_id)
    if existing:
        logger.info(f"Video already exists: {youtube_id}")
        return VideoResponse(**existing)
    
    # For local Termux operation - use yt-dlp to get info
    try:
        # Get video info using yt-dlp
        cmd = f'yt-dlp --dump-json --no-download "https://www.youtube.com/watch?v={youtube_id}"'
        proc = await asyncio.create_subprocess_shell(
            cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        
        if proc.returncode != 0:
            logger.error(f"yt-dlp error: {stderr.decode()}")
            raise HTTPException(status_code=500, detail="Failed to fetch video info")
        
        info = json.loads(stdout.decode())
        
        video_id = str(uuid.uuid4())
        video_data = {
            'id': video_id,
            'youtube_id': youtube_id,
            'title': info.get('title', 'Unknown Title'),
            'channel': info.get('channel', info.get('uploader', 'Unknown')),
            'duration': info.get('duration', 0),
            'thumbnail_url': info.get('thumbnail', ''),
            'description': info.get('description', ''),
            'status': 'downloaded'
        }
        
        await db_manager.add_video(video_data)
        
        # Download video in background
        background_tasks.add_task(
            _download_video, youtube_id, video_id, input_data.quality
        )
        
        logger.info(f"Video processed: {info.get('title')}")
        return VideoResponse(**video_data)
        
    except Exception as e:
        logger.error(f"Error processing video: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

async def _download_video(youtube_id: str, video_id: str, quality: str):
    """Download video in background."""
    from config import load_config
    config = load_config()
    
    output_path = Path(config.youtube.download_path) / f"{video_id}.mp4"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Use yt-dlp for downloading
    cmd = (
        f'yt-dlp '
        f'-f "best[height<={quality[:-1]}]" '
        f'-o "{output_path}" '
        f'"https://www.youtube.com/watch?v={youtube_id}"'
    )
    
    try:
        proc = await asyncio.create_subprocess_shell(
            cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await proc.communicate()
        
        if proc.returncode == 0:
            logger.info(f"Video downloaded: {video_id}")
        else:
            logger.error(f"Download failed for {video_id}")
    except Exception as e:
        logger.error(f"Download error: {e}")

@router.get("/list")
async def list_videos(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100)):
    """List all processed videos."""
    offset = (page - 1) * limit
    async with db_manager.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM videos ORDER BY created_at DESC LIMIT ? OFFSET ?", 
                      (limit, offset))
        videos = [dict(row) for row in cursor.fetchall()]
        
        cursor.execute("SELECT COUNT(*) as total FROM videos")
        total = cursor.fetchone()['total']
    
    return {
        "videos": videos,
        "page": page,
        "limit": limit,
        "total": total,
        "pages": (total + limit - 1) // limit
    }

@router.get("/{video_id}")
async def get_video(video_id: str):
    """Get video details."""
    video = await db_manager.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video

@router.delete("/{video_id}")
async def delete_video(video_id: str):
    """Delete a video and its associated data."""
    video = await db_manager.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Delete files
    video_path = Path(f"data/downloads/{video_id}.mp4")
    if video_path.exists():
        video_path.unlink()
    
    async with db_manager.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM transcripts WHERE video_id = ?", (video_id,))
        cursor.execute("DELETE FROM sessions WHERE video_id = ?", (video_id,))
        cursor.execute("DELETE FROM videos WHERE id = ?", (video_id,))
    
    return {"message": "Video deleted successfully"}

# Set db reference
def init_api(db):
    global db_manager
    db_manager = db