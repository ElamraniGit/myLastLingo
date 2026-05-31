"""
Smart Quiz Generator.

Implements:
  - Active Recall: target word is never shown alongside its answer.
  - Retrieval practice: distractors are real saved words (not random).
  - Context-based learning: pulls real example sentences.
  - Interleaving: a session shuffles word order AND question type;
    consecutive questions never share the same type.
  - Desirable difficulty: question type is chosen adaptively from the
    word's mastery score.

MVP question types (the 4 with the highest pedagogical ROI):

  1. EN_TO_AR        — recall meaning from a known surface form
  2. AR_TO_EN        — productive recall (harder)
  3. FILL_BLANK      — context-driven retrieval
  4. DEFINITION_MATCH— deep semantic processing
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import List, Optional, Dict, Any, Tuple
import random
import re
import uuid


class QuestionType(str, Enum):
    EN_TO_AR = "en_to_ar"
    AR_TO_EN = "ar_to_en"
    FILL_BLANK = "fill_blank"
    DEFINITION_MATCH = "definition_match"
    # Reserved for v2 (not generated in MVP unless data allows):
    SYNONYM_MATCH = "synonym_match"
    LISTENING = "listening"


@dataclass
class QuizQuestion:
    id: str
    saved_word_id: str
    word: str
    type: QuestionType
    prompt: str                           # what the user sees
    prompt_meta: Dict[str, Any] = field(default_factory=dict)  # e.g. blanked sentence
    choices: List[Dict[str, Any]] = field(default_factory=list) # {id, label, is_correct}
    correct_choice_id: str = ""
    explanation: str = ""                 # shown after answering
    hint: Optional[str] = None
    audio_word: Optional[str] = None      # word to TTS for listening types

    def to_dict(self) -> dict:
        d = asdict(self)
        d["type"] = self.type.value
        return d


@dataclass
class QuizSession:
    id: str
    questions: List[QuizQuestion]
    created_at: str

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "created_at": self.created_at,
            "questions": [q.to_dict() for q in self.questions],
            "total": len(self.questions),
        }


# ────────────────────────────────────────────────────────────────────────────

class QuizGenerator:
    """Builds an interleaved quiz session from saved words."""

    MIN_POOL_FOR_DISTRACTORS = 4  # need ≥3 distractors + the answer

    def __init__(self, seed: Optional[int] = None):
        self.rng = random.Random(seed)

    # ── public ───────────────────────────────────────────────────────────
    def build_session(
        self,
        target_words: List[Dict[str, Any]],
        pool: List[Dict[str, Any]],
        max_questions: int = 10,
    ) -> QuizSession:
        """
        target_words: words due for review (focus of this session).
        pool: all available saved words (used to mine distractors).
        """
        pool_by_id = {w["id"]: w for w in pool}
        # Make sure target words are also in the pool
        for tw in target_words:
            pool_by_id.setdefault(tw["id"], tw)
        full_pool = list(pool_by_id.values())

        target_subset = target_words[:max_questions]
        self.rng.shuffle(target_subset)

        questions: List[QuizQuestion] = []
        last_type: Optional[QuestionType] = None

        for w in target_subset:
            q = self._build_question_for(w, full_pool, avoid_type=last_type)
            if q is None:
                continue
            questions.append(q)
            last_type = q.type

        return QuizSession(
            id=str(uuid.uuid4()),
            questions=questions,
            created_at=_now(),
        )

    # ── per-word logic ───────────────────────────────────────────────────
    def _build_question_for(
        self,
        word: Dict[str, Any],
        pool: List[Dict[str, Any]],
        avoid_type: Optional[QuestionType] = None,
    ) -> Optional[QuizQuestion]:
        available = self._available_types(word)
        if avoid_type and len(available) > 1:
            available = [t for t in available if t != avoid_type] or available
        # Weighted by mastery: low mastery → easier types; high → harder.
        qtype = self._pick_type_adaptive(word, available)
        try:
            return self._builders[qtype](self, word, pool)
        except Exception:
            return None

    def _available_types(self, word: Dict[str, Any]) -> List[QuestionType]:
        types = [QuestionType.EN_TO_AR, QuestionType.AR_TO_EN]
        if word.get("sentence") and _word_in_sentence(word["word"], word["sentence"]):
            types.append(QuestionType.FILL_BLANK)
        if word.get("meaning_en"):
            types.append(QuestionType.DEFINITION_MATCH)
        if not word.get("meaning_ar"):
            # Drop AR-based variants if no Arabic translation.
            types = [t for t in types if t not in (QuestionType.EN_TO_AR, QuestionType.AR_TO_EN)]
        return types or [QuestionType.EN_TO_AR]

    def _pick_type_adaptive(self, word: Dict[str, Any], allowed: List[QuestionType]) -> QuestionType:
        """
        Low mastery (< 30):  prefer recognition (EN→AR, DEFINITION_MATCH).
        Mid mastery (30-70): mix freely.
        High mastery (>70):  prefer production (AR→EN, FILL_BLANK).
        """
        mastery = int(word.get("mastery_score") or 0)
        weights = []
        for t in allowed:
            if mastery < 30:
                w = {QuestionType.EN_TO_AR: 4, QuestionType.DEFINITION_MATCH: 3,
                     QuestionType.FILL_BLANK: 2, QuestionType.AR_TO_EN: 1}.get(t, 1)
            elif mastery > 70:
                w = {QuestionType.AR_TO_EN: 4, QuestionType.FILL_BLANK: 4,
                     QuestionType.DEFINITION_MATCH: 2, QuestionType.EN_TO_AR: 1}.get(t, 1)
            else:
                w = 2
            weights.append(w)
        return self.rng.choices(allowed, weights=weights, k=1)[0]

    # ── builders per type ────────────────────────────────────────────────
    def _build_en_to_ar(self, word: Dict[str, Any], pool: List[Dict[str, Any]]) -> Optional[QuizQuestion]:
        correct = (word.get("meaning_ar") or "").strip()
        if not correct:
            return None
        distractors = self._distractors(
            pool, word, key="meaning_ar", n=3,
            filter_fn=lambda w: bool((w.get("meaning_ar") or "").strip()),
        )
        if len(distractors) < 3:
            return None
        return self._mc_question(
            word=word,
            qtype=QuestionType.EN_TO_AR,
            prompt=word["word"],
            prompt_meta={"pronunciation": word.get("pronunciation")},
            correct_label=correct,
            distractor_labels=[d for d in distractors],
            explanation=f'"{word["word"]}" يعني: {correct}',
        )

    def _build_ar_to_en(self, word: Dict[str, Any], pool: List[Dict[str, Any]]) -> Optional[QuizQuestion]:
        ar = (word.get("meaning_ar") or "").strip()
        if not ar:
            return None
        distractors = self._distractors(pool, word, key="word", n=3)
        if len(distractors) < 3:
            return None
        return self._mc_question(
            word=word,
            qtype=QuestionType.AR_TO_EN,
            prompt=ar,
            prompt_meta={"direction": "rtl"},
            correct_label=word["word"],
            distractor_labels=distractors,
            explanation=f'الترجمة الصحيحة هي: {word["word"]}',
        )

    def _build_fill_blank(self, word: Dict[str, Any], pool: List[Dict[str, Any]]) -> Optional[QuizQuestion]:
        sentence = word.get("sentence") or ""
        if not _word_in_sentence(word["word"], sentence):
            # Fall back to a constructed example
            examples = word.get("examples") or []
            sentence = next((e for e in examples if _word_in_sentence(word["word"], e)), "")
        if not sentence:
            return None
        blanked = _blank_out(word["word"], sentence)
        distractors = self._distractors(pool, word, key="word", n=3)
        if len(distractors) < 3:
            return None
        return self._mc_question(
            word=word,
            qtype=QuestionType.FILL_BLANK,
            prompt="أكمل الفراغ بالكلمة المناسبة",
            prompt_meta={"sentence_blanked": blanked, "original_sentence": sentence},
            correct_label=word["word"],
            distractor_labels=distractors,
            explanation=f'الجملة الصحيحة: "{sentence}"',
        )

    def _build_definition_match(self, word: Dict[str, Any], pool: List[Dict[str, Any]]) -> Optional[QuizQuestion]:
        defin = (word.get("meaning_en") or "").strip()
        if not defin:
            return None
        distractors = self._distractors(pool, word, key="word", n=3)
        if len(distractors) < 3:
            return None
        return self._mc_question(
            word=word,
            qtype=QuestionType.DEFINITION_MATCH,
            prompt="ما الكلمة التي يصفها هذا التعريف؟",
            prompt_meta={"definition": defin},
            correct_label=word["word"],
            distractor_labels=distractors,
            explanation=f'"{word["word"]}" — {defin}',
        )

    _builders = {
        QuestionType.EN_TO_AR: _build_en_to_ar,
        QuestionType.AR_TO_EN: _build_ar_to_en,
        QuestionType.FILL_BLANK: _build_fill_blank,
        QuestionType.DEFINITION_MATCH: _build_definition_match,
    }

    # ── helpers ──────────────────────────────────────────────────────────
    def _distractors(
        self,
        pool: List[Dict[str, Any]],
        target: Dict[str, Any],
        *,
        key: str,
        n: int,
        filter_fn=None,
    ) -> List[str]:
        seen = set()
        target_val = (target.get(key) or "").strip().lower()
        seen.add(target_val)
        candidates = []
        for w in pool:
            if w.get("id") == target.get("id"):
                continue
            if filter_fn and not filter_fn(w):
                continue
            val = (w.get(key) or "").strip()
            if not val or val.lower() in seen:
                continue
            seen.add(val.lower())
            candidates.append(val)
        self.rng.shuffle(candidates)
        return candidates[:n]

    def _mc_question(
        self,
        *,
        word: Dict[str, Any],
        qtype: QuestionType,
        prompt: str,
        prompt_meta: Dict[str, Any],
        correct_label: str,
        distractor_labels: List[str],
        explanation: str,
    ) -> QuizQuestion:
        choices = []
        correct_id = str(uuid.uuid4())
        choices.append({"id": correct_id, "label": correct_label, "is_correct": True})
        for label in distractor_labels:
            choices.append({"id": str(uuid.uuid4()), "label": label, "is_correct": False})
        self.rng.shuffle(choices)
        return QuizQuestion(
            id=str(uuid.uuid4()),
            saved_word_id=word["id"],
            word=word["word"],
            type=qtype,
            prompt=prompt,
            prompt_meta=prompt_meta,
            choices=choices,
            correct_choice_id=correct_id,
            explanation=explanation,
            audio_word=word["word"],
        )


# ── module helpers ──────────────────────────────────────────────────────

def _word_in_sentence(word: str, sentence: str) -> bool:
    if not word or not sentence:
        return False
    return re.search(rf"\b{re.escape(word)}\b", sentence, re.IGNORECASE) is not None


def _blank_out(word: str, sentence: str) -> str:
    return re.sub(rf"\b{re.escape(word)}\b", "______", sentence, flags=re.IGNORECASE)


def _now() -> str:
    from datetime import datetime
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
