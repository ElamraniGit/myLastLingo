# LinguaLearn — Troubleshooting

Practical fixes for the most common issues, especially on Termux/Android.

---

## Frontend / build

### `Failed to load SWC binary for android/arm64`
Expected on Termux — Next.js has no native SWC binary for arm64, so **production
`next build` cannot complete there**. Use **dev mode**:
```bash
cd ~/myLastLingo && bash scripts/start_all.sh     # defaults to dev mode
# or: cd frontend && npm run dev
```
The repo ships `frontend/.babelrc` so dev compiles via Babel (no SWC). Don't run
`npm run build` / `npm run start` on Termux.

### `Could not find a production build … prerender-manifest.json`
You ran `npm run start` without a completed `next build`. On Termux, use dev mode
(above). On desktop/CI, run `npm run build` first.

### `Failed to resolve "@babel/runtime/regenerator"`
`@babel/runtime` isn't installed. `npm install` should pull it (it's a
dependency). If needed: `cd frontend && npm install @babel/runtime`.

### Blank screen / 500 on `/`
Usually a stale/empty `.next` from a failed build. Fix:
```bash
cd frontend && rm -rf .next && npm run dev
```

### `./scripts/start_all.sh: Permission denied`
The executable bit was lost (e.g. after `git reset --hard`). Run with bash or
restore it:
```bash
bash scripts/start_all.sh        # works without +x
# or
chmod +x scripts/*.sh && ./scripts/start_all.sh
```

---

## Git / updates

### `Not possible to fast-forward` / "divergent branches"
Your local `main` diverged from GitHub. To take the remote version exactly
(your `data/` is untracked and safe):
```bash
git fetch origin
git reset --hard origin/main
```
Then rebuild deps: `cd frontend && npm install`.

### After pulling, the app behaves oddly
Reinstall deps and clear the Next cache:
```bash
cd frontend && npm install && rm -rf .next && cd .. && bash scripts/start_all.sh
```

---

## Backend

### Port 8080 already in use
`run.py` tries to free it automatically. Manually:
```bash
pkill -f "uvicorn.*backend.main"; fuser -k 8080/tcp 2>/dev/null
```

### `OperationalError: no such column: user_id` (or similar on boot)
A schema/migration ordering bug. Schema/index changes that reference
migration-added columns must live in `_run_migrations()` after the column is
added. If you hit this on an old DB, pull latest; migrations are additive and run
on startup.

### `yt-dlp` errors / video won't process
YouTube changes often. Update yt-dlp:
```bash
pip install --upgrade yt-dlp
```

### Whisper transcription does nothing
Optional STT isn't installed: `pip install faster-whisper numpy` (and ffmpeg:
`pkg install ffmpeg`). Without it, only videos that have YouTube captions get
subtitles. Check transcript status via `GET /transcripts/{id}/status`.

### AI chat returns 503 "AI not configured"
Each user must add their own free Groq key in the app (Settings) — get one at
https://console.groq.com/keys. Keys are stored per-user in the DB.

---

## Auth / sessions

### Logged out unexpectedly / 401 everywhere
Tokens are revoked on logout and on password change (token-version bump). Log in
again. If it persists, the signing secret (`data/.secret_key`) may have changed —
all tokens become invalid; log in to get a fresh one.

### Too many login attempts (HTTP 429)
The login rate-limiter blocks after 8 failures in 5 minutes (per identifier).
Wait a few minutes, or restart the backend (the limiter is in-memory).

---

## Data & backups

- Database: `data/lingualearn.db` (+ `-wal`, `-shm`). Back it up by copying those
  files. `update.sh` auto-backs up to `data/backups/`.
- Reset everything: stop the backend, delete `data/lingualearn.db*`, restart.
- Logs: `logs/app.log`.

---

## Where to look
- Backend logs: `logs/app.log` (and the uvicorn console).
- Frontend: browser DevTools console + the `npm run dev` output.
- API behavior: open `http://127.0.0.1:8080/docs` (Swagger).
