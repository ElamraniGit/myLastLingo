"""
Tests for the Production Practice API (/practice/check-sentence).

Without a Groq key configured, the endpoint returns a graceful fallback that
still tells the user whether the target word appears in their sentence.
"""


def test_requires_auth(client):
    r = client.post("/api/v1/practice/check-sentence",
                    json={"word": "happy", "sentence": "I am happy."})
    assert r.status_code == 401


def test_empty_sentence_rejected(client, auth):
    _token, headers = auth
    r = client.post("/api/v1/practice/check-sentence",
                    json={"word": "happy", "sentence": ""}, headers=headers)
    assert r.status_code == 400


def test_fallback_detects_word_present(client, auth):
    _token, headers = auth
    r = client.post(
        "/api/v1/practice/check-sentence",
        json={"word": "improve", "sentence": "I want to improve my English."},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    # Fallback shape is complete and detects the word.
    for key in ("correct", "uses_word", "score", "corrected", "feedback",
                "grammar_notes", "naturalness", "tip"):
        assert key in body
    assert body["uses_word"] is True


def test_fallback_detects_word_absent(client, auth):
    _token, headers = auth
    r = client.post(
        "/api/v1/practice/check-sentence",
        json={"word": "improve", "sentence": "This is a totally unrelated line."},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["uses_word"] is False
