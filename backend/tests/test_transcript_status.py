"""Phase 2: transcript status state machine in DatabaseManager."""

import asyncio
import tempfile

from backend.app.db.database import DatabaseManager


def _db():
    db = DatabaseManager(tempfile.mktemp(suffix=".db"))
    asyncio.run(db.initialize())

    async def _video():
        await db.add_video({
            "id": "v1", "youtube_id": "yt1", "title": "T", "channel": "C",
            "duration": 1, "thumbnail_url": "", "description": "",
            "status": "ready", "user_id": "u1",
        })
    asyncio.run(_video())
    return db


def test_status_idle_by_default():
    db = _db()
    assert asyncio.run(db.get_transcript_status("v1", "en"))["status"] == "idle"


def test_status_processing_then_error():
    db = _db()
    asyncio.run(db.set_transcript_status("v1", "en", "processing"))
    assert asyncio.run(db.get_transcript_status("v1", "en"))["status"] == "processing"
    asyncio.run(db.set_transcript_status("v1", "en", "error", "boom"))
    st = asyncio.run(db.get_transcript_status("v1", "en"))
    assert st["status"] == "error"
    assert st["error"] == "boom"


def test_saving_transcript_replaces_placeholder():
    """A status placeholder must not shadow the real transcript (dedupe by video+lang)."""
    db = _db()
    asyncio.run(db.set_transcript_status("v1", "en", "processing"))
    asyncio.run(db.save_transcript({
        "id": "t1", "video_id": "v1", "language": "en", "source": "whisper",
        "segments": [{"index": 0, "start": 0, "end": 1, "text": "hi", "words": []}],
        "full_text": "hi", "word_timings": {}, "status": "ready",
    }))
    st = asyncio.run(db.get_transcript_status("v1", "en"))
    assert st["status"] == "ready"
    assert st["segment_count"] == 1
    # exactly one row remains for (v1, en)
    t = asyncio.run(db.get_transcript("v1", "en"))
    assert t is not None and len(t["segments"]) == 1
