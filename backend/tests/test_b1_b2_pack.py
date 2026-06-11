"""
Tests for the curated B1/B2 content pack (b1_b2_pack.json) that is seeded into
the shared core_words library and is visible to all users.
"""

import json
import asyncio
import tempfile
import os
from pathlib import Path

from backend.app.db.database import DatabaseManager
from backend.ai.dictionary.service import _is_valid_arabic

PACK = Path("backend/data/b1_b2_pack.json")


def test_pack_file_quality():
    pack = json.loads(PACK.read_text(encoding="utf-8"))
    assert len(pack) >= 100
    seen = set()
    for w in pack:
        assert w["level"] in ("B1", "B2")
        assert w["word"] and w["meaning_en"] and w["example"]
        assert _is_valid_arabic(w["meaning_ar"]), w["word"]
        key = w["word"].lower()
        assert key not in seen, f"duplicate in pack: {key}"
        seen.add(key)


def test_pack_seeds_into_core_words_and_is_idempotent():
    async def run():
        db = DatabaseManager(tempfile.mktemp(suffix=".db"))
        await db.initialize()
        await db.seed_core_words()
        async with db.get_connection() as c:
            async with c.execute("SELECT COUNT(*) FROM core_words") as cur:
                total1 = (await cur.fetchone())[0]
            async with c.execute(
                "SELECT COUNT(*) FROM core_words WHERE level IN ('B1','B2')"
            ) as cur:
                b = (await cur.fetchone())[0]
        # base + B2 pack + B1/B2 pack
        assert total1 >= 580
        assert b >= 250

        await db.seed_core_words()
        async with db.get_connection() as c:
            async with c.execute("SELECT COUNT(*) FROM core_words") as cur:
                total2 = (await cur.fetchone())[0]
        assert total1 == total2
        await db.close()
        os.remove(db.db_path)

    asyncio.run(run())
