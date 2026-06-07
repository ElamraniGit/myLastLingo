"""Backward-compatible wrapper for the unified language AI architecture.

Historically the application imported `ai.groq_language_service`. The actual
implementation now lives in `ai.language.*` so the AI stack is separated into:
- prompt layer
- normalization layer
- cache layer
- orchestration/service layer
"""

from ai.language.normalizer import cache_key as _cache_key
from ai.language.normalizer import empty_entry as _empty_entry
from ai.language.normalizer import normalize_ai_response as _validate_and_clean
from ai.language.service import LanguageAIService as GroqLanguageService
from ai.language.service import get_service, init_service

__all__ = [
    "GroqLanguageService",
    "get_service",
    "init_service",
    "_cache_key",
    "_empty_entry",
    "_validate_and_clean",
]
