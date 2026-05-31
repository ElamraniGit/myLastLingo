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

All 9 question types are now generated when the saved word has
sufficient data; the adaptive picker skews towards the hardest ones
as the user's mastery rises.

Question types
--------------
  1. EN_TO_AR          — recall meaning from a known surface form
  2. AR_TO_EN          — productive recall (harder)
  3. FILL_BLANK        — context-driven retrieval
  4. DEFINITION_MATCH  — deep semantic processing
  5. SYNONYM_MATCH     — pick the synonym of the target word
  6. LISTENING         — hear the spoken word, pick its meaning
  7. REVERSE_LISTENING — hear the example sentence, pick the missing word
  8. SENTENCE_BUILDING — re-order shuffled tokens into the original sentence
  9. ERROR_DETECTION   — spot the wrong word inserted into a sentence
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
    SYNONYM_MATCH = "synonym_match"
    LISTENING = "listening"
    REVERSE_LISTENING = "reverse_listening"
    SENTENCE_BUILDING = "sentence_building"
    ERROR_DETECTION = "error_detection"


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
    audio_word: Optional[str] = None      # word/sentence to TTS for listening types
    # ── Used by SENTENCE_BUILDING only ────────────────────────────
    # `tokens` is the shuffled list of words shown to the user; the
    # frontend lets the user drag them into the correct order. The
    # `correct_order` field stores the expected sequence (indexes
    # back into `tokens`).
    tokens: List[str] = field(default_factory=list)
    correct_order: List[int] = field(default_factory=list)

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
        """
        Decide which question types are *possible* given the data on this
        saved word. Each type is opt-in: missing data simply removes it
        from the list (no crash).
        """
        types: List[QuestionType] = []

        if word.get("meaning_ar"):
            types.append(QuestionType.EN_TO_AR)
            types.append(QuestionType.AR_TO_EN)
            # Listening uses the same answer pool as EN_TO_AR.
            types.append(QuestionType.LISTENING)

        if word.get("meaning_en"):
            types.append(QuestionType.DEFINITION_MATCH)

        if (word.get("synonyms") or []):
            types.append(QuestionType.SYNONYM_MATCH)

        # Sentence-based variants need an example sentence that actually
        # contains the target word and is long enough to be meaningful.
        sentence = (word.get("sentence") or "").strip()
        if not sentence:
            # Fall back to the first example if no source sentence stored.
            examples = word.get("examples") or []
            sentence = next(
                (e for e in examples if _word_in_sentence(word["word"], e or "")),
                "",
            )

        if sentence and _word_in_sentence(word["word"], sentence):
            types.append(QuestionType.FILL_BLANK)
            types.append(QuestionType.REVERSE_LISTENING)
            if _word_count(sentence) >= 4:
                types.append(QuestionType.SENTENCE_BUILDING)
                types.append(QuestionType.ERROR_DETECTION)

        return types or [QuestionType.EN_TO_AR]

    # Type difficulty (1 = easiest, 5 = hardest). Used by the adaptive picker.
    _TYPE_DIFFICULTY: Dict[QuestionType, int] = {
        QuestionType.EN_TO_AR: 1,
        QuestionType.LISTENING: 2,
        QuestionType.DEFINITION_MATCH: 2,
        QuestionType.SYNONYM_MATCH: 3,
        QuestionType.AR_TO_EN: 3,
        QuestionType.FILL_BLANK: 4,
        QuestionType.REVERSE_LISTENING: 4,
        QuestionType.ERROR_DETECTION: 4,
        QuestionType.SENTENCE_BUILDING: 5,
    }

    def _pick_type_adaptive(self, word: Dict[str, Any], allowed: List[QuestionType]) -> QuestionType:
        """
        Map the user's mastery score to the question-difficulty distribution
        ("desirable difficulty" principle from cognitive science).

          Low mastery   (< 30):  prefer easy (recognition) types.
          Mid mastery   (30-70): all types weighted moderately.
          High mastery  (> 70):  prefer hard (production / context) types.

        Weight = exp(-|target_difficulty - type_difficulty|) so the
        distribution is smooth and any allowed type can still appear.
        """
        mastery = int(word.get("mastery_score") or 0)
        if mastery < 30:
            target_diff = 1.5
        elif mastery > 70:
            target_diff = 4.0
        else:
            target_diff = 2.5

        import math
        weights = [
            math.exp(-abs(target_diff - self._TYPE_DIFFICULTY.get(t, 3)))
            for t in allowed
        ]
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

    # ── New v2 builders ──────────────────────────────────────────────────

    def _build_synonym_match(self, word: Dict[str, Any], pool: List[Dict[str, Any]]) -> Optional[QuizQuestion]:
        synonyms = [s for s in (word.get("synonyms") or []) if (s or "").strip()]
        if not synonyms:
            return None
        correct = self.rng.choice(synonyms).strip()

        # Distractor pool: words from the user's vocabulary that are NOT a
        # synonym of the target (more pedagogically meaningful than random).
        syn_set = {s.lower() for s in synonyms} | {word["word"].lower()}
        distractors: List[str] = []
        for w in self.rng.sample(pool, min(len(pool), 30)):
            cand = (w.get("word") or "").strip()
            if not cand or cand.lower() in syn_set:
                continue
            distractors.append(cand)
            syn_set.add(cand.lower())
            if len(distractors) >= 3:
                break
        if len(distractors) < 3:
            return None

        return self._mc_question(
            word=word,
            qtype=QuestionType.SYNONYM_MATCH,
            prompt=f'اختر المرادف الأقرب لكلمة "{word["word"]}"',
            prompt_meta={"target_word": word["word"]},
            correct_label=correct,
            distractor_labels=distractors,
            explanation=f'"{word["word"]}" ≈ {", ".join(synonyms[:3])}',
        )

    def _build_listening(self, word: Dict[str, Any], pool: List[Dict[str, Any]]) -> Optional[QuizQuestion]:
        """User hears the word; picks its Arabic meaning."""
        correct_ar = (word.get("meaning_ar") or "").strip()
        if not correct_ar:
            return None
        distractors = self._distractors(
            pool, word, key="meaning_ar", n=3,
            filter_fn=lambda w: bool((w.get("meaning_ar") or "").strip()),
        )
        if len(distractors) < 3:
            return None

        q = self._mc_question(
            word=word,
            qtype=QuestionType.LISTENING,
            prompt="🎧 استمع للكلمة واختر معناها",
            prompt_meta={
                "play_audio": True,
                "audio_text": word["word"],
                "hide_word": True,  # the spelled form must NOT be shown
            },
            correct_label=correct_ar,
            distractor_labels=distractors,
            explanation=f'"{word["word"]}" تعني: {correct_ar}',
        )
        q.audio_word = word["word"]
        return q

    def _build_reverse_listening(self, word: Dict[str, Any], pool: List[Dict[str, Any]]) -> Optional[QuizQuestion]:
        """User hears the example sentence with the target word; picks the missing word."""
        sentence = self._best_sentence(word)
        if not sentence:
            return None
        distractors = self._distractors(pool, word, key="word", n=3)
        if len(distractors) < 3:
            return None

        q = self._mc_question(
            word=word,
            qtype=QuestionType.REVERSE_LISTENING,
            prompt="🎧 استمع للجملة واختر الكلمة الناقصة",
            prompt_meta={
                "play_audio": True,
                "audio_text": sentence,
                "sentence_blanked": _blank_out(word["word"], sentence),
            },
            correct_label=word["word"],
            distractor_labels=distractors,
            explanation=f'الجملة الصحيحة: "{sentence}"',
        )
        q.audio_word = sentence
        return q

    def _build_sentence_building(self, word: Dict[str, Any], pool: List[Dict[str, Any]]) -> Optional[QuizQuestion]:
        """User drags shuffled tokens into the original sentence order."""
        sentence = self._best_sentence(word)
        if not sentence or _word_count(sentence) < 4:
            return None

        # Tokenise on whitespace; preserve punctuation as part of the token.
        original_tokens = sentence.strip().split()
        if not (4 <= len(original_tokens) <= 12):
            # Skip absurdly long sentences — re-ordering 15+ tokens is painful on mobile.
            return None

        # Shuffle until at least one token is out of place.
        shuffled = list(enumerate(original_tokens))  # [(orig_index, token), ...]
        for _ in range(8):
            self.rng.shuffle(shuffled)
            if any(i != pos for pos, (i, _t) in enumerate(shuffled)):
                break

        tokens = [t for _i, t in shuffled]
        # correct_order[i] = index in `tokens` of the i-th word of the original sentence
        position_in_shuffled = {orig_i: pos for pos, (orig_i, _t) in enumerate(shuffled)}
        correct_order = [position_in_shuffled[i] for i in range(len(original_tokens))]

        q = QuizQuestion(
            id=str(uuid.uuid4()),
            saved_word_id=word["id"],
            word=word["word"],
            type=QuestionType.SENTENCE_BUILDING,
            prompt="🧩 رتّب الكلمات لتكوين الجملة الصحيحة",
            prompt_meta={
                "target_word": word["word"],
                "original_sentence": sentence,
            },
            choices=[],   # not used for this type
            correct_choice_id="",
            tokens=tokens,
            correct_order=correct_order,
            explanation=f'الجملة الصحيحة: "{sentence}"',
            audio_word=sentence,
        )
        return q

    def _build_error_detection(self, word: Dict[str, Any], pool: List[Dict[str, Any]]) -> Optional[QuizQuestion]:
        """
        Inject a wrong word into a sentence; user picks the wrong word.
        We replace ONE non-target token with an unrelated word from the pool.
        """
        sentence = self._best_sentence(word)
        if not sentence:
            return None
        tokens = sentence.split()
        if len(tokens) < 4:
            return None

        # Candidate positions: any token that isn't the target itself,
        # is alphabetic, and at least 3 letters long (avoid swapping
        # articles/prepositions where the answer is ambiguous).
        target_lower = word["word"].lower()
        candidate_positions = [
            i for i, t in enumerate(tokens)
            if re.sub(r"[^a-zA-Z]", "", t).lower() != target_lower
            and len(re.sub(r"[^a-zA-Z]", "", t)) >= 3
        ]
        if not candidate_positions:
            return None

        swap_pos = self.rng.choice(candidate_positions)
        original_token = tokens[swap_pos]
        original_clean = re.sub(r"[^a-zA-Z]", "", original_token).lower()

        # Pick a replacement: a real saved word that's clearly different.
        replacement = None
        for w in self.rng.sample(pool, min(len(pool), 40)):
            cand = (w.get("word") or "").strip()
            if cand and cand.lower() not in {original_clean, target_lower}:
                replacement = cand
                break
        if not replacement:
            return None

        # Preserve the original token's surrounding punctuation.
        prefix = re.match(r"^[^a-zA-Z]*", original_token).group(0)
        suffix = re.search(r"[^a-zA-Z]*$", original_token).group(0)
        corrupted_tokens = list(tokens)
        corrupted_tokens[swap_pos] = f"{prefix}{replacement}{suffix}"

        # Choices: each TOKEN in the corrupted sentence is a click target.
        choices = []
        correct_id = None
        for i, tok in enumerate(corrupted_tokens):
            cid = str(uuid.uuid4())
            is_wrong = (i == swap_pos)
            if is_wrong:
                correct_id = cid
            choices.append({"id": cid, "label": tok, "is_correct": is_wrong, "position": i})

        return QuizQuestion(
            id=str(uuid.uuid4()),
            saved_word_id=word["id"],
            word=word["word"],
            type=QuestionType.ERROR_DETECTION,
            prompt="🔍 اضغط على الكلمة الخاطئة في الجملة",
            prompt_meta={
                "corrupted_sentence": " ".join(corrupted_tokens),
                "original_sentence": sentence,
                "corrupted_tokens": corrupted_tokens,
            },
            choices=choices,
            correct_choice_id=correct_id or "",
            explanation=(
                f'الكلمة الخاطئة هي "{replacement}".\n'
                f'الجملة الصحيحة: "{sentence}"'
            ),
            audio_word=sentence,
        )

    _builders = {
        QuestionType.EN_TO_AR: _build_en_to_ar,
        QuestionType.AR_TO_EN: _build_ar_to_en,
        QuestionType.FILL_BLANK: _build_fill_blank,
        QuestionType.DEFINITION_MATCH: _build_definition_match,
        QuestionType.SYNONYM_MATCH: _build_synonym_match,
        QuestionType.LISTENING: _build_listening,
        QuestionType.REVERSE_LISTENING: _build_reverse_listening,
        QuestionType.SENTENCE_BUILDING: _build_sentence_building,
        QuestionType.ERROR_DETECTION: _build_error_detection,
    }

    # ── helpers ──────────────────────────────────────────────────────────
    def _best_sentence(self, word: Dict[str, Any]) -> Optional[str]:
        """Return the most useful example sentence for this word, or None."""
        sentence = (word.get("sentence") or "").strip()
        if sentence and _word_in_sentence(word["word"], sentence):
            return sentence
        for ex in word.get("examples") or []:
            ex = (ex or "").strip()
            if ex and _word_in_sentence(word["word"], ex):
                return ex
        return None

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


def _word_count(sentence: str) -> int:
    return len([t for t in (sentence or "").split() if t.strip()])


def _now() -> str:
    from datetime import datetime
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
