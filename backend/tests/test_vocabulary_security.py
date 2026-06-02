"""IDOR / per-user isolation for vocabulary (FIX-SEC-2)."""


def _save_word(client, headers, word="serendipity"):
    r = client.post("/api/v1/vocabulary/save", json={"word": word}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_user_isolation_list(client, auth, register):
    _, h_alice = auth
    _save_word(client, h_alice)
    _, h_bob = register(client, username="bob", password="secret2")

    assert client.get("/api/v1/vocabulary/list", headers=h_alice).json()["total"] == 1
    assert client.get("/api/v1/vocabulary/list", headers=h_bob).json()["total"] == 0


def test_cross_user_delete_forbidden(client, auth, register):
    _, h_alice = auth
    saved_id = _save_word(client, h_alice)
    _, h_bob = register(client, username="bob", password="secret2")
    assert client.delete(f"/api/v1/vocabulary/{saved_id}", headers=h_bob).status_code == 403
    # still there for alice
    assert client.get("/api/v1/vocabulary/list", headers=h_alice).json()["total"] == 1


def test_cross_user_review_forbidden(client, auth, register):
    _, h_alice = auth
    saved_id = _save_word(client, h_alice)
    _, h_bob = register(client, username="bob", password="secret2")
    r = client.post(
        "/api/v1/vocabulary/review",
        json={"saved_word_id": saved_id, "quality": 5},
        headers=h_bob,
    )
    assert r.status_code == 403


def test_owner_can_review(client, auth):
    _, h_alice = auth
    saved_id = _save_word(client, h_alice)
    r = client.post(
        "/api/v1/vocabulary/review",
        json={"saved_word_id": saved_id, "quality": 5},
        headers=h_alice,
    )
    assert r.status_code == 200
