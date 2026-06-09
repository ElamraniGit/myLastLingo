"""
Local secret management + lightweight authenticated encryption.

Stdlib-only (no external deps) so it works on Termux/Android ARM where building
cryptography wheels is painful. Used to:

  * load/persist the app's local signing secret (data/.secret_key)
  * encrypt small secrets (e.g. a user's Groq API key) at rest in SQLite

Scheme (authenticated encryption):
  key      = HMAC-SHA256(master_secret, "lingualearn-aead-key-v1")
  nonce    = 16 random bytes
  keystream= HMAC-SHA256(key, nonce || counter) blocks (CTR-style)
  cipher   = plaintext XOR keystream
  tag      = HMAC-SHA256(key, nonce || cipher)        # encrypt-then-MAC
  token    = "enc:v1:" + base64url(nonce || cipher || tag)

Values without the "enc:v1:" prefix are treated as plaintext on decrypt, so
existing un-encrypted keys keep working (backward compatible).
"""

from __future__ import annotations

import os
import base64
import hashlib
import hmac
from pathlib import Path
from typing import Optional

_PREFIX = "enc:v1:"
_SECRET_FILE = "data/.secret_key"
_DERIVE_INFO = b"lingualearn-aead-key-v1"

_master_secret: Optional[str] = None


def get_master_secret() -> str:
    """
    Return the app's local secret, generating and persisting it on first use.

    SECURITY: never falls back to a hardcoded constant. If the secret file
    cannot be written (e.g. read-only FS), we keep a strong random secret in
    memory for the process lifetime instead of a predictable shared value.
    """
    global _master_secret
    if _master_secret:
        return _master_secret

    p = Path(_SECRET_FILE)
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        if p.exists():
            existing = p.read_text().strip()
            if existing:
                _master_secret = existing
                return _master_secret
        _master_secret = base64.urlsafe_b64encode(os.urandom(32)).decode()
        p.write_text(_master_secret)
        try:
            os.chmod(p, 0o600)  # best-effort: owner-only
        except OSError:
            pass
    except Exception:
        # Could not persist — use an ephemeral strong random secret (NOT a
        # predictable constant). Tokens won't survive a restart, but they can
        # never be forged with a publicly-known key.
        if not _master_secret:
            _master_secret = base64.urlsafe_b64encode(os.urandom(32)).decode()
    return _master_secret


def _derive_key(master: str) -> bytes:
    return hmac.new(master.encode(), _DERIVE_INFO, hashlib.sha256).digest()


def _keystream(key: bytes, nonce: bytes, length: int) -> bytes:
    out = bytearray()
    counter = 0
    while len(out) < length:
        block = hmac.new(key, nonce + counter.to_bytes(8, "big"), hashlib.sha256).digest()
        out.extend(block)
        counter += 1
    return bytes(out[:length])


def encrypt_secret(plaintext: str) -> str:
    """Encrypt a short secret. Empty input returns '' unchanged."""
    if not plaintext:
        return ""
    key = _derive_key(get_master_secret())
    nonce = os.urandom(16)
    data = plaintext.encode("utf-8")
    cipher = bytes(a ^ b for a, b in zip(data, _keystream(key, nonce, len(data))))
    tag = hmac.new(key, nonce + cipher, hashlib.sha256).digest()
    return _PREFIX + base64.urlsafe_b64encode(nonce + cipher + tag).decode()


def decrypt_secret(token: str) -> str:
    """
    Decrypt a value produced by encrypt_secret(). Values without the encryption
    prefix are returned as-is (backward compatibility with plaintext rows).
    Returns '' if the token is malformed or fails authentication.
    """
    if not token:
        return ""
    if not token.startswith(_PREFIX):
        return token  # legacy plaintext
    try:
        raw = base64.urlsafe_b64decode(token[len(_PREFIX):].encode())
        nonce, rest = raw[:16], raw[16:]
        cipher, tag = rest[:-32], rest[-32:]
        key = _derive_key(get_master_secret())
        expected = hmac.new(key, nonce + cipher, hashlib.sha256).digest()
        if not hmac.compare_digest(tag, expected):
            return ""
        plain = bytes(a ^ b for a, b in zip(cipher, _keystream(key, nonce, len(cipher))))
        return plain.decode("utf-8")
    except Exception:
        return ""


def is_encrypted(value: str) -> bool:
    return bool(value) and value.startswith(_PREFIX)
