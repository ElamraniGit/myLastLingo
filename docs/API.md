# LinguaLearn — REST API Reference

- **Base URL:** `http://127.0.0.1:8080/api/v1`
- **Auth:** send `Authorization: Bearer <token>` on protected endpoints. Tokens
  come from `/auth/register` or `/auth/login`. A 401 means missing/invalid/revoked
  token — the web client clears it and returns to login automatically.
- **Interactive docs:** FastAPI serves Swagger UI at `/docs` and ReDoc at `/redoc`.
- **Health:** `GET /health` (no `/api/v1` prefix) → `{"status":"healthy", ...}`.

Legend: 🔓 public · 🔒 requires Bearer token.

---

## Auth — `/auth`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | 🔓 | Create account → `{token, user}`. `username` ≥3, `password` ≥6, email optional. |
| POST | `/auth/login` | 🔓 | `{username|email, password, remember}` → `{token, user}`. Rate-limited (8 fails/5min → 429). |
| GET | `/auth/me` | 🔒 | Current user profile. |
| PATCH | `/auth/me` | 🔒 | Update `display_name`/`email`/password. Password change **revokes all tokens**. |
| POST | `/auth/refresh` | 🔒 | Issue a fresh token (same token version). |
| POST | `/auth/logout` | 🔒 | **Revokes all tokens** for the user (bumps `token_version`). |

## Videos — `/videos`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/videos/process` | 🔒 | `{url, quality?}` → fetch metadata via yt-dlp, store, return video. |
| GET | `/videos/list?page&limit` | 🔒 | Paginated list of the user's videos. |
| GET | `/videos/{video_id}` | 🔒 | Video details (owner-scoped). |
| DELETE | `/videos/{video_id}` | 🔒 | Delete video + its transcripts/sessions. |

## Transcripts — `/transcripts`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/transcripts/extract/{video_id}?language=en` | 🔒 | Get captions (VTT) or queue Whisper. Returns transcript or `{status:"processing"}`. |
| GET | `/transcripts/{video_id}/status?language=en` | 🔒 | `{status: idle|processing|ready|error, error, segment_count}`. Poll this. |
| GET | `/transcripts/{video_id}?language=en` | 🔒 | Full transcript (404 if not ready). |
| GET | `/transcripts/{video_id}/segments?...` | 🔒 | Segments, optionally filtered by `start_time`/`end_time`. |

## Dictionary — `/dictionary`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/dictionary/lookup` | 🔓 | `{word}` → cached entry or fetch (dictionaryapi.dev + MyMemory) + CEFR level. |
| GET | `/dictionary/search?query&limit` | 🔓 | Prefix search over cached words. |
| GET | `/dictionary/suggest?prefix&limit` | 🔓 | Autocomplete suggestions. |
| GET | `/dictionary/level/{word}` | 🔓 | CEFR level estimate. |

> Dictionary endpoints are intentionally public (linguistic reference data only,
> no user data).

## Vocabulary — `/vocabulary`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/vocabulary/save` | 🔒 | `{word, video_id?, sentence?, context?}` → save to user's list. |
| GET | `/vocabulary/list?status&page&limit&search&level&video_id&due_only&tag&favorite_only&sort` | 🔒 | Rich filtered list. |
| GET | `/vocabulary/filters` | 🔒 | Available levels / source videos / tags. |
| PATCH | `/vocabulary/{saved_id}` | 🔒 | Update `tags`/`notes`/`favorite` (ownership-checked). |
| POST | `/vocabulary/review` | 🔒 | `{saved_word_id, quality 0-5}` → SM-2 update (ownership-checked). |
| GET | `/vocabulary/due?limit` | 🔒 | Cards due for review + summary. |
| GET | `/vocabulary/review/summary` | 🔒 | Counts by status / due. |
| GET | `/vocabulary/review/history/{saved_word_id}` | 🔒 | Per-word review history (ownership-checked). |
| GET | `/vocabulary/stats` | 🔒 | Aggregate stats (levels, hardest words, upcoming reviews, tags). |
| DELETE | `/vocabulary/{saved_id}` | 🔒 | Remove a saved word (ownership-checked). |
| GET | `/vocabulary/export?format=csv\|json` | 🔒 | Download vocabulary (Anki-friendly). |
| POST | `/vocabulary/import` | 🔒 | `{words:[{word,sentence?,context?}]}` (≤500) → `{added,skipped,failed}`. |

## Player — `/player`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/player/state` | 🔒 | Save playback state (scoped by video+user). |
| GET | `/player/state/{video_id}` | 🔒 | Get saved state. |
| GET | `/player/stream/{video_id}` | 🔒 | Local-file vs YouTube source info (path-traversal-safe). |
| GET | `/player/file/{video_id}` | 🔒 | Serve a downloaded MP4 (if present). |
| WS | `/player/ws/{video_id}?token=<jwt>` | 🔒 | Real-time sync. Token passed as query param; verified before accept. |

## Library — `/library`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/library/sources?page&limit` | 🔒 | Unified list of videos + text sources. |
| POST | `/library/text` | 🔒 | `{title, content, source_type}` add reading text. |
| GET | `/library/text/{source_id}` | 🔒 | Full text content (owner-scoped). |
| DELETE | `/library/source/{source_id}` | 🔒 | Delete a video or text source (owner-scoped). |

## Chat (AI) — `/chat`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/chat/message` | 🔒 | `{message, conversation_id?}` → Groq reply using the user's vocab context. Needs a per-user key. |
| POST | `/chat/set-key` | 🔒 | Save the user's own Groq API key. |
| GET | `/chat/has-key` | 🔒 | Whether the user has a key configured. |
| GET | `/chat/history?conversation_id?` | 🔒 | Conversation history. |
| DELETE | `/chat/history` | 🔒 | Clear all history for the user. |

## XP — `/xp`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/xp/add` | 🔒 | `{action, amount?}` → award XP, update streak/daily goal. |
| GET | `/xp/status` | 🔒 | `{total_xp, level, streak_days, daily_xp, daily_goal, daily_goal_met, ...}`. |

## TTS — `/tts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/tts/voices` | 🔒 | Curated neural voice list. |
| GET | `/tts?text=&voice=&rate=` | 🔒 | MP3 audio (Edge-TTS), cached on disk by hash. Browser SpeechSynthesis is the client-side fallback. |

---

## Conventions

- All bodies are JSON; all responses are JSON except `/tts` (audio/mpeg) and
  `/vocabulary/export` (text/csv or application/json file download).
- Errors: `{ "detail": "<message>" }` with an appropriate HTTP status
  (400 validation, 401 auth, 403 ownership, 404 missing, 409 conflict,
  429 rate-limited, 5xx server).
- Pagination: `?page=<1-based>&limit=<n>`; list responses include
  `{ total, page, limit, pages }`.
