"""
Tests for the mnemonic (memory hook) endpoint /practice/mnemonic.

Without a Groq key the endpoint returns 503 (AI required). We also verify auth
and basic validation. Generation quality is exercised via the coercion helper.
"""

from backend.app.api.practice import _mnemonic_coerce


def test_requires_auth(client):
    r = client.post("/api/v1/practice/mnemonic", json={"word": "gloomy"})
    assert r.status_code == 401


def test_missing_word_rejected(client, auth):
    _t, headers = auth
    r = client.post("/api/v1/practice/mnemonic", json={"word": ""}, headers=headers)
    assert r.status_code == 400


def test_without_groq_key_returns_503(client, auth):
    _t, headers = auth
    r = client.post("/api/v1/practice/mnemonic", json={"word": "gloomy"}, headers=headers)
    assert r.status_code == 503


def test_coerce_shapes_output():
    out = _mnemonic_coerce({
        "hook": "  Picture a gloomy room  ",
        "hook_ar": "تخيّل غرفة كئيبة",
        "sound_link": "غلام",
        "image": "a dark room",
        "tip": "say it slowly",
        "extra": "ignored",
    })
    assert out == {
        "hook": "Picture a gloomy room",
        "hook_ar": "تخيّل غرفة كئيبة",
        "sound_link": "غلام",
        "image": "a dark room",
        "tip": "say it slowly",
    }
    # Missing fields become empty strings, never None.
    empty = _mnemonic_coerce({})
    assert all(v == "" for v in empty.values())
