"""
Tests for the Core Library /core/progress per-level breakdown.

Regression: 'By CEFR Level' was empty because the breakdown was built only from
rows the user had already started. It must always list every level with its true
total (driven by core_words), regardless of progress.
"""

LEVELS = {"A1", "A2", "B1", "B2", "C1", "C2"}


def test_by_level_lists_all_levels_with_no_progress(client, auth):
    _token, headers = auth
    r = client.get("/api/v1/core/progress", headers=headers)
    assert r.status_code == 200, r.text
    by_level = r.json()["by_level"]

    levels = {row["level"] for row in by_level}
    # Every level present in the seeded library shows up...
    assert levels.issubset(LEVELS)
    assert {"A1", "A2", "B1", "B2"}.issubset(levels)
    # ...each with a real total and zero progress.
    for row in by_level:
        assert row["total"] > 0
        assert row["started"] == 0
        assert row["learned"] == 0


def test_by_level_reflects_a_review(client, auth):
    _token, headers = auth

    # Find a B2 word and review it as "perfect" (quality 5).
    words = client.get("/api/v1/core/words?level=B2&limit=1", headers=headers).json()["words"]
    assert words, "expected B2 words in the seeded library"
    word_id = words[0]["id"]

    rr = client.post(f"/api/v1/core/progress/{word_id}", json={"quality": 5}, headers=headers)
    assert rr.status_code == 200, rr.text

    by_level = client.get("/api/v1/core/progress", headers=headers).json()["by_level"]
    b2 = next(row for row in by_level if row["level"] == "B2")
    assert b2["total"] > 0
    assert b2["started"] >= 1
