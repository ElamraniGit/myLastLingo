from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class LanguageCache:
    def __init__(self, db_manager):
        self.db = db_manager

    async def ensure_table(self) -> None:
        async with self.db.get_connection() as conn:
            await conn.execute(
                """
                CREATE TABLE IF NOT EXISTS ai_language_cache (
                    cache_key    TEXT PRIMARY KEY,
                    term         TEXT NOT NULL,
                    data_json    TEXT NOT NULL,
                    groq_used    INTEGER DEFAULT 0,
                    lookup_count INTEGER DEFAULT 0,
                    created_at   TEXT,
                    updated_at   TEXT
                )
                """
            )
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_alc_term ON ai_language_cache(term)")

    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        try:
            async with self.db.get_connection() as conn:
                async with conn.execute(
                    "SELECT data_json FROM ai_language_cache WHERE cache_key = ?",
                    (key,),
                ) as cur:
                    row = await cur.fetchone()
            return json.loads(dict(row)["data_json"]) if row else None
        except Exception as exc:
            logger.debug("Language cache read failed: %s", exc)
            return None

    async def set(self, key: str, term: str, entry: Dict[str, Any], *, groq_used: bool) -> None:
        now = datetime.utcnow().isoformat()
        try:
            async with self.db.get_connection() as conn:
                await conn.execute(
                    """
                    INSERT INTO ai_language_cache
                        (cache_key, term, data_json, groq_used, lookup_count, created_at, updated_at)
                    VALUES (?, ?, ?, ?, 1, ?, ?)
                    ON CONFLICT(cache_key) DO UPDATE SET
                        term = excluded.term,
                        data_json = excluded.data_json,
                        groq_used = excluded.groq_used,
                        lookup_count = lookup_count + 1,
                        updated_at = excluded.updated_at
                    """,
                    (key, term, json.dumps(entry, ensure_ascii=False), 1 if groq_used else 0, now, now),
                )
        except Exception as exc:
            logger.debug("Language cache write failed: %s", exc)

    async def bump(self, key: str) -> None:
        try:
            async with self.db.get_connection() as conn:
                await conn.execute(
                    "UPDATE ai_language_cache SET lookup_count = lookup_count + 1 WHERE cache_key = ?",
                    (key,),
                )
        except Exception:
            pass

    async def invalidate(self, key: str) -> None:
        async with self.db.get_connection() as conn:
            await conn.execute("DELETE FROM ai_language_cache WHERE cache_key = ?", (key,))
