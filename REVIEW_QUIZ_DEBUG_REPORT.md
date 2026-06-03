# Review & Quiz System — Debugging Report

**Date:** 2026-06-03
**Scope:** Review screens, Quiz screens, Vocabulary review cards, word/text rendering
**Objective:** Identify and fix all text-rendering issues without redesigning the application.

---

## 1. How the Review/Quiz System Currently Works

### Data Flow
1. **Word capture:** When a user taps a word in a video transcript, `useDictionary.lookupWord()` strips punctuation and looks it up via `/dictionary/lookup`. The result is cached in SQLite (`words` table).
2. **Save to vocabulary:** `useDictionary.saveWord()` persists a `saved_words` row linking the user, the word, and the original sentence context.
3. **Review queue:** `GET /vocabulary/due` queries `saved_words` joined with `words`, filtering for items whose `next_review` is due. SM-2 scheduling is updated on `POST /vocabulary/review`.
4. **Flashcard view (`FlashcardsView.tsx`):**
   - **Front:** Shows `word`, `pronunciation`, `part_of_speech`, `level`, and `status`.
   - **Back:** Shows `meaning_en` (primary), `examples`, `sentence` (context), and `meaning_ar` (RTL Arabic hint).
   - **Rating:** 4-button SM-2 grading (Again/Hard/Good/Easy) posts `quality` 0–5.
5. **Quiz view (`FlashcardsView.tsx`):**
   - **Definition quiz:** Shows the word; asks for the definition among 4 choices.
   - **Fill-in-the-blank quiz:** Shows `sentence` with the target word replaced by blanks.
   - **Word quiz:** Shows `meaning_en`; asks which word matches it.
   - Distractors are pulled from the global `pool` (other saved words), shuffled.
6. **Vocabulary list (`VocabularyView.tsx`):** Displays all saved words with `word`, `level`, `status`, `meaning_en`, `meaning_ar`, and due-time.

### Text Rendering Pipeline
- **Backend:** FastAPI serializes SQLite rows (UTF-8 TEXT) to JSON. `json.dumps(..., ensure_ascii=False)` is used throughout `database.py`, so Arabic/accented characters are preserved literally.
- **Frontend:** `fetch()` parses JSON natively. React renders text via JSX `{expression}`, which auto-escapes HTML but preserves Unicode characters.
- **Arabic handling:** `direction: 'rtl'` is applied inline on Arabic spans.

---

## 2. Discovered Issues

| # | File | Severity | Issue | Root Cause |
|---|------|----------|-------|------------|
| **R1** | `FlashcardsView.tsx` | **🔴 Critical** | Fill-in-the-blank quiz uses an **unescaped dynamic RegExp** (`\b${current.word}\b`) to blank out the target word. Words containing regex metacharacters (`+`, `*`, `(`, `)`, `[`, `]`, `{`, `}`, `?`, `^`, `$`, `\|`, `.`) cause a **JavaScript `SyntaxError`** that crashes/leaves the quiz blank. Words with non-ASCII characters (Arabic, accented Latin like *café*, *résumé*) cause `\b` (ASCII-only word boundary) to fail, so the blank is **never inserted** and the sentence appears unchanged. | Developer assumed all English words are plain ASCII alphanumeric strings. No `escapeRegExp()` was applied, and `\b` was used without a Unicode-aware boundary fallback. |
| **R2** | `FlashcardsView.tsx` | **🟠 High** | Arabic translations (`meaning_ar`) render as **tofu/boxes or broken glyphs** on Android devices that lack Arabic system fonts. The component only sets `direction: 'rtl'` but never specifies an Arabic-capable font family. | Global CSS font stack (`-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter'…`) contains no Arabic fallback font (e.g. *Noto Sans Arabic*). `WordPopup.tsx` already carries this fix, but FlashcardsView and VocabularyView were missed. |
| **R3** | `VocabularyView.tsx` | **🟠 High** | Same Arabic glyph corruption as R2 in the vocabulary list cards. | Identical root cause — missing `fontFamily` Arabic fallback on `meaning_ar` spans. |
| **R4** | `FlashcardsView.tsx` | **🟡 Medium** | The quiz-type selector always appends `'word'` to the type array, even when `meaning_en` is empty or missing. This creates a nonsensical question: *"Which word matches this definition?"* with **no definition text** shown. | `types.push('word')` is unconditional. It should be guarded by `current.meaning_en?.trim()`. |
| **R5** | `FlashcardsView.tsx` | **🟡 Medium** | `fillblank` is pushed if `current.sentence` is truthy, but a whitespace-only string `" "` is truthy yet produces an empty-looking sentence. The fallback ``________ — can you guess this word?`` is hidden behind a ternary that only checks truthiness, not meaningful content. | Insufficient validation of sentence quality before selecting the fillblank quiz type and before rendering the sentence. |

