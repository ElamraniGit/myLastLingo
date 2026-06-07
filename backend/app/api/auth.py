"""
Authentication API for LinguaLearn.
Local-first auth: PBKDF2 password hashing, signed local tokens stored in SQLite.
No external auth services required. Works fully offline on Termux.
"""

import os
import re
import uuid
import logging
import hashlib
import hmac
import base64
import json
from datetime import datetime, timedelta
from typing import Optional

import aiosqlite
from fastapi import APIRouter, HTTPException, Depends, Header, UploadFile, File
from pydantic import BaseModel, field_validator

logger = logging.getLogger(__name__)

router = APIRouter()
db_manager = None

# ─── Simple in-memory login rate limiter (FIX-SEC-4) ─────────────────────────
# Prevents online password brute-forcing. Keyed by identifier (username/email).
# In-process only (fine for a single-worker local app); resets on restart.
import time as _time
from collections import defaultdict as _defaultdict

_LOGIN_ATTEMPTS: dict = _defaultdict(list)  # ident -> [timestamps of failures]
_LOGIN_WINDOW_SEC = 300       # 5 minutes
_LOGIN_MAX_FAILS = 8          # max failed attempts within the window


def _login_rate_check(ident: str) -> None:
    now = _time.time()
    fails = [t for t in _LOGIN_ATTEMPTS[ident] if now - t < _LOGIN_WINDOW_SEC]
    _LOGIN_ATTEMPTS[ident] = fails
    if len(fails) >= _LOGIN_MAX_FAILS:
        raise HTTPException(
            status_code=429,
            detail="Too many failed login attempts. Try again in a few minutes.",
        )


def _login_record_failure(ident: str) -> None:
    _LOGIN_ATTEMPTS[ident].append(_time.time())


def _login_clear(ident: str) -> None:
    _LOGIN_ATTEMPTS.pop(ident, None)

# ─── Secret key (generated once, stored locally) ────────────────────────────
_SECRET_KEY: Optional[str] = None

def _get_secret() -> str:
    global _SECRET_KEY
    if _SECRET_KEY:
        return _SECRET_KEY
    key_file = "data/.secret_key"
    try:
        from pathlib import Path
        p = Path(key_file)
        p.parent.mkdir(parents=True, exist_ok=True)
        if p.exists():
            _SECRET_KEY = p.read_text().strip()
        else:
            _SECRET_KEY = base64.urlsafe_b64encode(os.urandom(32)).decode()
            p.write_text(_SECRET_KEY)
    except Exception:
        _SECRET_KEY = "lingualearn-local-secret-fallback-key-32b"
    return _SECRET_KEY


# ─── Simple local JWT (no external lib needed) ───────────────────────────────
def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def _b64url_decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s)

def _create_token(user_id: str, username: str, remember: bool = False, token_version: int = 0) -> str:
    """Create a signed local JWT-like token."""
    exp_hours = 720 if remember else 24  # 30 days if remember, else 24h
    payload = {
        "sub": user_id,
        "username": username,
        "tv": int(token_version),  # FIX-SEC-5: token version for revocation
        "exp": (datetime.utcnow() + timedelta(hours=exp_hours)).isoformat(),
        "iat": datetime.utcnow().isoformat(),
    }
    header = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = _b64url_encode(json.dumps(payload).encode())
    sig_input = f"{header}.{body}".encode()
    sig = hmac.new(_get_secret().encode(), sig_input, hashlib.sha256).digest()
    signature = _b64url_encode(sig)
    return f"{header}.{body}.{signature}"

