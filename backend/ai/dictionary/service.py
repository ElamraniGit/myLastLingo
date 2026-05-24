"""
Local Dictionary Service for LinguaLearn.
Provides word definitions, translations, and linguistic analysis without external APIs.
Uses built-in word databases and NLP heuristics.
"""

import json
import re
import logging
import gzip
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class DictionaryConfig:
    type: str = "local"
    path: str = "data/dictionary/"


# Built-in comprehensive word database (curated subset of common English words)
BUILT_IN_DICTIONARY = {
    "the": {
        "pronunciation": "/ðə/",
        "part_of_speech": "article",
        "level": "A1",
        "meaning_ar": "ال",
        "meaning_en": "used to refer to a specific noun",
        "examples": ["The book is on the table.", "The sun is shining."],
        "synonyms": [],
        "antonyms": []
    },
    "be": {
        "pronunciation": "/biː/",
        "part_of_speech": "verb",
        "level": "A1",
        "meaning_ar": "يكون",
        "meaning_en": "to exist, to occur, to have the quality of",
        "examples": ["I want to be a doctor.", "It will be cold tomorrow."],
        "synonyms": ["exist", "live"],
        "antonyms": []
    },
    "learn": {
        "pronunciation": "/lɜːrn/",
        "part_of_speech": "verb",
        "level": "A1",
        "meaning_ar": "يتعلم",
        "meaning_en": "to gain knowledge or skill by studying",
        "examples": ["I want to learn English.", "Children learn quickly."],
        "synonyms": ["study", "acquire", "master"],
        "antonyms": ["teach", "unlearn"]
    },
    "understand": {
        "pronunciation": "/ˌʌndərˈstænd/",
        "part_of_speech": "verb",
        "level": "A2",
        "meaning_ar": "يفهم",
        "meaning_en": "to grasp the meaning of something",
        "examples": ["I understand the lesson.", "Do you understand me?"],
        "synonyms": ["comprehend", "grasp"],
        "antonyms": ["misunderstand", "confuse"]
    },
    "beautiful": {
        "pronunciation": "/ˈbjuːtɪfəl/",
        "part_of_speech": "adjective",
        "level": "A2",
        "meaning_ar": "جميل",
        "meaning_en": "pleasing to the senses or mind",
        "examples": ["What a beautiful sunset!", "She has a beautiful voice."],
        "synonyms": ["gorgeous", "lovely", "stunning"],
        "antonyms": ["ugly", "hideous"]
    },
    "develop": {
        "pronunciation": "/dɪˈvɛləp/",
        "part_of_speech": "verb",
        "level": "B1",
        "meaning_ar": "يطوّر",
        "meaning_en": "to grow or cause to grow or become more advanced",
        "examples": ["The company developed new software.", "Children develop at different rates."],
        "synonyms": ["evolve", "advance", "improve"],
        "antonyms": ["regress", "decline"],
        "conjugations": {"base": "develop", "past": "developed", "past_participle": "developed", "present_participle": "developing", "third_person": "develops"}
    },
    "technology": {
        "pronunciation": "/tɛkˈnɒlədʒi/",
        "part_of_speech": "noun",
        "level": "B1",
        "meaning_ar": "تكنولوجيا",
        "meaning_en": "the application of scientific knowledge for practical purposes",
        "examples": ["Technology is changing rapidly.", "Modern technology has improved healthcare."],
        "synonyms": ["innovation", "engineering", "science"],
        "antonyms": []
    },
    "opportunity": {
        "pronunciation": "/ˌɒpərˈtjuːnɪti/",
        "part_of_speech": "noun",
        "level": "B1",
        "meaning_ar": "فرصة",
        "meaning_en": "a set of circumstances that makes it possible to do something",
        "examples": ["This is a great opportunity.", "Don't miss this opportunity!"],
        "synonyms": ["chance", "possibility"],
        "antonyms": ["obstacle", "hindrance"]
    },
    "significant": {
        "pronunciation": "/sɪɡˈnɪfɪkənt/",
        "part_of_speech": "adjective",
        "level": "B2",
        "meaning_ar": "مهم / كبير",
        "meaning_en": "sufficiently great or important to be worthy of attention",
        "examples": ["There was a significant increase in sales.", "This is a significant discovery."],
        "synonyms": ["important", "notable", "remarkable"],
        "antonyms": ["insignificant", "minor", "trivial"]
    },
    "sophisticated": {
        "pronunciation": "/səˈfɪstɪkeɪtɪd/",
        "part_of_speech": "adjective",
        "level": "C1",
        "meaning_ar": "متطور / راقي",
        "meaning_en": "having refined knowledge or complex technology",
        "examples": ["The software uses sophisticated algorithms.", "She has a sophisticated taste in art."],
        "synonyms": ["advanced", "complex", "refined"],
        "antonyms": ["simple", "unsophisticated", "primitive"]
    },
    "ubiquitous": {
        "pronunciation": "/juːˈbɪkʷɪtəs/",
        "part_of_speech": "adjective",
        "level": "C2",
        "meaning_ar": "موجود في كل مكان",
        "meaning_en": "present, appearing, or found everywhere",
        "examples": ["Smartphones have become ubiquitous.", "The song was ubiquitous that summer."],
        "synonyms": ["omnipresent", "pervasive", "universal"],
        "antonyms": ["rare", "scarce", "uncommon"]
    },
    "hello": {
        "pronunciation": "/həˈloʊ/",
        "part_of_speech": "interjection",
        "level": "A1",
        "meaning_ar": "مرحبًا",
        "meaning_en": "used as a greeting",
        "examples": ["Hello, how are you?", "Hello everyone!"],
        "synonyms": ["hi", "greetings"],
        "antonyms": ["goodbye"]
    },
    "goodbye": {
        "pronunciation": "/ɡʊdˈbaɪ/",
        "part_of_speech": "interjection",
        "level": "A1",
        "meaning_ar": "وداعًا",
        "meaning_en": "used to express good wishes when parting",
        "examples": ["Goodbye, see you tomorrow!", "Say goodbye to your friends."],
        "synonyms": ["farewell", "bye"],
        "antonyms": ["hello"]
    },
    "important": {
        "pronunciation": "/ɪmˈpɔːrtənt/",
        "part_of_speech": "adjective",
        "level": "A2",
        "meaning_ar": "مهم",
        "meaning_en": "having great significance or value",
        "examples": ["This is an important meeting.", "Education is important for success."],
        "synonyms": ["significant", "crucial", "vital"],
        "antonyms": ["unimportant", "trivial"]
    },
    "study": {
        "pronunciation": "/ˈstʌdi/",
        "part_of_speech": "verb",
        "level": "A1",
        "meaning_ar": "يدرس",
        "meaning_en": "to devote time and attention to gaining knowledge",
        "examples": ["I study English every day.", "She studied hard for the exam."],
        "synonyms": ["learn", "review"],
        "antonyms": ["teach"]
    },
    "challenge": {
        "pronunciation": "/ˈtʃælɪndʒ/",
        "part_of_speech": "noun",
        "level": "B1",
        "meaning_ar": "تحدي",
        "meaning_en": "a task or situation that tests someone's abilities",
        "examples": ["Learning a new language is a challenge.", "She faced the challenge bravely."],
        "synonyms": ["difficulty", "obstacle", "test"],
        "antonyms": ["ease", "solution"]
    },
    "fluent": {
        "pronunciation": "/ˈfluːənt/",
        "part_of_speech": "adjective",
        "level": "B2",
        "meaning_ar": "طلق / بطلاقة",
        "meaning_en": "able to express oneself easily and articulately",
        "examples": ["She is fluent in three languages.", "He speaks fluent English."],
        "synonyms": ["articulate", "eloquent"],
        "antonyms": ["halting", "hesitant"]
    },
    "vocabulary": {
        "pronunciation": "/vəˈkæbjʊleri/",
        "part_of_speech": "noun",
        "level": "A2",
        "meaning_ar": "مفردات",
        "meaning_en": "the body of words used in a particular language",
        "examples": ["Reading helps improve your vocabulary.", "I need to expand my vocabulary."],
        "synonyms": ["lexicon", "terminology"],
        "antonyms": []
    }
}


