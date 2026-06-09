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


def test_activity_returns_per_day_buckets(client, auth):
    _token, headers = auth

    # No activity yet.
    r = client.get("/api/v1/xp/activity?days=30", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["days"] == 30
    assert body["active_days"] == 0
    assert body["by_day"] == {}

    # Add a couple of actions; today's bucket should reflect them.
    client.post("/api/v1/xp/add", json={"action": "review_word"}, headers=headers)
    client.post("/api/v1/xp/add", json={"action": "save_word"}, headers=headers)

    body = client.get("/api/v1/xp/activity?days=30", headers=headers).json()
    assert body["active_days"] == 1
    # Exactly one day bucket, with 2 actions and 1 review.
    (day, stats), = body["by_day"].items()
    assert stats["actions"] == 2
    assert stats["reviews"] == 1
    assert stats["xp"] > 0


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
