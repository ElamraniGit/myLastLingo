"""
End-to-end test: a user's Groq API key must be stored encrypted at rest,
and must still be usable (decryptable) by the server.
"""

import os
import sqlite3

from backend.app.utils.crypto import decrypt_secret, is_encrypted


def test_set_key_is_encrypted_in_db(client, auth):
    _token, headers = auth
    api_key = "gsk_testkey0123456789ABCDEFabcdef"

    r = client.post("/api/v1/chat/set-key", json={"api_key": api_key}, headers=headers)
    assert r.status_code == 200, r.text

    # Read the raw column straight from the database file.
    db_path = os.environ["LINGUALEARN_DB_PATH"]
    conn = sqlite3.connect(db_path)
    try:
        row = conn.execute(
            "SELECT groq_api_key FROM users LIMIT 1"
        ).fetchone()
    finally:
        conn.close()

    stored = row[0]
    # Stored value must NOT be the plaintext key…
    assert stored != api_key
    assert api_key not in stored
    # …it must be in the encrypted envelope…
    assert is_encrypted(stored)
    # …and it must decrypt back to the original.
    assert decrypt_secret(stored) == api_key


def test_has_key_reports_true_after_set(client, auth):
    _token, headers = auth
    assert client.get("/api/v1/chat/has-key", headers=headers).json()["has_key"] is False
    client.post("/api/v1/chat/set-key", json={"api_key": "gsk_anotherkey0123456789xyz"}, headers=headers)
    assert client.get("/api/v1/chat/has-key", headers=headers).json()["has_key"] is True
