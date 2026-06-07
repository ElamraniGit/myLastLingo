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
                status TEXT DEFAULT 'ready',
                error TEXT DEFAULT '',
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
                collocations TEXT DEFAULT '[]',
                definitions TEXT DEFAULT '[]',
                how_to_use TEXT DEFAULT '[]',
                usage_notes TEXT DEFAULT '',
                grammar_notes TEXT DEFAULT '',
                entry_type TEXT DEFAULT 'word',
                difficulty_score REAL DEFAULT 0.5,
                priority_score REAL DEFAULT 0.5,
                ai_enriched INTEGER DEFAULT 0,
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
        # NOTE (FIX-CRIT-1): user_id indexes are created in _run_migrations(), AFTER the
        # user_id columns are guaranteed to exist. Creating them here previously caused a
        # CRITICAL "no such column: user_id" failure on every brand-new database.

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
        # ── Core English 3000 ─────────────────────────────────────────────
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS core_words (
                id             TEXT PRIMARY KEY,
                word           TEXT NOT NULL UNIQUE,
                pronunciation  TEXT DEFAULT '',
                part_of_speech TEXT DEFAULT '',
                level          TEXT DEFAULT 'B1',
                freq_rank      INTEGER DEFAULT 9999,
                meaning_en     TEXT DEFAULT '',
                meaning_ar     TEXT DEFAULT '',
                synonyms       TEXT DEFAULT '[]',
                antonyms       TEXT DEFAULT '[]',
                collocations   TEXT DEFAULT '[]',
                example        TEXT DEFAULT '',
                grammar_notes  TEXT DEFAULT '[]',
                definitions    TEXT DEFAULT '[]',
                difficulty_score REAL DEFAULT 0.5,
                created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_core_word ON core_words(word)"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_core_level ON core_words(level, freq_rank)"
        )

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS user_core_progress (
                id             TEXT PRIMARY KEY,
                user_id        TEXT NOT NULL,
                core_word_id   TEXT NOT NULL,
                status         TEXT DEFAULT 'learning',
                ease_factor    REAL DEFAULT 2.5,
                interval       INTEGER DEFAULT 0,
                repetitions    INTEGER DEFAULT 0,
                lapses         INTEGER DEFAULT 0,
                reviewed_count INTEGER DEFAULT 0,
                last_reviewed  TIMESTAMP,
                next_review    TIMESTAMP,
                created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, core_word_id),
                FOREIGN KEY(core_word_id) REFERENCES core_words(id) ON DELETE CASCADE
            )
        """)
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_ucp_user ON user_core_progress(user_id, next_review)"
        )

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS core_word_reviews (
                id           TEXT PRIMARY KEY,
                user_id      TEXT NOT NULL,
                core_word_id TEXT NOT NULL,
                quality      INTEGER,
                reviewed_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(core_word_id) REFERENCES core_words(id) ON DELETE CASCADE
            )
        """)
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_cwr_user ON core_word_reviews(user_id, core_word_id)"
        )



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
            "definitions":      "ALTER TABLE words ADD COLUMN definitions TEXT DEFAULT '[]'",
            "how_to_use":       "ALTER TABLE words ADD COLUMN how_to_use TEXT DEFAULT '[]'",
            "ai_enriched":      "ALTER TABLE words ADD COLUMN ai_enriched INTEGER DEFAULT 0",
            "collocations":     "ALTER TABLE words ADD COLUMN collocations TEXT DEFAULT '[]'",
            "usage_notes":      "ALTER TABLE words ADD COLUMN usage_notes TEXT DEFAULT ''",
            "grammar_notes":    "ALTER TABLE words ADD COLUMN grammar_notes TEXT DEFAULT ''",
            "entry_type":       "ALTER TABLE words ADD COLUMN entry_type TEXT DEFAULT 'word'",
            "difficulty_score": "ALTER TABLE words ADD COLUMN difficulty_score REAL DEFAULT 0.5",
            "priority_score":   "ALTER TABLE words ADD COLUMN priority_score REAL DEFAULT 0.5",
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
        }

        for column, sql in migrations.items():
            if column not in columns:
                logger.info(f"Applying migration: add saved_words.{column}")
                await conn.execute(sql)

        # Phase 2: transcript status/error tracking so the frontend can tell
        # "processing" apart from "failed" instead of blindly polling.
        async with conn.execute("PRAGMA table_info(transcripts)") as tcur:
            transcript_cols = {dict(r)["name"] for r in await tcur.fetchall()}
        transcript_migrations = {
            "status": "ALTER TABLE transcripts ADD COLUMN status TEXT DEFAULT 'ready'",
            "error": "ALTER TABLE transcripts ADD COLUMN error TEXT DEFAULT ''",
        }
        for column, sql in transcript_migrations.items():
            if column not in transcript_cols:
                logger.info(f"Applying migration: add transcripts.{column}")
                await conn.execute(sql)

        # FIX-CRIT-1: Create user_id indexes here, now that the columns exist.
        # (Previously these lived in _create_tables and broke fresh installs.)
        for idx_sql in [
            "CREATE INDEX IF NOT EXISTS idx_saved_words_uid ON saved_words(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_sessions_uid ON sessions(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_text_sources_uid ON text_sources(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_videos_uid ON videos(user_id)",
        ]:
            await conn.execute(idx_sql)

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
        data["collocations"] = self._decode_json_field(data.get("collocations"), [])
        data["definitions"] = self._decode_json_field(data.get("definitions"), [])
        data["how_to_use"] = self._decode_json_field(data.get("how_to_use"), [])
        data["tags"] = self._decode_json_field(data.get("tags"), [])
        data["favorite"] = bool(data.get("favorite", 0))
        try:
            data["difficulty_score"] = float(data.get("difficulty_score", 0.5) or 0.5)
        except (TypeError, ValueError):
            data["difficulty_score"] = 0.5
        try:
            data["priority_score"] = float(data.get("priority_score", 0.5) or 0.5)
        except (TypeError, ValueError):
            data["priority_score"] = 0.5
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
            w.collocations, w.definitions, w.how_to_use, w.usage_notes,
            w.grammar_notes, w.entry_type, w.difficulty_score, w.priority_score,
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

    async def seed_core_words(self):
        """
        Load Core English 3000 word list from JSON seed file if not already seeded.
        Runs on startup — idempotent (skips if data already present).
        """
        import os, json as _json, uuid as _uuid
        from pathlib import Path

        seed_path = Path("backend/data/core3000_words.json")
        if not seed_path.exists():
            logger.warning("Core 3000 seed file not found: %s", seed_path)
            return

        async with self.get_connection() as conn:
            async with conn.execute("SELECT COUNT(*) FROM core_words") as cur:
                count = (await cur.fetchone())[0]
            if count > 0:
                logger.info(f"Core 3000 already seeded ({count} words) — skipping")
                return

            with open(seed_path, encoding="utf-8") as f:
                words = _json.load(f)

            inserted = 0
            for w in words:
                wid = str(_uuid.uuid4())
                try:
                    await conn.execute(
                        """INSERT OR IGNORE INTO core_words
                           (id, word, pronunciation, part_of_speech, level, freq_rank,
                            meaning_en, meaning_ar, synonyms, antonyms, collocations,
                            example, grammar_notes, difficulty_score)
                           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                        (
                            wid,
                            w["word"],
                            w.get("pronunciation", ""),
                            w.get("pos", ""),
                            w.get("level", "B1"),
                            w.get("freq", 9999),
                            w.get("meaning_en", ""),
                            w.get("meaning_ar", ""),
                            _json.dumps(w.get("synonyms", []),    ensure_ascii=False),
                            _json.dumps(w.get("antonyms", []),    ensure_ascii=False),
                            _json.dumps(w.get("collocations", []),ensure_ascii=False),
                            w.get("example", ""),
                            _json.dumps([],                        ensure_ascii=False),
                            self._level_to_difficulty(w.get("level", "B1")),
                        ),
                    )
                    inserted += 1
                except Exception as e:
                    logger.debug(f"Skipping word '{w.get('word')}': {e}")

            logger.info(f"Core 3000 seeded: {inserted} words inserted")

    @staticmethod
    def _level_to_difficulty(level: str) -> float:
        return {"A1": 0.1, "A2": 0.25, "B1": 0.45, "B2": 0.65, "C1": 0.82, "C2": 0.95}.get(level, 0.5)


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
            # Dedupe by (video_id, language): a prior status-only placeholder row
            # may exist with a different id. Remove it so we don't end up with two
            # rows for the same transcript (which would shadow the real one).
            await conn.execute(
                "DELETE FROM transcripts WHERE video_id = ? AND language = ?",
                (transcript_data["video_id"], transcript_data.get("language", "en")),
            )
            await conn.execute(
                """
                INSERT OR REPLACE INTO transcripts
                    (id, video_id, language, source, segments, full_text, word_timings, status, error)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    transcript_data.get("id"),
                    transcript_data["video_id"],
                    transcript_data.get("language", "en"),
                    transcript_data.get("source", "youtube"),
                    json.dumps(transcript_data.get("segments", []), ensure_ascii=False),
                    transcript_data.get("full_text", ""),
                    json.dumps(transcript_data.get("word_timings", {}), ensure_ascii=False),
                    transcript_data.get("status", "ready"),
                    transcript_data.get("error", ""),
                ),
            )
        return transcript_data.get("id", "")

    async def set_transcript_status(
        self, video_id: str, language: str, status: str, error: str = ""
    ) -> None:
        """
        Phase 2: upsert a status row for a (video, language) transcript so the
        frontend can poll a real state machine: processing -> ready | error.
        """
        import uuid as _uuid
        async with self.get_connection() as conn:
            async with conn.execute(
                "SELECT id FROM transcripts WHERE video_id = ? AND language = ?",
                (video_id, language),
            ) as cur:
                row = await cur.fetchone()
            if row:
                await conn.execute(
                    "UPDATE transcripts SET status = ?, error = ? WHERE video_id = ? AND language = ?",
                    (status, error, video_id, language),
                )
            else:
                await conn.execute(
                    """
                    INSERT INTO transcripts
                        (id, video_id, language, source, segments, full_text, word_timings, status, error)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (str(_uuid.uuid4()), video_id, language, "pending", "[]", "", "{}", status, error),
                )

    async def get_transcript_status(self, video_id: str, language: str = "en") -> Dict[str, Any]:
        """Return {status, error, segment_count} for a transcript (or 'idle')."""
        async with self.get_connection() as conn:
            async with conn.execute(
                "SELECT status, error, segments FROM transcripts WHERE video_id = ? AND language = ?",
                (video_id, language),
            ) as cur:
                row = await cur.fetchone()
        if not row:
            return {"status": "idle", "error": "", "segment_count": 0}
        data = dict(row)
        segs = self._decode_json_field(data.get("segments"), [])
        return {
            "status": data.get("status") or "ready",
            "error": data.get("error") or "",
            "segment_count": len(segs),
        }

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
                     collocations, definitions, how_to_use, usage_notes, grammar_notes,
                     entry_type, difficulty_score, priority_score, frequency, ai_enriched)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    json.dumps(word_data.get("collocations", []), ensure_ascii=False),
                    json.dumps(word_data.get("definitions", []), ensure_ascii=False),
                    json.dumps(word_data.get("how_to_use", []), ensure_ascii=False),
                    word_data.get("usage_notes", ""),
                    word_data.get("grammar_notes", ""),
                    word_data.get("entry_type", "word"),
                    float(word_data.get("difficulty_score", 0.5) or 0.5),
                    float(word_data.get("priority_score", 0.5) or 0.5),
                    word_data.get("frequency", 0),
                    1 if word_data.get("ai_enriched") else 0,
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
                data["collocations"] = self._decode_json_field(data.get("collocations"), [])
                data["definitions"]  = self._decode_json_field(data.get("definitions"), [])
                data["how_to_use"]   = self._decode_json_field(data.get("how_to_use"), [])
                data["ai_enriched"]  = bool(data.get("ai_enriched", 0))
                try:
                    data["difficulty_score"] = float(data.get("difficulty_score", 0.5) or 0.5)
                except (TypeError, ValueError):
                    data["difficulty_score"] = 0.5
                try:
                    data["priority_score"] = float(data.get("priority_score", 0.5) or 0.5)
                except (TypeError, ValueError):
                    data["priority_score"] = 0.5
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
                       w.collocations, w.definitions, w.how_to_use, w.usage_notes,
                       w.grammar_notes, w.entry_type, w.difficulty_score, w.priority_score,
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

    async def get_vocabulary_facets(self, user_id: str = "") -> Dict[str, Any]:
        """
        Return facet counts (levels, source videos, tags) scoped to the requesting user.
        FIX: added user_id parameter so users see only their own facets.
        """
        uid_clause = "AND sw.user_id = ?" if user_id else ""
        uid_tag_clause = "AND user_id = ?" if user_id else ""
        uid_params = (user_id,) if user_id else ()

        async with self.get_connection() as conn:
            async with conn.execute(
                f"""
                SELECT w.level, COUNT(*) as count
                FROM saved_words sw
                JOIN words w ON sw.word_id = w.id
                WHERE 1=1 {uid_clause}
                GROUP BY w.level
                ORDER BY w.level ASC
                """,
                uid_params,
            ) as cursor:
                level_rows = await cursor.fetchall()

            async with conn.execute(
                f"""
                SELECT v.id as video_id, v.title, v.channel, COUNT(*) as count
                FROM saved_words sw
                LEFT JOIN videos v ON sw.video_id = v.id
                WHERE sw.video_id IS NOT NULL {uid_clause}
                GROUP BY v.id, v.title, v.channel
                ORDER BY count DESC, v.title ASC
                """,
                uid_params,
            ) as cursor:
                video_rows = await cursor.fetchall()

            async with conn.execute(
                f"SELECT tags FROM saved_words WHERE tags IS NOT NULL AND tags != '' {uid_tag_clause}",
                uid_params,
            ) as cursor:
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
        """
        Return words due for review, scoped strictly to the requesting user.
        FIX: removed `OR sw.user_id = ''` to prevent legacy data leaking across users.
        Legacy rows (user_id='') are only visible to users who own them based on
        their explicit user_id, not to all users.
        """
        due_expr = self._normalized_datetime_expr("sw.next_review")
        # Strict user scoping — only show rows owned by this user.
        # OR sw.user_id = '' was removed to prevent cross-user data exposure.
        uid_filter = "sw.user_id = ?" if user_id else "1=1"
        params = (user_id, limit) if user_id else (limit,)
        async with self.get_connection() as conn:
            async with conn.execute(
                f"""
                SELECT sw.*, w.word, w.pronunciation, w.part_of_speech,
                       w.meaning_ar, w.meaning_en, w.level, w.examples,
                       w.synonyms, w.antonyms, w.conjugations, w.related_words,
                       w.collocations, w.definitions, w.how_to_use, w.usage_notes,
                       w.grammar_notes, w.entry_type, w.difficulty_score, w.priority_score,
                       COALESCE(v.title, '') as source_video_title,
                       COALESCE(v.channel, '') as source_video_channel
                FROM saved_words sw
                JOIN words w ON sw.word_id = w.id
                LEFT JOIN videos v ON sw.video_id = v.id
                WHERE {uid_filter}
                  AND (sw.next_review IS NULL OR {due_expr} <= datetime('now'))
                ORDER BY
                    CASE sw.status
                        WHEN 'learning' THEN 0
                        WHEN 'reviewing' THEN 1
                        WHEN 'learned' THEN 2
                        ELSE 3
                    END,
                    COALESCE(sw.favorite, 0) DESC,
                    COALESCE(w.priority_score, 0.5) DESC,
                    COALESCE(sw.lapses, 0) DESC,
                    {due_expr} ASC,
                    sw.created_at ASC
                LIMIT ?
                """,
                params,
            ) as cursor:
                rows = await cursor.fetchall()
                return [self._parse_saved_word_row(row) for row in rows]

    async def get_review_summary(self, user_id: str = "") -> Dict[str, Any]:
        """
        Return a summary of the user's review queue.
        FIX: strict user scoping — removed `OR user_id = ''` to prevent
        cross-user data exposure. Each user sees only their own summary.
        """
        due_expr = self._normalized_datetime_expr("next_review")
        # Strict scoping: only this user's words.
        where = "WHERE user_id = ?" if user_id else ""
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

    async def update_review(self, saved_word_id: str, quality: int) -> Optional[Dict[str, Any]]:
        """Update spaced-repetition data after a review and return the updated saved word."""
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
