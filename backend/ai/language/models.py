from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal

from pydantic import BaseModel, ConfigDict, Field

CEFRLevel = Literal["A1", "A2", "B1", "B2", "C1", "C2"]
EntryType = Literal["word", "phrase", "expression", "idiom", "sentence"]


class DefinitionItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    text: str = ""
    context: str = "general"
    arabic: str = ""
    english_advanced: str = ""
    usage_register: str = Field(default="neutral", alias="register", serialization_alias="register")
    order: int = 1


class MeaningItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    rank: int = 1
    arabic: str = ""
    english_simple: str = ""
    english_advanced: str = ""
    context: str = "general"
    usage_register: str = Field(default="neutral", alias="register", serialization_alias="register")


class RelationItem(BaseModel):
    term: str = ""
    short_definition: str = ""
    commonness: str = ""


class ExampleItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    english: str = ""
    arabic: str = ""
    difficulty: CEFRLevel = "B1"
    usage_register: str = Field(default="general", alias="register", serialization_alias="register")
    focus: str = ""


class PhraseItem(BaseModel):
    expression: str = ""
    meaning: str = ""
    translation: str = ""
    example: str = ""


class PhrasalVerbItem(BaseModel):
    phrasal_verb: str = ""
    meaning: str = ""
    translation: str = ""
    example: str = ""


class CollocationItem(BaseModel):
    expression: str = ""
    pattern: str = ""
    meaning: str = ""
    translation: str = ""


class WordFamilyItem(BaseModel):
    term: str = ""
    part_of_speech: str = ""
    meaning: str = ""


class MistakeItem(BaseModel):
    mistake: str = ""
    correction: str = ""
    explanation: str = ""


class GrammarAnalysis(BaseModel):
    summary: str = ""
    base_form: str = ""
    form_type: str = ""
    tense: str = ""
    aspect: str = ""
    voice: str = ""
    sentence_type: str = ""
    subject: str = ""
    verb: str = ""
    object: str = ""
    number: str = ""
    comparison_type: str = ""
    irregularity: str = ""
    used_with: List[str] = Field(default_factory=list)
    notes: List[str] = Field(default_factory=list)
    inflected_forms: Dict[str, str] = Field(default_factory=dict)
    breakdown: List[Dict[str, str]] = Field(default_factory=list)


class LanguageEntry(BaseModel):
    term: str
    normalized_term: str = ""
    language: str = "en"
    entry_type: EntryType = "word"
    translation: str = ""
    pronunciation: str = ""
    part_of_speech: str = "unknown"
    part_of_speech_explanation: str = ""
    cefr_level: CEFRLevel = "B1"
    definitions: List[DefinitionItem] = Field(default_factory=list)
    meanings: List[MeaningItem] = Field(default_factory=list)
    word_explanation: str = ""
    grammar_analysis: GrammarAnalysis = Field(default_factory=GrammarAnalysis)
    examples: List[str] = Field(default_factory=list)
    example_details: List[ExampleItem] = Field(default_factory=list)
    synonyms: List[str] = Field(default_factory=list)
    synonym_details: List[RelationItem] = Field(default_factory=list)
    antonyms: List[str] = Field(default_factory=list)
    antonym_details: List[RelationItem] = Field(default_factory=list)
    collocations: List[str] = Field(default_factory=list)
    collocation_details: List[CollocationItem] = Field(default_factory=list)
    common_phrases: List[PhraseItem] = Field(default_factory=list)
    phrasal_verbs: List[PhrasalVerbItem] = Field(default_factory=list)
    usage_notes: str = ""
    grammar_notes: str = ""
    related_words: List[str] = Field(default_factory=list)
    word_family: List[WordFamilyItem] = Field(default_factory=list)
    common_mistakes: List[MistakeItem] = Field(default_factory=list)
    teaching_notes: List[str] = Field(default_factory=list)
    learning_difficulty: float = 0.5
    priority_score: float = 0.5
    frequency_score: int = 50
    frequency_label: str = "Common"
    confidence: float = 0.0
    source: str = "fallback"
    ai_generated: bool = False
    cached_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

    def to_cache_dict(self) -> dict:
        return self.model_dump(mode="json", by_alias=True)
