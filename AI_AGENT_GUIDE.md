# AI Agent Guide — LinguaLearn

This file orients an AI coding agent (or a new human) quickly and safely. Read it
before editing. Companion docs: [ARCHITECTURE.md](ARCHITECTURE.md),
[DEVELOPMENT.md](DEVELOPMENT.md), [docs/API.md](docs/API.md),
[docs/DATABASE.md](docs/DATABASE.md), [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

---

## TL;DR for agents

- **Stack:** FastAPI (Python, single uvicorn worker) + Next.js 14 Pages Router
  (React, Zustand, Tailwind) + SQLite (`aiosqlite`). Local-first, Termux-targeted.
- **Run:** `bash scripts/start_all.sh` (defaults to dev mode). Backend `:8080`,
  frontend `:3000`.
- **Test:** `pytest -q` (30 tests, must stay green). No frontend tests yet.
- **Verify before committing:** `pytest -q` **and** `cd frontend && npx next dev`
  reaches `✓ Ready` (don't rely on `next build` — it can't finish on arm64).

---

## Golden rules (do not violate)

1. **Migrations are additive.** Add columns only via idempotent
   `ALTER TABLE … ADD COLUMN` in `DatabaseManager._run_migrations()` (or
   `create_auth_tables` for `users`). Never rename/drop. Indexes on
   migration-added columns go in `_run_migrations()` *after* the column — putting
   them in `_create_tables()` re-breaks fresh installs ("no such column: user_id").
2. **Never delete the user's database.** `data/` is gitignored and sacred.
   `update.sh` backs it up and must never `rm` it.
3. **Every endpoint is `Depends(get_current_user)`** unless it is intentionally
   public (only the 4 `/dictionary/*` reads are public). Scope all queries by
   `user_id`; for single-row mutations verify ownership (see
   `_assert_owns_saved_word`).
4. **Single worker assumption.** The login rate-limiter and WebSocket registry are
   in-memory. Don't add multi-worker behavior without moving that state out.
5. **Don't leak internals.** The global 500 handler returns a generic message;
   keep it that way.
6. **Termux build constraint.** Keep `frontend/.babelrc`; keep `start_all.sh`
   defaulting to dev mode. Do not "fix" things by forcing `next build` on ARM.
7. **Secrets never committed.** `data/.secret_key`, `data/.groq_key`, `.env` are
   gitignored. Per-user Groq keys live in the DB, never a shared global.

---

## Repository map

### Backend (`backend/`)
| Path | Responsibility |
|---|---|
| `main.py` | App factory, lifespan (config→DB→migrations→DI), CORS, security headers, 500 handler |
| `app/api/__init__.py` | Mounts every router under `/api/v1/<prefix>` |
| `app/api/auth.py` | Register/login/logout, PBKDF2 hashing, custom JWT, **token-version revocation**, login rate-limit, `users` table |
| `app/api/videos.py` | yt-dlp metadata, video CRUD (owner-scoped) |
| `app/api/transcripts.py` | YouTube VTT captions, Whisper fallback, **status state machine**, VTT parser |
| `app/api/dictionary.py` | Word lookup (public), search/suggest/level |
| `app/api/vocabulary.py` | Saved words, SM-2 review, stats, **export/import**, IDOR guard |
| `app/api/player.py` | Playback state (user-scoped), file streaming (path-traversal-safe), WS sync |
| `app/api/library.py` | Unified videos + text sources |
| `app/api/chat.py` | Groq AI chat with per-user key + vocab context |
| `app/api/xp.py` | XP, levels, streaks, **daily goal** |
| `app/api/tts.py` | Edge-TTS neural audio with disk cache |
| `app/db/database.py` | `DatabaseManager`: schema, migrations, all queries, SM-2 logic |
| `app/services/cache.py` | On-disk cache manager |
| `app/utils/logger.py` | Logging setup |
| `ai/dictionary/service.py` | Definitions (dictionaryapi.dev) + Arabic (MyMemory) + CEFR |
| `ai/dictionary/level_estimator.py` | CEFR estimator with graded word lists |
| `ai/whisper/service.py` | Optional local STT (`faster-whisper`) |
| `tests/` | pytest suite (auth, IDOR, SM-2, migrations, CEFR, transcript status, export/import) |

### Frontend (`frontend/src/`)
| Path | Responsibility |
|---|---|
| `pages/_app.tsx` | App shell; **state-based routing** via `currentPage`; theme; session restore; 401 listener |
| `pages/index.tsx` | Loading splash (real UI is rendered by `_app.tsx`) |
| `store/appStore.ts` | Single Zustand store (persisted subset) |
| `lib/api.ts` | Typed fetch client; Bearer injection; central 401 → `ll:unauthorized` |
| `lib/tts.ts` | TTS playback (server Edge-TTS → browser fallback) |
| `hooks/useAuth.ts` | login/register/logout |
| `hooks/useDictionary.ts` | lookups + saved-word/review/stats actions |
| `hooks/useVideoPlayer.ts` | Shared player ref, sync loop, transcript status polling |
| `views/*.tsx` | Screens: Player, Library, Vocabulary, Flashcards, Chat, TextReader, Profile |
| `components/` | `auth/`, `common/` (Layout, XPBar, InstallPrompt), `player/`, `transcript/`, `dictionary/`, `ui/` (Button, Input, Badge) |
| `types/index.ts` | Shared TypeScript types |
| `styles/globals.css` | Tailwind layer + CSS-variable theme tokens |

---

## How to make common changes

- **New endpoint:** add to the right `app/api/*.py` router → it's auto-mounted →
  add `Depends(get_current_user)` → scope by `user_id` → add a test → update
  `docs/API.md`.
- **New DB column:** add to `_run_migrations()` (idempotent) → update
  `docs/DATABASE.md`. If you also add it to `_create_tables()` for fresh DBs, keep
  any new index in `_run_migrations()`.
- **New screen:** `views/NewView.tsx` → add a `case` in `_app.tsx`'s `Page()` →
  add nav entry in `components/common/Layout.tsx` → add API methods in `lib/api.ts`.
- **New dependency:** justify it. The repo deliberately keeps deps minimal (unused
  libraries were removed). Prefer the standard lib / existing deps. Heavy or
  native-binary deps may break Termux.

---

## Verification checklist before you finish

- [ ] `pytest -q` → all pass.
- [ ] `cd frontend && npx next dev` → `✓ Ready`, no SWC error, target page 200.
- [ ] New endpoints are auth-protected and `user_id`-scoped (or justified public).
- [ ] Schema changes are additive + documented in `docs/DATABASE.md`.
- [ ] No secrets, no `data/` deletions, no multi-worker-only assumptions.
- [ ] Relevant docs updated (`docs/API.md`, this file, `ARCHITECTURE.md`).

---

## Known gaps / good next tasks
(see full roadmap in `docs/history/AUDIT_2026-06-02.md`)

- Frontend tests (Vitest + RTL) — none exist yet.
- TS `strict` is off and lint is skipped in build — re-enable incrementally.
- `useVideoPlayer` sync loop runs ~25×/s — throttle for battery.
- Productive-recall quiz modes (typing/cloze/dictation) — highest learning value.
- Per-request DB connection pooling; bump Next.js to a patched 14.2.x.
