"""
Tests for the supplementary B2 vocabulary pack (b2_extra_words.json).

Verifies:
  - The additive seeding loads base + B2 pack into the shared core_words table.
  - Phrasal verbs are present and tagged with part_of_speech='phrasal verb'.
  - Re-running the seed is idempotent (no duplicates).
  - Cards carry the full helper data (meanings, synonyms, collocations, example).
"""

import asyncio
import tempfile
import os

import pytest

from backend.app.db.database import DatabaseManager


def _fresh_db():
    return DatabaseManager(tempfile.mktemp(suffix=".db"))


def test_b2_pack_seeds_and_is_idempotent():
    async def run():
        db = _fresh_db()
        await db.initialize()

        await db.seed_core_words()
        async with db.get_connection() as conn:
            async with conn.execute("SELECT COUNT(*) FROM core_words") as c:
                total1 = (await c.fetchone())[0]
            async with conn.execute(
                "SELECT COUNT(*) FROM core_words WHERE level='B2'"
            ) as c:
                b2 = (await c.fetchone())[0]
            async with conn.execute(
                "SELECT COUNT(*) FROM core_words WHERE part_of_speech='phrasal verb'"
            ) as c:
                phrasal = (await c.fetchone())[0]

        # B2 set (50 base B2 + 95 pack) and all 44 phrasal verbs present.
        assert b2 >= 140
        assert phrasal >= 44

        # Idempotent: seeding again must not create duplicates.
        await db.seed_core_words()
        async with db.get_connection() as conn:
            async with conn.execute("SELECT COUNT(*) FROM core_words") as c:
                total2 = (await c.fetchone())[0]
        assert total1 == total2

        await db.close()
        os.remove(db.db_path)

    asyncio.run(run())


def test_b2_phrasal_card_has_full_data():
    async def run():
        db = _fresh_db()
        await db.initialize()
        await db.seed_core_words()

        async with db.get_connection() as conn:
            async with conn.execute(
                "SELECT word, meaning_en, meaning_ar, synonyms, collocations, example "
                "FROM core_words WHERE word = ?",
                ("come up with",),
            ) as c:
                row = await c.fetchone()

        assert row is not None
        card = dict(row)
        assert card["meaning_en"]
        assert card["meaning_ar"]
        assert card["example"]
        # JSON-encoded lists are non-empty.
        assert card["synonyms"] not in ("", "[]", None)
        assert card["collocations"] not in ("", "[]", None)

        await db.close()
        os.remove(db.db_path)

    asyncio.run(run())
