"""
Transcript extraction and management API.
Handles YouTube captions and Whisper local transcription.
"""

import os
import re
import json
import uuid
import logging
import asyncio
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

db_manager = None
whisper_service = None


def _ensure_whisper_dependencies() -> None:
    """Validate optional Whisper dependencies before queuing background task."""
    try:
        import numpy  # noqa: F401
        import faster_whisper  # noqa: F401
    except ModuleNotFoundError as e:
        missing = getattr(e, "name", "unknown")
        raise HTTPException(
            status_code=503,
            detail=(
                f"Whisper dependency missing: {missing}. "
                "Install optional offline STT dependencies: "
                "pip install numpy faster-whisper"
            )
        )

class TranscriptResponse(BaseModel):
    id: str
    video_id: str
    language: str
    source: str
    segments: List[Dict]
    full_text: str

@router.post("/extract/{video_id}")
async def extract_transcript(
    video_id: str,
    background_tasks: BackgroundTasks,
    language: str = Query("en", description="Language code")
):
    """Extract transcript from YouTube video (captions or Whisper)."""
    
    video = await db_manager.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Check if transcript already exists
    existing = await db_manager.get_transcript(video_id, language)
    if existing:
        logger.info(f"Transcript already exists for {video_id}")
        return existing
    
    youtube_id = video['youtube_id']
    
    # Try to get YouTube captions first
    try:
        segments = await _fetch_youtube_captions(youtube_id, language)
        source = "youtube"
        logger.info(f"YouTube captions found for {youtube_id}")
    except Exception as e:
        logger.warning(f"YouTube captions not available: {e}. Falling back to Whisper.")
        _ensure_whisper_dependencies()
        # Fall back to local Whisper
        background_tasks.add_task(_transcribe_with_whisper, video_id, youtube_id, language)
        return {
            "message": "Transcript extraction queued using local Whisper",
            "video_id": video_id,
            "status": "processing"
        }
    
    # Save transcript
    transcript_id = str(uuid.uuid4())
    full_text = ' '.join([seg.get('text', '') for seg in segments])
    
    # Generate word-level timings
    word_timings = _generate_word_timings(segments)
    
    transcript_data = {
        'id': transcript_id,
        'video_id': video_id,
        'language': language,
        'source': source,
        'segments': segments,
        'full_text': full_text,
        'word_timings': word_timings
    }
    
    await db_manager.save_transcript(transcript_data)
    
    return {
        "id": transcript_id,
        "video_id": video_id,
        "language": language,
        "source": source,
        "segments": segments,
        "full_text": full_text,
        "word_count": len(full_text.split()),
        "segment_count": len(segments)
    }

async def _fetch_youtube_captions(youtube_id: str, language: str) -> List[Dict]:
    """Fetch captions from YouTube using yt-dlp."""
    
    # Use yt-dlp to get subtitles
    cmd = (
        f'yt-dlp --skip-download '
        f'--write-subs --sub-langs {language} '
        f'--convert-subs srt '
        f'--output "data/temp/%(id)s" '
        f'"https://www.youtube.com/watch?v={youtube_id}"'
    )
    
    proc = await asyncio.create_subprocess_shell(
        cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    await proc.communicate()
    
    # Try to read the SRT file
    srt_path = Path(f"data/temp/{youtube_id}.{language}.srt")
    if not srt_path.exists():
        # Try alternative naming
        srt_path = Path(f"data/temp/{youtube_id}.srt")
    
    if not srt_path.exists():
        raise FileNotFoundError("Captions not found")
    
    segments = _parse_srt(srt_path.read_text(encoding='utf-8'))
    
    # Cleanup
    if srt_path.exists():
        srt_path.unlink()
    
    return segments

def _parse_srt(srt_content: str) -> List[Dict]:
    """Parse SRT subtitle format to structured segments."""
    segments = []
    
    # SRT pattern: index -> timestamp -> text -> blank line
    pattern = r'(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\n((?:.+\n?)*?)(?:\n\n|\Z)'
    
    for match in re.finditer(pattern, srt_content, re.MULTILINE):
        start_time = _srt_time_to_seconds(match.group(2))
        end_time = _srt_time_to_seconds(match.group(3))
        text = match.group(4).strip().replace('\n', ' ')
        
        # Generate word-level timestamps
        words = text.split()
        word_duration = (end_time - start_time) / max(len(words), 1)
        word_timings = []
        
        for i, word in enumerate(words):
            word_timings.append({
                'word': word,
                'start': start_time + (i * word_duration),
                'end': start_time + ((i + 1) * word_duration)
            })
        
        # Clean text from HTML tags
        text = re.sub(r'<[^>]+>', '', text)
        
        segments.append({
            'index': int(match.group(1)),
            'start': start_time,
            'end': end_time,
            'text': text,
            'words': word_timings,
            'duration': end_time - start_time
        })
    
    return segments

def _srt_time_to_seconds(srt_time: str) -> float:
    """Convert SRT timestamp to seconds."""
    parts = srt_time.replace(',', '.').split(':')
    return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])

