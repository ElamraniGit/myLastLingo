"""
Video player control API.
Handles playback state, synchronization, and WebSocket connections.

FIXES APPLIED:
 - BUG-5:  WebSocket now verifies JWT token via query param (auth on WS).
 - BUG-6:  delete_video uses absolute path (via PROJECT_ROOT) instead of relative.
 - Bug #11: WebSocket connections keyed by unique session_id, not video_id.
"""

import json
import uuid
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Query, Depends
from pydantic import BaseModel

from backend.app.api.auth import get_current_user, _verify_token

logger = logging.getLogger(__name__)

router = APIRouter()
db_manager = None

# Resolve downloads dir absolutely so it works regardless of CWD
_DOWNLOADS_DIR = (Path(__file__).resolve().parent.parent.parent.parent / "data" / "downloads").resolve()


def _safe_video_path(video_id: str) -> Path:
    """
    Resolve the local video file path while preventing path traversal.
    Uses absolute path — FIX BUG-6.
    """
    import re as _re
    if not _re.fullmatch(r"[A-Za-z0-9_-]+", video_id or ""):
        raise HTTPException(status_code=400, detail="Invalid video id")
    target = (_DOWNLOADS_DIR / f"{video_id}.mp4").resolve()
    if _DOWNLOADS_DIR not in target.parents:
        raise HTTPException(status_code=400, detail="Invalid video id")
    return target


# Bug #11 fix: key = unique session_id, value = (websocket, video_id)
active_connections: Dict[str, tuple] = {}

class PlayerState(BaseModel):
    video_id: str
    position: float = 0.0
    playing: bool = False
    speed: float = 1.0
    volume: float = 1.0
    current_segment: int = 0
    loop_enabled: bool = False
    loop_start: Optional[float] = None
    loop_end: Optional[float] = None


@router.post("/state")
async def update_player_state(
    state: PlayerState,
    current_user: dict = Depends(get_current_user),
):
    """Update and save player state (scoped to the current user)."""
    uid = current_user["sub"]
    async with db_manager.get_connection() as conn:
        # FIX-SEC-3: scope session by (video_id, user_id) so two users watching
        # the same YouTube video don't overwrite each other's resume position.
        async with conn.execute(
            "SELECT * FROM sessions WHERE video_id = ? AND user_id = ?", (state.video_id, uid)
        ) as cursor:
            session = await cursor.fetchone()

        if session:
            await conn.execute(
                """
                UPDATE sessions SET
                    last_position = ?,
                    playback_speed = ?,
                    volume = ?,
                    last_watched = CURRENT_TIMESTAMP,
                    watch_count = watch_count + 1
                WHERE video_id = ? AND user_id = ?
                """,
                (state.position, state.speed, state.volume, state.video_id, uid),
            )
        else:
            await conn.execute(
                """
                INSERT INTO sessions (id, video_id, last_position, playback_speed, volume, user_id)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (str(uuid.uuid4()), state.video_id, state.position, state.speed, state.volume, uid),
            )

    return {"message": "State saved", "position": state.position}


@router.get("/state/{video_id}")
async def get_player_state(
    video_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get saved player state for a video (scoped to the current user)."""
    async with db_manager.get_connection() as conn:
        async with conn.execute(
            "SELECT * FROM sessions WHERE video_id = ? AND user_id = ?",
            (video_id, current_user["sub"]),
        ) as cursor:
            session = await cursor.fetchone()

    if not session:
        return {
            "video_id": video_id,
            "position": 0,
            "playback_speed": 1.0,
            "volume": 1.0,
            "watch_count": 0,
        }

    return dict(session)


@router.get("/stream/{video_id}")
async def get_video_stream(
    video_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get video streaming information."""
    video = await db_manager.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    video_path = _safe_video_path(video_id)
    if video_path.exists():
        return {
            "source": "local",
            "path": f"/api/v1/player/file/{video_id}",
            "type": "video/mp4",
        }

    return {
        "source": "youtube",
        "youtube_id": video["youtube_id"],
        "url": f"https://www.youtube.com/watch?v={video['youtube_id']}",
        "type": "youtube",
    }


@router.get("/file/{video_id}")
async def serve_video_file(
    video_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Serve local video file for streaming."""
    from fastapi.responses import FileResponse

    video_path = _safe_video_path(video_id)
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found")

    return FileResponse(str(video_path), media_type="video/mp4")


@router.websocket("/ws/{video_id}")
async def websocket_sync(
    websocket: WebSocket,
    video_id: str,
    token: Optional[str] = Query(None),  # FIX BUG-5: auth via query param
):
    """
    WebSocket for real-time video synchronization.

    FIX BUG-5: Requires valid JWT token as ?token= query parameter.
    Bug #11 fix: Each connection gets a unique session_id so multiple tabs
    on the same video don't overwrite each other.
    """
    # ── Auth check ────────────────────────────────────────────────────────────
    if not token:
        await websocket.close(code=4001, reason="Authentication required")
        return

    payload = _verify_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    await websocket.accept()

    # Unique key per connection, not per video
    session_id = str(uuid.uuid4())
    active_connections[session_id] = (websocket, video_id)
    logger.info(f"WebSocket connected: session={session_id}, video={video_id}, user={payload.get('username')}")

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "sync":
                # Broadcast sync to all OTHER connections watching the same video
                for sid, (conn, vid) in list(active_connections.items()):
                    if sid != session_id and vid == video_id:
                        try:
                            await conn.send_json(
                                {
                                    "type": "sync",
                                    "video_id": video_id,
                                    "position": data.get("position", 0),
                                    "playing": data.get("playing", False),
                                    "timestamp": datetime.now().isoformat(),
                                }
                            )
                        except Exception:
                            # Dead connection — remove it
                            active_connections.pop(sid, None)

            elif msg_type == "word_click":
                await websocket.send_json(
                    {
                        "type": "word_info_request",
                        "word": data.get("word", ""),
                        "timestamp": data.get("timestamp", 0),
                    }
                )

            elif msg_type == "segment_change":
                await websocket.send_json(
                    {
                        "type": "segment_updated",
                        "segment_index": data.get("segment_index", 0),
                        "segment_text": data.get("text", ""),
                    }
                )

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: session={session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        active_connections.pop(session_id, None)


def init_api(db):
    global db_manager
    db_manager = db
