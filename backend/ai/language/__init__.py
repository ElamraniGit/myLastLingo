"""Unified language AI architecture for LinguaLearn.

Layers:
- models.py      → canonical language entry schema
- prompts.py     → provider prompts
- normalizer.py  → validation + normalization
- cache.py       → SQLite cache access
- service.py     → orchestration / provider fallback
"""

from .models import LanguageEntry
from .service import LanguageAIService, get_service, init_service

__all__ = ["LanguageEntry", "LanguageAIService", "get_service", "init_service"]
