# LinguaLearn — Architecture

This document describes the high-level architecture, the request/data flow, and
the key design decisions behind LinguaLearn. For setup see
[DEVELOPMENT.md](DEVELOPMENT.md); for an agent-oriented map see
[AI_AGENT_GUIDE.md](AI_AGENT_GUIDE.md).

---

## 1. What the app is

LinguaLearn is a **local-first English-learning PWA**. A user pastes a YouTube
URL (or text), the app shows synchronized subtitles, lets them tap any word for a
dictionary lookup + translation + pronunciation, saves words to a personal
vocabulary, and schedules reviews with an SM-2 spaced-repetition algorithm. It is
designed to run entirely on an Android phone via **Termux**.

> ⚠️ **"Local-first", not "fully offline".** User data (accounts, saved words,
> progress, review history) lives only in a local SQLite file. But several
> features call external services at runtime: YouTube (playback + captions via
> `yt-dlp`), `api.dictionaryapi.dev` (definitions), `api.mymemory.translated.net`
> (Arabic translation), Microsoft Edge TTS (neural voices), and Groq
> (AI chat). See the connectivity table in [README.md](README.md).

---

## 2. Component diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                          Browser (PWA)                            │
│  Next.js 14 (Pages Router) · React 18 · Zustand · Tailwind        │
│                                                                    │
│   pages/_app.tsx ── renders one of ──► views/*.tsx                │
│        │  (routing is state-based, not URL-based)                  │
│        ├── store/appStore.ts  (single Zustand store, persisted)   │
│        ├── hooks/  (useAuth, useDictionary, useVideoPlayer)       │
│        └── lib/api.ts  (typed fetch client, injects Bearer token) │
└───────────────────────────────┬──────────────────────────────────┘
                                 │ HTTP /api/v1/*  (JSON, Bearer JWT)
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Backend — FastAPI (uvicorn)                   │
│  backend/main.py  (lifespan, CORS, security headers, DI)          │
│                                                                    │
│   app/api/*.py   one router per domain (auth, videos, …)          │
│        │  every router gets db injected via init_api(db)          │
│        ├── app/db/database.py     DatabaseManager (aiosqlite)      │
│        ├── app/services/cache.py  on-disk cache manager           │
│        ├── ai/dictionary/         definitions + CEFR estimator     │
│        └── ai/whisper/            optional local STT (faster-whisper) │
└───────────┬───────────────────────────────┬──────────────────────┘
            │                                │
            ▼                                ▼
   data/lingualearn.db (SQLite/WAL)    External services
   data/ (cache, tts_cache, temp)      YouTube/yt-dlp, dictionaryapi.dev,
                                       MyMemory, Edge-TTS, Groq
```

---

## 3. Backend architecture

- **Framework:** FastAPI, served by a **single uvicorn worker** (`run.py` or
  `backend/main.py`). The single-worker assumption is intentional and is baked
  into a few places (see §6).
- **Startup (`backend/main.py` `lifespan`):**
  1. Load config (`config/settings.py` → `settings.yaml` + env overrides).
  2. Open/initialize the database and run **additive migrations**.
  3. Create the `users` table (`auth.create_auth_tables`).
  4. Initialize the cache manager and ensure runtime directories exist.
  5. **Dependency injection:** call `init_api(db_manager)` on every router module
     so each one shares the same `DatabaseManager` instance.
- **Routing:** `app/api/__init__.py` mounts each domain router under
  `/api/v1/<prefix>` (see [docs/API.md](docs/API.md)).
- **Auth:** custom, dependency-free **JWT-like token** (HMAC-SHA256) — see §5.
- **Middleware:** locked-down CORS (localhost origins only) + a security-headers
  middleware (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, `Cache-Control: no-store` on `/api`).
- **Errors:** a global exception handler logs the real error server-side and
  returns a generic `{"detail": "Internal server error"}` (no internals leak).

### Database layer

`app/db/database.py` exposes a single `DatabaseManager` using **`aiosqlite`**
(true async I/O). Key conventions:

- `get_connection()` is an async context manager yielding a short-lived
  connection (WAL mode, foreign keys on), committing on success / rolling back on
  error.
- **Schema lives in `_create_tables()`**; **changes live in `_run_migrations()`**
  as idempotent `ALTER TABLE … ADD COLUMN` guarded by `PRAGMA table_info`. This
  is how the DB evolves without destroying user data.
- ⚠️ **Ordering rule:** any index/constraint that references a migration-added
  column (e.g. `user_id`) **must** be created in `_run_migrations()` *after* the
  column is added — never in `_create_tables()`. Violating this re-introduces the
  historical "no such column: user_id" boot crash.

---

## 4. Frontend architecture

- **Next.js Pages Router**, but **routing is state-driven**: `pages/index.tsx`
  is a loader; `pages/_app.tsx` reads `currentPage` from the Zustand store and
  renders the matching component from `src/views/`. There is intentionally no
  per-screen URL.
- **State:** one Zustand store (`src/store/appStore.ts`), persisted to
  `localStorage` (`partialize` whitelists what is saved). The auth token is
  stored separately under `ll_token`.
- **Hooks** encapsulate side-effects:
  - `useAuth` — login/register/logout.
  - `useDictionary` — lookups, saved-word CRUD, review actions, stats.
  - `useVideoPlayer` — the most complex hook: owns a **module-level shared
    ReactPlayer ref** so the player and the transcript viewer control the same
    instance; runs the high-frequency sync loop and transcript polling.
- **API client** (`src/lib/api.ts`): a thin typed `fetch` wrapper that injects
  the Bearer token, applies timeouts, and centralizes 401 handling (clears the
  token and dispatches a `ll:unauthorized` event that `_app.tsx` listens for).
- **Styling:** Tailwind with CSS-variable color tokens (`bg-card`, `text-heading`,
  …) defined in `globals.css` + `tailwind.config.js`, enabling the dark/light/auto
  theme.
- **PWA:** `public/manifest.json` + `public/sw.js` (network-first for API,
  cache-first for static assets; deliberately no `skipWaiting`/`clients.claim` to
  avoid reload loops).

---

## 5. Authentication & sessions

- **Password hashing:** PBKDF2-HMAC-SHA256, 260k iterations, random 16-byte salt,
  constant-time compare. (Chosen over bcrypt because it needs no native build on
  Termux.)
- **Token:** a self-signed JWT-like string `base64(header).base64(payload).HMAC`.
  Payload carries `sub` (user id), `username`, `tv` (token version), `exp`, `iat`.
  The signing secret is generated once and stored in `data/.secret_key`.
- **Revocation:** each user row has a `token_version`. A token is only accepted if
  its `tv` matches the DB. **Logout and password-change increment
  `token_version`**, instantly invalidating all existing tokens for that user.
- **Rate limiting:** in-memory, per-identifier throttle on `/auth/login`
  (8 failures / 5 min → HTTP 429). In-memory ⇒ single-worker only (see §6).

---

## 6. Key design decisions & constraints

| Decision | Why | Consequence |
|---|---|---|
| **Single uvicorn worker** | Termux is resource-limited; keeps things simple | In-memory login rate-limiter and the WebSocket registry are process-local. Do **not** scale to multiple workers without moving these to shared storage (e.g. Redis). |
| **SQLite + aiosqlite** | Zero-config local DB, async I/O | Fine for one user/device. The shared global `words` table is a cross-user dictionary cache. |
| **Additive migrations in code** | No migration tool needed on-device | Never rename/drop columns; only add. `update.sh` backs up the DB and never deletes it. |
| **Dev mode on Termux** | Next.js has **no native SWC binary for android/arm64**, so `next build` (production) cannot complete there | The repo ships `frontend/.babelrc` (Babel compile, no SWC) and `scripts/start_all.sh` **defaults to `next dev`**. Use `--prod` only where a full build works (desktop/CI). |
| **Custom JWT (no library)** | Avoid heavy/native deps on Termux | We own token format + revocation logic; keep it simple and tested. |
| **Per-user Groq key** | Multi-user safety | Stored in `users.groq_api_key`; never a shared global. |
| **Transcript status state machine** | Whisper runs as a background task | `transcripts.status ∈ {processing, ready, error}` lets the client poll real progress instead of guessing from 404s. |

---

## 7. Primary data flows

**Add a video & get subtitles**
1. `POST /videos/process` → `yt-dlp --dump-json` fetches metadata → row in `videos`.
2. `POST /transcripts/extract/{video_id}` → tries YouTube captions (VTT, no ffmpeg).
3. If captions fail → mark transcript `processing`, queue a background Whisper job
   (audio-only download → `faster-whisper`), then `ready` or `error`.
4. Frontend polls `GET /transcripts/{id}/status` until `ready`/`error`.

**Look up & save a word**
1. Tap a word → `POST /dictionary/lookup` (DB cache → dictionaryapi.dev → MyMemory
   → heuristic fallback; CEFR level via `ai/dictionary/level_estimator.py`).
2. `POST /vocabulary/save` stores it in `saved_words` for the current user.

**Review (spaced repetition)**
1. `GET /vocabulary/due` returns due cards.
2. `POST /vocabulary/review {quality 0-5}` runs the SM-2 update in
   `DatabaseManager.update_review` (ease, interval, repetitions, lapses,
   `next_review`) and logs to `word_reviews`.

See [docs/DATABASE.md](docs/DATABASE.md) for the full schema and
[docs/API.md](docs/API.md) for every endpoint.
