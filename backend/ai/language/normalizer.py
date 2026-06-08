from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any, Dict, Iterable, List

from .models import (
    CollocationItem,
    DefinitionItem,
    ExampleItem,
    GrammarAnalysis,
    LanguageEntry,
    MeaningItem,
    MistakeItem,
    PhraseItem,
    PhrasalVerbItem,
    RelationItem,
    WordFamilyItem,
)

_VALID_CEFR = {"A1", "A2", "B1", "B2", "C1", "C2"}
_VALID_ENTRY_TYPES = {"word", "phrase", "expression", "idiom", "sentence"}


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


def _text(value: Any) -> str:
    return str(value or "").strip()


def _normalize_cefr(value: Any, default: str = "B1") -> str:
    parsed = _text(value).upper()
    return parsed if parsed in _VALID_CEFR else default


def _clean_list(values: Any, *, limit: int = 10) -> List[str]:
    if not isinstance(values, list):
        return []
    seen = set()
    out: List[str] = []
    for item in values:
        text = _text(item)
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


def _clean_string_map(values: Any, *, limit: int = 12) -> Dict[str, str]:
    if not isinstance(values, dict):
        return {}
    out: Dict[str, str] = {}
    for key, value in values.items():
        k = _text(key)
        v = _text(value)
        if not k or not v:
            continue
        out[k[:40]] = v[:120]
        if len(out) >= limit:
            break
    return out


def _clean_breakdown(values: Any, *, limit: int = 8) -> List[Dict[str, str]]:
    if not isinstance(values, list):
        return []
    out: List[Dict[str, str]] = []
    for item in values[:limit]:
        if isinstance(item, dict):
            label = _text(item.get("label") or item.get("role") or item.get("name"))
            value = _text(item.get("value") or item.get("text"))
            if label and value:
                out.append({"label": label, "value": value})
    return out


def _clean_meanings(values: Any, translation: str = "") -> List[MeaningItem]:
    if not isinstance(values, list):
        values = []
    items: List[MeaningItem] = []
    for index, raw in enumerate(values[:6], start=1):
        if isinstance(raw, dict):
            simple = _text(raw.get("english_simple") or raw.get("text") or raw.get("definition"))
            arabic = _text(raw.get("arabic") or raw.get("translation"))
            advanced = _text(raw.get("english_advanced") or raw.get("advanced_definition"))
            if not simple and not advanced:
                continue
            items.append(MeaningItem(
                rank=int(raw.get("rank") or index),
                arabic=arabic,
                english_simple=simple,
                english_advanced=advanced,
                context=_text(raw.get("context") or "general") or "general",
                register=_text(raw.get("register") or "neutral") or "neutral",
            ))
        else:
            simple = _text(raw)
            if simple:
                items.append(MeaningItem(rank=index, arabic=translation if index == 1 else "", english_simple=simple))
    return items


def _clean_definitions(values: Any) -> List[DefinitionItem]:
    if not isinstance(values, list):
        return []
    items: List[DefinitionItem] = []
    for index, raw in enumerate(values[:6], start=1):
        if isinstance(raw, dict):
            text = _text(raw.get("text") or raw.get("english_simple") or raw.get("definition"))
            if not text:
                continue
            items.append(DefinitionItem(
                text=text,
                context=_text(raw.get("context") or "general") or "general",
                arabic=_text(raw.get("arabic")),
                english_advanced=_text(raw.get("english_advanced") or raw.get("advanced_definition")),
                register=_text(raw.get("register") or "neutral") or "neutral",
                order=int(raw.get("order") or raw.get("rank") or index),
            ))
        else:
            text = _text(raw)
            if text:
                items.append(DefinitionItem(text=text, order=index))
    return items


def _definitions_from_meanings(meanings: List[MeaningItem]) -> List[DefinitionItem]:
    out: List[DefinitionItem] = []
    for meaning in meanings[:6]:
        text = meaning.english_simple or meaning.english_advanced
        if not text:
            continue
        out.append(DefinitionItem(
            text=text,
            context=meaning.context or "general",
            arabic=meaning.arabic,
            english_advanced=meaning.english_advanced,
            register=meaning.usage_register or "neutral",
            order=meaning.rank,
        ))
    return out


