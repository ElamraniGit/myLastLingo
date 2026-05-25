"""
Video player control API.
Handles playback state, synchronization, and WebSocket connections.
"""

import json
import uuid
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()
db_manager = None

# Active WebSocket connections for real-time sync
active_connections: Dict[str, WebSocket] = {}

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
async def update_player_state(state: PlayerState):
    """Update and save player state."""
    async with db_manager.get_connection() as conn:
        cursor = conn.cursor()
        
        # Check if session exists
        cursor.execute(
            "SELECT * FROM sessions WHERE video_id = ?", 
            (state.video_id,)
        )
        session = cursor.fetchone()
        
        if session:
            cursor.execute("""
                UPDATE sessions SET
                    last_position = ?,
                    playback_speed = ?,
                    volume = ?,
                    last_watched = CURRENT_TIMESTAMP,
                    watch_count = watch_count + 1
                WHERE video_id = ?
            """, (state.position, state.speed, state.volume, state.video_id))
        else:
            cursor.execute("""
                INSERT INTO sessions (id, video_id, last_position, playback_speed, volume)
                VALUES (?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), state.video_id, state.position, state.speed, state.volume))
    
    return {"message": "State saved", "position": state.position}

@router.get("/state/{video_id}")
async def get_player_state(video_id: str):
    """Get saved player state for a video."""
    async with db_manager.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sessions WHERE video_id = ?", (video_id,))
        session = cursor.fetchone()
        
        if not session:
            return {
                "video_id": video_id,
                "position": 0,
                "playback_speed": 1.0,
                "volume": 1.0,
                "watch_count": 0
            }
        
        return dict(session)

@router.get("/stream/{video_id}")
async def get_video_stream(video_id: str):
    """Get video streaming information."""
    video = await db_manager.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Check if local file exists
    video_path = f"data/downloads/{video_id}.mp4"
    
    if Path(video_path).exists():
        return {
            "source": "local",
            "path": f"/api/v1/player/file/{video_id}",
            "type": "video/mp4"
        }
    
    # Fall back to streaming URL
    return {
        "source": "stream",
        "path": f"https://www.youtube.com/watch?v={video['youtube_id']}",
        "type": "youtube"
    }

@router.get("/file/{video_id}")
async def serve_video_file(video_id: str):
    """Serve local video file for streaming."""
    from fastapi.responses import FileResponse
    
    video_path = f"data/downloads/{video_id}.mp4"
    if not Path(video_path).exists():
        raise HTTPException(status_code=404, detail="Video file not found")
    
    return FileResponse(video_path, media_type="video/mp4")

@router.websocket("/ws/{video_id}")
async def websocket_sync(websocket: WebSocket, video_id: str):
    """WebSocket for real-time video synchronization."""
    await websocket.accept()
    active_connections[video_id] = websocket
    
    try:
        while True:
            data = await websocket.receive_json()
            
            # Handle different message types
            msg_type = data.get('type')
            
            if msg_type == 'sync':
                # Broadcast sync data to all connected clients
                for conn_id, conn in active_connections.items():
                    if conn_id != video_id:
                        try:
                            await conn.send_json({
                                'type': 'sync',
                                'video_id': video_id,
                                'position': data['position'],
                                'playing': data['playing'],
                                'timestamp': datetime.now().isoformat()
                            })
                        except:
                            pass
            
            elif msg_type == 'word_click':
                # Handle word click event
                await websocket.send_json({
                    'type': 'word_info_request',
                    'word': data['word'],
                    'timestamp': data.get('timestamp', 0)
                })
            
            elif msg_type == 'segment_change':
                # Notify about current segment change
                await websocket.send_json({
                    'type': 'segment_updated',
                    'segment_index': data['segment_index'],
                    'segment_text': data.get('text', '')
                })
    
    except WebSocketDisconnect:
        active_connections.pop(video_id, None)
        logger.info(f"WebSocket disconnected for {video_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        active_connections.pop(video_id, None)

def init_api(db):
    global db_manager
    db_manager = db