# LinguaLearn — Database Schema & Data Flow

- **Engine:** SQLite (WAL mode), accessed asynchronously via `aiosqlite`.
- **Location:** `data/lingualearn.db` (configurable via `LINGUALEARN_DB_PATH`).
- **Owner:** `backend/app/db/database.py` (`DatabaseManager`) for app tables;
  `backend/app/api/auth.py` (`create_auth_tables`) for the `users` table.
- **Migrations:** additive only, applied at startup in `_run_migrations()`
  (app tables) and `create_auth_tables()` (users). Guarded by `PRAGMA table_info`
  so they are idempotent. **Never rename or drop columns.**

> ⚠️ Indexes on migration-added columns (`user_id`, …) are created in
> `_run_migrations()` *after* the column exists — not in `_create_tables()`.

---

## Tables

### `users` (auth.py)
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| username | TEXT UNIQUE NOT NULL | lowercased |
| email | TEXT UNIQUE | optional |
| display_name | TEXT | |
| password_hash | TEXT NOT NULL | PBKDF2 salt+hash, base64 |
| avatar_color | TEXT | derived from username |
| streak_days | INTEGER | |
| token_version | INTEGER DEFAULT 0 | **migration** — bumped on logout / password change to revoke tokens |
| groq_api_key | TEXT DEFAULT '' | **migration** — per-user AI key |
| last_login, created_at, updated_at | TIMESTAMP | |

Indexes: `idx_users_username`, `idx_users_email`.

### `videos`
YouTube items added by a user. `id` (UUID) PK, `youtube_id` UNIQUE, `title`,
`channel`, `duration`, `thumbnail_url`, `description`, `status`, timestamps,
and `user_id` (**migration**, owner scoping). Indexes: `idx_videos_youtube`,
`idx_videos_uid`.

### `transcripts`
One per `(video_id, language)`. Columns: `id` PK, `video_id` FK→videos
(CASCADE), `language`, `source` (`youtube`|`whisper`), `segments` (JSON text),
`full_text`, `word_timings` (JSON text), `status` (**migration**:
`processing`|`ready`|`error`), `error` (**migration**), `created_at`.
`save_transcript()` deletes any existing row for the same `(video_id, language)`
before inserting, so a status placeholder never shadows the real transcript.

### `words`
Global dictionary cache (shared across users), keyed by unique `word`. Holds
`pronunciation`, `part_of_speech`, `level` (CEFR), `meaning_ar`, `meaning_en`,
and JSON fields `examples`, `synonyms`, `antonyms`, `conjugations`,
`related_words`, plus `definitions` & `how_to_use` (**migrations**), `frequency`.

### `saved_words` (the spaced-repetition core)
A user's saved instance of a word. Columns: `id` PK, `word_id` FK→words
(CASCADE), `video_id` FK→videos (SET NULL), `sentence`, `context`, `status`
(`learning`|`reviewing`|`learned`), SM-2 fields `ease_factor`, `interval`,
`repetitions`, `next_review`, `last_reviewed`, plus **migrations**
`learning_step`, `lapses`, `reviewed_count`, `last_quality`, `tags` (JSON),
`notes`, `favorite`, and `user_id`. Indexes: `idx_saved_words_user(status,
next_review)`, `idx_saved_words_uid(user_id)`.

### `word_reviews`
Append-only review log: `id` PK, `saved_word_id` FK→saved_words (CASCADE),
`quality` (0–5, CHECK), `reviewed_at`. Index: `idx_word_reviews_saved`.

### `sessions`
Per-user playback state: `id` PK, `video_id` FK→videos (CASCADE),
`last_position`, `playback_speed`, `volume`, `completed`, `watch_count`,
timestamps, `user_id` (**migration**). Scoped by `(video_id, user_id)`.

### `user_xp` / `xp_log`
Gamification. `user_xp`: one row per user — `total_xp`, `level`, `streak_days`,
`daily_xp`, `last_active_date`. `xp_log`: append-only `(user_id, action,
xp_earned, created_at)`. Daily goal = 50 XP (see `xp.py DAILY_GOAL_XP`).

### `text_sources`
Pasted/imported reading material: `id` PK, `title`, `source_type`, `content`,
`word_count`, `created_at`, `user_id` (**migration**). Index: `idx_text_sources_uid`.

### `chat_messages`
AI chat history: `id` PK, `user_id`, `conversation_id`, `role`, `content`,
`created_at`. Index: `idx_chat_user(user_id, conversation_id)`.

### `user_progress`
Legacy aggregate counters table (created but not central to current flows).

---

## Relationships (text ERD)

```
users 1──* videos 1──* transcripts
users 1──* saved_words *──1 words
saved_words 1──* word_reviews
users 1──* sessions ──1 videos
users 1──1 user_xp ; users 1──* xp_log
users 1──* text_sources ; users 1──* chat_messages
```

Ownership is enforced in the API layer by filtering on `user_id` and, for
mutations on a single row, by `_assert_owns_saved_word()` / explicit owner checks
(prevents IDOR).

---

## SM-2 scheduling (in `update_review`)

Quality 0–5 maps to: ease-factor adjustment, `interval` growth, `repetitions`
increment, `status` transition (`learning → reviewing → learned` at interval ≥ 30
days), `lapses` increment on failure, and a new `next_review`. Datetimes are
stored as `YYYY-MM-DD HH:MM:SS` (UTC) and normalized in SQL via
`_normalized_datetime_expr()` to tolerate older ISO-with-`T` rows.

---

## Backups & reset

- `update.sh` copies `data/lingualearn.db` to `data/backups/` before updating and
  **never deletes** it.
- Migrations are additive, so pulling new code and restarting is safe.
- To start fresh, stop the backend and delete `data/lingualearn.db*` (also removes
  the WAL/SHM sidecars).
