"""
Tests for the fourth curated B1/B2 pack (b1_b2_pack4.json) — more everyday
phrasal verbs, idioms and high-frequency personality/emotion adjectives.
"""

import json
import asyncio
import tempfile
import os
from pathlib import Path

from backend.app.db.database import DatabaseManager
from backend.ai.dictionary.service import _is_valid_arabic

PACK = Path("backend/data/b1_b2_pack4.json")


def test_pack4_quality_and_unique():
    pack = json.loads(PACK.read_text(encoding="utf-8"))
    others = set()
    for f in ("core3000_words.json", "b2_extra_words.json",
              "b1_b2_pack.json", "b1_b2_pack2.json", "b1_b2_pack3.json"):
        for w in json.loads(Path("backend/data", f).read_text(encoding="utf-8")):
            others.add(w["word"].lower())
    seen = set()
    for w in pack:
        assert w["level"] in ("B1", "B2")
        assert w["word"] and w["meaning_en"] and w["example"]
        assert _is_valid_arabic(w["meaning_ar"]), w["word"]
        k = w["word"].lower()
        assert k not in others, f"dup vs existing: {k}"
        assert k not in seen, f"internal dup: {k}"
        seen.add(k)


def test_pack4_seeds_and_idempotent():
    async def run():
        db = DatabaseManager(tempfile.mktemp(suffix=".db"))
        await db.initialize()
        await db.seed_core_words()
        async with db.get_connection() as c:
            async with c.execute("SELECT COUNT(*) FROM core_words") as cur:
                t1 = (await cur.fetchone())[0]
            async with c.execute(
                "SELECT COUNT(*) FROM core_words WHERE part_of_speech='idiom'"
            ) as cur:
                idioms = (await cur.fetchone())[0]
        assert t1 >= 780
        assert idioms >= 45
        await db.seed_core_words()
        async with db.get_connection() as c:
            async with c.execute("SELECT COUNT(*) FROM core_words") as cur:
                t2 = (await cur.fetchone())[0]
        assert t1 == t2
        await db.close()
        os.remove(db.db_path)
    asyncio.run(run())
