from __future__ import annotations

from datetime import datetime
from typing import List, Literal

from pydantic import BaseModel, Field

CEFRLevel = Literal["A1", "A2", "B1", "B2", "C1", "C2"]
EntryType = Literal["word", "phrase", "expression", "idiom", "sentence"]


class DefinitionItem(BaseModel):
    text: str = ""
    context: str = "general"


class LanguageEntry(BaseModel):
    term: str
    normalized_term: str = ""
    language: str = "en"
    entry_type: EntryType = "word"
    translation: str = ""
    pronunciation: str = ""
    part_of_speech: str = "unknown"
    cefr_level: CEFRLevel = "B1"
    definitions: List[DefinitionItem] = Field(default_factory=list)
    examples: List[str] = Field(default_factory=list)
    synonyms: List[str] = Field(default_factory=list)
    antonyms: List[str] = Field(default_factory=list)
    collocations: List[str] = Field(default_factory=list)
    usage_notes: str = ""
    grammar_notes: str = ""
    related_words: List[str] = Field(default_factory=list)
    learning_difficulty: float = 0.5
    priority_score: float = 0.5
    confidence: float = 0.0
    source: str = "fallback"
    ai_generated: bool = False
    cached_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

    def to_cache_dict(self) -> dict:
        return self.model_dump(mode="json")
