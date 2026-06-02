"""Phase 5: vocabulary export (CSV/JSON) and bulk import."""


def test_import_adds_words(client, auth):
    _, h = auth
    r = client.post(
        "/api/v1/vocabulary/import",
        json={"words": [{"word": "serendipity"}, {"word": "ephemeral"}]},
        headers=h,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["added"] == 2
    assert client.get("/api/v1/vocabulary/list", headers=h).json()["total"] == 2


def test_import_skips_duplicates(client, auth):
    _, h = auth
    client.post("/api/v1/vocabulary/import", json={"words": [{"word": "alpha"}]}, headers=h)
    r = client.post("/api/v1/vocabulary/import", json={"words": [{"word": "alpha"}]}, headers=h)
    assert r.json()["skipped"] == 1
    assert r.json()["added"] == 0


def test_import_rejects_empty(client, auth):
    _, h = auth
    assert client.post("/api/v1/vocabulary/import", json={"words": []}, headers=h).status_code == 400


def test_export_csv(client, auth):
    _, h = auth
    client.post("/api/v1/vocabulary/import", json={"words": [{"word": "beta"}]}, headers=h)
    r = client.get("/api/v1/vocabulary/export?format=csv", headers=h)
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    assert "word,meaning_en" in r.text
    assert "beta" in r.text


def test_export_json(client, auth):
    _, h = auth
    client.post("/api/v1/vocabulary/import", json={"words": [{"word": "gamma"}]}, headers=h)
    r = client.get("/api/v1/vocabulary/export?format=json", headers=h)
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 1
    assert body["words"][0]["word"] == "gamma"


def test_export_requires_auth(client):
    assert client.get("/api/v1/vocabulary/export").status_code == 401
