# LinguaLearn — Development Guide

How to set up, run, test, and build the project. For architecture see
[ARCHITECTURE.md](ARCHITECTURE.md); for an AI-agent map see
[AI_AGENT_GUIDE.md](AI_AGENT_GUIDE.md).

---

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Python | 3.11+ (3.13 OK) | Backend |
| Node.js | 18 or 20 LTS | Frontend |
| npm | 9+ | Frontend |
| ffmpeg | any | Optional — only for Whisper audio conversion |
| yt-dlp | latest | Installed via `requirements.txt`; **keep updated** |

Target runtime is **Termux on Android (arm64)**, but the project runs the same on
Linux/macOS for development.

---

## 2. First-time setup

```bash
git clone https://github.com/ElamraniGit/myLastLingo.git
cd myLastLingo

# Backend deps (runtime)
pip install -r requirements.txt
# Backend deps (tests/dev)
pip install -r requirements-dev.txt

# Frontend deps
cd frontend && npm install && cd ..

# Optional: copy env template
cp .env.example .env            # backend env (optional)
# For LAN/phone access also create frontend/.env.local with NEXT_PUBLIC_API_URL
```

Optional offline speech-to-text (large download): `pip install faster-whisper numpy`.

---

## 3. Running

### One command (recommended)
```bash
bash scripts/start_all.sh          # dev mode (default) — works on Termux/ARM
bash scripts/start_all.sh --prod   # production build + start (desktop/CI only)
```
Open **http://127.0.0.1:3000**. Backend is on **http://127.0.0.1:8080**.

### Manual (two terminals)
```bash
# Terminal 1 — backend
python3 run.py                     # or: uvicorn backend.main:app --port 8080

# Terminal 2 — frontend (dev)
cd frontend && npm run dev
```

> **Termux / Android note:** Next.js has **no native SWC binary for android/arm64**,
> so `next build` (production) cannot finish there. The repo ships
> `frontend/.babelrc` (Babel-based compile, no SWC) and **defaults to dev mode**.
> Do **not** run `npm run build`/`npm run start` on Termux — use dev mode.

---

## 4. Testing

Backend tests use **pytest** against the real app with a throwaway SQLite DB.

```bash
pytest -q                  # run all (30 tests)
pytest backend/tests/test_auth.py -q
pytest -k "idor or sm2"    # filter by name
```

Coverage areas: auth + token revocation, vocabulary IDOR/isolation, SM-2
scheduling math, DB fresh-init + migration idempotency, CEFR estimation,
transcript status state machine, vocabulary export/import.

There are currently **no frontend tests** — adding Vitest + React Testing Library
for `useVideoPlayer` and the Flashcards flow is a known gap (see roadmap in
[docs/history/AUDIT_2026-06-02.md](docs/history/AUDIT_2026-06-02.md)).

---

## 5. Build & deploy

- **Local/Termux:** there is no "deploy" — `scripts/start_all.sh` runs both
  services on the device. `update.sh` pulls latest, backs up the DB, rebuilds, and
  restarts.
- **Production build (non-ARM):** `cd frontend && npm run build && npm run start`.
- **CI:** `.github/workflows/ci.yml` runs backend pytest and a frontend
  `npm ci && npm run build` + `npm audit` on every push/PR.

---

## 6. Configuration

Settings load order (later overrides earlier): defaults in
`config/settings.py` → `config/settings.yaml` → environment variables.

| Env var | Default | Purpose |
|---|---|---|
| `LINGUALEARN_HOST` | `127.0.0.1` | Backend bind host |
| `LINGUALEARN_PORT` | `8080` | Backend port |
| `LINGUALEARN_DB_PATH` | `data/lingualearn.db` | SQLite path |
| `LINGUALEARN_LOG_LEVEL` | `INFO` | Logging |
| `LINGUALEARN_DEBUG` | `false` | Debug flag |
| `LINGUALEARN_WHISPER_MODEL` | `base` | Whisper size |
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8080/api/v1` | Frontend → backend base (set in `frontend/.env.local`) |

For LAN/phone access: set `NEXT_PUBLIC_API_URL` to your machine IP **and** add that
origin to `_ALLOWED_ORIGINS` in `backend/main.py` (CORS is locked to localhost).

Secrets (auto-managed, gitignored): `data/.secret_key` (JWT signing). The Groq AI
key is entered in-app and stored per-user in the DB.

---

## 7. Project layout (top level)

```
backend/      FastAPI app, DB, AI services, tests
frontend/     Next.js PWA (src/, public/)
config/       settings loader + YAML
scripts/      install/start helpers (Termux-oriented)
docs/         API.md, DATABASE.md, history/ (past audits)
run.py        backend entry point (port cleanup + uvicorn)
update.sh     pull + backup DB + rebuild + restart
```

See [AI_AGENT_GUIDE.md](AI_AGENT_GUIDE.md) for a file-by-file map.

---

## 8. Common tasks

- **Add an API endpoint:** create/extend a router in `backend/app/api/`, ensure
  it's mounted in `app/api/__init__.py`, protect it with
  `Depends(get_current_user)` unless it's intentionally public, scope queries by
  `user_id`, and add a pytest. Document it in `docs/API.md`.
- **Change the schema:** add an idempotent `ALTER TABLE … ADD COLUMN` in
  `_run_migrations()` (never edit existing columns); update `docs/DATABASE.md`.
- **Add a frontend screen:** add a `views/*.tsx`, a `currentPage` case in
  `pages/_app.tsx`, and a nav entry in `components/common/Layout.tsx`.
- **Add an API call:** extend the typed client in `frontend/src/lib/api.ts`.

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) when something breaks.
