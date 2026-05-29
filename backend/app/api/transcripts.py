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
):
    """Extract transcript from YouTube video (captions or Whisper)."""

    video = await db_manager.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Return cached transcript if already exists
    existing = await db_manager.get_transcript(video_id, language)
    if existing:
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

def _strip_vtt_markup(text: str) -> str:
    """Strip YouTube/WebVTT karaoke markup while keeping readable text."""
    if not text:
        return ""
    text = text.replace("\n", " ")
    text = re.sub(r"<\d{1,2}:\d{2}:\d{2}[.,]\d{3}>", "", text)
    text = re.sub(r"</?c(?:\.[^>]*)?>", "", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


_SHORT_FUNCTION_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "do", "for", "from",
    "he", "her", "him", "his", "i", "in", "is", "it", "me", "my", "of",
    "on", "or", "our", "she", "so", "the", "their", "them", "there", "they",
    "to", "up", "us", "we", "you", "your",
}


def _estimate_word_weight(word: str) -> float:
    cleaned = re.sub(r"[^A-Za-z0-9'_-]", "", word).lower()
    if not cleaned:
        return 0.35

    length = len(cleaned)
    weight = 0.65 + min(length, 10) * 0.11

    if cleaned in _SHORT_FUNCTION_WORDS:
        weight *= 0.72
    if length <= 2:
        weight *= 0.82
    if length >= 8:
        weight *= 1.12
    if "'" in cleaned:
        weight += 0.08
    if re.search(r"[,.!?;:]$", word):
        weight += 0.28
    if re.fullmatch(r"[♪…]+", word):
        weight *= 0.6

    return max(weight, 0.3)



def _smooth_word_timings(word_timings: List[Dict], cue_start: float, cue_end: float) -> List[Dict]:
    if not word_timings:
        return []

    word_timings[0]["start"] = round(max(cue_start, word_timings[0]["start"]), 3)
    for i in range(len(word_timings)):
        current = word_timings[i]
        if i > 0:
            prev = word_timings[i - 1]
            if current["start"] < prev["end"]:
                midpoint = round((current["start"] + prev["end"]) / 2, 3)
                prev["end"] = midpoint
                current["start"] = midpoint
        if current["end"] <= current["start"]:
            current["end"] = round(current["start"] + 0.08, 3)

    word_timings[-1]["end"] = round(cue_end, 3)

    for i in range(len(word_timings) - 2, -1, -1):
        if word_timings[i]["end"] > word_timings[i + 1]["start"]:
            midpoint = round((word_timings[i]["end"] + word_timings[i + 1]["start"]) / 2, 3)
            word_timings[i]["end"] = midpoint
            word_timings[i + 1]["start"] = midpoint

    return word_timings



def _fallback_even_word_timings(text: str, start: float, end: float) -> List[Dict]:
    words = text.split()
    if not words:
        return []

    raw_duration = max(end - start, 0.12)
    lead_in = min(0.05, raw_duration * 0.06)
    tail_out = min(0.05, raw_duration * 0.06)
    timing_start = start + lead_in
    timing_end = max(timing_start, end - tail_out)
    usable_duration = max(timing_end - timing_start, raw_duration * 0.7, 0.08 * len(words))

    weights = [_estimate_word_weight(word) for word in words]
    total_weight = max(sum(weights), 1e-6)

    cursor = timing_start
    word_timings: List[Dict] = []
    for i, word in enumerate(words):
        share = usable_duration * (weights[i] / total_weight)
        word_start = cursor
        word_end = timing_end if i == len(words) - 1 else min(timing_end, cursor + share)
        word_timings.append({
            "word": word,
            "start": round(word_start, 3),
            "end": round(word_end, 3),
        })
        cursor = word_end

    return _smooth_word_timings(word_timings, start, end)


def _extract_word_timings_from_vtt_text(raw_text: str, cue_start: float, cue_end: float) -> List[Dict]:
    """Extract word timings from YouTube karaoke-style VTT timestamp tags."""
    if not raw_text:
        return []

    inline = raw_text.replace("\n", " ").strip()
    timestamp_re = re.compile(r"<(\d{1,2}:\d{2}:\d{2}[.,]\d{3})>")
    matches = list(timestamp_re.finditer(inline))
    if not matches:
        return []

    chunks = []
    prev_idx = 0
    prev_time = cue_start
    for match in matches:
        next_time = _vtt_time_to_seconds(match.group(1))
        chunk_text = inline[prev_idx:match.start()]
        chunks.append((prev_time, next_time, chunk_text))
        prev_idx = match.end()
        prev_time = next_time
    chunks.append((prev_time, cue_end, inline[prev_idx:]))

    word_timings: List[Dict] = []
    for raw_start, raw_end, chunk in chunks:
        cleaned_chunk = _strip_vtt_markup(chunk)
        if not cleaned_chunk:
            continue
        words = cleaned_chunk.split()
        if not words:
            continue

        start = raw_start
        end = raw_end
        if end <= start:
            end = min(cue_end, start + max(0.12 * len(words), 0.12))
            if end <= start:
                end = start + 0.12

        duration = max(end - start, 0.12 * len(words), 0.12)
        word_duration = duration / max(len(words), 1)
        for i, word in enumerate(words):
            word_timings.append({
                "word": word,
                "start": round(start + i * word_duration, 3),
                "end": round(start + (i + 1) * word_duration, 3),
            })

    return word_timings


