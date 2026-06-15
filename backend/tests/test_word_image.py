"""
Tests for the word image endpoint /dictionary/image/{word}.

Network calls to Openverse are mocked so the test is deterministic/offline.
"""


def test_requires_auth(client):
    assert client.get("/api/v1/dictionary/image/mountain").status_code == 401


def test_returns_image_shape_and_caches(client, auth, monkeypatch):
    _t, headers = auth

    import backend.app.api.dictionary as dapi

    calls = {"n": 0}

    class _Resp:
        status = 200
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def json(self):
            return {"results": [{
                "thumbnail": "https://example.test/mountain.jpg",
                "foreign_landing_url": "https://example.test/page",
                "title": "Mountain",
                "creator": "Someone",
            }]}

    class _Session:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        def get(self, *a, **k):
            calls["n"] += 1
            return _Resp()

    monkeypatch.setattr(dapi._aiohttp, "ClientSession", _Session)

    r = client.get("/api/v1/dictionary/image/mountain", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["found"] is True
    assert body["thumbnail"] == "https://example.test/mountain.jpg"
    assert body["cached"] is False

    # Second call is served from cache → no extra network hit.
    r2 = client.get("/api/v1/dictionary/image/mountain", headers=headers)
    assert r2.json()["cached"] is True
    assert calls["n"] == 1


def test_no_results_is_cached_miss(client, auth, monkeypatch):
    _t, headers = auth
    import backend.app.api.dictionary as dapi

    class _Resp:
        status = 200
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def json(self): return {"results": []}

    class _Session:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        def get(self, *a, **k): return _Resp()

    monkeypatch.setattr(dapi._aiohttp, "ClientSession", _Session)

    body = client.get("/api/v1/dictionary/image/zzqxabc", headers=headers).json()
    assert body["found"] is False
    assert body["thumbnail"] == ""
