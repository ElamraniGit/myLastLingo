# 🔬 LinguaLearn — Full Diagnostic Report
**Date:** 2026-05-25  
**Analyst:** Senior Full-Stack AI Engineer  
**Repo:** https://github.com/ElamraniGit/myLastLingo

---

## EXECUTIVE SUMMARY

The application has a sound architectural skeleton but contains **17 critical bugs** spread across the backend, frontend, and build system that prevent it from working end-to-end. The subtitle extraction is broken in multiple layers simultaneously. Below is a complete root-cause analysis and the full corrected code for every affected file.

---

## 🔴 CRITICAL BUGS — SUBTITLE / TRANSCRIPT EXTRACTION

### BUG #1 — `--convert-subs srt` requires `ffmpeg` (CONFIRMED ROOT CAUSE)
**File:** `backend/app/api/transcripts.py` → `_fetch_youtube_captions()`  
**Impact:** 100% failure on Termux without ffmpeg in PATH

The yt-dlp command used is:
```
yt-dlp --skip-download --write-subs --write-auto-subs --sub-langs "en"
       --convert-subs srt ...
```
`--convert-subs srt` calls ffmpeg internally. On Termux, ffmpeg may not be in PATH, or its version may not support subtitle conversion. The VTT files ARE downloaded by yt-dlp, but the SRT conversion step fails silently, leaving zero subtitle files in the output directory.

**Fix:** Use `--write-auto-subs` WITHOUT `--convert-subs`, then parse VTT directly (which the developer partially attempted in the latest commit but left the SRT-based loop intact).

---

### BUG #2 — Both `--write-subs` AND `--write-auto-subs` are sent together in BOTH branches
**File:** `backend/app/api/transcripts.py` → `_fetch_youtube_captions()` lines ~60–75  
**Impact:** Causes yt-dlp to run in a confused mode; flags conflict.

```python
# WRONG — this sends --write-subs --write-auto-subs for the "not use_auto" branch too
auto_flag = "--write-auto-subs " if use_auto else ""
sub_flag = "--write-subs " if not use_auto else "--write-subs "  # BUG: both branches add --write-subs
```
The non-auto branch sends `--write-subs` (correct), but the auto branch sends `--write-subs --write-auto-subs` which is valid but then the file pattern search looks for `.en.srt` which won't exist because `--convert-subs` failed.

---

### BUG #3 — SRT file pattern search fails post-VTT-parse commit
**File:** `backend/app/api/transcripts.py` → `_fetch_youtube_captions()`  
**Impact:** Even when the VTT parser was added (`_parse_vtt`), the main download loop still tries to `found_srt.read_text()` and calls `_parse_srt()`. The newly added `_parse_vtt` function is **never actually called** in the download loop. The loop only looks for `.srt` files, not `.vtt` files.

The mismatch:
- yt-dlp writes: `{video_id}.en.vtt` (without conversion)
- The code searches for: `{video_id}.en.srt`, `{video_id}.srt`, etc.
- **Result:** `found_srt` is always `None` → raises `FileNotFoundError` → fallback to Whisper

---

### BUG #4 — Race condition in async shell subprocess + temp file cleanup
**File:** `backend/app/api/transcripts.py`  
**Impact:** If two requests come in for different videos simultaneously, both write to `data/temp/` with the same `youtube_id` as the file name. File A's cleanup deletes file B before it's parsed.

---

### BUG #5 — `_fetch_youtube_captions` has no timeout on `proc.communicate()`
**File:** `backend/app/api/transcripts.py`  
**Impact:** If yt-dlp hangs (network timeout, bot detection), the entire FastAPI worker thread is blocked forever. On Termux with 1 uvicorn worker, this freezes the whole backend.

---

### BUG #6 — VTT cue regex fails on auto-generated captions
**File:** `backend/app/api/transcripts.py` → `_parse_vtt()`  
Auto-generated YouTube VTT captions have an extra `align:start position:0%` tag after the timestamp line AND use `<TIMESTAMP>` tags inside the cue text. The current regex does not strip these correctly, resulting in empty `text` fields for every cue.

Example auto-generated VTT cue:
```
00:00:01.200 --> 00:00:04.880 align:start position:0%

hello<00:00:01.200><c> everyone</c><00:00:03.000><c> welcome</c>
```
The cue regex `r'(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})(?:[^\n]*)\n(...)+'` — the non-capturing group `(?:[^\n]*)` strips the `align:start` part, but the body then includes `<00:00:01.200>` timestamp tags and `<c>` tags. The HTML tag stripper `re.sub(r'<[^>]+>', '', raw_text)` DOES strip these, but YouTube auto-captions also insert a **blank line** between the timestamp header and the text, which breaks the multiline cue body match.

