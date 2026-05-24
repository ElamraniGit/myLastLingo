"""
Vocabulary management API.
Handles saved words, flashcards, and spaced repetition.
"""

import json
import uuid
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()
db_manager = None
dict_service = None  # DictionaryService instance (injected)

class SaveWordRequest(BaseModel):
    word: str
    video_id: Optional[str] = None
    sentence: str = ""
    context: str = ""

class ReviewRequest(BaseModel):
    saved_word_id: str
    quality: int  # 0-5

class WordResponse(BaseModel):
    id: str
    word: str
    pronunciation: str
    part_of_speech: str
    meaning_ar: str
    meaning_en: str
    level: str
    sentence: str
    status: str
    next_review: Optional[str]

@router.post("/save")
async def save_word(request: SaveWordRequest):
    """Save a word to user's vocabulary."""
    word = request.word.lower().strip()
    
    # Ensure word exists in dictionary
    word_data = await db_manager.get_word(word)
    if not word_data:
        # Try to look up from local dictionary service
        try:
            from backend.ai.dictionary.service import DictionaryService
            svc = DictionaryService()
            word_data = await svc.lookup(word)
            if word_data:
                word_data['id'] = str(uuid.uuid4())
                await db_manager.add_word(word_data)
            else:
                # Create a basic entry
                word_data = {
                    'id': str(uuid.uuid4()),
                    'word': word,
                    'pronunciation': f'/{word}/',
                    'part_of_speech': 'unknown',
                    'level': 'B1',
                    'meaning_ar': '',
                    'meaning_en': f'Definition not available locally for "{word}"',
                    'examples': [],
                    'synonyms': [],
                    'antonyms': [],
                    'conjugations': {},
                    'related_words': [],
                    'frequency': 1
                }
                await db_manager.add_word(word_data)
        except Exception as e:
            logger.warning(f"Dictionary lookup failed, using basic entry: {e}")
            word_data = {
                'id': str(uuid.uuid4()),
                'word': word,
                'pronunciation': f'/{word}/',
                'part_of_speech': 'unknown',
                'level': 'B1',
                'meaning_ar': '',
                'meaning_en': f'{word}',
                'examples': [],
                'synonyms': [],
                'antonyms': [],
                'conjugations': {},
                'related_words': [],
                'frequency': 1
            }
            await db_manager.add_word(word_data)
    
    # Check if already saved
    async with db_manager.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM saved_words WHERE word_id = ? AND video_id = ?",
            (word_data['id'], request.video_id)
        )
        existing = cursor.fetchone()
        
        if existing:
            return {"message": "Word already saved", "id": existing['id']}
    
    # Save word
    saved_id = await db_manager.save_word_to_vocabulary(
        word_data['id'],
        request.video_id,
        request.sentence,
        request.context
    )
    
    return {
        "message": "Word saved successfully",
        "id": saved_id,
        "word": word,
        "status": "learning"
    }

@router.get("/list")
async def list_vocabulary(
    status: Optional[str] = Query(None, pattern="^(learning|reviewing|learned)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
):
    """List saved vocabulary words."""
    words = await db_manager.get_saved_words(status, limit * page)
    
    # Paginate
    start = (page - 1) * limit
    paginated = words[start:start + limit]
    
    async with db_manager.get_connection() as conn:
        cursor = conn.cursor()
        if status:
            cursor.execute("SELECT COUNT(*) as total FROM saved_words WHERE status = ?", (status,))
        else:
            cursor.execute("SELECT COUNT(*) as total FROM saved_words")
        total = cursor.fetchone()['total']
    
    return {
        "words": paginated,
        "page": page,
        "limit": limit,
        "total": total,
        "pages": max(1, (total + limit - 1) // limit)
    }

@router.post("/review")
async def review_word(request: ReviewRequest):
    """Review a saved word using SM-2 spaced repetition."""
    if request.quality < 0 or request.quality > 5:
        raise HTTPException(status_code=400, detail="Quality must be between 0 and 5")
    
    await db_manager.update_review(request.saved_word_id, request.quality)
    
    return {"message": "Review recorded", "saved_word_id": request.saved_word_id}

@router.get("/due")
async def get_due_words(limit: int = Query(20, ge=1, le=50)):
    """Get words due for review."""
    words = await db_manager.get_due_words(limit)
    return {"words": words, "count": len(words)}

@router.get("/stats")
async def get_vocabulary_stats():
    """Get vocabulary learning statistics."""
    async with db_manager.get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'learning' THEN 1 ELSE 0 END) as learning,
                SUM(CASE WHEN status = 'learned' THEN 1 ELSE 0 END) as learned,
                SUM(CASE WHEN next_review <= datetime('now') THEN 1 ELSE 0 END) as due
            FROM saved_words
        """)
        stats = dict(cursor.fetchone())
        
        # Get today's reviews
        cursor.execute("""
            SELECT COUNT(*) as today_reviews
            FROM word_reviews
            WHERE date(reviewed_at) = date('now')
        """)
        today = cursor.fetchone()
        stats['reviewed_today'] = today['today_reviews']
        
        # Streak
        cursor.execute("""
            SELECT COUNT(DISTINCT date(reviewed_at)) as streak
            FROM word_reviews
            WHERE reviewed_at >= date('now', '-30 days')
        """)
        streak_data = cursor.fetchone()
        stats['active_days_30'] = streak_data['streak']
        
        # Level distribution
        cursor.execute("""
            SELECT w.level, COUNT(*) as count
            FROM saved_words sw
            JOIN words w ON sw.word_id = w.id
            GROUP BY w.level
            ORDER BY w.level
        """)
        stats['level_distribution'] = {row['level']: row['count'] for row in cursor.fetchall()}
        
    return stats

@router.delete("/{saved_id}")
async def delete_saved_word(saved_id: str):
    """Remove a word from vocabulary."""
    async with db_manager.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM word_reviews WHERE saved_word_id = ?", (saved_id,))
        cursor.execute("DELETE FROM saved_words WHERE id = ?", (saved_id,))
    
    return {"message": "Word removed from vocabulary"}

def init_api(db):
    global db_manager
    db_manager = db