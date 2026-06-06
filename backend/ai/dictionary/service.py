"""
DictionaryService — Multi-source pipeline for high-quality English word data.

Sources (in priority order):
  1. Free Dictionary API  — definitions, IPA, examples, POS
  2. Datamuse API         — richer synonyms, antonyms, related words, collocations
  3. Google Translate*    — Arabic translation (most accurate, unofficial endpoint)
  4. MyMemory             — Arabic translation fallback
  5. CEFR estimator       — local level estimation

*Uses the public gtx endpoint (no API key). Falls back to MyMemory if unavailable.

The pipeline is fully async and concurrent — all sources are fetched in parallel
where possible, minimising total latency.
"""

import re
import json
import logging
import asyncio
from typing import Optional, List, Dict, Any, Tuple

import aiohttp

logger = logging.getLogger(__name__)

# ── HTTP defaults ──────────────────────────────────────────────────────────────
_TIMEOUT  = aiohttp.ClientTimeout(total=8)
_HEADERS  = {"User-Agent": "Mozilla/5.0 LinguaLearn/1.0"}


# ══════════════════════════════════════════════════════════════════════════════
# DictionaryService
# ══════════════════════════════════════════════════════════════════════════════

class DictionaryService:
    def __init__(self, config=None):
        self.config = config

    async def lookup(self, word: str) -> Optional[Dict[str, Any]]:
        """
        Full lookup pipeline. All network calls run concurrently.
        Returns a rich word dict or None on complete failure.
        """
        word = word.lower().strip()
        if not word:
            return None

        # Fan-out: fetch all sources in parallel
        free_dict_task   = asyncio.create_task(self._fetch_free_dictionary(word))
        datamuse_task    = asyncio.create_task(self._fetch_datamuse(word))
        translation_task = asyncio.create_task(self._fetch_arabic(word))

        free_data, datamuse_data, arabic = await asyncio.gather(
            free_dict_task, datamuse_task, translation_task,
            return_exceptions=True,
        )

        # Treat exceptions as None
        if isinstance(free_data, Exception):
            logger.debug(f"FreeDictionary error for '{word}': {free_data}")
            free_data = None
        if isinstance(datamuse_data, Exception):
            logger.debug(f"Datamuse error for '{word}': {datamuse_data}")
            datamuse_data = None
        if isinstance(arabic, Exception):
            logger.debug(f"Translation error for '{word}': {arabic}")
            arabic = None

        if not free_data and not datamuse_data:
            return self._heuristic_entry(word, arabic or "")

        # Merge all sources
        result = self._merge(word, free_data, datamuse_data, arabic or "")
        return result

    # ── Source 1: Free Dictionary API ─────────────────────────────────────────

    async def _fetch_free_dictionary(self, word: str) -> Optional[Dict]:
        url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
        try:
            async with aiohttp.ClientSession(headers=_HEADERS) as s:
                async with s.get(url, timeout=_TIMEOUT) as r:
                    if r.status != 200:
                        return None
                    data = await r.json()

            if not isinstance(data, list) or not data:
                return None

            entry = data[0]

            # IPA pronunciation — prefer one with both text and audio
            pronunciation = ""
            audio_url = ""
            for p in entry.get("phonetics", []):
                if p.get("text") and not pronunciation:
                    pronunciation = p["text"]
                if p.get("audio") and not audio_url:
                    audio_url = p["audio"]

            # Parse meanings
            all_definitions: List[Dict] = []
            all_examples:    List[str]  = []
            all_synonyms:    List[str]  = []
            all_antonyms:    List[str]  = []
            main_pos        = ""
            main_definition = ""

            for meaning in entry.get("meanings", []):
                pos = meaning.get("partOfSpeech", "")
                if not main_pos:
                    main_pos = pos

                # Synonyms/antonyms at meaning level
                all_synonyms.extend(meaning.get("synonyms", []))
                all_antonyms.extend(meaning.get("antonyms", []))

                for defn in meaning.get("definitions", []):
                    d_text   = (defn.get("definition") or "").strip()
                    d_ex     = (defn.get("example") or "").strip()
                    d_syns   = defn.get("synonyms", [])
                    d_ants   = defn.get("antonyms", [])

                    if d_text:
                        if not main_definition:
                            main_definition = d_text
                        all_definitions.append({
                            "part_of_speech": pos,
                            "definition":     d_text,
                            "example":        d_ex,
                        })

                    if d_ex:
                        all_examples.append(d_ex)

                    all_synonyms.extend(d_syns)
                    all_antonyms.extend(d_ants)

            return {
                "pronunciation":  pronunciation,
                "audio_url":      audio_url,
                "part_of_speech": main_pos,
                "main_definition": main_definition,
                "definitions":    self._dedup(all_definitions, key="definition")[:8],
                "examples":       self._dedup_list(all_examples)[:5],
                "synonyms":       self._dedup_list(all_synonyms)[:10],
                "antonyms":       self._dedup_list(all_antonyms)[:8],
            }
        except Exception as e:
            logger.debug(f"FreeDictionary error '{word}': {e}")
            return None

    # ── Source 2: Datamuse API ─────────────────────────────────────────────────

    async def _fetch_datamuse(self, word: str) -> Optional[Dict]:
        """
        Datamuse provides vocabulary-rich data:
          ml = means-like (semantic field, related concepts)
          rel_syn = synonyms
          rel_ant = antonyms
          rel_spc = more specific (hyponyms)
          rel_gen = more general (hypernyms)
          sp + md=d = spelling match with definitions (Wiktionary data)
        """
        try:
            async with aiohttp.ClientSession(headers=_HEADERS) as s:
                # Run Datamuse calls concurrently
                tasks = [
                    s.get(f"https://api.datamuse.com/words?rel_syn={word}&max=12", timeout=_TIMEOUT),
                    s.get(f"https://api.datamuse.com/words?rel_ant={word}&max=8",  timeout=_TIMEOUT),
                    s.get(f"https://api.datamuse.com/words?ml={word}&max=12",      timeout=_TIMEOUT),
                    s.get(f"https://api.datamuse.com/words?sp={word}&md=d&max=1",  timeout=_TIMEOUT),
                ]
                responses = await asyncio.gather(*[t for t in tasks], return_exceptions=True)

            syns, ants, related, defs_resp = [], [], [], []
            wikt_defs: List[str] = []

            for i, resp in enumerate(responses):
                if isinstance(resp, Exception):
                    continue
                async with resp as r:
                    if r.status != 200:
                        continue
                    data = await r.json()

                if i == 0:
                    syns    = [d["word"] for d in data if "word" in d]
                elif i == 1:
                    ants    = [d["word"] for d in data if "word" in d]
                elif i == 2:
                    related = [d["word"] for d in data if "word" in d]
                elif i == 3 and data:
                    # Wiktionary definitions from Datamuse
                    raw_defs = data[0].get("defs", [])
                    for raw in raw_defs:
                        # format: "n\tDefinition text here."
                        parts = raw.split("\t", 1)
                        if len(parts) == 2:
                            wikt_defs.append(parts[1].strip())

            return {
                "synonyms":    syns,
                "antonyms":    ants,
                "related":     related,
                "wikt_defs":   wikt_defs,
            }
        except Exception as e:
            logger.debug(f"Datamuse error '{word}': {e}")
            return None

    # ── Source 3: Arabic translation ───────────────────────────────────────────

    async def _fetch_arabic(self, word: str) -> str:
        """Try Google (unofficial) then MyMemory for Arabic translation."""
        # A: Google Translate unofficial (most accurate)
        tr = await self._google_translate(word)
        if tr:
            return tr

        # B: MyMemory fallback
        tr = await self._mymemory_translate(word)
        return tr or ""

    async def _google_translate(self, word: str) -> str:
        """Google Translate via unofficial gtx endpoint (no API key required)."""
        url = (
            f"https://translate.googleapis.com/translate_a/single"
            f"?client=gtx&sl=en&tl=ar&dt=t&dt=at&q={word}"
        )
        try:
            async with aiohttp.ClientSession(headers=_HEADERS) as s:
                async with s.get(url, timeout=aiohttp.ClientTimeout(total=6)) as r:
                    if r.status != 200:
                        return ""
                    data = await r.json()

            # Primary translation from first block
            primary = ""
            if data and isinstance(data[0], list):
                for seg in data[0]:
                    if seg and isinstance(seg, list) and seg[0]:
                        primary += str(seg[0])

            if not primary or primary.lower() == word.lower():
                return ""

            return primary.strip()
        except Exception:
            return ""

    async def _mymemory_translate(self, word: str) -> str:
        """MyMemory translation as fallback."""
        url = f"https://api.mymemory.translated.net/get?q={word}&langpair=en|ar"
        try:
            async with aiohttp.ClientSession(headers=_HEADERS) as s:
                async with s.get(url, timeout=aiohttp.ClientTimeout(total=6)) as r:
                    if r.status != 200:
                        return ""
                    data = await r.json()

            tr = data.get("responseData", {}).get("translatedText", "")
            if tr and tr.lower() != word.lower():
                return tr.strip()
            return ""
        except Exception:
            return ""

    # ── Merge all sources into final dict ──────────────────────────────────────

    def _merge(
        self,
        word: str,
        free: Optional[Dict],
        datamuse: Optional[Dict],
        arabic: str,
    ) -> Dict[str, Any]:
        free     = free     or {}
        datamuse = datamuse or {}

        # ── Pronunciation ──────────────────────────────────────────────────────
        pronunciation = free.get("pronunciation") or f"/{word}/"
        audio_url     = free.get("audio_url", "")

        # ── Part of speech ─────────────────────────────────────────────────────
        pos = free.get("part_of_speech") or self._guess_pos(word)

        # ── Primary English definition ─────────────────────────────────────────
        # Priority: FreeDictionary main def > Wiktionary > heuristic
        main_en = free.get("main_definition", "")
        if not main_en:
            wdefs = datamuse.get("wikt_defs", [])
            if wdefs:
                main_en = wdefs[0]
        if not main_en:
            main_en = f'No definition found for "{word}".'

        # ── Definitions list ───────────────────────────────────────────────────
        definitions = free.get("definitions", [])
        # Add Wiktionary defs as extra entries if not duplicate
        for wdef in datamuse.get("wikt_defs", []):
            if wdef and not any(d.get("definition") == wdef for d in definitions):
                definitions.append({
                    "part_of_speech": pos,
                    "definition":     wdef,
                    "example":        "",
                })
        definitions = definitions[:8]

        # ── Examples ───────────────────────────────────────────────────────────
        examples = free.get("examples", [])
        # Filter: must contain the word, min length 20 chars
        examples = [
            e for e in examples
            if word.lower() in e.lower() and len(e) >= 20
        ]
        examples = self._dedup_list(examples)[:5]

        # ── Synonyms — merge both sources, prefer quality ──────────────────────
        free_syns = free.get("synonyms", [])
        dm_syns   = datamuse.get("synonyms", [])
        # Union: FreeDictionary first (higher accuracy), Datamuse enriches
        synonyms  = self._dedup_list(free_syns + [
            s for s in dm_syns if s not in free_syns
        ])[:10]

        # ── Antonyms ───────────────────────────────────────────────────────────
        free_ants = free.get("antonyms", [])
        dm_ants   = datamuse.get("antonyms", [])
        antonyms  = self._dedup_list(free_ants + [
            a for a in dm_ants if a not in free_ants
        ])[:8]

        # ── Related words (semantic field) ─────────────────────────────────────
        related_raw = datamuse.get("related", [])
        # Exclude the word itself and exact synonyms/antonyms
        exclude = {word} | set(synonyms[:5]) | set(antonyms[:3])
        related = [w for w in related_raw if w not in exclude][:8]

        # ── How to use ─────────────────────────────────────────────────────────
        how_to_use = self._build_how_to_use(word, pos, definitions, examples, synonyms)

        # ── Conjugations (verbs only) ──────────────────────────────────────────
        conjugations = {}
        if pos == "verb":
            conjugations = self._conjugate(word)

        # ── CEFR level ─────────────────────────────────────────────────────────
        level = self._estimate_level(word)

        return {
            "word":           word,
            "pronunciation":  pronunciation,
            "audio_url":      audio_url,
            "part_of_speech": pos,
            "level":          level,
            "meaning_ar":     arabic,
            "meaning_en":     main_en,
            "definitions":    definitions,
            "how_to_use":     how_to_use,
            "examples":       examples,
            "synonyms":       synonyms,
            "antonyms":       antonyms,
            "conjugations":   conjugations,
            "related_words":  related,
            "root_form":      word,
            "frequency":      1,
            "ai_enriched":    False,
        }

    # ── Usage guidance ─────────────────────────────────────────────────────────

    def _build_how_to_use(
        self,
        word: str,
        pos: str,
        definitions: List[Dict],
        examples: List[str],
        synonyms: List[str],
    ) -> List[str]:
        tips: List[str] = []

        # 1. POS-based grammar tip
        pos_tips = {
            "verb":       f'"{word}" is a verb — describe an action. E.g. "She {word}s every morning."',
            "noun":       f'"{word}" is a noun — use it as a subject or object.',
            "adjective":  f'"{word}" is an adjective — place it before a noun or after a linking verb.',
            "adverb":     f'"{word}" is an adverb — use it to modify verbs, adjectives, or other adverbs.',
            "preposition":f'"{word}" shows a relationship between words (position, time, direction).',
            "conjunction":f'"{word}" connects clauses or words in a sentence.',
            "interjection":f'"{word}" is an exclamation — use it to express sudden emotion.',
        }
        if pos in pos_tips:
            tips.append(pos_tips[pos])

        # 2. Synonym tip (if available)
        if len(synonyms) >= 2:
            s1, s2 = synonyms[0], synonyms[1]
            tips.append(f'Similar words: "{s1}", "{s2}".')

        # 3. First example if available
        if examples:
            tips.append(f'Example: {examples[0]}')

        return tips[:3]

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _heuristic_entry(self, word: str, arabic: str) -> Dict[str, Any]:
        pos = self._guess_pos(word)
        return {
            "word":           word,
            "pronunciation":  f"/{word}/",
            "audio_url":      "",
            "part_of_speech": pos,
            "level":          self._estimate_level(word),
            "meaning_ar":     arabic,
            "meaning_en":     "",
            "definitions":    [],
            "how_to_use":     [],
            "examples":       [],
            "synonyms":       [],
            "antonyms":       [],
            "conjugations":   self._conjugate(word) if pos == "verb" else {},
            "related_words":  [],
            "root_form":      word,
            "frequency":      1,
            "ai_enriched":    False,
        }

    def _guess_pos(self, word: str) -> str:
        w = word.lower()
        if w.endswith(("tion", "sion", "ment", "ness", "ity", "ance", "ence", "ship", "hood", "dom", "ism")):
            return "noun"
        if w.endswith(("ly",)) and len(w) > 4:
            return "adverb"
        if w.endswith(("ful", "ous", "ive", "able", "ible", "al", "ent", "ant", "ic", "ical", "ish")):
            return "adjective"
        if w.endswith(("ize", "ise", "ify", "ate", "en")) and len(w) > 4:
            return "verb"
        return "unknown"

    def _estimate_level(self, word: str) -> str:
        try:
            from .level_estimator import estimate_level
            return estimate_level(word)
        except Exception:
            n = len(word)
            if n <= 4:  return "A1"
            if n <= 6:  return "A2"
            if n <= 8:  return "B1"
            if n <= 10: return "B2"
            if n <= 13: return "C1"
            return "C2"

    def _conjugate(self, word: str) -> Dict[str, str]:
        w = word.lower().rstrip()
        if w.endswith("e"):
            stem = w[:-1]
            return {
                "base":                w,
                "past":                w + "d",
                "past participle":     w + "d",
                "present participle":  stem + "ing",
                "3rd person singular": w + "s",
            }
        if w.endswith("ie"):
            stem = w[:-2]
            return {
                "base":                w,
                "past":                stem + "ied",
                "past participle":     stem + "ied",
                "present participle":  stem + "ying",
                "3rd person singular": stem + "ies",
            }
        if (w.endswith("y") and len(w) > 2
                and w[-2] not in "aeiou"):
            stem = w[:-1]
            return {
                "base":                w,
                "past":                stem + "ied",
                "past participle":     stem + "ied",
                "present participle":  w + "ing",
                "3rd person singular": stem + "ies",
            }
        # CVC doubling (run→running, stop→stopped)
        if (len(w) >= 3
                and w[-1] not in "aeiouwy"
                and w[-2] in "aeiou"
                and w[-3] not in "aeiou"):
            return {
                "base":                w,
                "past":                w + w[-1] + "ed",
                "past participle":     w + w[-1] + "ed",
                "present participle":  w + w[-1] + "ing",
                "3rd person singular": w + "s",
            }
        return {
            "base":                w,
            "past":                w + "ed",
            "past participle":     w + "ed",
            "present participle":  w + "ing",
            "3rd person singular": w + "s",
        }

    @staticmethod
    def _dedup_list(lst: List[str]) -> List[str]:
        seen, out = set(), []
        for x in lst:
            low = x.lower().strip()
            if low and low not in seen:
                seen.add(low)
                out.append(x)
        return out

    @staticmethod
    def _dedup(lst: List[Dict], key: str) -> List[Dict]:
        seen, out = set(), []
        for d in lst:
            v = d.get(key, "").lower().strip()
            if v and v not in seen:
                seen.add(v)
                out.append(d)
        return out