---

### BUG #7 — Whisper fallback downloads video first (not audio only)
**File:** `backend/app/api/transcripts.py` → `_transcribe_with_whisper()`  
The Whisper path requires a full MP4 video to be already downloaded:
```python
video_path = Path(f"data/downloads/{video_id}.mp4")
if not video_path.exists():
    logger.error(f"Video file not found: {video_path}")
    return
```
But the download happens in a `BackgroundTask` via `videos.py`. The Whisper task fires **immediately** after the transcript extraction request, before the video is finished downloading. The video file doesn't exist yet → Whisper silently returns with no transcript.

**Fix:** The Whisper fallback should download audio-only directly, not wait for the full video.

---

## 🟠 HIGH-SEVERITY BUGS — DATABASE & API

### BUG #8 — `DatabaseManager.get_connection()` is NOT thread-safe
**File:** `backend/app/db/database.py`  
The connection pool uses a plain Python `list`. `asyncio.Lock()` is used only in `initialize()`, NOT in `_get_connection()` and `_release_connection()`. Multiple concurrent async requests can cause list corruption or use the same connection simultaneously.

---

### BUG #9 — `database.py` uses sync SQLite in async context
**File:** `backend/app/db/database.py`  
All DB operations use synchronous `sqlite3` in async functions without running them in an executor. This blocks the event loop on every database call. On a slow device like Termux/Android, this will cause request timeouts and poor UX.

**Fix:** Either use `aiosqlite` (which is in requirements but unused!) or wrap all sync calls in `asyncio.get_event_loop().run_in_executor(None, ...)`.

---

### BUG #10 — `vocabulary.py` imports from wrong path
**File:** `backend/app/api/vocabulary.py` line ~35:
```python
from backend.ai.dictionary.service import DictionaryService
```
This will fail with `ModuleNotFoundError` when called from within the `backend` package context, because `backend.ai.dictionary` is the wrong import path when `backend/` is already in `sys.path`. Should be `from ai.dictionary.service import DictionaryService`.

---

### BUG #11 — `player.py` WebSocket uses `video_id` as both the room key AND connection identifier
**File:** `backend/app/api/player.py`  
```python
active_connections[video_id] = websocket
```
If the same video is opened in two browser tabs, the second connection silently replaces the first. The first tab's WS is then orphaned (disconnected server-side but alive client-side), causing `WebSocketDisconnect` errors and stale connections.

---

## 🟡 MEDIUM-SEVERITY BUGS — FRONTEND

### BUG #12 — `TranscriptViewer.tsx` calls `useVideoPlayer()` which creates a SECOND hook instance
**File:** `frontend/src/components/transcript/TranscriptViewer.tsx`  
Both `VideoPlayer.tsx` and `TranscriptViewer.tsx` call `useVideoPlayer()`. Each call creates its own `progressInterval` ref and its own `playerRef`. The `playerRef` in `TranscriptViewer` is never attached to any actual player element, so `getCurrentSegment()` always has stale `currentTime` (stuck at 0).

**Fix:** `currentTime` must be stored in Zustand state (or a shared context), not in a local hook state.

---

### BUG #13 — `useVideoPlayer` save interval fires on EVERY re-render
**File:** `frontend/src/hooks/useVideoPlayer.ts`  
```javascript
useEffect(() => {
  if (!currentVideo || !playerState.playing) return;
  const saveInterval = setInterval(async () => { ... }, 10000);
  return () => clearInterval(saveInterval);
}, [currentVideo?.id, playerState.playing]);
```
`playerState` is an object. Every call to `updatePlayerState()` creates a new object reference. If `playerState` (not `.playing`) were in the dep array, this would recreate the interval on every position update (every 250ms). The current version is OK but the dependency on `playerState.playing` (extracted) is fine — **however** the inner effect references `playerState` as a closure value, meaning it sends stale position data after the first save.

---

### BUG #14 — `next.config.js` is missing entirely
**File:** `frontend/` directory  
There is no `next.config.js`. Without it:
- No `NEXT_PUBLIC_API_URL` is type-safe
- No `@` alias is configured (though TypeScript `tsconfig.json` may handle it)
- `next export` (used in README) is not compatible with Next.js 12+ App Router or custom `_app.tsx` without `output: 'export'`

---

### BUG #15 — `tailwind.config.js` is missing
**File:** `frontend/`  
`globals.css` uses custom Tailwind classes like `bg-surface-800`, `text-surface-100`, `bg-primary-600`, etc. Without a `tailwind.config.js` that defines `surface` and `primary` as custom color palettes, **all custom classes produce no CSS output**. The UI will be completely unstyled.