def _clean_relation_details(values: Any, *, limit: int = 10, term_keys: Iterable[str] = ("term", "word", "expression", "item")) -> List[RelationItem]:
    if not isinstance(values, list):
        return []
    items: List[RelationItem] = []
    seen = set()
    for raw in values:
        term = ""
        if isinstance(raw, dict):
            for key in term_keys:
                term = _text(raw.get(key))
                if term:
                    break
            short_definition = _text(raw.get("short_definition") or raw.get("definition") or raw.get("meaning"))
            commonness = _text(raw.get("commonness") or raw.get("frequency") or raw.get("level"))
        else:
            term = _text(raw)
            short_definition = ""
            commonness = ""
        if not term:
            continue
        lowered = term.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        items.append(RelationItem(term=term, short_definition=short_definition, commonness=commonness))
        if len(items) >= limit:
            break
    return items


def _clean_example_details(values: Any, *, limit: int = 10) -> List[ExampleItem]:
    if not isinstance(values, list):
        return []
    items: List[ExampleItem] = []
    seen = set()
    for raw in values:
        if isinstance(raw, dict):
            english = _text(raw.get("english") or raw.get("sentence") or raw.get("example") or raw.get("text"))
            arabic = _text(raw.get("arabic") or raw.get("translation"))
            difficulty = _normalize_cefr(raw.get("difficulty"), "B1")
            register = _text(raw.get("register") or raw.get("context") or "general") or "general"
            focus = _text(raw.get("focus") or raw.get("note"))
        else:
            english = _text(raw)
            arabic = ""
            difficulty = "B1"
            register = "general"
            focus = ""
        if not english:
            continue
        lowered = english.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        items.append(ExampleItem(
            english=english,
            arabic=arabic,
            difficulty=difficulty,
            register=register,
            focus=focus,
        ))
        if len(items) >= limit:
            break
    return items


def _clean_phrase_items(values: Any, *, limit: int = 8) -> List[PhraseItem]:
    if not isinstance(values, list):
        return []
    items: List[PhraseItem] = []
    seen = set()
    for raw in values:
        if not isinstance(raw, dict):
            expression = _text(raw)
            meaning = translation = example = ""
        else:
            expression = _text(raw.get("expression") or raw.get("term") or raw.get("phrase"))
            meaning = _text(raw.get("meaning") or raw.get("definition"))
            translation = _text(raw.get("translation") or raw.get("arabic"))
            example = _text(raw.get("example"))
        if not expression:
            continue
        lowered = expression.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        items.append(PhraseItem(expression=expression, meaning=meaning, translation=translation, example=example))
        if len(items) >= limit:
            break
    return items


def _clean_phrasal_verbs(values: Any, *, limit: int = 8) -> List[PhrasalVerbItem]:
    if not isinstance(values, list):
        return []
    items: List[PhrasalVerbItem] = []
    seen = set()
    for raw in values:
        if not isinstance(raw, dict):
            pv = _text(raw)
            meaning = translation = example = ""
        else:
            pv = _text(raw.get("phrasal_verb") or raw.get("term") or raw.get("expression"))
            meaning = _text(raw.get("meaning") or raw.get("definition"))
            translation = _text(raw.get("translation") or raw.get("arabic"))
            example = _text(raw.get("example"))
        if not pv:
            continue
        lowered = pv.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        items.append(PhrasalVerbItem(phrasal_verb=pv, meaning=meaning, translation=translation, example=example))
        if len(items) >= limit:
            break
    return items


