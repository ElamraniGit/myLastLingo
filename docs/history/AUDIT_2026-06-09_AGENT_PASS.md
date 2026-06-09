# LinguaLearn Audit Pass — 2026-06-09

## Scope
Full-app review with security hardening, build optimisation, and test coverage.

## Verified
- `pytest -q` ✅ (42 passed)
- `frontend: tsc --noEmit` ✅
- `frontend: npm run build` ✅

## Issues fixed

### 1. Groq API key stored in plaintext (SECURITY — fixed)
The per-user Groq API key was written to `users.groq_api_key` as plaintext.
Anyone with read access to the SQLite file could exfiltrate it.

- Added `backend/app/utils/crypto.py` — stdlib-only authenticated encryption
  (HMAC-SHA256 CTR keystream + encrypt-then-MAC), no external deps (Termux-safe).
- The key is now encrypted at rest (`enc:v1:` envelope) on write (`/chat/set-key`)
  and decrypted on read in all four call sites (chat, dictionary, vocabulary,
  ai_enricher). Legacy plaintext rows remain readable (backward compatible).

### 2. Hardcoded fallback signing secret (SECURITY — fixed)
`auth.py` fell back to a constant `"lingualearn-local-secret-fallback-key-32b"`
if the secret file couldn't be written — allowing token forgery on such hosts.

- Secret management moved to `crypto.get_master_secret()`, which generates a
  strong random secret and persists it (chmod 600). If persistence fails it uses
  an ephemeral random secret for the process — never a predictable constant.

### 3. Production minification fully disabled (BUILD — improved)
`next.config.js` disabled minification unconditionally (a workaround for Terser
crashing on Termux ARM64), bloating bundles everywhere.

- Minification is now disabled **only** on ARM64/Android (or via `DISABLE_MINIFY=1`)
  and **enabled** on CI/desktop. Result on x86_64:
  - First Load JS: **218 kB → 130 kB** (-40%)
  - main chunk: **89.4 kB → 43.4 kB** (-51%)

## Tests added
- `test_crypto.py` — roundtrip, empty values, legacy passthrough, tamper
  rejection, nonce uniqueness, no hardcoded fallback.
- `test_groq_key_encryption.py` — end-to-end: `/chat/set-key` stores ciphertext
  (not plaintext) and `has-key` reflects state.

## Still open (tracked, lower priority)
- `postcss` moderate advisory via `next` (dev dependency; fix is a breaking
  Next downgrade — not worth it).
- Several large view files (`ReviewView`, `CoreLibraryView`) remain candidates
  for future extraction.
