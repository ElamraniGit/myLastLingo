"""Regression tests for DB init (FIX-CRIT-1) and migration idempotency."""

import asyncio
import tempfile

from backend.app.db.database import DatabaseManager


def test_fresh_database_initializes():
    """Regression for the critical 'no such column: user_id' boot crash."""
    path = tempfile.mktemp(suffix=".db")
    db = DatabaseManager(path)
    asyncio.run(db.initialize())  # must not raise


def test_init_is_idempotent():
    """Running initialize twice (re-migration) must be safe."""
    path = tempfile.mktemp(suffix=".db")
    asyncio.run(DatabaseManager(path).initialize())
    asyncio.run(DatabaseManager(path).initialize())  # must not raise


def test_user_id_indexes_exist():
    path = tempfile.mktemp(suffix=".db")
    db = DatabaseManager(path)
    asyncio.run(db.initialize())

    async def _indexes():
        async with db.get_connection() as conn:
            async with conn.execute(
                "SELECT name FROM sqlite_master WHERE type='index'"
            ) as cur:
                return {dict(r)["name"] for r in await cur.fetchall()}

    idx = asyncio.run(_indexes())
    assert "idx_saved_words_uid" in idx
    assert "idx_videos_uid" in idx
