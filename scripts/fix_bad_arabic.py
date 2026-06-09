#!/usr/bin/env python3
"""
Repair words whose stored Arabic translation (meaning_ar) is invalid — e.g. an
English passthrough or a MyMemory warning string that slipped in before the
Arabic-validation fix.

For each affected row it re-fetches a proper Arabic translation (Google unofficial
→ MyMemory, both now validated). Rows that can't be improved are left untouched.

Run from the project root:
  python3 scripts/fix_bad_arabic.py
"""

import asyncio
import sys
from pathlib import Path

import aiosqlite

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
DB_PATH = PROJECT_ROOT / "data" / "lingualearn.db"

from backend.ai.dictionary.service import DictionaryService, _is_valid_arabic  # noqa: E402


async def _retranslate(svc: DictionaryService, word: str) -> str:
    try:
        return await svc._fetch_arabic(word)  # already validated internally
    except Exception:
        return ""


async def _fix_table(conn, svc, table: str) -> int:
    async with conn.execute(f"SELECT id, word, meaning_ar FROM {table}") as cur:
        rows = [dict(r) for r in await cur.fetchall()]

    fixed = 0
    for r in rows:
        current = (r.get("meaning_ar") or "").strip()
        # Only touch rows that have a value but it's not valid Arabic.
        if not current or _is_valid_arabic(current):
            continue
        word = r["word"]
        new = await _retranslate(svc, word)
        if new and _is_valid_arabic(new):
            await conn.execute(
                f"UPDATE {table} SET meaning_ar = ? WHERE id = ?", (new, r["id"])
            )
            fixed += 1
            print(f"  ✓ {word!r}: {current!r} → {new!r}")
        else:
            print(f"  – {word!r}: no valid Arabic found (left as-is)")
        await asyncio.sleep(0.15)  # be gentle with free endpoints
    return fixed


async def main():
    if not DB_PATH.exists():
        print(f"Database not found: {DB_PATH}")
        return
    svc = DictionaryService()
    async with aiosqlite.connect(str(DB_PATH)) as conn:
        conn.row_factory = aiosqlite.Row
        total = 0
        for table in ("words", "core_words"):
            try:
                print(f"Scanning {table}…")
                total += await _fix_table(conn, svc, table)
            except Exception as e:
                print(f"  (skipped {table}: {e})")
        await conn.commit()
    print(f"\nDone. Repaired {total} translation(s).")


if __name__ == "__main__":
    asyncio.run(main())
