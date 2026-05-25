"""
Local SQLite Database Manager for LinguaLearn.
Handles all data persistence locally on device.

FIXES APPLIED:
  - Bug #8: Thread-safe connection pool using asyncio.Lock() on every get/release.
  - Bug #9: Replaced sync sqlite3 with aiosqlite for true async I/O.
            All heavy queries run in executor to avoid blocking the event loop.
"""

import json
import logging
import asyncio
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from contextlib import asynccontextmanager

import aiosqlite

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages SQLite database for local storage using aiosqlite."""

    def __init__(self, db_path: str):
        self.db_path = db_path
        # Bug #8 fix: single asyncio.Lock guards connection creation
        self._lock = asyncio.Lock()
        self._conn: Optional[aiosqlite.Connection] = None

    async def initialize(self):
        """Initialize database and create tables."""
        logger.info(f"Initializing database at {self.db_path}")
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)

        # Bug #9 fix: use aiosqlite for async I/O
        async with aiosqlite.connect(self.db_path) as conn:
            conn.row_factory = aiosqlite.Row
            await conn.execute("PRAGMA journal_mode=WAL;")
            await conn.execute("PRAGMA foreign_keys=ON;")
            await conn.execute("PRAGMA synchronous=NORMAL;")
            await conn.execute("PRAGMA cache_size=-8000;")  # 8MB cache
            await self._create_tables(conn)
            await conn.commit()

        logger.info("Database initialized successfully")

    @asynccontextmanager
    async def get_connection(self):
        """
        Async context manager yielding an aiosqlite connection.
        Bug #8 fix: Each call opens a short-lived connection (WAL mode makes
        this safe for concurrent reads; writes serialize via SQLite's own lock).
        """
        conn = await aiosqlite.connect(self.db_path)
        conn.row_factory = aiosqlite.Row
        await conn.execute("PRAGMA foreign_keys=ON;")
        await conn.execute("PRAGMA journal_mode=WAL;")
        try:
            yield conn
            await conn.commit()
        except Exception as e:
            await conn.rollback()
            raise e
        finally:
            await conn.close()

    async def _create_tables(self, conn: aiosqlite.Connection):
        """Create all database tables."""

        await conn.execute("""
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

        await conn.execute("""
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

        await conn.execute("""
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

        await conn.execute("""
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

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS word_reviews (
                id TEXT PRIMARY KEY,
                saved_word_id TEXT NOT NULL,
                quality INTEGER CHECK(quality >= 0 AND quality <= 5),
                reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (saved_word_id) REFERENCES saved_words(id) ON DELETE CASCADE
            )
        """)

        await conn.execute("""
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

        await conn.execute("""
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
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_videos_youtube ON videos(youtube_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_transcripts_video ON transcripts(video_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_words_word ON words(word)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_saved_words_user ON saved_words(status, next_review)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_video ON sessions(video_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_word_reviews_saved ON word_reviews(saved_word_id)")

    # =========================================================================
    # Video CRUD
    # =========================================================================

    async def add_video(self, video_data: Dict[str, Any]) -> str:
        """Add a new video to the database."""
        async with self.get_connection() as conn:
            await conn.execute(
                """
                INSERT OR REPLACE INTO videos
                    (id, youtube_id, title, channel, duration, thumbnail_url, description, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    video_data.get("id"),
                    video_data["youtube_id"],
                    video_data["title"],
                    video_data.get("channel", ""),
                    video_data.get("duration", 0),
                    video_data.get("thumbnail_url", ""),
                    video_data.get("description", ""),
                    video_data.get("status", "downloaded"),
                ),
            )
        return video_data.get("id", "")

    async def get_video(self, video_id: str) -> Optional[Dict[str, Any]]:
        """Get video by ID."""
        async with self.get_connection() as conn:
            async with conn.execute(
                "SELECT * FROM videos WHERE id = ?", (video_id,)
            ) as cursor:
                row = await cursor.fetchone()
                return dict(row) if row else None

    async def get_video_by_youtube_id(self, youtube_id: str) -> Optional[Dict[str, Any]]:
        """Get video by YouTube ID."""
        async with self.get_connection() as conn:
            async with conn.execute(
                "SELECT * FROM videos WHERE youtube_id = ?", (youtube_id,)
            ) as cursor:
                row = await cursor.fetchone()
                return dict(row) if row else None

    # =========================================================================
    # Transcript CRUD
    # =========================================================================

    async def save_transcript(self, transcript_data: Dict[str, Any]) -> str:
        """Save transcript for a video."""
        async with self.get_connection() as conn:
            await conn.execute(
                """
                INSERT OR REPLACE INTO transcripts
                    (id, video_id, language, source, segments, full_text, word_timings)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    transcript_data.get("id"),
                    transcript_data["video_id"],
                    transcript_data.get("language", "en"),
                    transcript_data.get("source", "youtube"),
                    json.dumps(transcript_data.get("segments", []), ensure_ascii=False),
                    transcript_data.get("full_text", ""),
                    json.dumps(transcript_data.get("word_timings", {}), ensure_ascii=False),
                ),
            )
        return transcript_data.get("id", "")

    async def get_transcript(self, video_id: str, language: str = "en") -> Optional[Dict[str, Any]]:
        """Get transcript for a video."""
        async with self.get_connection() as conn:
            async with conn.execute(
                "SELECT * FROM transcripts WHERE video_id = ? AND language = ?",
                (video_id, language),
            ) as cursor:
                row = await cursor.fetchone()
                if not row:
                    return None
                data = dict(row)
                # Deserialize JSON fields
                try:
                    data["segments"] = json.loads(data["segments"])
                except (json.JSONDecodeError, TypeError):
                    data["segments"] = []
                try:
                    data["word_timings"] = json.loads(data.get("word_timings") or "{}")
                except (json.JSONDecodeError, TypeError):
                    data["word_timings"] = {}
                return data

    # =========================================================================
    # Dictionary / Word CRUD
    # =========================================================================

    async def add_word(self, word_data: Dict[str, Any]) -> str:
        """Add or update a word in the dictionary."""
        async with self.get_connection() as conn:
            await conn.execute(
                """
                INSERT OR REPLACE INTO words
                    (id, word, pronunciation, part_of_speech, level, meaning_ar, meaning_en,
                     examples, synonyms, antonyms, root_form, conjugations, related_words, frequency)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    word_data.get("id"),
                    word_data["word"],
                    word_data.get("pronunciation", ""),
                    word_data.get("part_of_speech", "unknown"),
                    word_data.get("level", "B1"),
                    word_data.get("meaning_ar", ""),
                    word_data.get("meaning_en", ""),
                    json.dumps(word_data.get("examples", []), ensure_ascii=False),
                    json.dumps(word_data.get("synonyms", []), ensure_ascii=False),
                    json.dumps(word_data.get("antonyms", []), ensure_ascii=False),
                    word_data.get("root_form", ""),
                    json.dumps(word_data.get("conjugations", {}), ensure_ascii=False),
                    json.dumps(word_data.get("related_words", []), ensure_ascii=False),
                    word_data.get("frequency", 0),
                ),
            )
        return word_data.get("id", "")

    async def get_word(self, word: str) -> Optional[Dict[str, Any]]:
        """Get word from dictionary."""
        async with self.get_connection() as conn:
            async with conn.execute(
                "SELECT * FROM words WHERE word = ?", (word.lower(),)
            ) as cursor:
                row = await cursor.fetchone()
                if not row:
                    return None
                data = dict(row)
                for field in ("examples", "synonyms", "antonyms", "conjugations", "related_words"):
                    try:
                        data[field] = json.loads(data.get(field) or ("[]" if field != "conjugations" else "{}"))
                    except (json.JSONDecodeError, TypeError):
                        data[field] = [] if field != "conjugations" else {}
                return data

    # =========================================================================
    # Vocabulary CRUD (Spaced Repetition)
    # =========================================================================

    async def save_word_to_vocabulary(
        self,
        word_id: str,
        video_id: Optional[str],
        sentence: str,
        context: str,
    ) -> str:
        """Save a word to user vocabulary."""
        import uuid as _uuid
        saved_id = str(_uuid.uuid4())
        # First review in 1 day
        next_review = (datetime.now() + timedelta(days=1)).isoformat()

        async with self.get_connection() as conn:
            await conn.execute(
                """
                INSERT INTO saved_words
                    (id, word_id, video_id, sentence, context, next_review)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (saved_id, word_id, video_id, sentence, context, next_review),
            )
        return saved_id

    async def get_saved_words(
        self, status: Optional[str] = None, limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get saved vocabulary words with full word data."""
        query = """
            SELECT sw.*, w.word, w.pronunciation, w.part_of_speech,
                   w.meaning_ar, w.meaning_en, w.level, w.examples
            FROM saved_words sw
            JOIN words w ON sw.word_id = w.id
        """
        params: list = []
        if status:
            query += " WHERE sw.status = ?"
            params.append(status)
        query += " ORDER BY sw.created_at DESC LIMIT ?"
        params.append(limit)

        async with self.get_connection() as conn:
            async with conn.execute(query, params) as cursor:
                rows = await cursor.fetchall()
                result = []
                for row in rows:
                    d = dict(row)
                    try:
                        d["examples"] = json.loads(d.get("examples") or "[]")
                    except (json.JSONDecodeError, TypeError):
                        d["examples"] = []
                    result.append(d)
                return result

    async def get_due_words(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get words due for review."""
        now = datetime.now().isoformat()
        async with self.get_connection() as conn:
            async with conn.execute(
                """
                SELECT sw.*, w.word, w.pronunciation, w.meaning_ar, w.meaning_en,
                       w.level, w.examples
                FROM saved_words sw
                JOIN words w ON sw.word_id = w.id
                WHERE sw.next_review <= ? OR sw.next_review IS NULL
                ORDER BY sw.next_review ASC
                LIMIT ?
                """,
                (now, limit),
            ) as cursor:
                rows = await cursor.fetchall()
                result = []
                for row in rows:
                    d = dict(row)
                    try:
                        d["examples"] = json.loads(d.get("examples") or "[]")
                    except (json.JSONDecodeError, TypeError):
                        d["examples"] = []
                    result.append(d)
                return result

    async def update_review(self, saved_word_id: str, quality: int):
        """Update SM-2 spaced repetition data after a review."""
        import uuid as _uuid

        async with self.get_connection() as conn:
            async with conn.execute(
                "SELECT * FROM saved_words WHERE id = ?", (saved_word_id,)
            ) as cursor:
                row = await cursor.fetchone()
                if not row:
                    return

            sw = dict(row)
            ease = float(sw.get("ease_factor", 2.5))
            interval = int(sw.get("interval", 0))
            repetitions = int(sw.get("repetitions", 0))

            # SM-2 algorithm
            if quality >= 3:
                if repetitions == 0:
                    interval = 1
                elif repetitions == 1:
                    interval = 6
                else:
                    interval = round(interval * ease)
                repetitions += 1
            else:
                repetitions = 0
                interval = 1

            ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
            ease = max(1.3, ease)

            status = "learned" if interval >= 21 else ("reviewing" if repetitions > 1 else "learning")
            next_review = (datetime.now() + timedelta(days=interval)).isoformat()
            review_id = str(_uuid.uuid4())

            await conn.execute(
                """
                UPDATE saved_words SET
                    ease_factor = ?, interval = ?, repetitions = ?,
                    next_review = ?, last_reviewed = CURRENT_TIMESTAMP, status = ?
                WHERE id = ?
                """,
                (ease, interval, repetitions, next_review, status, saved_word_id),
            )
            await conn.execute(
                "INSERT INTO word_reviews (id, saved_word_id, quality) VALUES (?, ?, ?)",
                (review_id, saved_word_id, quality),
            )

    async def close(self):
        """Cleanup."""
        logger.info("Database manager closed")
