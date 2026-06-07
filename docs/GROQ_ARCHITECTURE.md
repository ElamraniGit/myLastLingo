# LinguaLearn — Groq-First Architecture

## Overview

All linguistic intelligence in LinguaLearn now flows through a single centralised
service: **GroqLanguageService**. This eliminates the previous fragmented approach
that called MyMemory, Free Dictionary API, Datamuse, and Google Translate
independently from multiple places.

---

## Data Flow

```
User taps a word / phrase
         │
         ▼
  Frontend (WordPopup / SelectionToolbar / VocabularyView)
         │  POST /dictionary/lookup
         │  POST /dictionary/lookup/phrase
         ▼
  dictionary.py (API layer)
         │  1. Get user's Groq key from DB
         │  2. Call GroqLanguageService.lookup(term, key)
         ▼
  GroqLanguageService  (ai/groq_language_service.py)
         │
         ├─► Cache hit?  ──YES──► Return instantly (SQLite)
         │
         └─► NO ──► Call Groq API (llama-3.3-70b-versatile)
                         │
                         ├─► Validate & clean response
                         │
                         ├─► Save to ai_language_cache table
                         │
                         └─► Return LanguageEntry
```

---

## Unified Schema — LanguageEntry

Every response from `GroqLanguageService` conforms to this schema:

```json
{
  "term":           "make a decision",
  "language":       "en",
  "translation":    "اتخاذ قرار",
  "pronunciation":  "/meɪk ə dɪˈsɪʒən/",
  "part_of_speech": "phrase",
  "cefr_level":     "B1",
  "definitions": [
    {
      "text":    "to choose between different options after thinking",
      "context": "general"
    }
  ],
  "examples": [
    "She needs to make a decision before Friday.",
    "It was the hardest decision he ever had to make.",
    "They made a joint decision to relocate the office."
  ],
  "synonyms":      ["decide", "choose", "determine", "resolve"],
  "antonyms":      ["hesitate", "procrastinate"],
  "collocations":  ["make a final decision", "make a quick decision", "make an informed decision"],
  "usage_notes":   "Always use 'make' not 'do' with decision. Say 'make a decision', never 'do a decision'.",
  "grammar_notes": "Verb phrase: make (base) + a/an + adjective (optional) + decision",
  "related_words": ["choice", "conclusion", "judgment", "verdict"],
  "confidence":    0.97,
  "ai_generated":  true,
  "cached_at":     "2025-06-07T10:30:00"
}
```

---

## Components

### `ai/groq_language_service.py`

The central intelligence service.

```python
from ai.groq_language_service import get_service

svc   = get_service()
entry = await svc.lookup("serendipity", groq_key)
entry = await svc.lookup_phrase("break a leg", groq_key)
```

**Methods:**
- `lookup(term, groq_key, force_refresh)` — main entry point
- `lookup_phrase(phrase, groq_key)` — alias for multi-word inputs
- `get_cached(term)` — read from cache only, never calls Groq
- `invalidate(term)` — remove from cache
- `ensure_table()` — create DB table (called at startup)

**Caching:** `ai_language_cache` SQLite table:
```sql
CREATE TABLE ai_language_cache (
    cache_key    TEXT PRIMARY KEY,   -- SHA256 of term
    term         TEXT NOT NULL,
    data_json    TEXT NOT NULL,      -- full LanguageEntry JSON
    groq_used    INTEGER DEFAULT 0,  -- 1 = came from Groq
    lookup_count INTEGER DEFAULT 0,  -- for popularity sorting
    created_at   TEXT,
    updated_at   TEXT
);
```

### `backend/app/api/dictionary.py`

API layer — routes → GroqLanguageService.

**Endpoints:**
```
POST /dictionary/lookup          — word or phrase lookup
POST /dictionary/lookup/phrase   — explicit phrase lookup
POST /dictionary/refresh/{term}  — force Groq re-fetch
GET  /dictionary/search          — search cached terms
GET  /dictionary/suggest         — auto-complete prefix
GET  /dictionary/level/{word}    — CEFR level only
```

**Legacy compatibility:** `_to_legacy()` maps LanguageEntry → old field names
so existing UI components (WordPopup, VocabularyView, etc.) work unchanged.

---

## Fallback Strategy

```
User has Groq key?
    YES → GroqLanguageService.lookup() → Groq API
    NO  → GroqLanguageService.lookup() → cache only
         → if cache miss → _fallback_lookup()
              → Free Dictionary + Datamuse + Google Translate (parallel)
              → maps result to LanguageEntry format
              → saves to ai_language_cache for future hits
```

### Offline behaviour
1. Request comes in (no internet)
2. `GroqLanguageService.lookup()` → cache hit → instant return
3. Cache miss → returns `_empty_entry()` (structural scaffold with no data)
4. UI shows "definition not available offline" gracefully

---

## What Was Removed

| Old component | Status | Replacement |
|---------------|--------|-------------|
| `SelectionToolbar` MyMemory fetch | **Removed** | Backend `/dictionary/lookup/phrase` |
| `SelectionToolbar` Free Dictionary fetch | **Removed** | Backend `/dictionary/lookup/phrase` |
| `ai_enricher.py` as primary path | **Demoted** | GroqLanguageService (unified schema) |
| Scattered `fetch()` to external APIs | **Removed** | All go through backend |

### Kept (as fallback)
- `ai/dictionary/service.py` — still used when user has no Groq key
- `ai/dictionary/level_estimator.py` — local CEFR estimation
- `ai/dictionary/ai_enricher.py` — kept for `/dictionary/enrich` endpoint

---

## Adding a New AI Provider

To add a second provider (e.g. OpenAI, Anthropic):

1. Create `ai/openai_language_provider.py` implementing:
   ```python
   async def call(term: str, api_key: str) -> Optional[Dict]
   ```
   The returned dict must match `LanguageEntry` schema.

2. In `GroqLanguageService._call_groq()`, add provider selection:
   ```python
   if provider == "openai":
       return await openai_provider.call(term, api_key)
   ```

3. Add `ai_provider` field to users table and Settings UI.

The caching layer, schema validation, and API endpoints remain unchanged.

---

## Environment

- **Model:** `llama-3.3-70b-versatile` (best free Groq tier)
- **Temperature:** `0.2` (factual, low creativity)
- **Max tokens:** `800`
- **Response format:** `json_object` (guaranteed valid JSON)
- **Timeout:** 30 seconds
- **Cache TTL:** indefinite (manual refresh via `/dictionary/refresh/{term}`)
