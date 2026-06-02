"""
Shared pytest fixtures for LinguaLearn backend tests.

Spins up the real FastAPI app against a throwaway SQLite database so tests
exercise the full request → router → DB path (no mocks).
"""

import os
import sys
import tempfile
from pathlib import Path

import pytest

# Make the project importable the same way the app does at runtime.
_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(_ROOT))
sys.path.insert(0, str(_ROOT / "backend"))


@pytest.fixture()
def client():
    """A TestClient backed by a fresh, isolated database per test."""
    from fastapi.testclient import TestClient

    db_path = tempfile.mktemp(suffix=".db")
    os.environ["LINGUALEARN_DB_PATH"] = db_path

    # Import inside the fixture so the env var is set before app startup.
    import importlib
    import backend.main as main
    importlib.reload(main)

    with TestClient(main.app) as c:
        yield c

    for suffix in ("", "-wal", "-shm"):
        try:
            os.remove(db_path + suffix)
        except OSError:
            pass


def _register(client, username="alice", password="secret1", email=""):
    r = client.post(
        "/api/v1/auth/register",
        json={"username": username, "email": email, "password": password},
    )
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    return token, {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def auth(client):
    """Return (token, headers) for a freshly registered user."""
    return _register(client)


@pytest.fixture()
def register():
    """Expose the register helper to tests that need a second user."""
    return _register
