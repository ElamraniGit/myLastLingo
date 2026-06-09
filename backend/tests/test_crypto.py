"""
Tests for backend.app.utils.crypto — local authenticated encryption used to
protect secrets (e.g. the Groq API key) at rest.
"""

from backend.app.utils import crypto


def test_roundtrip():
    secret = "gsk_abc123456789012345678901234567890"
    token = crypto.encrypt_secret(secret)
    assert crypto.is_encrypted(token)
    assert token != secret
    assert crypto.decrypt_secret(token) == secret


def test_empty_values():
    assert crypto.encrypt_secret("") == ""
    assert crypto.decrypt_secret("") == ""


def test_legacy_plaintext_passthrough():
    # Values stored before encryption was added must still be readable.
    assert crypto.decrypt_secret("gsk_legacy_plaintext_key") == "gsk_legacy_plaintext_key"


def test_tampered_token_is_rejected():
    token = crypto.encrypt_secret("sensitive-value")
    tampered = token[:-3] + ("aaa" if not token.endswith("aaa") else "bbb")
    assert crypto.decrypt_secret(tampered) == ""


def test_nonce_makes_ciphertext_unique():
    s = "same-secret"
    assert crypto.encrypt_secret(s) != crypto.encrypt_secret(s)


def test_no_hardcoded_fallback_secret():
    # The master secret must be strong/random, never a known constant.
    secret = crypto.get_master_secret()
    assert secret
    assert "fallback" not in secret.lower()
    assert len(secret) >= 32
