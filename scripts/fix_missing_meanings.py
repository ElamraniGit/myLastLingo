#!/usr/bin/env python3
"""
Fix words in the database that have empty meaning_en.
Fetches English definitions from the Free Dictionary API.

Run from project root:
  python3 scripts/fix_missing_meanings.py
"""

import asyncio
import aiosqlite
import aiohttp
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = PROJECT_ROOT / "data" / "lingualearn.db"

async def fetch_english_definition(session: aiohttp.ClientSession, word: str) -> str:
    """Fetch English definition from Free Dictionary API."""
    url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=8)) as resp:
            if resp.status != 200:
                return ""
            data = await resp.json()
            if not data or not isinstance(data, list):
                return ""
            entry = data[0]
            for meaning in entry.get("meanings", []):
                for defn in meaning.get("definitions", []):
                    text = defn.get("definition", "").strip()
                    if text:
                        return text
    except Exception as e:
        print(f"  API error for '{word}': {e}")
    return ""

async def main():
    if not DB_PATH.exists():
        print(f"❌ Database not found at: {DB_PATH}")
        print("   Make sure the backend has been started at least once.")
        sys.exit(1)

    print(f"📂 Database: {DB_PATH}")

    async with aiosqlite.connect(str(DB_PATH)) as conn:
        conn.row_factory = aiosqlite.Row

        # Find words with empty meaning_en
        async with conn.execute(
            "SELECT id, word, meaning_en, meaning_ar FROM words "
            "WHERE meaning_en IS NULL OR meaning_en = '' OR meaning_en LIKE 'Definition not available%'"
            "ORDER BY frequency DESC"
        ) as cur:
            words = [dict(r) for r in await cur.fetchall()]

    print(f"🔍 Found {len(words)} words with missing English definitions")

    if not words:
        print("✅ All words already have English definitions!")
        return

    fixed = 0
    failed = 0

    async with aiohttp.ClientSession() as session:
        async with aiosqlite.connect(str(DB_PATH)) as conn:
            for i, w in enumerate(words, 1):
                word = w["word"]
                print(f"[{i}/{len(words)}] {word} ...", end=" ", flush=True)

                definition = await fetch_english_definition(session, word)

                if definition:
                    await conn.execute(
                        "UPDATE words SET meaning_en = ? WHERE id = ?",
                        (definition, w["id"])
                    )
                    await conn.commit()
                    print(f"✅ {definition[:60]}...")
                    fixed += 1
                else:
                    print("⚠️  not found online")
                    failed += 1

                # Rate limit — don't hammer the API
                await asyncio.sleep(0.3)

    print(f"\n{'='*50}")
    print(f"✅ Fixed:  {fixed} words")
    print(f"⚠️  Failed: {failed} words")
    print(f"\nRestart the backend to see changes.")

if __name__ == "__main__":
    asyncio.run(main())