def _generate_word_timings(segments: List[Dict]) -> Dict[str, Any]:
    """Generate word-level timing map from segments."""
    word_map = {}
    for seg in segments:
        for word_info in seg.get('words', []):
            word_map[word_info['word'].lower().strip('.,!?;:')] = {
                'start': word_info['start'],
                'end': word_info['end'],
                'segment_index': seg.get('index', 0)
            }
    return word_map

async def _transcribe_with_whisper(video_id: str, youtube_id: str, language: str):
    """Transcribe audio using local Whisper."""
    global whisper_service
    
    try:
        if whisper_service is None:
            from ai.whisper.service import WhisperService
            from config import load_config
            config = load_config()
            whisper_service = WhisperService(config.ai.whisper)

        # Extract audio from video
        audio_path = Path(f"data/temp/{video_id}.wav")
        video_path = Path(f"data/downloads/{video_id}.mp4")
        
        if not video_path.exists():
            logger.error(f"Video file not found: {video_path}")
            return
        
        # Extract audio using ffmpeg
        cmd = f'ffmpeg -i "{video_path}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "{audio_path}" -y'
        proc = await asyncio.create_subprocess_shell(
            cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        await proc.communicate()
        
        if not audio_path.exists():
            logger.error("Audio extraction failed")
            return
        
        # Transcribe with Whisper
        segments = await whisper_service.transcribe(str(audio_path), language)
        
        # Save transcript
        transcript_id = str(uuid.uuid4())
        full_text = ' '.join([seg['text'] for seg in segments])
        
        transcript_data = {
            'id': transcript_id,
            'video_id': video_id,
            'language': language,
            'source': 'whisper',
            'segments': segments,
            'full_text': full_text,
            'word_timings': _generate_word_timings(segments)
        }
        
        await db_manager.save_transcript(transcript_data)
        
        # Cleanup audio file
        if audio_path.exists():
            audio_path.unlink()
        
        logger.info(f"Whisper transcription complete for {video_id}")
        
    except Exception as e:
        logger.error(f"Whisper transcription failed: {e}", exc_info=True)

@router.get("/{video_id}")
async def get_transcript(
    video_id: str,
    language: str = Query("en", description="Language code")
):
    """Get transcript for a video."""
    transcript = await db_manager.get_transcript(video_id, language)
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    return transcript

@router.get("/{video_id}/segments")
async def get_transcript_segments(
    video_id: str,
    language: str = Query("en"),
    start_time: Optional[float] = Query(None),
    end_time: Optional[float] = Query(None)
):
    """Get transcript segments, optionally filtered by time range."""
    transcript = await db_manager.get_transcript(video_id, language)
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    
    segments = transcript['segments']
    
    if start_time is not None:
        segments = [s for s in segments if s['end'] >= start_time]
    if end_time is not None:
        segments = [s for s in segments if s['start'] <= end_time]
    
    return {"segments": segments, "count": len(segments)}

def init_api(db):
    global db_manager
    db_manager = db