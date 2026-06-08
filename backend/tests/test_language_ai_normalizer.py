import asyncio
import tempfile

from backend.ai.language.normalizer import normalize_ai_response
from backend.app.db.database import DatabaseManager


def test_normalize_ai_response_preserves_rich_learning_sections():
    raw = {
        "term": "went",
        "entry_type": "word",
        "translation": "ذهب",
        "pronunciation": "/wɛnt/",
        "part_of_speech": "verb",
        "part_of_speech_explanation": "past-tense verb form",
        "cefr_level": "A2",
        "meanings": [
            {
                "rank": 1,
                "arabic": "ذهب",
                "english_simple": "moved from one place to another",
                "english_advanced": "past-tense form used to describe movement to a destination",
                "context": "general",
                "register": "neutral",
            }
        ],
        "word_explanation": "This is the common past form of go and is used to talk about completed movement in the past.",
        "grammar_analysis": {
            "summary": "Past simple form of go.",
            "base_form": "go",
            "form_type": "past tense",
            "tense": "Past Simple",
            "notes": ["Use it for finished actions in the past."],
            "inflected_forms": {"base": "go", "past": "went", "past participle": "gone"},
        },
        "synonym_details": [
            {"term": "traveled", "short_definition": "moved from one place to another", "commonness": "high"},
            {"term": "headed", "short_definition": "went in a direction", "commonness": "medium"},
        ],
        "antonym_details": [
            {"term": "stayed", "short_definition": "did not leave", "commonness": "high"}
        ],
        "example_details": [
            {
                "english": "She went to the market before work.",
                "arabic": "ذهبت إلى السوق قبل العمل.",
                "difficulty": "A2",
                "register": "daily",
                "focus": "simple past action",
            },
            {
                "english": "The discussion went in a different direction.",
                "arabic": "سار النقاش في اتجاه مختلف.",
                "difficulty": "B2",
                "register": "academic",
                "focus": "abstract use",
            },
        ],
        "collocation_details": [
            {"expression": "went home", "pattern": "verb+adverb", "meaning": "returned home", "translation": "عاد إلى البيت"}
        ],
        "word_family": [
            {"term": "go", "part_of_speech": "verb", "meaning": "to move"},
            {"term": "gone", "part_of_speech": "verb", "meaning": "past participle of go"},
        ],
        "common_mistakes": [
            {"mistake": "I have went", "correction": "I have gone", "explanation": "Use gone after have/has/had."}
        ],
        "teaching_notes": ["Remember: went is past simple, gone is past participle."],
        "frequency_score": 88,
        "confidence": 0.94,
    }

    entry = normalize_ai_response(raw, "went")

    assert entry["translation"] == "ذهب"
    assert entry["meanings"][0]["english_simple"] == "moved from one place to another"
    assert entry["definitions"][0]["text"] == "moved from one place to another"
    assert entry["grammar_analysis"]["base_form"] == "go"
    assert entry["examples"][0] == "She went to the market before work."
    assert "traveled" in entry["synonyms"]
    assert entry["frequency_label"] == "Very Common"
    assert entry["common_mistakes"][0]["correction"] == "I have gone"


def test_word_roundtrip_preserves_ai_payload_for_saved_words():
    path = tempfile.mktemp(suffix=".db")
    db = DatabaseManager(path)
    asyncio.run(db.initialize())

    async def _run():
        payload = {
            "term": "went",
            "grammar_analysis": {"base_form": "go"},
            "meanings": [{"english_simple": "moved from one place to another", "arabic": "ذهب"}],
        }
        word_data = {
            "id": "w1",
            "word": "went",
            "pronunciation": "/wɛnt/",
            "part_of_speech": "verb",
            "level": "A2",
            "meaning_ar": "ذهب",
            "meaning_en": "moved from one place to another",
            "examples": ["She went home early."],
            "synonyms": ["traveled"],
            "antonyms": ["stayed"],
            "root_form": "go",
            "conjugations": {"base": "go", "past": "went"},
            "related_words": ["gone"],
            "collocations": ["went home"],
            "definitions": [{"part_of_speech": "verb", "definition": "moved from one place to another", "example": ""}],
            "how_to_use": ["Use it for completed past actions."],
            "usage_notes": "Use it for completed past actions.",
            "grammar_notes": "Past simple of go.",
            "entry_type": "word",
            "difficulty_score": 0.2,
            "priority_score": 0.9,
            "frequency": 88,
            "ai_enriched": True,
            "ai_payload": payload,
        }
        await db.add_word(word_data)
        found = await db.get_word("went")
        saved_id = await db.save_word_to_vocabulary("w1", None, "She went home early.", "", user_id="u1")
        saved = await db.get_saved_word(saved_id)
        return found, saved

    found, saved = asyncio.run(_run())

    assert found["ai_payload"]["grammar_analysis"]["base_form"] == "go"
    assert saved["_ai_entry"]["term"] == "went"
    assert saved["_ai_entry"]["meanings"][0]["arabic"] == "ذهب"
