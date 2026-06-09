"""
Tests for the XP status endpoint, focusing on the `reviewed_today` field used
by the client to decide whether to show a streak-warning reminder.
"""


def test_status_has_reviewed_today_zero_initially(client, auth):
    _token, headers = auth
    r = client.get("/api/v1/xp/status", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "reviewed_today" in body
    assert body["reviewed_today"] == 0


def test_reviewed_today_counts_review_actions_only(client, auth):
    _token, headers = auth

    # A non-review action (save_word) must NOT count as a review.
    client.post("/api/v1/xp/add", json={"action": "save_word"}, headers=headers)
    body = client.get("/api/v1/xp/status", headers=headers).json()
    assert body["reviewed_today"] == 0

    # Two review actions should be counted.
    client.post("/api/v1/xp/add", json={"action": "review_word"}, headers=headers)
    client.post("/api/v1/xp/add", json={"action": "review_perfect"}, headers=headers)
    body = client.get("/api/v1/xp/status", headers=headers).json()
    assert body["reviewed_today"] == 2