---

## 3. Affected Files

1. `frontend/src/views/FlashcardsView.tsx` — Issues R1, R2, R4, R5
2. `frontend/src/views/VocabularyView.tsx` — Issue R3

> **Not affected:** Backend API (`vocabulary.py`, `dictionary.py`, `database.py`), DB schema, `WordPopup.tsx` (already fixed), `globals.css` (no changes needed — we add inline font fallbacks to preserve the existing design system).

---

## 4. Fixes Implemented

### Fix R1 — Safe Fill-in-the-Blank Regex
- **Added** `escapeRegExp()` helper to sanitize regex metacharacters.
- **Added** `makeFillBlank()` helper with a three-tier fallback strategy:
  1. **Unicode-aware boundaries** using `(?<![\p{L}\p{M}\p{N}_])…(?![\p{L}\p{M}\p{N}_])` with the `giu` flags. This correctly handles *café*, *résumé*, Arabic words, and symbols like `C++`/`$100`.
  2. **ASCII `\b` fallback** for older JS engines that lack Unicode property support.
  3. **Literal substring fallback** — case-insensitive literal replacement — guaranteed never to throw.
- **Replaced** the inline `sentence.replace(new RegExp('\\b…'))` call with `makeFillBlank(current.sentence, current.word)`.

### Fix R2 — Arabic Font Fallback in FlashcardsView
- **Added** `fontFamily: "'Segoe UI', 'Noto Sans Arabic', Arial, sans-serif"` to both occurrences of the `meaning_ar` span:
  - Back of the flashcard (AR hint)
  - Quiz feedback Arabic hint
- This matches the exact pattern already used in `WordPopup.tsx`, ensuring consistency.

### Fix R3 — Arabic Font Fallback in VocabularyView
- **Added** the same `fontFamily` inline style to the `meaning_ar` display line in the vocabulary list.

### Fix R4 — Guarded Quiz-Type Selection
- **Changed** the quiz-type builder to only push `'word'` when `current.meaning_en?.trim()` is present.
- **Changed** the `'fillblank'` push to require that `sentence.trim()` is non-empty **and** that the sentence actually contains the target word (case-insensitive). This prevents empty or irrelevant fillblank prompts.

### Fix R5 — Meaningful Sentence Validation
- The `makeFillBlank()` helper itself validates `sentence.trim()` and `word.trim()` before attempting replacement, returning a graceful fallback string instead of an invisible/whitespace sentence.

---

## 5. Design & Functionality Preservation

| Aspect | Preserved? | Evidence |
|--------|-----------|----------|
| Existing layout | ✅ | No CSS class names changed; only inline `style` additions for fontFamily. |
| Existing animations | ✅ | No animation or transition code touched. |
| Flashcard 3D flip | ✅ | `.flashcard-wrap`/`.flashcard-inner`/`.flipped` unchanged. |
| Quiz logic (SM-2, scoring, choices) | ✅ | Rating values, choice mapping, `handleRate`, and keyboard shortcuts are untouched. |
| User flow | ✅ | Same mode toggle (`flashcards` ↔ `quiz`), same empty-state messages, same keyboard bindings. |
| Color tokens / dark mode | ✅ | No Tailwind classes modified. |
| Existing SM-2 review state | ✅ | No backend changes; data model untouched. |

---

## 6. Verification Steps

1. **Regex stress test:** `makeFillBlank('I love C++ and $100!', 'C++')` → correctly inserts `________`.  
2. **Unicode boundary test:** `makeFillBlank('I went to a café.', 'café')` → correctly inserts `________`.  
3. **Arabic rendering:** `meaning_ar` spans now carry an explicit Arabic font stack; on Android without system Arabic fonts, `Noto Sans Arabic` (or browser default Arabic fallback) is used instead of generic sans-serif.  
4. **Quiz type logic:** Empty `meaning_en` no longer produces a "Which word matches this definition?" card with no definition.  
5. **Whitespace sentence:** A sentence containing only spaces no longer triggers a blank fillblank prompt.  

---

*End of Report*
