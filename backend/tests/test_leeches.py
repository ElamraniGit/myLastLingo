"""
Tests for the "hard words" (leeches) endpoint /vocabulary/leeches — words the
learner repeatedly forgets, surfaced for focused practice.
"""


def _save(client, headers, word):
    r = client.post("/api/v1/vocabulary/save", json={"word": word}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _review(client, headers, saved_id, quality):
    r = client.post("/api/v1/vocabulary/review",
                    json={"saved_word_id": saved_id, "quality": quality}, headers=headers)
    assert r.status_code == 200, r.text


def test_leeches_empty_initially(client, auth):
    _t, headers = auth
    _save(client, headers, "serendipity")
    r = client.get("/api/v1/vocabulary/leeches", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] == 0
    assert body["words"] == []


def test_repeated_failures_become_a_leech(client, auth):
    _t, headers = auth
    sid = _save(client, headers, "ubiquitous")

    # Build a lapse history: succeed, then fail repeatedly. A lapse is counted
    # after there have been prior reviews, so several fails accumulate lapses.
    _review(client, headers, sid, 5)   # learned a bit (reps > 0)
    for _ in range(4):
        _review(client, headers, sid, 0)  # "Again" → increments lapses

    body = client.get("/api/v1/vocabulary/leeches", headers=headers).json()
    assert body["total"] >= 1
    assert any(w["word"] == "ubiquitous" for w in body["words"])


def test_leeches_requires_auth(client):
    assert client.get("/api/v1/vocabulary/leeches").status_code == 401
