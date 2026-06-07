from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any, Dict, Iterable, List

from .models import DefinitionItem, LanguageEntry

_VALID_CEFR = {"A1", "A2", "B1", "B2", "C1", "C2"}


def cache_key(term: str) -> str:
    return hashlib.sha256((term or "").lower().strip().encode()).hexdigest()[:24]


def infer_entry_type(term: str) -> str:
    value = (term or "").strip()
    if not value:
        return "word"
    lowered = value.lower()
    token_count = len([t for t in value.split() if t])
    if token_count >= 6 or value.endswith((".", "!", "?")):
        return "sentence"
    if any(mark in lowered for mark in ["kick the bucket", "piece of cake", "break the ice"]):
        return "idiom"
    if token_count >= 3:
        return "expression"
    if token_count == 2:
        return "phrase"
    return "word"


def _clean_list(values: Any, *, limit: int = 10) -> List[str]:
    if not isinstance(values, list):
        return []
    seen = set()
    out: List[str] = []
    for item in values:
        text = str(item or "").strip()
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(text)
        if len(out) >= limit:
            break
    return out


def _clean_definitions(values: Any) -> List[DefinitionItem]:
    if not isinstance(values, list):
        return []
    items: List[DefinitionItem] = []
    for raw in values[:4]:
        if isinstance(raw, dict):
            text = str(raw.get("text", "")).strip()
            if not text:
                continue
            items.append(DefinitionItem(text=text, context=str(raw.get("context", "general")).strip() or "general"))
        else:
            text = str(raw or "").strip()
            if text:
                items.append(DefinitionItem(text=text, context="general"))
    return items


def _clamp_float(value: Any, default: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def _estimate_priority(entry: Dict[str, Any], inferred_type: str) -> float:
    level_weight = {
        "A1": 0.95,
        "A2": 0.88,
        "B1": 0.76,
        "B2": 0.62,
        "C1": 0.48,
        "C2": 0.34,
    }.get(entry.get("cefr_level", "B1"), 0.6)
    richness = 0.0
    richness += min(len(entry.get("definitions", [])), 4) * 0.05
    richness += min(len(entry.get("examples", [])), 3) * 0.04
    richness += 0.08 if inferred_type == "word" else 0.0
    richness += 0.05 if entry.get("translation") else 0.0
    richness -= _clamp_float(entry.get("learning_difficulty"), 0.5) * 0.12
    return round(max(0.0, min(1.0, level_weight + richness)), 2)


def empty_entry(term: str) -> Dict[str, Any]:
    entry = LanguageEntry(
        term=(term or "").strip(),
        normalized_term=(term or "").strip().lower(),
        entry_type=infer_entry_type(term),
        learning_difficulty=0.5,
        priority_score=0.5,
        source="fallback",
    )
    return entry.to_cache_dict()


def normalize_ai_response(raw: Dict[str, Any], term: str) -> Dict[str, Any]:
    inferred_type = infer_entry_type(term)
    entry = empty_entry(term)
    entry.update({
        "term": str(raw.get("term") or term).strip() or term,
        "normalized_term": (term or "").strip().lower(),
        "translation": str(raw.get("translation", "")).strip(),
        "pronunciation": str(raw.get("pronunciation", "")).strip(),
        "part_of_speech": str(raw.get("part_of_speech", "unknown")).strip() or "unknown",
        "entry_type": str(raw.get("entry_type", inferred_type)).strip() or inferred_type,
        "usage_notes": str(raw.get("usage_notes", "")).strip(),
        "grammar_notes": str(raw.get("grammar_notes", "")).strip(),
        "cefr_level": str(raw.get("cefr_level", "B1")).strip(),
        "definitions": [d.model_dump() for d in _clean_definitions(raw.get("definitions", []))],
        "examples": _clean_list(raw.get("examples", []), limit=5),
        "synonyms": _clean_list(raw.get("synonyms", []), limit=10),
        "antonyms": _clean_list(raw.get("antonyms", []), limit=8),
        "collocations": _clean_list(raw.get("collocations", []), limit=8),
        "related_words": _clean_list(raw.get("related_words", []), limit=10),
        "learning_difficulty": _clamp_float(raw.get("learning_difficulty"), 0.5),
        "priority_score": _clamp_float(raw.get("priority_score"), 0.6),
        "confidence": _clamp_float(raw.get("confidence"), 0.8),
        "source": "groq",
        "ai_generated": True,
        "cached_at": datetime.utcnow().isoformat(),
    })
    if entry["cefr_level"] not in _VALID_CEFR:
        entry["cefr_level"] = "B1"
    if entry["entry_type"] not in {"word", "phrase", "expression", "idiom", "sentence"}:
        entry["entry_type"] = inferred_type
    if not entry["priority_score"]:
        entry["priority_score"] = _estimate_priority(entry, inferred_type)
    return entry


def normalize_multisource(word_data: Dict[str, Any], term: str) -> Dict[str, Any]:
    inferred_type = infer_entry_type(term)
    definitions = []
    for item in (word_data.get("definitions") or [])[:4]:
        text = str((item or {}).get("definition", "")).strip()
        if text:
            definitions.append({
                "text": text,
                "context": str((item or {}).get("part_of_speech", "general") or "general"),
            })

    entry = empty_entry(term)
    entry.update({
        "term": term,
        "normalized_term": term.lower().strip(),
        "entry_type": inferred_type,
        "translation": str(word_data.get("meaning_ar", "")).strip(),
        "pronunciation": str(word_data.get("pronunciation", "")).strip(),
        "part_of_speech": str(word_data.get("part_of_speech", "unknown")).strip() or "unknown",
        "cefr_level": str(word_data.get("level", "B1")).strip() if str(word_data.get("level", "B1")).strip() in _VALID_CEFR else "B1",
        "definitions": definitions,
        "examples": _clean_list(word_data.get("examples", []), limit=5),
        "synonyms": _clean_list(word_data.get("synonyms", []), limit=10),
        "antonyms": _clean_list(word_data.get("antonyms", []), limit=8),
        "collocations": _clean_list(word_data.get("collocations") or word_data.get("related_words", []), limit=8),
        "usage_notes": " ".join(_clean_list(word_data.get("how_to_use", []), limit=2)).strip(),
        "grammar_notes": str(word_data.get("grammar_notes", "")).strip(),
        "related_words": _clean_list(word_data.get("related_words", []), limit=10),
        "learning_difficulty": _clamp_float(word_data.get("difficulty_score"), 0.45),
        "confidence": 0.62,
        "source": "multi_source",
        "ai_generated": False,
        "cached_at": datetime.utcnow().isoformat(),
    })
    entry["priority_score"] = _estimate_priority(entry, inferred_type)
    return entry