def _count_inline_timestamps(text: str) -> int:
    return len(re.findall(r"<\d{1,2}:\d{2}:\d{2}[.,]\d{3}>", text or ""))



def _normalize_word_token(word: str) -> str:
    return re.sub(r"[^\w'-]", "", (word or "").lower())



def _common_prefix_len(words_a: List[str], words_b: List[str]) -> int:
    count = 0
    for a, b in zip(words_a, words_b):
        if _normalize_word_token(a) != _normalize_word_token(b):
            break
        count += 1
    return count



def _prepare_growth_cues(raw_cues: List[Dict]) -> List[Dict]:
    """Collapse exact duplicates while preserving the best raw cue text."""
    prepared: List[Dict] = []
    for raw in raw_cues:
        cue = dict(raw)
        cue["tokens"] = cue["text"].split()
        if not cue["tokens"]:
            continue

        if prepared:
            prev = prepared[-1]
            common = _common_prefix_len(prev["tokens"], cue["tokens"])
            if common == len(prev["tokens"]) == len(cue["tokens"]):
                if _count_inline_timestamps(cue.get("raw_text", "")) > _count_inline_timestamps(prev.get("raw_text", "")):
                    prev["raw_text"] = cue.get("raw_text", "")
                prev["start"] = min(prev["start"], cue["start"])
                prev["end"] = max(prev["end"], cue["end"])
                continue

        prepared.append(cue)

    return prepared



def _group_growth_cues(cues: List[Dict]) -> List[List[Dict]]:
    """Group rolling-window cues where each cue expands the previous text."""
    if not cues:
        return []

    groups: List[List[Dict]] = []
    current_group: List[Dict] = [cues[0]]

    for cue in cues[1:]:
        prev = current_group[-1]
        common = _common_prefix_len(prev["tokens"], cue["tokens"])
        is_growth = common == len(prev["tokens"]) and len(cue["tokens"]) >= len(prev["tokens"])
        close_in_time = cue["start"] <= prev["end"] + 1.0

        if is_growth and close_in_time:
            current_group.append(cue)
        else:
            groups.append(current_group)
            current_group = [cue]

    groups.append(current_group)
    return groups



def _build_word_timings_from_growth_cues(group: List[Dict]) -> List[Dict]:
    """Infer word timings from successive growing subtitle cues."""
    if not group:
        return []

    segment_start = group[0]["start"]
    segment_end = max(cue["end"] for cue in group)
    final_tokens = group[-1]["tokens"]

    previous_tokens: List[str] = []
    result: List[Dict] = []

    for index, cue in enumerate(group):
        tokens = cue["tokens"]
        common = _common_prefix_len(previous_tokens, tokens)
        if common < len(previous_tokens):
            return []

        introduced = tokens[common:]
        if introduced:
            interval_start = cue["start"]
            interval_end = group[index + 1]["start"] if index + 1 < len(group) else segment_end
            if interval_end <= interval_start:
                interval_end = interval_start + max(0.12 * len(introduced), 0.12)

            batch = _fallback_even_word_timings(" ".join(introduced), interval_start, interval_end)
            result.extend(batch)

        previous_tokens = tokens

    if len(result) != len(final_tokens):
        return []

    for idx, token in enumerate(final_tokens):
        result[idx]["word"] = token

    return _smooth_word_timings(result, segment_start, segment_end)