def _verify_token(token: str) -> Optional[dict]:
    """Verify and decode a local token. Returns payload or None."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header, body, signature = parts
        sig_input = f"{header}.{body}".encode()
        expected_sig = hmac.new(_get_secret().encode(), sig_input, hashlib.sha256).digest()
        expected_b64 = _b64url_encode(expected_sig)
        if not hmac.compare_digest(signature, expected_b64):
            return None
        payload = json.loads(_b64url_decode(body))
        exp = datetime.fromisoformat(payload["exp"])
        if datetime.utcnow() > exp:
            return None
        return payload
    except Exception:
        return None

def _hash_password(password: str) -> str:
    """Hash password with PBKDF2-HMAC-SHA256 (no bcrypt needed, works on Termux)."""
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 260000)
    return base64.b64encode(salt + dk).decode()

def _verify_password(password: str, hashed: str) -> bool:
    try:
        raw = base64.b64decode(hashed.encode())
        salt = raw[:16]
        stored_dk = raw[16:]
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 260000)
        return hmac.compare_digest(dk, stored_dk)
    except Exception:
        return False


# ─── Token-version helpers (FIX-SEC-5: revocation support) ───────────────────
async def _get_token_version(user_id: str) -> Optional[int]:
    """Return the user's current token_version, or None if the user is gone."""
    if db_manager is None:
        return 0
    async with db_manager.get_connection() as conn:
        async with conn.execute(
            "SELECT token_version FROM users WHERE id = ?", (user_id,)
        ) as cur:
            row = await cur.fetchone()
    if row is None:
        return None
    return int(dict(row).get("token_version") or 0)


async def _token_version_ok(payload: dict) -> bool:
    """A token is valid only if its 'tv' claim matches the user's current version."""
    current = await _get_token_version(payload.get("sub", ""))
    if current is None:
        return False  # user deleted
    return int(payload.get("tv", 0)) == current


# ─── Dependency: get current user from Authorization header ──────────────────
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization[7:]
    payload = _verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    # FIX-SEC-5: reject tokens whose version no longer matches (logout/password change)
    if not await _token_version_ok(payload):
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    return payload

async def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    payload = _verify_token(token)
    if payload and not await _token_version_ok(payload):
        return None
    return payload


# ─── Pydantic models ──────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    display_name: str = ""

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters")
        if len(v) > 30:
            raise ValueError("Username too long (max 30)")
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username can only contain letters, numbers, hyphens, underscores")
        return v.lower()

    @field_validator("password")
    @classmethod
    def password_valid(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        v = (v or "").strip().lower()
        # Email is optional, but if provided it must look like an email
        if v and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", v):
            raise ValueError("Invalid email address")
        return v

class LoginRequest(BaseModel):
    username: str  # username or email
    password: str
    remember: bool = False

class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None
    avatar_color: Optional[str] = None   # hex colour for avatar background
    current_password: Optional[str] = None
    new_password: Optional[str] = None

class AuthResponse(BaseModel):
    token: str
    user: dict


# ─── Create auth tables ───────────────────────────────────────────────────────
async def create_auth_tables(conn: aiosqlite.Connection):
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE,
            display_name TEXT,
            password_hash TEXT NOT NULL,
            avatar_color TEXT DEFAULT '#3b82f6',
            avatar_url TEXT DEFAULT NULL,
            streak_days INTEGER DEFAULT 0,
            token_version INTEGER DEFAULT 0,
            groq_api_key TEXT DEFAULT '',
            last_login TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    await conn.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)")
    await conn.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")

    # FIX-SEC-5 / FIX-SEC-4: additive migrations for existing databases.
    async with conn.execute("PRAGMA table_info(users)") as cur:
        cols = {dict(r)["name"] for r in await cur.fetchall()}
    if "token_version" not in cols:
        await conn.execute("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0")
    if "groq_api_key" not in cols:
        await conn.execute("ALTER TABLE users ADD COLUMN groq_api_key TEXT DEFAULT ''")
    if "avatar_url" not in cols:
        await conn.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT NULL")
    if "avatar_color" not in cols:
        await conn.execute("ALTER TABLE users ADD COLUMN avatar_color TEXT DEFAULT '#3b82f6'")

    await conn.commit()


def _project_root():
    from pathlib import Path
    return Path(__file__).resolve().parent.parent.parent.parent


def _delete_avatar_file(user_id: str) -> None:
    avatar_dir = _project_root() / "data" / "avatars"
    for old_file in avatar_dir.glob(f"{user_id}.*"):
        try:
            old_file.unlink()
        except Exception:
            pass


