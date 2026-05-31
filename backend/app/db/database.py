"""
Local SQLite Database Manager for LinguaLearn.
Handles all data persistence locally on device.

Improvements in this version:
  - true async I/O via aiosqlite
  - lightweight schema migrations for review columns
  - stronger spaced-repetition / review support
  - vocabulary metadata (tags / notes / favorites)
  - richer filtering and sorting for saved words
  - normalized datetime handling for existing rows that may contain either
    ISO strings with `T` or SQLite-style `YYYY-MM-DD HH:MM:SS`
"""

import json
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
from contextlib import asynccontextmanager

import aiosqlite

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages SQLite database for local storage using aiosqlite."""

    def __init__(self, db_path: str):
        self.db_path = db_path
        self._conn: Optional[aiosqlite.Connection] = None

    async def initialize(self):
        """Initialize database, create tables, and run lightweight migrations."""
        logger.info(f"Initializing database at {self.db_path}")
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)

        async with aiosqlite.connect(self.db_path) as conn:
            conn.row_factory = aiosqlite.Row
            await conn.execute("PRAGMA journal_mode=WAL;")
            await conn.execute("PRAGMA foreign_keys=ON;")
            await conn.execute("PRAGMA synchronous=NORMAL;")
            await conn.execute("PRAGMA cache_size=-8000;")
            await self._create_tables(conn)
            await self._run_migrations(conn)
            await conn.commit()

        logger.info("Database initialized successfully")

    @asynccontextmanager
    async def get_connection(self):
        """Yield a short-lived aiosqlite connection."""
        conn = await aiosqlite.connect(self.db_path)
        conn.row_factory = aiosqlite.Row
        await conn.execute("PRAGMA foreign_keys=ON;")
        await conn.execute("PRAGMA journal_mode=WAL;")
        try:
            yield conn
            await conn.commit()
        except Exception:
            await conn.rollback()
            raise
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

        await conn.execute("CREATE INDEX IF NOT EXISTS idx_videos_youtube ON videos(youtube_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_transcripts_video ON transcripts(video_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_words_word ON words(word)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_saved_words_user ON saved_words(status, next_review)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_video ON sessions(video_id)")

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_messages(user_id, conversation_id)")

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS user_xp (
                id TEXT PRIMARY KEY,
                user_id TEXT UNIQUE NOT NULL,
                total_xp INTEGER DEFAULT 0,
                level INTEGER DEFAULT 1,
                streak_days INTEGER DEFAULT 0,
                daily_xp INTEGER DEFAULT 0,
                last_active_date TEXT DEFAULT '',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS xp_log (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                action TEXT NOT NULL,
                xp_earned INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_xp_user ON user_xp(user_id)")

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS text_sources (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                source_type TEXT DEFAULT 'text',
                content TEXT NOT NULL,
                word_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_word_reviews_saved ON word_reviews(saved_word_id)")

    async def _run_migrations(self, conn: aiosqlite.Connection):
        """Apply lightweight additive migrations for review and vocabulary metadata fields."""
        async with conn.execute("PRAGMA table_info(saved_words)") as cursor:
            rows = await cursor.fetchall()
            columns = {dict(row)["name"] for row in rows}

        # Add user_id to tables that need per-user isolation
        for tbl, col_sql in [
            ("videos", "ALTER TABLE videos ADD COLUMN user_id TEXT DEFAULT ''"),
            ("saved_words", "ALTER TABLE saved_words ADD COLUMN user_id TEXT DEFAULT ''"),
            ("sessions", "ALTER TABLE sessions ADD COLUMN user_id TEXT DEFAULT ''"),
            ("text_sources", "ALTER TABLE text_sources ADD COLUMN user_id TEXT DEFAULT ''"),
        ]:
            async with conn.execute(f"PRAGMA table_info({tbl})") as tc:
                trows = await tc.fetchall()
                tcols = {dict(r)["name"] for r in trows}
            if "user_id" not in tcols:
                logger.info(f"Applying migration: add {tbl}.user_id")
                await conn.execute(col_sql)

        # Also migrate words table
        async with conn.execute("PRAGMA table_info(words)") as wcur:
            wrows = await wcur.fetchall()
            word_columns = {dict(r)["name"] for r in wrows}

        word_migrations = {
            "definitions": "ALTER TABLE words ADD COLUMN definitions TEXT DEFAULT '[]'",
            "how_to_use": "ALTER TABLE words ADD COLUMN how_to_use TEXT DEFAULT '[]'",
        }
        for col, sql in word_migrations.items():
            if col not in word_columns:
                logger.info(f"Applying migration: add words.{col}")
                await conn.execute(sql)

        migrations = {
            "learning_step": "ALTER TABLE saved_words ADD COLUMN learning_step INTEGER DEFAULT 0",
            "lapses": "ALTER TABLE saved_words ADD COLUMN lapses INTEGER DEFAULT 0",
            "reviewed_count": "ALTER TABLE saved_words ADD COLUMN reviewed_count INTEGER DEFAULT 0",
            "last_quality": "ALTER TABLE saved_words ADD COLUMN last_quality INTEGER",
            "tags": "ALTER TABLE saved_words ADD COLUMN tags TEXT DEFAULT '[]'",
            "notes": "ALTER TABLE saved_words ADD COLUMN notes TEXT DEFAULT ''",
            "favorite": "ALTER TABLE saved_words ADD COLUMN favorite INTEGER DEFAULT 0",
            # ── Smart Review System (FSRS + Mastery + Error tracking) ──
            "fsrs_stability": "ALTER TABLE saved_words ADD COLUMN fsrs_stability REAL DEFAULT 0",
            "fsrs_difficulty": "ALTER TABLE saved_words ADD COLUMN fsrs_difficulty REAL DEFAULT 0",
            "fsrs_state": "ALTER TABLE saved_words ADD COLUMN fsrs_state TEXT DEFAULT 'new'",
            "stage": "ALTER TABLE saved_words ADD COLUMN stage TEXT DEFAULT 'new'",
            "mastery_score": "ALTER TABLE saved_words ADD COLUMN mastery_score INTEGER DEFAULT 0",
            "correct_count": "ALTER TABLE saved_words ADD COLUMN correct_count INTEGER DEFAULT 0",
            "incorrect_count": "ALTER TABLE saved_words ADD COLUMN incorrect_count INTEGER DEFAULT 0",
            "total_attempts": "ALTER TABLE saved_words ADD COLUMN total_attempts INTEGER DEFAULT 0",
            "avg_response_ms": "ALTER TABLE saved_words ADD COLUMN avg_response_ms REAL DEFAULT 0",
            "is_leech": "ALTER TABLE saved_words ADD COLUMN is_leech INTEGER DEFAULT 0",
        }

        for column, sql in migrations.items():
            if column not in columns:
                logger.info(f"Applying migration: add saved_words.{column}")
                await conn.execute(sql)

        # New tables for the smart review system
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS quiz_attempts (
                id TEXT PRIMARY KEY,
                saved_word_id TEXT NOT NULL,
                user_id TEXT DEFAULT '',
                question_type TEXT NOT NULL,
                is_correct INTEGER NOT NULL,
                response_ms INTEGER DEFAULT 0,
                picked_label TEXT,
                error_type TEXT,
                error_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (saved_word_id) REFERENCES saved_words(id) ON DELETE CASCADE
            )
        """)
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_quiz_attempts_saved ON quiz_attempts(saved_word_id)"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_date ON quiz_attempts(user_id, created_at)"
        )

        # Extend word_reviews with FSRS-specific telemetry
        async with conn.execute("PRAGMA table_info(word_reviews)") as cur:
            wr_cols = {dict(r)["name"] for r in await cur.fetchall()}
        wr_migrations = {
            "rating": "ALTER TABLE word_reviews ADD COLUMN rating INTEGER",
            "stability": "ALTER TABLE word_reviews ADD COLUMN stability REAL",
            "difficulty": "ALTER TABLE word_reviews ADD COLUMN difficulty REAL",
            "interval_days": "ALTER TABLE word_reviews ADD COLUMN interval_days REAL",
            "retrievability": "ALTER TABLE word_reviews ADD COLUMN retrievability REAL",
            "response_ms": "ALTER TABLE word_reviews ADD COLUMN response_ms INTEGER",
            "review_type": "ALTER TABLE word_reviews ADD COLUMN review_type TEXT DEFAULT 'flashcard'",
        }
        for col, sql in wr_migrations.items():
            if col not in wr_cols:
                logger.info(f"Applying migration: add word_reviews.{col}")
                await conn.execute(sql)

    def _now_str(self) -> str:
        return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    def _dt_plus_minutes(self, minutes: int) -> str:
        return (datetime.utcnow() + timedelta(minutes=minutes)).strftime("%Y-%m-%d %H:%M:%S")

    def _dt_plus_days(self, days: int) -> str:
        return (datetime.utcnow() + timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")

    def _normalized_datetime_expr(self, field: str) -> str:
        """SQLite expression that normalizes both ISO and SQLite datetime strings."""
        return f"datetime(replace(substr({field}, 1, 19), 'T', ' '))"

    def _decode_json_field(self, value: Any, default: Any):
        try:
            return json.loads(value) if value else default
        except (json.JSONDecodeError, TypeError):
            return default

    def _normalize_tags(self, tags: Optional[List[str]]) -> List[str]:
        if not tags:
            return []
        seen = set()
        cleaned: List[str] = []
        for raw in tags:
            tag = str(raw).strip().lower()
            if not tag:
                continue
            if len(tag) > 32:
                tag = tag[:32]
            if tag not in seen:
                seen.add(tag)
                cleaned.append(tag)
        return cleaned[:12]

    def _parse_saved_word_row(self, row: aiosqlite.Row) -> Dict[str, Any]:
        data = dict(row)
        data["examples"] = self._decode_json_field(data.get("examples"), [])
        data["synonyms"] = self._decode_json_field(data.get("synonyms"), [])
        data["antonyms"] = self._decode_json_field(data.get("antonyms"), [])
        data["conjugations"] = self._decode_json_field(data.get("conjugations"), {})
        data["related_words"] = self._decode_json_field(data.get("related_words"), [])
        data["tags"] = self._decode_json_field(data.get("tags"), [])
        data["favorite"] = bool(data.get("favorite", 0))
        return data

    def _build_saved_words_query(
        self,
        *,
        count: bool = False,
        status: Optional[str] = None,
        search: Optional[str] = None,
        level: Optional[str] = None,
        video_id: Optional[str] = None,
        due_only: bool = False,
        tag: Optional[str] = None,
        favorite_only: bool = False,
        sort: str = "next_review",
        limit: Optional[int] = None,
        offset: int = 0,
        user_id: str = "",
    ) -> Tuple[str, List[Any]]:
        due_expr = self._normalized_datetime_expr("sw.next_review")
        select_clause = "COUNT(*) as total" if count else f"""
            sw.*, w.word, w.pronunciation, w.part_of_speech,
            w.meaning_ar, w.meaning_en, w.level, w.examples,
            w.synonyms, w.antonyms, w.conjugations, w.related_words,
            COALESCE(v.title, '') as source_video_title,
            COALESCE(v.channel, '') as source_video_channel
        """

        query = f"""
            SELECT {select_clause}
            FROM saved_words sw
            JOIN words w ON sw.word_id = w.id
            LEFT JOIN videos v ON sw.video_id = v.id
        """

        clauses: List[str] = []
        params: List[Any] = []

        if user_id:
            clauses.append("sw.user_id = ?")
            params.append(user_id)

        if status:
            clauses.append("sw.status = ?")
            params.append(status)
        if level:
            clauses.append("w.level = ?")
            params.append(level)
        if video_id:
            clauses.append("sw.video_id = ?")
            params.append(video_id)
        if due_only:
            clauses.append(f"(sw.next_review IS NULL OR {due_expr} <= datetime('now'))")
        if favorite_only:
            clauses.append("COALESCE(sw.favorite, 0) = 1")
        if tag:
            clauses.append("LOWER(COALESCE(sw.tags, '[]')) LIKE ?")
            params.append(f'%"{tag.strip().lower()}"%')
        if search:
            term = f"%{search.strip().lower()}%"
            clauses.append("(" + " OR ".join([
                "LOWER(w.word) LIKE ?",
                "LOWER(COALESCE(w.meaning_en, '')) LIKE ?",
                "LOWER(COALESCE(w.meaning_ar, '')) LIKE ?",
                "LOWER(COALESCE(sw.sentence, '')) LIKE ?",
                "LOWER(COALESCE(sw.notes, '')) LIKE ?",
                "LOWER(COALESCE(v.title, '')) LIKE ?",
            ]) + ")")
            params.extend([term] * 6)

        if clauses:
            query += " WHERE " + " AND ".join(clauses)

        if count:
            return query, params

        sort_map = {
            "newest": "datetime(sw.created_at) DESC, LOWER(w.word) ASC",
            "oldest": "datetime(sw.created_at) ASC, LOWER(w.word) ASC",
            "alphabetical": "LOWER(w.word) ASC",
            "level": "w.level ASC, LOWER(w.word) ASC",
            "difficulty": "COALESCE(sw.lapses, 0) DESC, COALESCE(sw.reviewed_count, 0) DESC, LOWER(w.word) ASC",
            "next_review": f"CASE WHEN sw.next_review IS NULL THEN 0 ELSE 1 END ASC, {due_expr} ASC, datetime(sw.created_at) DESC",
        }
        query += f" ORDER BY {sort_map.get(sort, sort_map['next_review'])}"

        if limit is not None:
            query += " LIMIT ? OFFSET ?"
            params.extend([limit, max(offset, 0)])

        return query, params

    # =========================================================================
    # Video CRUD
    # =========================================================================

    async def add_video(self, video_data: Dict[str, Any]) -> str:
        async with self.get_connection() as conn:
            await conn.execute(
                """
                INSERT OR REPLACE INTO videos
                    (id, youtube_id, title, channel, duration, thumbnail_url, description, status, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    video_data.get("user_id", ""),
                ),
            )
        return video_data.get("id", "")

    async def get_video(self, video_id: str) -> Optional[Dict[str, Any]]:
        async with self.get_connection() as conn:
            async with conn.execute("SELECT * FROM videos WHERE id = ?", (video_id,)) as cursor:
                row = await cursor.fetchone()
                return dict(row) if row else None

    async def get_video_by_youtube_id(self, youtube_id: str, user_id: str = "") -> Optional[Dict[str, Any]]:
        async with self.get_connection() as conn:
            if user_id:
                query = "SELECT * FROM videos WHERE youtube_id = ? AND user_id = ?"
                params = (youtube_id, user_id)
            else:
                query = "SELECT * FROM videos WHERE youtube_id = ?"
                params = (youtube_id,)
            async with conn.execute(query, params) as cursor:
                row = await cursor.fetchone()
                return dict(row) if row else None

    # =========================================================================
    # Transcript CRUD
    # =========================================================================

    async def save_transcript(self, transcript_data: Dict[str, Any]) -> str:
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
        async with self.get_connection() as conn:
            async with conn.execute(
                "SELECT * FROM transcripts WHERE video_id = ? AND language = ?",
                (video_id, language),
            ) as cursor:
                row = await cursor.fetchone()
                if not row:
                    return None
                data = dict(row)
                data["segments"] = self._decode_json_field(data.get("segments"), [])
                data["word_timings"] = self._decode_json_field(data.get("word_timings"), {})
                return data

    # =========================================================================
    # Dictionary / Word CRUD
    # =========================================================================

    async def add_word(self, word_data: Dict[str, Any]) -> str:
        async with self.get_connection() as conn:
            await conn.execute(
                """
                INSERT OR REPLACE INTO words
                    (id, word, pronunciation, part_of_speech, level, meaning_ar, meaning_en,
                     examples, synonyms, antonyms, root_form, conjugations, related_words,
                     definitions, how_to_use, frequency)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    json.dumps(word_data.get("definitions", []), ensure_ascii=False),
                    json.dumps(word_data.get("how_to_use", []), ensure_ascii=False),
                    word_data.get("frequency", 0),
                ),
            )
        return word_data.get("id", "")

    async def get_word(self, word: str) -> Optional[Dict[str, Any]]:
        async with self.get_connection() as conn:
            async with conn.execute("SELECT * FROM words WHERE word = ?", (word.lower(),)) as cursor:
                row = await cursor.fetchone()
                if not row:
                    return None
                data = dict(row)
                data["examples"] = self._decode_json_field(data.get("examples"), [])
                data["synonyms"] = self._decode_json_field(data.get("synonyms"), [])
                data["antonyms"] = self._decode_json_field(data.get("antonyms"), [])
                data["conjugations"] = self._decode_json_field(data.get("conjugations"), {})
                data["related_words"] = self._decode_json_field(data.get("related_words"), [])
                data["definitions"] = self._decode_json_field(data.get("definitions"), [])
                data["how_to_use"] = self._decode_json_field(data.get("how_to_use"), [])
                return data

    # =========================================================================
    # Vocabulary / Review CRUD
    # =========================================================================

    async def save_word_to_vocabulary(
        self,
        word_id: str,
        video_id: Optional[str],
        sentence: str,
        context: str,
        user_id: str = "",
    ) -> str:
        import uuid as _uuid

        saved_id = str(_uuid.uuid4())
        next_review = self._now_str()

        async with self.get_connection() as conn:
            await conn.execute(
                """
                INSERT INTO saved_words
                    (id, word_id, video_id, sentence, context, status, ease_factor,
                     interval, repetitions, next_review, learning_step, lapses,
                     reviewed_count, last_quality, tags, notes, favorite, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    saved_id,
                    word_id,
                    video_id,
                    sentence,
                    context,
                    "learning",
                    2.5,
                    0,
                    0,
                    next_review,
                    0,
                    0,
                    0,
                    None,
                    json.dumps([], ensure_ascii=False),
                    "",
                    0,
                    user_id,
                ),
            )
        return saved_id

    async def get_saved_word(self, saved_word_id: str) -> Optional[Dict[str, Any]]:
        async with self.get_connection() as conn:
            async with conn.execute(
                """
                SELECT sw.*, w.word, w.pronunciation, w.part_of_speech,
                       w.meaning_ar, w.meaning_en, w.level, w.examples,
                       w.synonyms, w.antonyms, w.conjugations, w.related_words,
                       COALESCE(v.title, '') as source_video_title,
                       COALESCE(v.channel, '') as source_video_channel
                FROM saved_words sw
                JOIN words w ON sw.word_id = w.id
                LEFT JOIN videos v ON sw.video_id = v.id
                WHERE sw.id = ?
                """,
                (saved_word_id,),
            ) as cursor:
                row = await cursor.fetchone()
                return self._parse_saved_word_row(row) if row else None

    async def get_saved_words(
        self,
        user_id: str = "",
        status: Optional[str] = None,
        limit: int = 100,
        page: int = 1,
        search: Optional[str] = None,
        level: Optional[str] = None,
        video_id: Optional[str] = None,
        due_only: bool = False,
        tag: Optional[str] = None,
        favorite_only: bool = False,
        sort: str = "next_review",
    ) -> List[Dict[str, Any]]:
        offset = max(0, (page - 1) * limit)
        query, params = self._build_saved_words_query(
            user_id=user_id,
            status=status,
            search=search,
            level=level,
            video_id=video_id,
            due_only=due_only,
            tag=tag,
            favorite_only=favorite_only,
            sort=sort,
            limit=limit,
            offset=offset,
        )
        async with self.get_connection() as conn:
            async with conn.execute(query, params) as cursor:
                rows = await cursor.fetchall()
                return [self._parse_saved_word_row(row) for row in rows]

    async def count_saved_words(
        self,
        user_id: str = "",
        status: Optional[str] = None,
        search: Optional[str] = None,
        level: Optional[str] = None,
        video_id: Optional[str] = None,
        due_only: bool = False,
        tag: Optional[str] = None,
        favorite_only: bool = False,
    ) -> int:
        query, params = self._build_saved_words_query(
            count=True,
            user_id=user_id,
            status=status,
            search=search,
            level=level,
            video_id=video_id,
            due_only=due_only,
            tag=tag,
            favorite_only=favorite_only,
        )
        async with self.get_connection() as conn:
            async with conn.execute(query, params) as cursor:
                row = await cursor.fetchone()
                return int(dict(row).get("total", 0) if row else 0)

    async def get_vocabulary_facets(self) -> Dict[str, Any]:
        async with self.get_connection() as conn:
            async with conn.execute(
                """
                SELECT w.level, COUNT(*) as count
                FROM saved_words sw
                JOIN words w ON sw.word_id = w.id
                GROUP BY w.level
                ORDER BY w.level ASC
                """
            ) as cursor:
                level_rows = await cursor.fetchall()

            async with conn.execute(
                """
                SELECT v.id as video_id, v.title, v.channel, COUNT(*) as count
                FROM saved_words sw
                LEFT JOIN videos v ON sw.video_id = v.id
                WHERE sw.video_id IS NOT NULL
                GROUP BY v.id, v.title, v.channel
                ORDER BY count DESC, v.title ASC
                """
            ) as cursor:
                video_rows = await cursor.fetchall()

            async with conn.execute("SELECT tags FROM saved_words WHERE tags IS NOT NULL AND tags != ''") as cursor:
                tag_rows = await cursor.fetchall()

        tag_counts: Dict[str, int] = {}
        for row in tag_rows:
            tags = self._decode_json_field(dict(row).get("tags"), [])
            for tag in tags:
                key = str(tag).strip().lower()
                if not key:
                    continue
                tag_counts[key] = tag_counts.get(key, 0) + 1

        return {
            "levels": [dict(r) for r in level_rows],
            "videos": [dict(r) for r in video_rows],
            "tags": [
                {"tag": tag, "count": count}
                for tag, count in sorted(tag_counts.items(), key=lambda item: (-item[1], item[0]))
            ],
        }

    async def update_saved_word_metadata(
        self,
        saved_word_id: str,
        *,
        tags: Optional[List[str]] = None,
        notes: Optional[str] = None,
        favorite: Optional[bool] = None,
    ) -> Optional[Dict[str, Any]]:
        updates: List[str] = []
        params: List[Any] = []

        if tags is not None:
            normalized_tags = self._normalize_tags(tags)
            updates.append("tags = ?")
            params.append(json.dumps(normalized_tags, ensure_ascii=False))

        if notes is not None:
            updates.append("notes = ?")
            params.append(str(notes).strip()[:2000])

        if favorite is not None:
            updates.append("favorite = ?")
            params.append(1 if favorite else 0)

        if not updates:
            return await self.get_saved_word(saved_word_id)

        params.append(saved_word_id)
        async with self.get_connection() as conn:
            await conn.execute(
                f"UPDATE saved_words SET {', '.join(updates)} WHERE id = ?",
                params,
            )

        return await self.get_saved_word(saved_word_id)

    async def get_due_words(self, limit: int = 20, user_id: str = "") -> List[Dict[str, Any]]:
        due_expr = self._normalized_datetime_expr("sw.next_review")
        async with self.get_connection() as conn:
            async with conn.execute(
                f"""
                SELECT sw.*, w.word, w.pronunciation, w.part_of_speech,
                       w.meaning_ar, w.meaning_en, w.level, w.examples,
                       w.synonyms, w.antonyms, w.conjugations, w.related_words,
                       COALESCE(v.title, '') as source_video_title,
                       COALESCE(v.channel, '') as source_video_channel
                FROM saved_words sw
                JOIN words w ON sw.word_id = w.id
                LEFT JOIN videos v ON sw.video_id = v.id
                WHERE (sw.user_id = ? OR sw.user_id = '')
                  AND (sw.next_review IS NULL OR {due_expr} <= datetime('now'))
                ORDER BY
                    CASE sw.status
                        WHEN 'learning' THEN 0
                        WHEN 'reviewing' THEN 1
                        WHEN 'learned' THEN 2
                        ELSE 3
                    END,
                    COALESCE(sw.favorite, 0) DESC,
                    COALESCE(sw.lapses, 0) DESC,
                    {due_expr} ASC,
                    sw.created_at ASC
                LIMIT ?
                """,
                (user_id, limit),
            ) as cursor:
                rows = await cursor.fetchall()
                return [self._parse_saved_word_row(row) for row in rows]

    async def get_review_summary(self, user_id: str = "") -> Dict[str, Any]:
        due_expr = self._normalized_datetime_expr("next_review")
        where = "WHERE (user_id = ? OR user_id = '')" if user_id else ""
        params = (user_id,) if user_id else ()
        async with self.get_connection() as conn:
            async with conn.execute(
                f"""
                SELECT
                    COUNT(*) as total_saved,
                    COALESCE(SUM(CASE WHEN status = 'learning' THEN 1 ELSE 0 END), 0) as learning,
                    COALESCE(SUM(CASE WHEN status = 'reviewing' THEN 1 ELSE 0 END), 0) as reviewing,
                    COALESCE(SUM(CASE WHEN status = 'learned' THEN 1 ELSE 0 END), 0) as learned,
                    COALESCE(SUM(CASE WHEN reviewed_count = 0 THEN 1 ELSE 0 END), 0) as never_reviewed,
                    COALESCE(SUM(CASE WHEN next_review IS NULL OR {due_expr} <= datetime('now') THEN 1 ELSE 0 END), 0) as due_now
                FROM saved_words {where}
                """, params
            ) as cursor:
                row = await cursor.fetchone()
                data = dict(row) if row else {}
                for key, value in list(data.items()):
                    data[key] = int(value or 0)
                return data

    async def get_review_history(self, saved_word_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        async with self.get_connection() as conn:
            async with conn.execute(
                """
                SELECT id, saved_word_id, quality, reviewed_at
                FROM word_reviews
                WHERE saved_word_id = ?
                ORDER BY datetime(replace(substr(reviewed_at, 1, 19), 'T', ' ')) DESC
                LIMIT ?
                """,
                (saved_word_id, limit),
            ) as cursor:
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]

    async def update_review(
        self,
        saved_word_id: str,
        quality: int,
        *,
        response_ms: int = 0,
        review_type: str = "flashcard",
        is_correct: Optional[bool] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Update SRS state after a review using FSRS-v4 (with full fallback
        to the legacy SM-2 path if FSRS is not available).

        Parameters
        ----------
        quality : int
            Legacy 0..5 quality OR Anki-style 1..4 rating. Both accepted.
        response_ms : int
            Time the user took to answer (used for mastery + analytics).
        review_type : str
            'flashcard' | 'quiz' | 'listening' | …
        is_correct : Optional[bool]
            Override for accuracy stats; if None we infer from quality.
        """
        try:
            from backend.app.services.srs import (
                FSRSScheduler, quality_to_rating, MasteryCalculator,
            )
            from backend.app.services.srs.fsrs import card_from_row
            use_fsrs = True
        except Exception:
            use_fsrs = False

        if not use_fsrs:
            return await self._legacy_update_review(saved_word_id, quality)

        import uuid as _uuid

        async with self.get_connection() as conn:
            async with conn.execute("SELECT * FROM saved_words WHERE id = ?", (saved_word_id,)) as cursor:
                row = await cursor.fetchone()
                if not row:
                    return None
            sw = dict(row)

            # Determine correctness
            correct = bool(is_correct) if is_correct is not None else (int(quality) >= 3)
            correct_count = int(sw.get("correct_count") or 0) + (1 if correct else 0)
            incorrect_count = int(sw.get("incorrect_count") or 0) + (0 if correct else 1)
            total_attempts = int(sw.get("total_attempts") or 0) + 1

            # Rolling average response time
            prev_avg = float(sw.get("avg_response_ms") or 0)
            if response_ms > 0:
                new_avg = (prev_avg * (total_attempts - 1) + response_ms) / total_attempts
            else:
                new_avg = prev_avg

            # ── Run FSRS ────────────────────────────────────────────
            card = card_from_row(sw)
            rating = quality_to_rating(int(quality))
            scheduler = FSRSScheduler()
            result = scheduler.review(card, rating)

            # Status mapping for existing UI: learning | reviewing | learned
            stage_to_status = {
                "new": "learning",
                "learning": "learning",
                "familiar": "reviewing",
                "mastered": "learned",
            }
            status = stage_to_status.get(result.stage, "learning")

            # Mastery score
            recent_errors = await self._count_recent_errors(conn, saved_word_id, limit=3)
            mastery = MasteryCalculator.compute(
                correct_count=correct_count,
                total_attempts=total_attempts,
                lapses=result.lapses,
                stability_days=result.stability,
                avg_response_ms=new_avg,
                recent_errors=recent_errors,
                stage=result.stage,
            )

            now_str = self._now_str()
            next_review = result.next_review.strftime("%Y-%m-%d %H:%M:%S")
            review_id = str(_uuid.uuid4())

            await conn.execute(
                """
                UPDATE saved_words SET
                    ease_factor = ?,
                    interval = ?,
                    repetitions = ?,
                    next_review = ?,
                    last_reviewed = ?,
                    status = ?,
                    stage = ?,
                    lapses = ?,
                    reviewed_count = ?,
                    last_quality = ?,
                    fsrs_stability = ?,
                    fsrs_difficulty = ?,
                    fsrs_state = ?,
                    mastery_score = ?,
                    correct_count = ?,
                    incorrect_count = ?,
                    total_attempts = ?,
                    avg_response_ms = ?,
                    is_leech = ?
                WHERE id = ?
                """,
                (
                    # Keep ease_factor/interval in sync for any legacy code paths
                    max(1.3, min(3.0, 11.0 - result.difficulty * 0.8)),
                    int(round(result.interval_days)),
                    result.reps,
                    next_review,
                    now_str,
                    status,
                    result.stage,
                    result.lapses,
                    result.reps,
                    int(quality),
                    result.stability,
                    result.difficulty,
                    result.state,
                    mastery.score,
                    correct_count,
                    incorrect_count,
                    total_attempts,
                    new_avg,
                    1 if mastery.is_leech else 0,
                    saved_word_id,
                ),
            )
            await conn.execute(
                """
                INSERT INTO word_reviews
                    (id, saved_word_id, quality, reviewed_at,
                     rating, stability, difficulty, interval_days,
                     retrievability, response_ms, review_type)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    review_id, saved_word_id, int(quality), now_str,
                    int(rating), result.stability, result.difficulty,
                    result.interval_days, result.retrievability,
                    int(response_ms), review_type,
                ),
            )

        return await self.get_saved_word(saved_word_id)

    async def _count_recent_errors(self, conn, saved_word_id: str, limit: int = 3) -> int:
        async with conn.execute(
            """
            SELECT is_correct FROM quiz_attempts
            WHERE saved_word_id = ?
            ORDER BY datetime(created_at) DESC LIMIT ?
            """,
            (saved_word_id, limit),
        ) as cur:
            rows = await cur.fetchall()
            return sum(1 for r in rows if not dict(r)["is_correct"])

    async def record_quiz_attempt(
        self,
        *,
        saved_word_id: str,
        user_id: str,
        question_type: str,
        is_correct: bool,
        response_ms: int = 0,
        picked_label: Optional[str] = None,
        error_type: Optional[str] = None,
        error_reason: Optional[str] = None,
    ) -> str:
        """Persist a single quiz answer for analytics + error mining."""
        import uuid as _uuid
        attempt_id = str(_uuid.uuid4())
        async with self.get_connection() as conn:
            await conn.execute(
                """
                INSERT INTO quiz_attempts
                    (id, saved_word_id, user_id, question_type, is_correct,
                     response_ms, picked_label, error_type, error_reason, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    attempt_id, saved_word_id, user_id, question_type,
                    1 if is_correct else 0, int(response_ms), picked_label,
                    error_type, error_reason, self._now_str(),
                ),
            )
        return attempt_id

    async def get_error_analytics(self, user_id: str, days: int = 30) -> Dict[str, Any]:
        """Aggregate recent errors for the analytics dashboard."""
        async with self.get_connection() as conn:
            async with conn.execute(
                """
                SELECT error_type, COUNT(*) as n
                FROM quiz_attempts
                WHERE user_id = ? AND is_correct = 0 AND error_type IS NOT NULL
                  AND datetime(created_at) >= datetime('now', ?)
                GROUP BY error_type ORDER BY n DESC
                """,
                (user_id, f"-{int(days)} days"),
            ) as cur:
                by_type = [dict(r) for r in await cur.fetchall()]

            async with conn.execute(
                """
                SELECT sw.id, w.word, COUNT(*) as misses
                FROM quiz_attempts qa
                JOIN saved_words sw ON sw.id = qa.saved_word_id
                JOIN words w ON w.id = sw.word_id
                WHERE qa.user_id = ? AND qa.is_correct = 0
                  AND datetime(qa.created_at) >= datetime('now', ?)
                GROUP BY sw.id ORDER BY misses DESC LIMIT 10
                """,
                (user_id, f"-{int(days)} days"),
            ) as cur:
                top_missed = [dict(r) for r in await cur.fetchall()]

        return {"by_type": by_type, "top_missed_words": top_missed, "window_days": days}

    async def _legacy_update_review(self, saved_word_id: str, quality: int) -> Optional[Dict[str, Any]]:
        """Original SM-2 fallback (kept verbatim for safety)."""
        import uuid as _uuid

        async with self.get_connection() as conn:
            async with conn.execute("SELECT * FROM saved_words WHERE id = ?", (saved_word_id,)) as cursor:
                row = await cursor.fetchone()
                if not row:
                    return None

            sw = dict(row)
            ease = float(sw.get("ease_factor") or 2.5)
            interval = int(sw.get("interval") or 0)
            repetitions = int(sw.get("repetitions") or 0)
            learning_step = int(sw.get("learning_step") or 0)
            lapses = int(sw.get("lapses") or 0)
            reviewed_count = int(sw.get("reviewed_count") or 0)
            had_reviews_before = reviewed_count > 0 or bool(sw.get("last_reviewed"))

            now_str = self._now_str()

            if quality <= 1:
                ease = max(1.3, ease - 0.20)
                interval = 0
                repetitions = 0
                learning_step = 0
                status = "learning"
                next_review = self._dt_plus_minutes(10)
                if had_reviews_before:
                    lapses += 1

            elif quality == 2:
                ease = max(1.3, ease - 0.15)
                interval = 0
                repetitions = 0
                learning_step = min(1, learning_step + 1)
                status = "learning"
                next_review = self._dt_plus_minutes(30)

            elif quality == 3:
                ease = min(3.0, max(1.3, ease - 0.02))
                if repetitions < 1:
                    repetitions = 1
                    learning_step = 1
                    interval = 1
                    status = "learning"
                    next_review = self._dt_plus_days(1)
                else:
                    repetitions += 1
                    interval = max(2, round(max(1, interval) * ease))
                    status = "learned" if interval >= 30 else "reviewing"
                    next_review = self._dt_plus_days(interval)

            elif quality == 4:
                ease = min(3.0, max(1.3, ease + 0.05))
                if repetitions < 1:
                    repetitions = 2
                    learning_step = 2
                    interval = 3
                else:
                    repetitions += 1
                    interval = max(interval + 1, round(max(1, interval) * (ease + 0.15)))
                status = "learned" if interval >= 30 else "reviewing"
                next_review = self._dt_plus_days(interval)

            else:  # quality == 5
                ease = min(3.0, max(1.3, ease + 0.10))
                if repetitions < 1:
                    repetitions = 2
                    learning_step = 2
                    interval = 4
                else:
                    repetitions += 1
                    interval = max(interval + 2, round(max(1, interval) * (ease + 0.30)))
                status = "learned" if interval >= 30 else "reviewing"
                next_review = self._dt_plus_days(interval)

            reviewed_count += 1
            review_id = str(_uuid.uuid4())

            await conn.execute(
                """
                UPDATE saved_words SET
                    ease_factor = ?,
                    interval = ?,
                    repetitions = ?,
                    next_review = ?,
                    last_reviewed = ?,
                    status = ?,
                    learning_step = ?,
                    lapses = ?,
                    reviewed_count = ?,
                    last_quality = ?
                WHERE id = ?
                """,
                (
                    ease,
                    interval,
                    repetitions,
                    next_review,
                    now_str,
                    status,
                    learning_step,
                    lapses,
                    reviewed_count,
                    quality,
                    saved_word_id,
                ),
            )
            await conn.execute(
                "INSERT INTO word_reviews (id, saved_word_id, quality, reviewed_at) VALUES (?, ?, ?, ?)",
                (review_id, saved_word_id, quality, now_str),
            )

        return await self.get_saved_word(saved_word_id)

    async def close(self):
        logger.info("Database manager closed")
