"""
Transcript extraction and management API.
Handles YouTube captions (VTT) and Whisper local transcription.

FIXES APPLIED:
  - Bug #1: Removed --convert-subs srt (requires ffmpeg). Now downloads VTT directly.
  - Bug #2: Corrected flag logic: --write-subs for manual, --write-auto-subs for auto.
  - Bug #3: File search now looks for .vtt files and calls _parse_vtt().
  - Bug #4: Temp files namespaced per-request with uuid to avoid race conditions.
  - Bug #5: Added asyncio.wait_for() timeout around proc.communicate().
  - Bug #6: VTT parser rewrites handles auto-generated cues with <TIMESTAMP><c> tags.
  - Bug #7: Whisper fallback downloads audio-only via yt-dlp, no MP4 dependency.
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

from fastapi import APIRouter, HTTPException, BackgroundTasks, Query, Depends
from pydantic import BaseModel

from backend.app.api.auth import get_current_user

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
                "Install optional offline STT dependencies:\n"
                "  pip install numpy faster-whisper\n\n"
                "Or try a video that has YouTube captions instead."
            ),
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
    language: str = Query("en", description="Language code"),
    current_user: dict = Depends(get_current_user),
):
    """Extract transcript from YouTube video (captions or Whisper)."""

    video = await db_manager.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Return cached transcript only if it actually has segments (a status-only
    # placeholder row, e.g. 'processing', must not be treated as ready).
    existing = await db_manager.get_transcript(video_id, language)
    if existing and existing.get("segments"):
        logger.info(f"Transcript already exists for {video_id}")
        return existing

    youtube_id = video["youtube_id"]

    # Try YouTube captions first (VTT — no ffmpeg required)
    try:
        segments = await _fetch_youtube_captions(youtube_id, language)
        source = "youtube"
        logger.info(f"YouTube captions found for {youtube_id}: {len(segments)} segments")
    except Exception as e:
        logger.warning(f"YouTube captions not available: {e}. Falling back to Whisper.")
        _ensure_whisper_dependencies()
        # Mark as processing so the frontend can poll a real state machine.
        await db_manager.set_transcript_status(video_id, language, "processing")
        # Queue audio-only download + Whisper transcription
        background_tasks.add_task(
            _transcribe_with_whisper_audio_only, video_id, youtube_id, language
        )
        return {
            "message": "Transcript extraction queued using local Whisper (audio download in progress)",
            "video_id": video_id,
            "status": "processing",
        }

    # Build and persist transcript
    transcript_id = str(uuid.uuid4())
    full_text = " ".join([seg.get("text", "") for seg in segments])
    word_timings = _generate_word_timings(segments)

    transcript_data = {
        "id": transcript_id,
        "video_id": video_id,
        "language": language,
        "source": source,
        "segments": segments,
        "full_text": full_text,
        "word_timings": word_timings,
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
        "segment_count": len(segments),
    }


# ---------------------------------------------------------------------------
# VTT Caption Fetching (Bug #1 fix: no ffmpeg, pure VTT)
# ---------------------------------------------------------------------------

async def _fetch_youtube_captions(youtube_id: str, language: str) -> List[Dict]:
    """
    Fetch captions from YouTube using yt-dlp writing VTT directly.

    Strategy:
      1. Try manual subtitles (--write-subs) for the given language.
      2. Try auto-generated subtitles (--write-auto-subs).
      3. Try broad language match (en.* pattern).
    Each attempt is done WITHOUT --convert-subs (no ffmpeg needed).
    """
    # Bug #4 fix: per-request temp directory to avoid race conditions
    request_id = str(uuid.uuid4())[:8]
    # Use absolute path relative to this file — works regardless of CWD
    _base = Path(__file__).resolve().parent.parent.parent.parent / "data" / "temp"
    temp_dir = _base / request_id
    temp_dir.mkdir(parents=True, exist_ok=True)

    lang_variants = [language, f"{language}-.*"]
    last_error = "No captions found"
    found_vtt: Optional[Path] = None

    try:
        for lang in lang_variants:
            for use_auto in [False, True]:
                # Bug #2 fix: correct flag logic
                if use_auto:
                    sub_flags = ["--write-auto-subs"]
                else:
                    sub_flags = ["--write-subs"]

                # Bug #1 fix: NO --convert-subs, download VTT directly
                cmd = [
                    "yt-dlp",
                    "--skip-download",
                    *sub_flags,
                    "--sub-langs", lang,
                    "--sub-format", "vtt",
                    "--output", str(temp_dir / "%(id)s.%(ext)s"),
                    f"https://www.youtube.com/watch?v={youtube_id}",
                ]

                logger.debug(f"Running yt-dlp: {' '.join(cmd)}")

                try:
                    proc = await asyncio.create_subprocess_exec(
                        *cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                    )
                    # Bug #5 fix: timeout so hung yt-dlp doesn't block forever
                    try:
                        stdout, stderr = await asyncio.wait_for(
                            proc.communicate(), timeout=60.0
                        )
                    except asyncio.TimeoutError:
                        proc.kill()
                        last_error = "yt-dlp timed out after 60s"
                        logger.warning(last_error)
                        continue

                    if proc.returncode != 0:
                        err_msg = stderr.decode(errors="replace") if stderr else ""
                        last_error = f"yt-dlp exit {proc.returncode}: {err_msg[:200]}"
                        logger.debug(f"yt-dlp stderr: {err_msg[:300]}")
                        continue

                    # Bug #3 fix: look for VTT files, not SRT
                    vtt_files = list(temp_dir.glob(f"{youtube_id}*.vtt"))
                    if not vtt_files:
                        # Try without ID prefix in case yt-dlp used title
                        vtt_files = list(temp_dir.glob("*.vtt"))

                    for vf in vtt_files:
                        if vf.stat().st_size > 50:  # not an empty/header-only file
                            found_vtt = vf
                            break

                    if found_vtt:
                        break

                except FileNotFoundError:
                    raise RuntimeError(
                        "yt-dlp not found. Install it: pip install yt-dlp"
                    )
                except Exception as e:
                    last_error = str(e)
                    logger.warning(f"yt-dlp attempt failed: {e}")
                    continue

            if found_vtt:
                break

        if not found_vtt:
            raise FileNotFoundError(
                f"No VTT captions found for video {youtube_id}. "
                f"Last error: {last_error}. "
                "The video may not have captions available in the requested language."
            )

        vtt_content = found_vtt.read_text(encoding="utf-8", errors="replace")
        segments = _parse_vtt(vtt_content)

        if not segments:
            raise ValueError(
                f"VTT file was downloaded but parsed to 0 segments for {youtube_id}. "
                "File may be empty or malformed."
            )

        return segments

    finally:
        # Clean up temp directory regardless of success/failure
        import shutil
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# VTT Parser (Bug #6 fix: handles auto-generated YouTube VTT properly)
# ---------------------------------------------------------------------------
# VTT Parser — Rewritten for YouTube auto-generated sliding-window subtitles
# ---------------------------------------------------------------------------


def _strip_vtt_markup(text: str) -> str:
    """Strip YouTube/WebVTT karaoke markup while keeping readable text."""
    if not text:
        return ""
    text = text.replace("\n", " ")
    text = re.sub(r"<\d{1,2}:\d{2}:\d{2}[.,]\d{3}>", "", text)
    text = re.sub(r"</?c(?:\.[^>]*)?>" , "", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _norm(text: str) -> str:
    """Lowercase, strip punctuation, collapse spaces — for comparison."""
    t = re.sub(r"[^\w\s]", "", (text or "").lower())
    return re.sub(r"\s+", " ", t).strip()


def _extract_raw_cues(vtt_content: str) -> List[Dict]:
    """Parse VTT content into a flat list of raw cues."""
    content = vtt_content.lstrip("\ufeff").strip()
    if not content.startswith("WEBVTT"):
        logger.warning("VTT file does not start with WEBVTT header")
        return []

    cues: List[Dict] = []
    for block in re.split(r"\n\n+", content):
        block = block.strip()
        if not block or block.startswith("WEBVTT") or block.startswith("NOTE"):
            continue

        lines = block.splitlines()
        timestamp_line = None
        text_lines: List[str] = []
        for i, line in enumerate(lines):
            if "-->" in line:
                timestamp_line = line
                text_lines = lines[i + 1:]
                break

        if not timestamp_line or not text_lines:
            continue

        ts_match = re.match(
            r"(\d{1,2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{3})",
            timestamp_line,
        )
        if not ts_match:
            continue

        start = _vtt_time_to_seconds(ts_match.group(1))
        end = _vtt_time_to_seconds(ts_match.group(2))
        if end <= start:
            continue

        raw_text = "\n".join(text_lines).strip()
        text = _strip_vtt_markup(raw_text)
        if text:
            cues.append({
                "start": start,
                "end": end,
                "text": text,
                "words": text.split(),
            })

    return cues


def _find_new_words(seen_words: List[str], cue_words: List[str]) -> List[str]:
    """
    Given all words emitted so far and the current cue words,
    return only the truly NEW words the cue introduces.
    """
    if not seen_words or not cue_words:
        return cue_words

    seen_norm = [_norm(w) for w in seen_words]
    curr_norm = [_norm(w) for w in cue_words]

    # Find longest suffix of seen that matches a prefix of current
    best_overlap = 0
    max_check = min(len(seen_norm), len(curr_norm))

    for overlap_len in range(1, max_check + 1):
        if seen_norm[-overlap_len:] == curr_norm[:overlap_len]:
            best_overlap = overlap_len

    if best_overlap > 0:
        return cue_words[best_overlap:]

    # Fuzzy fallback: skip leading words found in recent history
    recent = set(seen_norm[-20:])
    skip = 0
    for w in curr_norm:
        if w in recent:
            skip += 1
        else:
            break

    if 0 < skip < len(cue_words):
        return cue_words[skip:]

    return cue_words


def _build_clean_segments(cues: List[Dict]) -> List[Dict]:
    """
    Collapse YouTube sliding-window cues into clean non-overlapping segments.
    """
    if not cues:
        return []

    # Phase 1: collapse growing cues
    collapsed: List[Dict] = []
    for cue in cues:
        if collapsed:
            prev = collapsed[-1]
            prev_n = _norm(prev["text"])
            curr_n = _norm(cue["text"])

            if curr_n.startswith(prev_n) and len(curr_n) > len(prev_n):
                collapsed[-1] = cue
                continue

            if curr_n == prev_n:
                collapsed[-1]["end"] = max(prev["end"], cue["end"])
                continue

        collapsed.append(dict(cue))

    # Phase 2: extract only NEW words from each cue
    word_runs: List[Dict] = []
    all_words: List[str] = []

    for cue in collapsed:
        new_words = _find_new_words(all_words, cue["words"])
        if not new_words:
            continue

        n_total = len(cue["words"])
        n_new = len(new_words)
        cue_dur = cue["end"] - cue["start"]

        if n_total > 0 and cue_dur > 0:
            word_dur = cue_dur / n_total
            seg_start = cue["start"] + (n_total - n_new) * word_dur
        else:
            seg_start = cue["start"]

        word_runs.append({
            "start": seg_start,
            "end": cue["end"],
            "words": new_words,
            "text": " ".join(new_words),
        })
        all_words.extend(new_words)

    # Phase 3: merge into sentence-sized segments
    return _merge_into_sentences(word_runs)


def _merge_into_sentences(
    runs: List[Dict],
    max_words: int = 14,
    max_duration: float = 6.0,
) -> List[Dict]:
    """Merge small word-runs into sentence-like segments."""
    if not runs:
        return []

    merged: List[Dict] = []
    buf_words: List[str] = []
    buf_start = 0.0
    buf_end = 0.0

    def flush():
        nonlocal buf_words, buf_start, buf_end
        if not buf_words:
            return
        text = " ".join(buf_words)
        n = len(buf_words)
        dur = max(buf_end - buf_start, 0.1)
        wd = dur / n
        words = [{
            "word": w,
            "start": round(buf_start + j * wd, 3),
            "end": round(buf_start + (j + 1) * wd, 3),
        } for j, w in enumerate(buf_words)]

        merged.append({
            "index": len(merged),
            "start": round(buf_start, 3),
            "end": round(buf_end, 3),
            "text": text,
            "words": words,
            "duration": round(buf_end - buf_start, 3),
        })
        buf_words = []

    for run in runs:
        if not buf_words:
            buf_start = run["start"]

        buf_words.extend(run["words"])
        buf_end = run["end"]

        text_so_far = " ".join(buf_words)
        ends_sentence = bool(re.search(r"[.!?]$", text_so_far.rstrip()))
        too_long = len(buf_words) >= max_words
        too_much_time = (buf_end - buf_start) >= max_duration

        if ends_sentence or too_long or too_much_time:
            flush()

    flush()
    return merged


def _parse_vtt(vtt_content: str) -> List[Dict]:
    """
    Parse WebVTT subtitle format to clean, non-overlapping segments.
    Handles YouTube auto-generated sliding-window subtitles.
    """
    raw_cues = _extract_raw_cues(vtt_content)
    if not raw_cues:
        return []

    segments = _build_clean_segments(raw_cues)

    logger.debug(
        f"VTT parser: {len(raw_cues)} raw cues -> {len(segments)} clean segments"
    )
    return segments


def _vtt_time_to_seconds(vtt_time: str) -> float:
    """Convert VTT timestamp (HH:MM:SS.mmm or MM:SS.mmm) to seconds."""
    # Normalize comma to dot
    vtt_time = vtt_time.replace(",", ".")
    parts = vtt_time.split(":")
    if len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
    elif len(parts) == 2:
        return int(parts[0]) * 60 + float(parts[1])
    return float(parts[0])


# ---------------------------------------------------------------------------
# SRT Parser (kept for backwards compatibility / cached files)
# ---------------------------------------------------------------------------

def _parse_srt(srt_content: str) -> List[Dict]:
    """Parse SRT subtitle format to structured segments."""
    segments = []
    pattern = (
        r"(\d+)\n(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})\n"
        r"((?:(?!\n\n).+\n?)*)"
    )
    for match in re.finditer(pattern, srt_content, re.MULTILINE):
        start_time = _srt_time_to_seconds(match.group(2))
        end_time = _srt_time_to_seconds(match.group(3))
        text = match.group(4).strip().replace("\n", " ")
        text = re.sub(r"<[^>]+>", "", text)

        words = text.split()
        word_duration = (end_time - start_time) / max(len(words), 1)
        word_timings = [
            {
                "word": w,
                "start": round(start_time + i * word_duration, 3),
                "end": round(start_time + (i + 1) * word_duration, 3),
            }
            for i, w in enumerate(words)
        ]

        segments.append(
            {
                "index": int(match.group(1)),
                "start": start_time,
                "end": end_time,
                "text": text,
                "words": word_timings,
                "duration": end_time - start_time,
            }
        )
    return segments


def _srt_time_to_seconds(srt_time: str) -> float:
    """Convert SRT timestamp to seconds."""
    parts = srt_time.replace(",", ".").split(":")
    return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])


# ---------------------------------------------------------------------------
# Word-timing utility
# ---------------------------------------------------------------------------

def _generate_word_timings(segments: List[Dict]) -> Dict[str, Any]:
    """Generate word-level timing map from segments."""
    word_map: Dict[str, Any] = {}
    for seg in segments:
        for word_info in seg.get("words", []):
            clean = word_info["word"].lower().strip(".,!?;:'\"")
            word_map[clean] = {
                "start": word_info["start"],
                "end": word_info["end"],
                "segment_index": seg.get("index", 0),
            }
    return word_map


# ---------------------------------------------------------------------------
# Whisper fallback (Bug #7 fix: audio-only download, no MP4 dependency)
# ---------------------------------------------------------------------------

async def _transcribe_with_whisper_audio_only(
    video_id: str, youtube_id: str, language: str
):
    """
    Download audio-only from YouTube then transcribe with local Whisper.

    Bug #7 fix: Does NOT depend on the full video MP4 being present.
    Downloads a small audio-only stream (opus/m4a) directly.
    """
    global whisper_service

    request_id = str(uuid.uuid4())[:8]
    _base = Path(__file__).resolve().parent.parent.parent.parent / "data" / "temp"
    temp_dir = _base / f"whisper_{request_id}"
    temp_dir.mkdir(parents=True, exist_ok=True)
    audio_path = temp_dir / f"{video_id}.wav"

    try:
        # Step 1: Download audio-only with yt-dlp
        logger.info(f"Downloading audio for Whisper: {youtube_id}")

        dl_cmd = [
            "yt-dlp",
            "--format", "bestaudio[ext=m4a]/bestaudio/best",
            "--extract-audio",
            "--audio-format", "wav",
            "--audio-quality", "0",
            "--output", str(temp_dir / "%(id)s.%(ext)s"),
            f"https://www.youtube.com/watch?v={youtube_id}",
        ]

        proc = await asyncio.create_subprocess_exec(
            *dl_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300.0)
        except asyncio.TimeoutError:
            proc.kill()
            logger.error("yt-dlp audio download timed out")
            await db_manager.set_transcript_status(video_id, language, "error", "Audio download timed out")
            return

        if proc.returncode != 0:
            logger.error(f"Audio download failed: {stderr.decode(errors='replace')[:300]}")
            await db_manager.set_transcript_status(video_id, language, "error", "Audio download failed")
            return

        # Find the downloaded wav file
        wav_files = list(temp_dir.glob("*.wav"))
        if not wav_files:
            # Try converting with ffmpeg if yt-dlp wrote m4a/webm
            other_files = list(temp_dir.glob("*.m4a")) + list(temp_dir.glob("*.webm")) + list(temp_dir.glob("*.ogg"))
            if other_files:
                src = other_files[0]
                convert_cmd = [
                    "ffmpeg", "-i", str(src),
                    "-vn", "-acodec", "pcm_s16le",
                    "-ar", "16000", "-ac", "1",
                    "-y", str(audio_path),
                ]
                conv_proc = await asyncio.create_subprocess_exec(
                    *convert_cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                await asyncio.wait_for(conv_proc.communicate(), timeout=120.0)
                wav_files = [audio_path] if audio_path.exists() else []

        if not wav_files:
            logger.error("Audio extraction produced no WAV file")
            await db_manager.set_transcript_status(video_id, language, "error", "Audio extraction failed")
            return

        actual_audio = wav_files[0]

        # Step 2: Load and run Whisper
        if whisper_service is None:
            from ai.whisper.service import WhisperService
            from config.settings import load_config
            config = load_config()
            whisper_service = WhisperService(config.ai.whisper)

        segments = await whisper_service.transcribe(str(actual_audio), language)

        if not segments:
            logger.warning(f"Whisper produced 0 segments for {video_id}")
            await db_manager.set_transcript_status(
                video_id, language, "error", "No speech could be transcribed"
            )
            return

        # Step 3: Persist transcript (status ready)
        transcript_id = str(uuid.uuid4())
        full_text = " ".join([seg["text"] for seg in segments])

        transcript_data = {
            "id": transcript_id,
            "video_id": video_id,
            "language": language,
            "source": "whisper",
            "segments": segments,
            "full_text": full_text,
            "word_timings": _generate_word_timings(segments),
            "status": "ready",
            "error": "",
        }

        await db_manager.save_transcript(transcript_data)
        logger.info(f"Whisper transcription complete for {video_id}: {len(segments)} segments")

    except Exception as e:
        logger.error(f"Whisper transcription failed for {video_id}: {e}", exc_info=True)
        try:
            await db_manager.set_transcript_status(
                video_id, language, "error", "Transcription failed"
            )
        except Exception:
            pass
    finally:
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@router.get("/{video_id}/status")
async def get_transcript_status(
    video_id: str,
    language: str = Query("en", description="Language code"),
    current_user: dict = Depends(get_current_user),
):
    """
    Phase 2: report transcript progress as a real state machine so the client
    can distinguish 'processing' from 'error' instead of blindly polling.

    Returns: {status: idle|processing|ready|error, error, segment_count}
    """
    return await db_manager.get_transcript_status(video_id, language)


@router.get("/{video_id}")
async def get_transcript(
    video_id: str,
    language: str = Query("en", description="Language code"),
    current_user: dict = Depends(get_current_user),
):
    """Get transcript for a video."""
    transcript = await db_manager.get_transcript(video_id, language)
    # A status-only placeholder row (no segments) is not a usable transcript.
    if not transcript or not transcript.get("segments"):
        raise HTTPException(status_code=404, detail="Transcript not found")
    return transcript


@router.get("/{video_id}/segments")
async def get_transcript_segments(
    video_id: str,
    language: str = Query("en"),
    start_time: Optional[float] = Query(None),
    end_time: Optional[float] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Get transcript segments, optionally filtered by time range."""
    transcript = await db_manager.get_transcript(video_id, language)
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")

    segments = transcript["segments"]

    if start_time is not None:
        segments = [s for s in segments if s["end"] >= start_time]
    if end_time is not None:
        segments = [s for s in segments if s["start"] <= end_time]

    return {"segments": segments, "count": len(segments)}


def init_api(db):
    global db_manager
    db_manager = db