def _clean_collocation_details(values: Any, *, limit: int = 8) -> List[CollocationItem]:
    if not isinstance(values, list):
        return []
    items: List[CollocationItem] = []
    seen = set()
    for raw in values:
        if not isinstance(raw, dict):
            expression = _text(raw)
            pattern = meaning = translation = ""
        else:
            expression = _text(raw.get("expression") or raw.get("term") or raw.get("collocation"))
            pattern = _text(raw.get("pattern"))
            meaning = _text(raw.get("meaning") or raw.get("definition"))
            translation = _text(raw.get("translation") or raw.get("arabic"))
        if not expression:
            continue
        lowered = expression.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        items.append(CollocationItem(expression=expression, pattern=pattern, meaning=meaning, translation=translation))
        if len(items) >= limit:
            break
    return items


def _clean_word_family(values: Any, *, limit: int = 10) -> List[WordFamilyItem]:
    if not isinstance(values, list):
        return []
    items: List[WordFamilyItem] = []
    seen = set()
    for raw in values:
        if not isinstance(raw, dict):
            term = _text(raw)
            pos = meaning = ""
        else:
            term = _text(raw.get("term") or raw.get("word"))
            pos = _text(raw.get("part_of_speech") or raw.get("pos"))
            meaning = _text(raw.get("meaning") or raw.get("translation") or raw.get("definition"))
        if not term:
            continue
        lowered = term.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        items.append(WordFamilyItem(term=term, part_of_speech=pos, meaning=meaning))
        if len(items) >= limit:
            break
    return items


def _clean_common_mistakes(values: Any, *, limit: int = 6) -> List[MistakeItem]:
    if not isinstance(values, list):
        return []
    items: List[MistakeItem] = []
    seen = set()
    for raw in values:
        if isinstance(raw, dict):
            mistake = _text(raw.get("mistake"))
            correction = _text(raw.get("correction"))
            explanation = _text(raw.get("explanation") or raw.get("note"))
        else:
            mistake = _text(raw)
            correction = ""
            explanation = ""
        if not mistake:
            continue
        lowered = mistake.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        items.append(MistakeItem(mistake=mistake, correction=correction, explanation=explanation))
        if len(items) >= limit:
            break
    return items


def _clean_grammar_analysis(raw: Any) -> GrammarAnalysis:
    if not isinstance(raw, dict):
        raw = {}
    return GrammarAnalysis(
        summary=_text(raw.get("summary") or raw.get("grammar_summary")),
        base_form=_text(raw.get("base_form") or raw.get("lemma") or raw.get("root_form")),
        form_type=_text(raw.get("form_type") or raw.get("type")),
        tense=_text(raw.get("tense")),
        aspect=_text(raw.get("aspect")),
        voice=_text(raw.get("voice")),
        sentence_type=_text(raw.get("sentence_type")),
        subject=_text(raw.get("subject")),
        verb=_text(raw.get("verb")),
        object=_text(raw.get("object")),
        number=_text(raw.get("number")),
        comparison_type=_text(raw.get("comparison_type")),
        irregularity=_text(raw.get("irregularity") or raw.get("irregular")),
        used_with=_clean_list(raw.get("used_with", []), limit=8),
        notes=_clean_list(raw.get("notes", []), limit=10),
        inflected_forms=_clean_string_map(raw.get("inflected_forms", {}), limit=12),
        breakdown=_clean_breakdown(raw.get("breakdown", []), limit=8),
    )


def _derive_frequency_label(score: int) -> str:
    if score >= 80:
        return "Very Common"
    if score >= 55:
        return "Common"
    if score >= 30:
        return "Uncommon"
    return "Rare"


def _derive_frequency_score(raw: Dict[str, Any], cefr_level: str, priority_hint: float) -> int:
    try:
        score = int(float(raw.get("frequency_score")))
    except (TypeError, ValueError):
        score = 0
    if 1 <= score <= 100:
        return score
    level_defaults = {
        "A1": 92,
        "A2": 82,
        "B1": 68,
        "B2": 54,
        "C1": 38,
        "C2": 24,
    }
    score = round(level_defaults.get(cefr_level, 60) * 0.75 + max(0.0, min(1.0, priority_hint)) * 25)
    return max(1, min(100, score))