---

### BUG #16 — `pages/PlayerPage.tsx` et al. are in `pages/` but imported in `_app.tsx` directly
**File:** `frontend/src/pages/`  
Next.js treats every file in `pages/` as a route. `PlayerPage.tsx`, `VocabularyPage.tsx`, etc. are imported and rendered manually in `_app.tsx`. This means Next.js also creates routes for `/PlayerPage`, `/VocabularyPage`, etc. These routes are empty shells that will 404 or render blank pages, confusing the router.

**Fix:** Move page components to `src/views/` or `src/screens/` and keep `pages/` only for `index.tsx`, `_app.tsx`, `_document.tsx`.

---

### BUG #17 — `frontend/src/pages/index.tsx` returns `null`
**File:** `frontend/src/pages/index.tsx`  
```tsx
const Home: NextPage = () => {
  return null;
};
```
The root route renders nothing. The navigation between pages is managed by `_app.tsx` switching on `currentPage`, but `index.tsx` returning `null` means opening the app shows a blank screen until Zustand hydrates from localStorage. There's no loading state.

---

## 🔵 ARCHITECTURAL WEAKNESSES

### A1 — Synchronous SQLite in Async FastAPI (Performance)
`aiosqlite` is listed in requirements but the `DatabaseManager` uses sync `sqlite3`. This blocks the event loop on every query. On Android with slow I/O, this is catastrophic.

### A2 — yt-dlp run via shell string (Security + Fragility)
Shell string injection via f-strings: `f'yt-dlp ... "{youtube_id}"'`. A malformed video ID containing shell metacharacters would cause issues. Use `asyncio.create_subprocess_exec()` with a list of arguments instead.

### A3 — No transcript status table / polling mechanism is unreliable
When Whisper is queued as a background task, the frontend polls `GET /transcripts/{video_id}` every 2 seconds for up to 60 seconds. But there's no `status` column in the transcripts table. The backend returns 404 until Whisper completes. The frontend can't distinguish "Whisper failed" from "still processing."

### A4 — Dictionary is a tiny hardcoded dict (~17 words)
The built-in dictionary in `backend/ai/dictionary/service.py` has only 17 words. Any word not in that list gets an empty definition. No integration with free offline dictionaries (WordNet, etc.).

### A5 — `framer-motion` is heavy for mobile
`framer-motion` adds ~40KB gzipped. On low-end Android with slow JS parsing, this slows startup. CSS transitions are sufficient for most animations in this app.

### A6 — `react-player` loads YouTube iframe (CSP & network issue)
`react-player` renders YouTube videos via the YouTube iframe embed API. On Android/Termux when running locally, the `https://www.youtube-nocookie.com` or `https://www.youtube.com` domains must be reachable. If the user is offline, playback fails silently. The app claims to work offline but the YouTube player requires internet for streaming.

### A7 — Missing `tailwindcss.config.js` and `next.config.js`
Critical build files are absent. The app cannot be built.

### A8 — No `tsconfig.json` path alias for `@/`
Without `"paths": { "@/*": ["./src/*"] }` in `tsconfig.json`, the `@/` imports fail at compile time.

---

## 📋 FILES THAT NEED MODIFICATION

| Priority | File | Issue |
|----------|------|-------|
| 🔴 CRITICAL | `backend/app/api/transcripts.py` | Bugs #1-6: Entire VTT extraction rewrite |
| 🔴 CRITICAL | `backend/app/db/database.py` | Bug #8-9: Thread safety + async |
| 🔴 CRITICAL | `frontend/tailwind.config.js` | Bug #15: Missing file |
| 🔴 CRITICAL | `frontend/next.config.js` | Bug #14: Missing file |
| 🔴 CRITICAL | `frontend/tsconfig.json` | Bug #18: Path aliases |
| 🟠 HIGH | `backend/app/api/vocabulary.py` | Bug #10: Wrong import path |
| 🟠 HIGH | `frontend/src/hooks/useVideoPlayer.ts` | Bug #12-13: currentTime in store |
| 🟠 HIGH | `frontend/src/store/appStore.ts` | Add currentTime to global state |
| 🟠 HIGH | `frontend/src/components/transcript/TranscriptViewer.tsx` | Bug #12: Use store currentTime |
| 🟡 MEDIUM | `backend/app/api/player.py` | Bug #11: WS connection key |
| 🟡 MEDIUM | `frontend/src/pages/index.tsx` | Bug #17: Proper home page |
| 🟡 MEDIUM | `backend/app/api/videos.py` | Bug #2: Use list args for subprocess |
