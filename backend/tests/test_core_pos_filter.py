"""
Tests for the Core Library part-of-speech filter (used by the Phrasal Verbs
quick filter in the UI).
"""


def test_phrasal_verb_filter_returns_only_phrasal_verbs(client, auth):
    _token, headers = auth
    r = client.get("/api/v1/core/words?pos=phrasal%20verb&limit=200", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    words = body["words"]
    assert len(words) >= 40  # the B2 pack ships 44 phrasal verbs
    # Every returned row must actually be a phrasal verb.
    assert all(w["part_of_speech"] == "phrasal verb" for w in words)


def test_pos_filter_narrows_results(client, auth):
    _token, headers = auth
    total = client.get("/api/v1/core/words?limit=1", headers=headers).json()["total"]
    phrasal = client.get("/api/v1/core/words?pos=phrasal%20verb&limit=1", headers=headers).json()["total"]
    # Filtered total is positive but smaller than the whole library.
    assert 0 < phrasal < total


def test_noun_filter_excludes_phrasal_verbs(client, auth):
    _token, headers = auth
    r = client.get("/api/v1/core/words?pos=noun&limit=200", headers=headers)
    words = r.json()["words"]
    assert all(w["part_of_speech"] == "noun" for w in words)