def _clamp_float(value: Any, default: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def _estimate_learning_difficulty(cefr_level: str, entry_type: str, frequency_score: int) -> float:
    level_component = {
        "A1": 0.12,
        "A2": 0.22,
        "B1": 0.42,
        "B2": 0.58,
        "C1": 0.76,
        "C2": 0.9,
    }.get(cefr_level, 0.45)
    type_penalty = 0.08 if entry_type in {"idiom", "expression", "sentence"} else 0.0
    frequency_bonus = (100 - max(1, min(100, frequency_score))) / 250
    return round(max(0.0, min(1.0, level_component + type_penalty + frequency_bonus)), 2)


def _estimate_priority(entry: Dict[str, Any], inferred_type: str) -> float:
    level_weight = {
        "A1": 0.92,
        "A2": 0.84,
        "B1": 0.72,
        "B2": 0.58,
        "C1": 0.44,
        "C2": 0.3,
    }.get(entry.get("cefr_level", "B1"), 0.6)
    frequency_weight = max(0.0, min(1.0, float(entry.get("frequency_score", 50)) / 100.0)) * 0.45
    richness = 0.0
    richness += min(len(entry.get("meanings", [])), 4) * 0.04
    richness += min(len(entry.get("example_details", [])), 6) * 0.025
    richness += min(len(entry.get("synonym_details", [])), 6) * 0.015
    richness += min(len(entry.get("collocation_details", [])), 5) * 0.015
    richness += 0.04 if inferred_type in {"word", "phrase"} else 0.02
    richness -= _clamp_float(entry.get("learning_difficulty"), 0.5) * 0.1
    return round(max(0.0, min(1.0, level_weight * 0.4 + frequency_weight + richness)), 2)


def _estimate_confidence(raw: Dict[str, Any], *, meanings: List[MeaningItem], examples: List[ExampleItem]) -> float:
    explicit = raw.get("confidence")
    if explicit not in (None, ""):
        return _clamp_float(explicit, 0.85)
    score = 0.45
    score += min(len(meanings), 4) * 0.08
    score += min(len(examples), 5) * 0.04
    score += 0.06 if _text(raw.get("translation") or raw.get("meaning_ar")) else 0.0
    score += 0.05 if isinstance(raw.get("grammar_analysis"), dict) and raw.get("grammar_analysis") else 0.0
    return round(max(0.0, min(1.0, score)), 2)


def empty_entry(term: str) -> Dict[str, Any]:
    inferred = infer_entry_type(term)
    entry = LanguageEntry(
        term=(term or "").strip(),
        normalized_term=(term or "").strip().lower(),
        entry_type=inferred,
        learning_difficulty=_estimate_learning_difficulty("B1", inferred, 50),
        priority_score=0.5,
        frequency_score=50,
        frequency_label=_derive_frequency_label(50),
        source="fallback",
    )
    return entry.to_cache_dict()


def normalize_ai_response(raw: Dict[str, Any], term: str) -> Dict[str, Any]:
    inferred_type = infer_entry_type(term)
    clean_term = (term or "").strip()
    base_priority = _clamp_float(raw.get("priority_score"), 0.6)
    cefr_level = _normalize_cefr(raw.get("cefr_level"), "B1")

    meanings = _clean_meanings(raw.get("meanings", []), _text(raw.get("translation") or raw.get("meaning_ar")))
    definitions = _clean_definitions(raw.get("definitions", []))
    if not definitions and meanings:
        definitions = _definitions_from_meanings(meanings)

    example_details = _clean_example_details(raw.get("example_details", []), limit=10)
    if not example_details:
        example_details = _clean_example_details(raw.get("examples", []), limit=10)

    synonym_details = _clean_relation_details(raw.get("synonym_details", []), limit=10)
    antonym_details = _clean_relation_details(raw.get("antonym_details", []), limit=10)
    collocation_details = _clean_collocation_details(raw.get("collocation_details", []), limit=8)
    common_phrases = _clean_phrase_items(raw.get("common_phrases", []), limit=8)
    phrasal_verbs = _clean_phrasal_verbs(raw.get("phrasal_verbs", []), limit=8)
    word_family = _clean_word_family(raw.get("word_family", []), limit=10)
    common_mistakes = _clean_common_mistakes(raw.get("common_mistakes", []), limit=6)
    grammar_analysis = _clean_grammar_analysis(raw.get("grammar_analysis", {}))

    translation = _text(raw.get("translation") or raw.get("meaning_ar"))
    if not translation and meanings:
        translation = meanings[0].arabic
    if not translation and definitions:
        translation = definitions[0].arabic

    examples = _clean_list(raw.get("examples", []), limit=10)
    if not examples:
        examples = [item.english for item in example_details if item.english][:10]

    synonyms = _clean_list(raw.get("synonyms", []), limit=10)
    if not synonyms:
        synonyms = [item.term for item in synonym_details][:10]
    else:
        detail_terms = [item.term for item in synonym_details if item.term]
        synonyms = _clean_list(synonyms + detail_terms, limit=10)

    antonyms = _clean_list(raw.get("antonyms", []), limit=10)
    if not antonyms:
        antonyms = [item.term for item in antonym_details][:10]
    else:
        detail_terms = [item.term for item in antonym_details if item.term]
        antonyms = _clean_list(antonyms + detail_terms, limit=10)

    collocations = _clean_list(raw.get("collocations", []), limit=8)
    if not collocations:
        collocations = [item.expression for item in collocation_details][:8]
    else:
        collocations = _clean_list(collocations + [item.expression for item in collocation_details], limit=8)

    related_words = _clean_list(raw.get("related_words", []), limit=12)
    if not related_words:
        related_words = _clean_list([item.term for item in word_family if item.term], limit=12)

    word_explanation = _text(raw.get("word_explanation") or raw.get("explanation"))
    teaching_notes = _clean_list(raw.get("teaching_notes", []), limit=8)
    usage_notes = _text(raw.get("usage_notes")) or word_explanation
    if not usage_notes and teaching_notes:
        usage_notes = " ".join(teaching_notes[:2]).strip()

    grammar_notes = _text(raw.get("grammar_notes")) or grammar_analysis.summary
    if not grammar_notes and grammar_analysis.notes:
        grammar_notes = " ".join(grammar_analysis.notes[:3]).strip()

    part_of_speech = _text(raw.get("part_of_speech") or "unknown") or "unknown"
    entry_type = _text(raw.get("entry_type") or inferred_type) or inferred_type
    if entry_type not in _VALID_ENTRY_TYPES:
        entry_type = inferred_type

    frequency_score = _derive_frequency_score(raw, cefr_level, base_priority)
    frequency_label = _text(raw.get("frequency_label")) or _derive_frequency_label(frequency_score)
    learning_difficulty = _clamp_float(
        raw.get("learning_difficulty"),
        _estimate_learning_difficulty(cefr_level, entry_type, frequency_score),
    )

    entry = LanguageEntry(
        term=_text(raw.get("term") or clean_term) or clean_term,
        normalized_term=clean_term.lower(),
        language="en",
        entry_type=entry_type,
        translation=translation,
        pronunciation=_text(raw.get("pronunciation")),
        part_of_speech=part_of_speech,
        part_of_speech_explanation=_text(raw.get("part_of_speech_explanation") or raw.get("pos_explanation")),
        cefr_level=cefr_level,
        definitions=definitions,
        meanings=meanings,
        word_explanation=word_explanation,
        grammar_analysis=grammar_analysis,
        examples=examples,
        example_details=example_details,
        synonyms=synonyms,
        synonym_details=synonym_details,
        antonyms=antonyms,
        antonym_details=antonym_details,
        collocations=collocations,
        collocation_details=collocation_details,
        common_phrases=common_phrases,
        phrasal_verbs=phrasal_verbs,
        usage_notes=usage_notes,
        grammar_notes=grammar_notes,
        related_words=related_words,
        word_family=word_family,
        common_mistakes=common_mistakes,
        teaching_notes=teaching_notes,
        learning_difficulty=learning_difficulty,
        priority_score=base_priority,
        frequency_score=frequency_score,
        frequency_label=frequency_label,
        confidence=_estimate_confidence(raw, meanings=meanings, examples=example_details),
        source="groq",
        ai_generated=True,
        cached_at=datetime.utcnow().isoformat(),
    )

    dumped = entry.to_cache_dict()
    dumped["priority_score"] = _estimate_priority(dumped, inferred_type)
    return dumped


def normalize_multisource(word_data: Dict[str, Any], term: str) -> Dict[str, Any]:
    inferred_type = infer_entry_type(term)
    translation = _text(word_data.get("meaning_ar"))
    cefr_level = _normalize_cefr(word_data.get("level"), "B1")

    meanings: List[MeaningItem] = []
    for index, item in enumerate((word_data.get("definitions") or [])[:6], start=1):
        text = _text((item or {}).get("definition"))
        if not text:
            continue
        meanings.append(MeaningItem(
            rank=index,
            arabic=translation if index == 1 else "",
            english_simple=text,
            english_advanced="",
            context=_text((item or {}).get("part_of_speech") or "general") or "general",
            register="neutral",
        ))

    definitions = _definitions_from_meanings(meanings)
    example_details = [
        ExampleItem(english=example, arabic="", difficulty=cefr_level, register="general", focus="")
        for example in _clean_list(word_data.get("examples", []), limit=10)
    ]
    synonym_details = [RelationItem(term=item) for item in _clean_list(word_data.get("synonyms", []), limit=10)]
    antonym_details = [RelationItem(term=item) for item in _clean_list(word_data.get("antonyms", []), limit=10)]
    collocation_details = [CollocationItem(expression=item) for item in _clean_list(word_data.get("collocations") or word_data.get("related_words", []), limit=8)]
    word_family = [WordFamilyItem(term=item) for item in _clean_list(word_data.get("related_words", []), limit=10)]
    grammar_analysis = GrammarAnalysis(
        summary=_text(word_data.get("grammar_notes")),
        base_form=_text(word_data.get("root_form") or term),
        inflected_forms=_clean_string_map(word_data.get("conjugations", {}), limit=12),
    )

    frequency_score = max(1, min(100, int(float(word_data.get("frequency", 0) or 0) or 0))) if word_data.get("frequency") else _derive_frequency_score(word_data, cefr_level, 0.55)
    entry = LanguageEntry(
        term=term,
        normalized_term=term.lower().strip(),
        language="en",
        entry_type=inferred_type,
        translation=translation,
        pronunciation=_text(word_data.get("pronunciation")),
        part_of_speech=_text(word_data.get("part_of_speech") or "unknown") or "unknown",
        part_of_speech_explanation="",
        cefr_level=cefr_level,
        definitions=definitions,
        meanings=meanings,
        word_explanation=" ".join(_clean_list(word_data.get("how_to_use", []), limit=3)).strip(),
        grammar_analysis=grammar_analysis,
        examples=[item.english for item in example_details],
        example_details=example_details,
        synonyms=[item.term for item in synonym_details],
        synonym_details=synonym_details,
        antonyms=[item.term for item in antonym_details],
        antonym_details=antonym_details,
        collocations=[item.expression for item in collocation_details],
        collocation_details=collocation_details,
        common_phrases=[],
        phrasal_verbs=[],
        usage_notes=" ".join(_clean_list(word_data.get("how_to_use", []), limit=2)).strip(),
        grammar_notes=_text(word_data.get("grammar_notes")),
        related_words=_clean_list(word_data.get("related_words", []), limit=10),
        word_family=word_family,
        common_mistakes=[],
        teaching_notes=[],
        learning_difficulty=_clamp_float(word_data.get("difficulty_score"), _estimate_learning_difficulty(cefr_level, inferred_type, frequency_score)),
        priority_score=0.55,
        frequency_score=frequency_score,
        frequency_label=_derive_frequency_label(frequency_score),
        confidence=0.62,
        source="multi_source",
        ai_generated=False,
        cached_at=datetime.utcnow().isoformat(),
    )
    dumped = entry.to_cache_dict()
    dumped["priority_score"] = _estimate_priority(dumped, inferred_type)
    return dumped
