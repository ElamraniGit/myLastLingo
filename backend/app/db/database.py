"""
Local SQLite Database Manager for LinguaLearn.
Handles all data persistence locally on device.
"""

import os
import json
import logging
import sqlite3
import asyncio
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages SQLite database for local storage."""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._pool: List[sqlite3.Connection] = []
        self._pool_size = 5
        self._lock = asyncio.Lock()
    
    async def initialize(self):
        """Initialize database and create tables."""
        logger.info(f"Initializing database at {self.db_path}")
        
        # Ensure directory exists
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        
        async with self._lock:
            conn = self._get_connection()
            try:
                conn.execute("PRAGMA journal_mode=WAL;")
                conn.execute("PRAGMA foreign_keys=ON;")
                conn.execute("PRAGMA synchronous=NORMAL;")
                conn.execute("PRAGMA cache_size=-8000;")  # 8MB cache
                
                self._create_tables(conn)
                conn.commit()
                logger.info("Database initialized successfully")
            finally:
                self._release_connection(conn)
    
    def _get_connection(self) -> sqlite3.Connection:
        """Get a database connection from pool or create new."""
        if self._pool:
            return self._pool.pop()
        conn = sqlite3.connect(self.db_path, timeout=30, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn
    
    def _release_connection(self, conn: sqlite3.Connection):
        """Return connection to pool."""
        if len(self._pool) < self._pool_size:
            self._pool.append(conn)
        else:
            conn.close()
    
    @asynccontextmanager
    async def get_connection(self):
        """Async context manager for database connections."""
        conn = self._get_connection()
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            self._release_connection(conn)
    
    def _create_tables(self, conn: sqlite3.Connection):
        """Create all database tables."""
        cursor = conn.cursor()
        
        # Videos table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS videos (
                id TEXT PRIMARY KEY,
                youtube_id TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL,
                channel TEXT,
                duration INTEGER,
                thumbnail_url TEXT,
                description TEXT,
                downloaded_path TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Transcripts table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transcripts (
                id TEXT PRIMARY KEY,
                video_id TEXT NOT NULL,
                language TEXT NOT NULL DEFAULT 'en',
                source TEXT DEFAULT 'youtube',
                segments TEXT NOT NULL,
                full_text TEXT,
                word_timings TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
            )
        """)
        
        # Words table (dictionary)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS words (
                id TEXT PRIMARY KEY,
                word TEXT NOT NULL UNIQUE,
                pronunciation TEXT,
                part_of_speech TEXT,
                level TEXT DEFAULT 'B1',
                meaning_ar TEXT,
                meaning_en TEXT,
                examples TEXT,
                synonyms TEXT,
                antonyms TEXT,
                root_form TEXT,
                conjugations TEXT,
                related_words TEXT,
                frequency INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Saved words (user vocabulary)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS saved_words (
                id TEXT PRIMARY KEY,
                word_id TEXT NOT NULL,
                video_id TEXT,
                sentence TEXT,
                context TEXT,
                status TEXT DEFAULT 'learning',
                ease_factor REAL DEFAULT 2.5,
                interval INTEGER DEFAULT 0,
                repetitions INTEGER DEFAULT 0,
                next_review TIMESTAMP,
                last_reviewed TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
                FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE SET NULL
            )
        """)
        
        # Word reviews (spaced repetition history)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS word_reviews (
                id TEXT PRIMARY KEY,
                saved_word_id TEXT NOT NULL,
                quality INTEGER CHECK(quality >= 0 AND quality <= 5),
                reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (saved_word_id) REFERENCES saved_words(id) ON DELETE CASCADE
            )
        """)
        
        # User progress
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_progress (
                id TEXT PRIMARY KEY,
                total_videos INTEGER DEFAULT 0,
                total_words_saved INTEGER DEFAULT 0,
                total_words_learned INTEGER DEFAULT 0,
                total_study_time INTEGER DEFAULT 0,
                streak_days INTEGER DEFAULT 0,
                last_active TIMESTAMP,
                vocabulary_level TEXT DEFAULT 'A1',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Sessions/Play history
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                video_id TEXT NOT NULL,
                last_position REAL DEFAULT 0,
                playback_speed REAL DEFAULT 1.0,
                volume REAL DEFAULT 1.0,
                completed BOOLEAN DEFAULT 0,
                watch_count INTEGER DEFAULT 1,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_watched TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
            )
        """)
        
        # Indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_videos_youtube ON videos(youtube_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_transcripts_video ON transcripts(video_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_words_word ON words(word)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_saved_words_user ON saved_words(status, next_review)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_video ON sessions(video_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_word_reviews_saved ON word_reviews(saved_word_id)")
        
    # === CRUD Operations ===
    
    async def add_video(self, video_data: Dict[str, Any]) -> str:
        """Add a new video to the database."""
        async with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO videos 
                (id, youtube_id, title, channel, duration, thumbnail_url, description, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                video_data.get('id'),
                video_data['youtube_id'],
                video_data['title'],
                video_data.get('channel', ''),
                video_data.get('duration', 0),
                video_data.get('thumbnail_url', ''),
                video_data.get('description', ''),
                video_data.get('status', 'downloaded')
            ))
            return cursor.lastrowid
    
    async def get_video(self, video_id: str) -> Optional[Dict[str, Any]]:
        """Get video by ID."""
        async with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM videos WHERE id = ?", (video_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    async def get_video_by_youtube_id(self, youtube_id: str) -> Optional[Dict[str, Any]]:
        """Get video by YouTube ID."""
        async with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM videos WHERE youtube_id = ?", (youtube_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    async def save_transcript(self, transcript_data: Dict[str, Any]) -> str:
        """Save transcript for a video."""
        async with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO transcripts
                (id, video_id, language, source, segments, full_text, word_timings)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                transcript_data.get('id'),
                transcript_data['video_id'],
                transcript_data.get('language', 'en'),
                transcript_data.get('source', 'youtube'),
                json.dumps(transcript_data.get('segments', [])),
                transcript_data.get('full_text', ''),
                json.dumps(transcript_data.get('word_timings', {}))
            ))
            return cursor.lastrowid
    
    async def get_transcript(self, video_id: str, language: str = 'en') -> Optional[Dict[str, Any]]:
        """Get transcript for a video."""
        async with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM transcripts WHERE video_id = ? AND language = ?",
                (video_id, language)
            )
            row = cursor.fetchone()
            if row:
                data = dict(row)
                data['segments'] = json.loads(data['segments'])
                data['word_timings'] = json.loads(data['word_timings']) if data['word_timings'] else {}
                return data
            return None
    
    async def add_word(self, word_data: Dict[str, Any]) -> str:
        """Add a word to the dictionary."""
        async with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO words
                (id, word, pronunciation, part_of_speech, level, meaning_ar, meaning_en,
                 examples, synonyms, antonyms, root_form, conjugations, related_words, frequency)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                word_data.get('id'),
                word_data['word'].lower(),
                word_data.get('pronunciation', ''),
                word_data.get('part_of_speech', ''),
                word_data.get('level', 'B1'),
                word_data.get('meaning_ar', ''),
                word_data.get('meaning_en', ''),
                json.dumps(word_data.get('examples', [])),
                json.dumps(word_data.get('synonyms', [])),
                json.dumps(word_data.get('antonyms', [])),
                word_data.get('root_form', ''),
                json.dumps(word_data.get('conjugations', {})),
                json.dumps(word_data.get('related_words', [])),
                word_data.get('frequency', 0)
            ))
            return cursor.lastrowid
    
    async def get_word(self, word: str) -> Optional[Dict[str, Any]]:
        """Get word from dictionary."""
        async with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM words WHERE word = ?", (word.lower(),))
            row = cursor.fetchone()
            if row:
                data = dict(row)
                data['examples'] = json.loads(data['examples']) if data['examples'] else []
                data['synonyms'] = json.loads(data['synonyms']) if data['synonyms'] else []
                data['antonyms'] = json.loads(data['antonyms']) if data['antonyms'] else []
                data['conjugations'] = json.loads(data['conjugations']) if data['conjugations'] else {}
                data['related_words'] = json.loads(data['related_words']) if data['related_words'] else []
                return data
            return None
    
    async def save_word_to_vocabulary(self, word_id: str, video_id: str, 
                                     sentence: str, context: str) -> str:
        """Save a word to user's vocabulary."""
        import uuid
        saved_id = str(uuid.uuid4())
        
        async with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO saved_words (id, word_id, video_id, sentence, context, next_review)
                VALUES (?, ?, ?, ?, ?, datetime('now', '+1 day'))
            """, (saved_id, word_id, video_id, sentence, context))
            
            # Update user progress
            cursor.execute("""
                UPDATE user_progress 
                SET total_words_saved = total_words_saved + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = (SELECT id FROM user_progress LIMIT 1)
            """)
            
            return saved_id
    
    async def get_saved_words(self, status: Optional[str] = None, limit: int = 50) -> List[Dict]:
        """Get saved vocabulary words."""
        async with self.get_connection() as conn:
            cursor = conn.cursor()
            if status:
                cursor.execute("""
                    SELECT sw.*, w.word, w.pronunciation, w.part_of_speech, w.meaning_ar, w.meaning_en,
                           w.level, w.examples, w.synonyms, w.antonyms
                    FROM saved_words sw
                    JOIN words w ON sw.word_id = w.id
                    WHERE sw.status = ?
                    ORDER BY sw.next_review ASC
                    LIMIT ?
                """, (status, limit))
            else:
                cursor.execute("""
                    SELECT sw.*, w.word, w.pronunciation, w.part_of_speech, w.meaning_ar, w.meaning_en,
                           w.level, w.examples, w.synonyms, w.antonyms
                    FROM saved_words sw
                    JOIN words w ON sw.word_id = w.id
                    ORDER BY sw.next_review ASC
                    LIMIT ?
                """, (limit,))
            
            rows = cursor.fetchall()
            results = []
            for row in rows:
                data = dict(row)
                if data.get('examples'):
                    data['examples'] = json.loads(data['examples'])
                results.append(data)
            return results
    
    async def update_review(self, saved_word_id: str, quality: int):
        """Update spaced repetition review for a word."""
        async with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Get current saved word data
            cursor.execute("SELECT * FROM saved_words WHERE id = ?", (saved_word_id,))
            word = cursor.fetchone()
            if not word:
                return
            
            # SM2 Algorithm
            ease_factor = word['ease_factor']
            interval = word['interval']
            repetitions = word['repetitions']
            
            if quality >= 3:
                if repetitions == 0:
                    interval = 1
                elif repetitions == 1:
                    interval = 6
                else:
                    interval = round(interval * ease_factor)
                repetitions += 1
            else:
                repetitions = 0
                interval = 1
            
            ease_factor = max(1.3, ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
            
            next_review = (datetime.now() + timedelta(days=interval)).isoformat()
            
            cursor.execute("""
                UPDATE saved_words 
                SET ease_factor = ?, interval = ?, repetitions = ?, 
                    next_review = ?, last_reviewed = CURRENT_TIMESTAMP,
                    status = CASE WHEN ? >= 4 AND repetitions >= 3 THEN 'learned' ELSE 'learning' END
                WHERE id = ?
            """, (ease_factor, interval, repetitions, next_review, quality, saved_word_id))
            
            # Record review
            cursor.execute("""
                INSERT INTO word_reviews (id, saved_word_id, quality)
                VALUES (?, ?, ?)
            """, (str(uuid.uuid4()), saved_word_id, quality))
    
    async def get_due_words(self, limit: int = 20) -> List[Dict]:
        """Get words due for review."""
        async with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT sw.*, w.word, w.pronunciation, w.part_of_speech, w.meaning_ar, w.meaning_en,
                       w.level, w.examples
                FROM saved_words sw
                JOIN words w ON sw.word_id = w.id
                WHERE (sw.next_review IS NULL OR sw.next_review <= datetime('now'))
                  AND sw.status IN ('learning', 'reviewing')
                ORDER BY sw.next_review ASC
                LIMIT ?
            """, (limit,))
            return [dict(row) for row in cursor.fetchall()]
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get user statistics."""
        async with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Get or create progress
            cursor.execute("SELECT * FROM user_progress LIMIT 1")
            progress = cursor.fetchone()
            
            if not progress:
                cursor.execute("""
                    INSERT INTO user_progress (id, created_at, updated_at)
                    VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, (str(uuid.uuid4()),))
                progress = cursor.fetchone()
            
            stats = dict(progress) if progress else {}
            
            # Additional stats
            cursor.execute("SELECT COUNT(*) as total FROM videos")
            stats['total_videos'] = cursor.fetchone()['total']
            
            cursor.execute("SELECT COUNT(*) as total FROM saved_words")
            stats['total_saved_words'] = cursor.fetchone()['total']
            
            cursor.execute("SELECT COUNT(*) as total FROM saved_words WHERE status = 'learned'")
            stats['learned_words'] = cursor.fetchone()['total']
            
            cursor.execute("SELECT COUNT(*) as total FROM saved_words WHERE next_review <= datetime('now')")
            stats['due_reviews'] = cursor.fetchone()['total']
            
            return stats
    
    async def close(self):
        """Close all database connections."""
        for conn in self._pool:
            conn.close()
        self._pool.clear()
        logger.info("Database connections closed")


import uuid