class DictionaryService:
    """
    Local dictionary service using built-in word database.
    Extensible with StarDict or other dict formats.
    """
    
    def __init__(self, config: Optional[DictionaryConfig] = None):
        self.config = config or DictionaryConfig()
        self._dictionary = {}
        self._loaded = False
    
    async def load_dictionary(self):
        """Load the dictionary database."""
        if self._loaded:
            return
        
        logger.info("Loading local dictionary...")
        
        # Start with built-in dictionary
        self._dictionary = dict(BUILT_IN_DICTIONARY)
        
        # Try to load additional word lists from files
        dict_path = Path(self.config.path)
        if dict_path.exists():
            for file_path in dict_path.glob("*.json"):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        self._dictionary.update(data)
                    logger.info(f"Loaded dictionary: {file_path.name}")
                except Exception as e:
                    logger.warning(f"Failed to load {file_path}: {e}")
        
        self._loaded = True
        logger.info(f"Dictionary loaded: {len(self._dictionary)} words")
    
    async def lookup(self, word: str) -> Optional[Dict[str, Any]]:
        """
        Look up a word in the local dictionary.
        Returns comprehensive word data or None.
        """
        await self.load_dictionary()
        
        word = word.lower().strip()
        
        # Direct lookup
        if word in self._dictionary:
            data = dict(self._dictionary[word])
            data['word'] = word
            
            # Add root form
            data['root_form'] = word
            data['related_words'] = self._find_related_words(word)
            data['conjugations'] = data.get('conjugations', self._estimate_conjugations(word))
            
            return data
        
        # Stemmed lookup
        stemmed = self._stem(word)
        if stemmed and stemmed in self._dictionary:
            data = dict(self._dictionary[stemmed])
            data['word'] = word
            data['root_form'] = stemmed
            data['related_words'] = self._find_related_words(stemmed)
            return data
        
        return None
    
    def _stem(self, word: str) -> Optional[str]:
        """Simple stemmer for common English inflections."""
        # Remove common suffixes
        suffixes = ['ing', 'ed', 'ly', 's', 'es', 'ies', 'er', 'est', 'tion', 'ment']
        
        for suffix in suffixes:
            if word.endswith(suffix) and len(word) > len(suffix) + 2:
                base = word[:-len(suffix)]
                # Irregular mappings
                if word.endswith('ies') and len(word) > 3:
                    base = word[:-3] + 'y'
                elif word.endswith('ying') and len(word) > 4:
                    base = word[:-3] + 'ie'
                elif word.endswith('eed'):
                    base = word
                elif word.endswith('ed') and not word.endswith('eed'):
                    base = word[:-2]
                    if base.endswith('i'):
                        base = base[:-1] + 'y'
                
                if base in self._dictionary:
                    return base
        
        return None
    
    def _find_related_words(self, word: str) -> List[str]:
        """Find related words (same root, different forms)."""
        related = []
        for dict_word, data in self._dictionary.items():
            if dict_word != word:
                if data.get('root_form') == word:
                    related.append(dict_word)
                # Check word length similarity and shared root
                if len(word) > 3 and abs(len(dict_word) - len(word)) < 4:
                    if dict_word.startswith(word[:3]) or word.startswith(dict_word[:3]):
                        related.append(dict_word)
        
        return list(set(related))[:10]
    
    def _estimate_conjugations(self, word: str) -> Dict[str, str]:
        """Estimate verb conjugations for common patterns."""
        if word.endswith('e'):
            return {
                "base": word,
                "past": word + "d",
                "past_participle": word + "d",
                "present_participle": word[:-1] + "ing",
                "third_person": word + "s"
            }
        elif word.endswith('y'):
            return {
                "base": word,
                "past": word[:-1] + "ied",
                "past_participle": word[:-1] + "ied",
                "present_participle": word + "ing",
                "third_person": word[:-1] + "ies"
            }
        else:
            return {
                "base": word,
                "past": word + "ed",
                "past_participle": word + "ed",
                "present_participle": word + "ing",
                "third_person": word + "s"
            }
    
    def search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search for words matching query."""
        query = query.lower()
        results = []
        
        for word, data in self._dictionary.items():
            if query in word:
                results.append({
                    "word": word,
                    "part_of_speech": data.get("part_of_speech", ""),
                    "meaning_ar": data.get("meaning_ar", ""),
                    "meaning_en": data.get("meaning_en", ""),
                    "level": data.get("level", "B1")
                })
        
        return sorted(results, key=lambda x: x['word'])[:limit]
    
    @property
    def word_count(self) -> int:
        return len(self._dictionary)