"""
Authentication API for LinguaLearn.
Local-first auth: bcrypt password hashing, JWT tokens stored in SQLite.
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
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, field_validator

logger = logging.getLogger(__name__)

router = APIRouter()
db_manager = None

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

def _create_token(user_id: str, username: str, remember: bool = False) -> str:
    """Create a signed local JWT-like token."""
    exp_hours = 720 if remember else 24  # 30 days if remember, else 24h
    payload = {
        "sub": user_id,
        "username": username,
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


# ─── Dependency: get current user from Authorization header ──────────────────
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization[7:]
    payload = _verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload

async def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    return _verify_token(token)


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
            streak_days INTEGER DEFAULT 0,
            last_login TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    await conn.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)")
    await conn.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
    await conn.commit()


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
    async with db_manager.get_connection() as conn:
        async with conn.execute(
            "SELECT * FROM users WHERE username = ? OR email = ?", (ident, ident)
        ) as cur:
            row = await cur.fetchone()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = dict(row)
    if not _verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Update last login
    async with db_manager.get_connection() as conn:
        await conn.execute(
            "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", (user["id"],)
        )

    token = _create_token(user["id"], user["username"], req.remember)
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
            updates.append("display_name = ?")
            params.append(req.display_name.strip())

        if req.email is not None:
            # Check email not taken
            async with conn.execute(
                "SELECT id FROM users WHERE email = ? AND id != ?", (req.email, user_id)
            ) as cur2:
                if await cur2.fetchone():
                    raise HTTPException(status_code=409, detail="Email already in use")
            updates.append("email = ?")
            params.append(req.email)

        if req.new_password:
            if not req.current_password:
                raise HTTPException(status_code=400, detail="Current password required")
            if not _verify_password(req.current_password, user["password_hash"]):
                raise HTTPException(status_code=401, detail="Current password incorrect")
            if len(req.new_password) < 6:
                raise HTTPException(status_code=400, detail="New password too short")
            updates.append("password_hash = ?")
            params.append(_hash_password(req.new_password))

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.append(user_id)
            await conn.execute(
                f"UPDATE users SET {', '.join(updates)} WHERE id = ?", params
            )

    return {"message": "Profile updated"}


@router.post("/refresh")
async def refresh_token(current_user: dict = Depends(get_current_user)):
    """Issue a fresh token for an authenticated user."""
    token = _create_token(current_user["sub"], current_user["username"])
    return {"token": token}


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout (client should discard token)."""
    return {"message": "Logged out"}


def init_api(db):
    global db_manager
    db_manager = db