async def _purge_user_library(conn: aiosqlite.Connection, user_id: str) -> None:
    """Delete user-owned library records and downloaded media files."""
    async with conn.execute("SELECT id FROM videos WHERE user_id = ?", (user_id,)) as cur:
        video_ids = [dict(r)["id"] for r in await cur.fetchall()]

    for video_id in video_ids:
        try:
            path = _project_root() / "data" / "downloads" / f"{video_id}.mp4"
            if path.exists():
                path.unlink()
        except Exception:
            pass

    if video_ids:
        for video_id in video_ids:
            await conn.execute("DELETE FROM videos WHERE id = ? AND user_id = ?", (video_id, user_id))

    await conn.execute("DELETE FROM text_sources WHERE user_id = ?", (user_id,))


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/register")
async def register(req: RegisterRequest):
    """Register a new local user account."""
    async with db_manager.get_connection() as conn:
        # Check username taken
        async with conn.execute("SELECT id FROM users WHERE username = ?", (req.username,)) as cur:
            if await cur.fetchone():
                raise HTTPException(status_code=409, detail="Username already taken")
        # Check email taken
        if req.email:
            async with conn.execute("SELECT id FROM users WHERE email = ?", (req.email,)) as cur:
                if await cur.fetchone():
                    raise HTTPException(status_code=409, detail="Email already registered")

        user_id = str(uuid.uuid4())
        display = req.display_name.strip() or req.username.capitalize()
        # Pick a deterministic avatar color from username
        colors = ["#3b82f6","#8b5cf6","#ec4899","#f97316","#10b981","#06b6d4","#f59e0b"]
        color = colors[sum(ord(c) for c in req.username) % len(colors)]

        await conn.execute(
            """INSERT INTO users (id, username, email, display_name, password_hash, avatar_color)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (user_id, req.username, req.email or None, display,
             _hash_password(req.password), color),
        )

    token = _create_token(user_id, req.username)
    user = {
        "id": user_id,
        "username": req.username,
        "email": req.email,
        "display_name": display,
        "avatar_color": color,
        "streak_days": 0,
    }
    logger.info(f"New user registered: {req.username}")
    return {"token": token, "user": user}


@router.post("/login")
async def login(req: LoginRequest):
    """Login with username or email + password."""
    ident = req.username.strip().lower()
    _login_rate_check(ident)  # FIX-SEC-4: throttle brute-force attempts
    async with db_manager.get_connection() as conn:
        async with conn.execute(
            "SELECT * FROM users WHERE username = ? OR email = ?", (ident, ident)
        ) as cur:
            row = await cur.fetchone()

    if not row:
        _login_record_failure(ident)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = dict(row)
    if not _verify_password(req.password, user["password_hash"]):
        _login_record_failure(ident)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    _login_clear(ident)  # successful login resets the counter

    # Update last login
    async with db_manager.get_connection() as conn:
        await conn.execute(
            "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", (user["id"],)
        )

    token = _create_token(
        user["id"], user["username"], req.remember,
        token_version=int(user.get("token_version") or 0),
    )
    safe_user = {
        "id": user["id"],
        "username": user["username"],
        "email": user.get("email"),
        "display_name": user.get("display_name"),
        "avatar_color": user.get("avatar_color", "#3b82f6"),
        "streak_days": user.get("streak_days", 0),
    }
    logger.info(f"User logged in: {user['username']}")
    return {"token": token, "user": safe_user}


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user profile."""
    async with db_manager.get_connection() as conn:
        async with conn.execute(
            "SELECT * FROM users WHERE id = ?", (current_user["sub"],)
        ) as cur:
            row = await cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    user = dict(row)
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user.get("email"),
        "display_name": user.get("display_name"),
        "avatar_color": user.get("avatar_color", "#3b82f6"),
        "avatar_url": user.get("avatar_url"),
        "streak_days": user.get("streak_days", 0),
        "created_at": user.get("created_at"),
        "last_login": user.get("last_login"),
    }


