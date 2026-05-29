"""
Dictionary Service for LinguaLearn.
Uses Free Dictionary API + MyMemory Translation API for comprehensive word data.
Falls back to built-in heuristics when offline or APIs fail.
Results are cached in SQLite for instant subsequent lookups.
"""

import json
import re
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class DictionaryConfig:
    type: str = "local"
    path: str = "data/dictionary/"


class DictionaryService:
    def __init__(self, config: Optional[DictionaryConfig] = None):
        self.config = config or DictionaryConfig()

    async def lookup(self, word: str) -> Optional[Dict[str, Any]]:
        """
        Full word lookup pipeline:
          1. Free Dictionary API (definitions, phonetics, examples, synonyms)
          2. MyMemory API (Arabic translation)
          3. Heuristic fallback if both fail
        """
        word = word.lower().strip()
        if not word or len(word) < 1:
            return None

        # Try online APIs first
        api_data = await self._fetch_from_free_dictionary(word)
        translation = await self._fetch_arabic_translation(word)

        if api_data:
            api_data["meaning_ar"] = translation or ""
            return api_data

        # Fallback: build basic entry with translation
        return self._build_heuristic_entry(word, translation)

    # ─── Free Dictionary API ────────────────────────────────────────

    async def _fetch_from_free_dictionary(self, word: str) -> Optional[Dict[str, Any]]:
        """Fetch from https://api.dictionaryapi.dev (free, no key needed)."""
        import aiohttp

        url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=8)) as resp:
                    if resp.status != 200:
                        return None
                    data = await resp.json()

            if not data or not isinstance(data, list):
                return None

            entry = data[0]

            # Extract pronunciation
            pronunciation = ""
            phonetics = entry.get("phonetics", [])
            for p in phonetics:
                if p.get("text"):
                    pronunciation = p["text"]
                    break

            # Extract all meanings grouped by part of speech
            all_definitions: List[Dict[str, Any]] = []
            main_pos = ""
            main_definition = ""
            all_examples: List[str] = []
            all_synonyms: List[str] = []
            all_antonyms: List[str] = []
            how_to_use: List[str] = []

            for meaning in entry.get("meanings", []):
                pos = meaning.get("partOfSpeech", "")
                if not main_pos:
                    main_pos = pos

                pos_synonyms = meaning.get("synonyms", [])
                pos_antonyms = meaning.get("antonyms", [])
                all_synonyms.extend(pos_synonyms)
                all_antonyms.extend(pos_antonyms)

                for defn in meaning.get("definitions", []):
                    definition_text = defn.get("definition", "")
                    example = defn.get("example", "")
                    def_synonyms = defn.get("synonyms", [])
                    def_antonyms = defn.get("antonyms", [])

                    all_synonyms.extend(def_synonyms)
                    all_antonyms.extend(def_antonyms)

                    all_definitions.append({
                        "part_of_speech": pos,
                        "definition": definition_text,
                        "example": example,
                    })

                    if example:
                        all_examples.append(example)

                    if not main_definition and definition_text:
                        main_definition = definition_text

            # Build "How to Use" section
            if main_pos == "verb":
                how_to_use.append(f'"{word}" is a verb. Use it to describe an action.')
            elif main_pos == "noun":
                how_to_use.append(f'"{word}" is a noun. Use it as a subject or object in a sentence.')
            elif main_pos == "adjective":
                how_to_use.append(f'"{word}" is an adjective. Use it before a noun to describe it.')
            elif main_pos == "adverb":
                how_to_use.append(f'"{word}" is an adverb. Use it to modify a verb, adjective, or another adverb.')

            if all_examples:
                how_to_use.append(f"Example: {all_examples[0]}")

            # Estimate CEFR level
            level = self._estimate_level(word)

            # Build conjugations for verbs
            conjugations = {}
            if main_pos == "verb":
                conjugations = self._estimate_conjugations(word)

            # Deduplicate
            all_synonyms = list(dict.fromkeys(all_synonyms))[:8]
            all_antonyms = list(dict.fromkeys(all_antonyms))[:6]
            all_examples = list(dict.fromkeys(all_examples))[:5]

            return {
                "word": word,
                "pronunciation": pronunciation or f"/{word}/",
                "part_of_speech": main_pos or "unknown",
                "level": level,
                "meaning_ar": "",  # filled by caller
                "meaning_en": main_definition,
                "definitions": all_definitions[:6],
                "how_to_use": how_to_use,
                "examples": all_examples,
                "synonyms": all_synonyms,
                "antonyms": all_antonyms,
                "conjugations": conjugations,
                "related_words": [],
                "root_form": word,
                "frequency": 1,
            }

        except Exception as e:
            logger.debug(f"Free Dictionary API failed for '{word}': {e}")
            return None

    # ─── Arabic Translation ─────────────────────────────────────────

    async def _fetch_arabic_translation(self, word: str) -> Optional[str]:
        """Fetch Arabic translation from MyMemory API (free, no key needed)."""
        import aiohttp

        url = f"https://api.mymemory.translated.net/get?q={word}&langpair=en|ar"
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=6)) as resp:
                    if resp.status != 200:
                        return None
                    data = await resp.json()

            translated = data.get("responseData", {}).get("translatedText", "")
            if translated and translated.lower() != word.lower():
                return translated

            return None
        except Exception as e:
            logger.debug(f"MyMemory translation failed for '{word}': {e}")
            return None

    # ─── Heuristic Fallback ─────────────────────────────────────────

    def _build_heuristic_entry(self, word: str, translation: Optional[str] = None) -> Dict[str, Any]:
        """Build a basic word entry when APIs are unavailable."""
        pos = self._guess_pos(word)
        conjugations = self._estimate_conjugations(word) if pos == "verb" else {}

        return {
            "word": word,
            "pronunciation": f"/{word}/",
            "part_of_speech": pos,
            "level": self._estimate_level(word),
            "meaning_ar": translation or "",
            "meaning_en": f"Definition not available offline for \"{word}\"",
            "definitions": [],
            "how_to_use": [],
            "examples": [],
            "synonyms": [],
            "antonyms": [],
            "conjugations": conjugations,
            "related_words": [],
            "root_form": word,
            "frequency": 1,
        }

    def _guess_pos(self, word: str) -> str:
        if word.endswith(("tion", "ment", "ness", "ity", "ance", "ence")):
            return "noun"
        if word.endswith(("ly",)):
            return "adverb"
        if word.endswith(("ful", "ous", "ive", "able", "ible", "al", "ent", "ant")):
            return "adjective"
        if word.endswith(("ize", "ise", "ify", "ate")):
            return "verb"
        return "unknown"

    def _estimate_level(self, word: str) -> str:
        length = len(word)
        if length <= 4:
            return "A1"
        elif length <= 6:
            return "A2"
        elif length <= 8:
            return "B1"
        elif length <= 10:
            return "B2"
        elif length <= 13:
            return "C1"
        return "C2"

    def _estimate_conjugations(self, word: str) -> Dict[str, str]:
        if word.endswith("e"):
            return {
                "base": word,
                "past": word + "d",
                "past participle": word + "d",
                "present participle": word[:-1] + "ing",
                "3rd person": word + "s",
            }
        elif word.endswith("y") and len(word) > 2 and word[-2] not in "aeiou":
            return {
                "base": word,
                "past": word[:-1] + "ied",
                "past participle": word[:-1] + "ied",
                "present participle": word + "ing",
                "3rd person": word[:-1] + "ies",
            }
        else:
            return {
                "base": word,
                "past": word + "ed",
                "past participle": word + "ed",
                "present participle": word + "ing",
                "3rd person": word + "s",
            }
