"""
Local dictionary API for LinguaLearn.
Provides word definitions, translations, and analysis without external APIs.
"""

import json
import uuid
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()
db_manager = None
dictionary_service = None

class WordResponse(BaseModel):
    id: str
    word: str
    pronunciation: str
    part_of_speech: str
    level: str
    meaning_ar: str
    meaning_en: str
    examples: List[str]
    synonyms: List[str]
    antonyms: List[str]
    conjugations: Dict
    related_words: List[str]

class WordSearchRequest(BaseModel):
    word: str

@router.post("/lookup")
async def lookup_word(request: WordSearchRequest):
    """Look up a word in the local dictionary."""
    word = request.word.lower().strip()
    
    if not word:
        raise HTTPException(status_code=400, detail="Word cannot be empty")
    
    # Check database first
    cached = await db_manager.get_word(word)
    if cached:
        # Update frequency
        async with db_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE words SET frequency = frequency + 1 WHERE word = ?", (word,))
        return cached
    
    # Use local dictionary service
    global dictionary_service
    if dictionary_service is None:
        from ai.dictionary.service import DictionaryService
        from config import load_config
        config = load_config()
        dictionary_service = DictionaryService(config.ai.dictionary)
    
    try:
        word_data = await dictionary_service.lookup(word)
        
        if word_data:
            word_data['id'] = str(uuid.uuid4())
            await db_manager.add_word(word_data)
            return word_data
        else:
            # Return a basic response with empty fields
            basic_data = {
                'id': str(uuid.uuid4()),
                'word': word,
                'pronunciation': f'/{word}/',
                'part_of_speech': 'unknown',
                'level': 'B1',
                'meaning_ar': '',
                'meaning_en': f'No definition available locally for "{word}"',
                'examples': [],
                'synonyms': [],
                'antonyms': [],
                'conjugations': {},
                'related_words': [],
                'frequency': 1
            }
            await db_manager.add_word(basic_data)
            return basic_data
            
    except Exception as e:
        logger.error(f"Dictionary lookup failed: {e}")
        raise HTTPException(status_code=500, detail="Dictionary lookup failed")

@router.get("/search")
async def search_dictionary(query: str = Query(..., min_length=2), limit: int = Query(10, ge=1, le=50)):
    """Search dictionary for words matching query."""
    async with db_manager.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT word, part_of_speech, meaning_ar, meaning_en, level, frequency
            FROM words 
            WHERE word LIKE ? 
            ORDER BY frequency DESC, word ASC
            LIMIT ?
        """, (f'{query}%', limit))
        
        results = [dict(row) for row in cursor.fetchall()]
    
    return {"results": results, "count": len(results), "query": query}

@router.get("/suggest")
async def suggest_words(prefix: str = Query(..., min_length=1), limit: int = Query(10, ge=1, le=30)):
    """Auto-complete suggestions for word input."""
    async with db_manager.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT word, part_of_speech, frequency
            FROM words 
            WHERE word LIKE ? 
            ORDER BY frequency DESC
            LIMIT ?
        """, (f'{prefix}%', limit))
        
        suggestions = [dict(row) for row in cursor.fetchall()]
    
    return {"suggestions": suggestions}

@router.get("/popular")
async def get_popular_words(limit: int = Query(50, ge=1, le=200)):
    """Get most frequently looked up words."""
    async with db_manager.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT word, part_of_speech, meaning_ar, level, frequency
            FROM words 
            ORDER BY frequency DESC
            LIMIT ?
        """, (limit,))
        
        words = [dict(row) for row in cursor.fetchall()]
    
    return {"words": words, "count": len(words)}

@router.get("/level/{word}")
async def get_word_level(word: str):
    """Get CEFR level (A1-C2) estimate for a word."""
    from ai.dictionary.level_estimator import estimate_level
    
    word_data = await db_manager.get_word(word.lower())
    if word_data and word_data.get('level'):
        return {"word": word, "level": word_data['level']}
    
    # Estimate level
    level = estimate_level(word)
    return {"word": word, "level": level}

def init_api(db):
    global db_manager
    db_manager = db