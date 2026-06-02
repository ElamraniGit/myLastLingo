"""Auth: registration, login, session restore, revocation, rate limiting."""


def test_register_and_me(client, auth):
    _, headers = auth
    r = client.get("/api/v1/auth/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["username"] == "alice"


def test_me_requires_auth(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_login_wrong_password(client, auth):
    r = client.post("/api/v1/auth/login", json={"username": "alice", "password": "nope"})
    assert r.status_code == 401


def test_duplicate_username_rejected(client, auth, register):
    r = client.post(
        "/api/v1/auth/register",
        json={"username": "alice", "email": "", "password": "another"},
    )
    assert r.status_code == 409


def test_logout_revokes_token(client, auth):
    """FIX-SEC-5: token must be invalid after logout."""
    _, headers = auth
    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 200
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_password_change_revokes_old_sessions(client, register):
    token = client.post(
        "/api/v1/auth/login", json={"username": "carol", "password": "origpass"}
    )
    # carol doesn't exist yet -> register her
    _, headers = register(client, username="carol", password="origpass")
    client.patch(
        "/api/v1/auth/me",
        json={"current_password": "origpass", "new_password": "brandnew1"},
        headers=headers,
    )
    # old token now rejected
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
    # new password works
    r = client.post("/api/v1/auth/login", json={"username": "carol", "password": "brandnew1"})
    assert r.status_code == 200


def test_login_rate_limited(client, auth):
    """FIX-SEC-4: too many failures -> 429."""
    codes = [
        client.post("/api/v1/auth/login", json={"username": "alice", "password": "x"}).status_code
        for _ in range(12)
    ]
    assert 429 in codes