def _parse_vtt(vtt_content: str) -> List[Dict]:
    """
    Parse WebVTT subtitle format to structured segments.

    Priority order for word timing extraction:
      1. Real inline karaoke timestamps inside the cue
      2. Rolling-window inference from adjacent growth cues
      3. Weighted fallback heuristic distribution across the cue duration
    """
    segments: List[Dict] = []

    content = vtt_content.lstrip("\ufeff").strip()
    if not content.startswith("WEBVTT"):
        logger.warning("VTT file does not start with WEBVTT header")
        return segments

    raw_cues: List[Dict] = []
    for block in re.split(r"\n\n+", content):
        block = block.strip()
        if not block or block.startswith("WEBVTT") or block.startswith("NOTE"):
            continue

        lines = block.splitlines()
        if len(lines) < 2:
            continue

        timestamp_line = None
        text_lines = []
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
            raw_cues.append({
                "start": start,
                "end": end,
                "text": text,
                "raw_text": raw_text,
            })

    prepared_cues = _prepare_growth_cues(raw_cues)
    groups = _group_growth_cues(prepared_cues)

    for idx, group in enumerate(groups):
        segment_start = round(group[0]["start"], 3)
        segment_end = round(max(cue["end"] for cue in group), 3)
        final_cue = group[-1]
        text = final_cue["text"]

        inline_candidate = None
        for cue in reversed(group):
            if _count_inline_timestamps(cue.get("raw_text", "")) > 0 and len(cue["tokens"]) == len(final_cue["tokens"]):
                inline_candidate = cue
                break

        if inline_candidate is not None:
            word_timings = _extract_word_timings_from_vtt_text(
                inline_candidate.get("raw_text", ""),
                inline_candidate["start"],
                inline_candidate["end"],
            )
            word_timings = _smooth_word_timings(word_timings, segment_start, segment_end)
        else:
            word_timings = _build_word_timings_from_growth_cues(group) if len(group) > 1 else []

        if not word_timings:
            word_timings = _fallback_even_word_timings(text, segment_start, segment_end)

        segments.append({
            "index": idx,
            "start": segment_start,
            "end": segment_end,
            "text": text,
            "words": word_timings,
            "duration": round(segment_end - segment_start, 3),
        })

    # Deduplicate segments (YouTube auto-subs often repeat lines)
    segments = _dedup_segments(segments)

    logger.debug(
        f"VTT parser: {len(raw_cues)} raw cues → {len(groups)} groups → {len(segments)} final segments (after dedup)"
    )
    return segments



def _normalize_segment_text(text: str) -> str:
    """Normalize text for comparison: lowercase, strip punctuation, collapse spaces."""
    t = re.sub(r"[^\w\s]", "", (text or "").lower())
    return re.sub(r"\s+", " ", t).strip()


def _dedup_segments(segments: List[Dict]) -> List[Dict]:
    """
    Remove duplicate/near-duplicate subtitle segments.

    YouTube auto-generated VTT often produces:
      - Exact duplicate lines with slightly different timestamps
      - Lines where one is a substring of the adjacent one
      - Repeated text across non-adjacent segments

    Strategy:
      1. Skip segments whose normalized text matches the previous segment
      2. Skip segments whose text is fully contained in the previous or next
      3. Merge segments that overlap in time AND have identical text
      4. Re-index the remaining segments
    """
    if len(segments) <= 1:
        return segments

    cleaned: List[Dict] = []

    for i, seg in enumerate(segments):
        norm = _normalize_segment_text(seg["text"])
        if not norm:
            continue

        # Skip if identical to previous
        if cleaned:
            prev_norm = _normalize_segment_text(cleaned[-1]["text"])
            if norm == prev_norm:
                # Keep the one with longer time span
                if seg["duration"] > cleaned[-1]["duration"]:
                    cleaned[-1] = seg
                continue

            # Skip if current is a substring of previous
            if norm in prev_norm:
                continue

            # If previous is a substring of current, replace it
            if prev_norm in norm:
                cleaned[-1] = seg
                continue

            # Skip near-duplicates (>80% word overlap)
            prev_words = set(prev_norm.split())
            curr_words = set(norm.split())
            if prev_words and curr_words:
                overlap = len(prev_words & curr_words) / max(len(prev_words), len(curr_words))
                if overlap > 0.8 and abs(seg["start"] - cleaned[-1]["start"]) < 2.0:
                    # Keep the longer text
                    if len(seg["text"]) > len(cleaned[-1]["text"]):
                        cleaned[-1] = seg
                    continue

        cleaned.append(seg)

    # Re-index
    for i, seg in enumerate(cleaned):
        seg["index"] = i

    return cleaned


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
            return

        if proc.returncode != 0:
            logger.error(f"Audio download failed: {stderr.decode(errors='replace')[:300]}")
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
            return

        # Step 3: Persist transcript
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
        }

        await db_manager.save_transcript(transcript_data)
        logger.info(f"Whisper transcription complete for {video_id}: {len(segments)} segments")

    except Exception as e:
        logger.error(f"Whisper transcription failed for {video_id}: {e}", exc_info=True)
    finally:
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@router.get("/{video_id}")
async def get_transcript(
    video_id: str,
    language: str = Query("en", description="Language code"),
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
    end_time: Optional[float] = Query(None),
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