@router.patch("/me")
async def update_profile(
    req: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update user profile."""
    user_id = current_user["sub"]
    async with db_manager.get_connection() as conn:
        async with conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        user = dict(row)

        updates = []
        params = []

        if req.display_name is not None:
            display_name = req.display_name.strip()[:80]
            updates.append("display_name = ?")
            params.append(display_name)

        if req.email is not None:
            email = (req.email or "").strip().lower()
            if email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
                raise HTTPException(status_code=400, detail="Invalid email address")
            # Check email not taken
            async with conn.execute(
                "SELECT id FROM users WHERE email = ? AND id != ?", (email or None, user_id)
            ) as cur2:
                if email and await cur2.fetchone():
                    raise HTTPException(status_code=409, detail="Email already in use")
            updates.append("email = ?")
            params.append(email or None)

        if req.avatar_color is not None:
            # Basic hex colour validation
            import re as _re
            if _re.match(r'^#[0-9a-fA-F]{6}$', req.avatar_color):
                updates.append("avatar_color = ?")
                params.append(req.avatar_color)

        if req.new_password:
            if not req.current_password:
                raise HTTPException(status_code=400, detail="Current password required")
            if not _verify_password(req.current_password, user["password_hash"]):
                raise HTTPException(status_code=401, detail="Current password incorrect")
            if len(req.new_password) < 6:
                raise HTTPException(status_code=400, detail="New password too short")
            updates.append("password_hash = ?")
            params.append(_hash_password(req.new_password))
            # FIX-SEC-5: changing the password revokes all existing sessions.
            updates.append("token_version = token_version + 1")

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.append(user_id)
            await conn.execute(
                f"UPDATE users SET {', '.join(updates)} WHERE id = ?", params
            )

    return {"message": "Profile updated"}


@router.post("/refresh")
async def refresh_token(current_user: dict = Depends(get_current_user)):
    """Issue a fresh token for an authenticated user (preserving token version)."""
    tv = await _get_token_version(current_user["sub"]) or 0
    token = _create_token(current_user["sub"], current_user["username"], token_version=tv)
    return {"token": token}


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """
    Log out everywhere by incrementing the user's token_version.

    FIX-SEC-5: previously this was a no-op and tokens stayed valid until expiry
    (up to 30 days). Now every issued token for this user is immediately revoked.
    """
    async with db_manager.get_connection() as conn:
        await conn.execute(
            "UPDATE users SET token_version = token_version + 1 WHERE id = ?",
            (current_user["sub"],),
        )
    return {"message": "Logged out"}



# ─── Delete account ───────────────────────────────────────────────────────────

class DeleteAccountRequest(BaseModel):
    password: str
    confirm: str   # must equal "DELETE MY ACCOUNT"


@router.delete("/me")
async def delete_account(
    req: DeleteAccountRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Permanently delete the user account and ALL associated data:
    saved words, reviews, chat history, XP, library sources.
    Requires password confirmation + typed confirmation phrase.
    """
    if req.confirm != "DELETE MY ACCOUNT":
        raise HTTPException(400, "Type DELETE MY ACCOUNT to confirm")

    user_id = current_user["sub"]

    async with db_manager.get_connection() as conn:
        async with conn.execute(
            "SELECT password_hash FROM users WHERE id = ?", (user_id,)
        ) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(404, "User not found")
        if not _verify_password(req.password, dict(row)["password_hash"]):
            raise HTTPException(401, "Incorrect password")

        # Delete all user data (cascade handles word_reviews via FK)
        await _purge_user_library(conn, user_id)
        for sql in [
            "DELETE FROM saved_words        WHERE user_id = ?",
            "DELETE FROM chat_messages      WHERE user_id = ?",
            "DELETE FROM user_xp            WHERE user_id = ?",
            "DELETE FROM xp_log             WHERE user_id = ?",
            "DELETE FROM user_core_progress WHERE user_id = ?",
            "DELETE FROM core_word_reviews  WHERE user_id = ?",
        ]:
            await conn.execute(sql, (user_id,))

        # Delete account last
        await conn.execute("DELETE FROM users WHERE id = ?", (user_id,))

    _delete_avatar_file(user_id)
    return {"message": "Account deleted"}


# ─── Clear vocabulary only ────────────────────────────────────────────────────

@router.delete("/me/vocabulary")
async def clear_vocabulary(current_user: dict = Depends(get_current_user)):
    """Delete all saved words and review history for the current user."""
    user_id = current_user["sub"]
    async with db_manager.get_connection() as conn:
        # word_reviews deleted via CASCADE on saved_words
        await conn.execute(
            "DELETE FROM saved_words WHERE user_id = ?", (user_id,)
        )
        await conn.execute(
            "DELETE FROM user_core_progress WHERE user_id = ?", (user_id,)
        )
        await conn.execute(
            "DELETE FROM core_word_reviews WHERE user_id = ?", (user_id,)
        )
        await conn.execute(
            "DELETE FROM user_xp    WHERE user_id = ?", (user_id,)
        )
        await conn.execute(
            "DELETE FROM xp_log     WHERE user_id = ?", (user_id,)
        )
    return {"message": "Vocabulary cleared"}


# ─── Clear library sources only ───────────────────────────────────────────────

@router.delete("/me/library")
async def clear_library(current_user: dict = Depends(get_current_user)):
    """Delete all library sources (videos + texts) for the current user."""
    user_id = current_user["sub"]
    async with db_manager.get_connection() as conn:
        await conn.execute(
            "DELETE FROM text_sources WHERE user_id = ?", (user_id,)
        )
    return {"message": "Library cleared"}


# ─── Clear chat history only ──────────────────────────────────────────────────

@router.delete("/me/chat")
async def clear_chat_data(current_user: dict = Depends(get_current_user)):
    """Delete all chat messages for the current user."""
    user_id = current_user["sub"]
    async with db_manager.get_connection() as conn:
        await conn.execute(
            "DELETE FROM chat_messages WHERE user_id = ?", (user_id,)
        )
    return {"message": "Chat history cleared"}


# ─── Upload avatar image ──────────────────────────────────────────────────────

@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload a profile picture.
    Accepts JPEG/PNG/WebP (or any image/* MIME) up to 5 MB.
    Saves to data/avatars/<user_id>.<ext> relative to PROJECT_ROOT.
    Returns the public URL path.
    """
    from pathlib import Path

    user_id = current_user["sub"]

    # Read data first — needed for magic-bytes detection
    data = await file.read()

    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(400, "Image too large — max 5 MB")
    if len(data) < 12:
        raise HTTPException(400, "Invalid image file")

    # Detect format from magic bytes (more reliable than content-type on Android)
    if data[:2] == b"\xff\xd8":
        ext = "jpg"
    elif data[:8] == b"\x89PNG\r\n\x1a\n":
        ext = "png"
    elif data[:4] in (b"RIFF", b"WEBP") or data[8:12] == b"WEBP":
        ext = "webp"
    else:
        # Fall back to content-type (normalise common variants)
        ct = (file.content_type or "image/jpeg").lower().strip()
        ct_map = {
            "image/jpeg": "jpg", "image/jpg": "jpg", "image/pjpeg": "jpg",
            "image/png": "png", "image/webp": "webp",
        }
        ext = ct_map.get(ct)
        if not ext:
            raise HTTPException(400, "Only JPEG, PNG or WebP images are allowed")

    # Save to PROJECT_ROOT/data/avatars/
    # Use an absolute path relative to this file to avoid cwd issues
    project_root = Path(__file__).resolve().parent.parent.parent.parent
    avatars_dir  = project_root / "data" / "avatars"
    avatars_dir.mkdir(parents=True, exist_ok=True)

    # Remove previous avatar for this user
    for old_file in avatars_dir.glob(f"{user_id}.*"):
        try: old_file.unlink()
        except: pass

    filename  = f"{user_id}.{ext}"
    file_path = avatars_dir / filename
    file_path.write_bytes(data)

    # Store URL in DB
    avatar_url = f"/api/v1/auth/avatars/{filename}"
    async with db_manager.get_connection() as conn:
        await conn.execute(
            "UPDATE users SET avatar_url = ? WHERE id = ?",
            (avatar_url, user_id),
        )

    return {"avatar_url": avatar_url}


@router.get("/avatars/{filename}")
async def get_avatar(filename: str):
    """Serve avatar images."""
    from fastapi.responses import FileResponse
    from pathlib import Path
    import re

    # Security: only allow safe filenames
    if not re.match(r'^[a-zA-Z0-9_-]+[.](jpg|png|webp)$', filename):
        raise HTTPException(404, "Not found")

    project_root = Path(__file__).resolve().parent.parent.parent.parent
    path = project_root / "data" / "avatars" / filename
    if not path.exists():
        raise HTTPException(404, "Avatar not found")

    media = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
    ext   = filename.rsplit(".", 1)[-1]
    return FileResponse(str(path), media_type=media.get(ext, "image/jpeg"))


def init_api(db):
    global db_manager
    db_manager = db
