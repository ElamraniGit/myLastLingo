# 🧠 Smart Review System — Technical Overview

> نظام تعلّم كلمات حديث مبني على أحدث الأبحاث في علم الذاكرة (FSRS-v4،
> Active Recall، Interleaving، Retrieval Practice، Desirable Difficulty).

هذا الملف يلخّص ما الذي تغيّر في هذا الـ branch (`feat/smart-review-system`)
ولماذا، وكيف تستعمله من الواجهة ومن الـ API.

---

## 1) الأعمدة الفقرية الجديدة

| الطبقة | الملف | الدور |
|---|---|---|
| Backend / Algorithm | `backend/app/services/srs/fsrs.py` | محرّك **FSRS-v4** نقي — يحسب Stability/Difficulty ويحدّد موعد المراجعة التالية بناءً على احتمال التذكّر المستهدف (90%). |
| Backend / Algorithm | `backend/app/services/srs/mastery.py` | **Word Mastery Score 0..100** + كاشف الكلمات الصعبة (leeches). |
| Backend / Algorithm | `backend/app/services/quiz/generator.py` | مولّد جلسات اختبار **متشابكة (interleaved)** بـ 4 أنواع أسئلة + اختيار النوع تكيفياً حسب الإتقان. |
| Backend / Algorithm | `backend/app/services/quiz/error_analyzer.py` | يصنّف سبب كل إجابة خاطئة (تشابه دلالي / عكسي / شكلي / سياق / مجهول). |
| Backend / DB | `backend/app/db/database.py` | جداول جديدة + هجرات إضافية + `update_review` يقود FSRS، يحفظ زمن الاستجابة ودقّتها، ويحسب Mastery. |
| Backend / API | `backend/app/api/review.py` | الراوتر الجديد `/api/v1/review`. |
| Frontend / Types | `frontend/src/types/index.ts` | أنواع `QuizQuestion`, `QuizSession`, `LearningStage`, `FsrsRating`, `ReviewDashboard`. |
| Frontend / API | `frontend/src/lib/api.ts` | `reviewApi.{startSession, submitAnswer, rateFlashcard, dashboard, daily, forecast}`. |
| Frontend / Hook | `frontend/src/hooks/useReview.ts` | Hook موحّد لكل التفاعل مع نظام المراجعة. |
| Frontend / UI | `frontend/src/views/FlashcardsView.tsx` | شاشة موحّدة: **Smart Quiz** + **Flashcards** بزر تبديل واحد. |
| Frontend / UI | `frontend/src/components/review/ReviewDashboard.tsx` | لوحة تحليلات (KPIs + sparklines + forecast + errors). |

---

## 2) كيف تُطبَّق المبادئ التعليمية

### Spaced Repetition (FSRS-v4)
- لكل كلمة نخزّن `fsrs_stability` (متى تنسى) و`fsrs_difficulty` (صعوبتها الذاتية).
- بعد كل إجابة، نحدّث الاثنين عبر معادلات FSRS-v4 الرسمية (راجع `fsrs.py`).
- الموعد التالي يُحسَب بحيث يكون احتمال التذكّر = 0.9 (قابل للضبط).
- المستويات الأربعة تظهر للمستخدم: **new → learning → familiar → mastered**.

### Active Recall
- في وضع البطاقات: لا تظهر الترجمة حتى يضغط المستخدم "إظهار الإجابة".
- في وضع الاختبار: السؤال لا يحوي أي جزء من الإجابة.

### Retrieval Practice
- الـ distractors في الاختبارات تُستخرَج من **كلمات المستخدم نفسه**، ليس من قائمة عشوائية. هذا يجبر الدماغ على التمييز الفعلي بدل التعرّف البصري.

### Context-Based Learning
- نوع السؤال **Fill-Blank** يستخدم الجملة الأصلية من الفيديو/النص الذي حُفظت منه الكلمة.
- نوع **Definition Match** يجبر معالجة دلالية عميقة.

### Interleaving
- جلسة الـ Smart Quiz تخلط أنواع الأسئلة بحيث لا يتكرّر نفس النوع مرّتين متتاليتين (مع استثناءات صغيرة عند نقص البيانات).
- ترتيب الكلمات داخل الجلسة عشوائي.

### Desirable Difficulty
- نوع السؤال يُختار **تكيفياً** بناءً على `mastery_score`:
  - مستوى منخفض → recognition (EN→AR، Definition Match).
  - مستوى متوسط → خليط.
  - مستوى عالٍ → production (AR→EN، Fill-Blank).

### Adaptive Learning
- كلمات Leech (لها ≥ 6 lapses) تظهر تلقائياً في خيار "ركّز على الكلمات الصعبة".
- زمن الاستجابة يُؤخذ في الحسبان: إجابة صحيحة لكن بطيئة (> 8s) ⇒ تُعتبر Hard، إجابة سريعة (< 3s) ⇒ Easy.
- نظام تحليل الأخطاء يقترح إجراءً (مثلاً `compare_synonyms`, `drill_spelling`).

---

## 3) أنواع الأسئلة في MVP

| النوع | البيانات المطلوبة | الغرض البيداغوجي |
|---|---|---|
| `EN_TO_AR` | meaning_ar | استرجاع معنى من شكل معروف |
| `AR_TO_EN` | meaning_ar | إنتاج (أصعب من التعرّف) |
| `FILL_BLANK` | sentence فيه الكلمة | استرجاع مدفوع بالسياق |
| `DEFINITION_MATCH` | meaning_en | معالجة دلالية عميقة |

أنواع محجوزة لـ v2 (الـ schema جاهز): `SYNONYM_MATCH`, `LISTENING`,
`REVERSE_LISTENING`, `SENTENCE_BUILDING`, `ERROR_DETECTION`.

---

## 4) واجهات الـ API الجديدة

```
POST /api/v1/review/session/start      → بناء جلسة اختبار متشابكة (10 أسئلة افتراضياً)
POST /api/v1/review/session/answer     → تسجيل إجابة + تحليل الخطأ + تحديث FSRS تلقائياً
POST /api/v1/review/flashcard/rate     → Again/Hard/Good/Easy (1..4)
GET  /api/v1/review/daily              → خطة اليوم (due + leeches + تقدير الوقت)
GET  /api/v1/review/forecast?days=14   → حجم المراجعة المتوقّع في الأيام القادمة
GET  /api/v1/review/dashboard          → كل إحصائيات اللوحة
```

أمثلة طلب/استجابة في `backend/app/api/review.py`.

---

## 5) Mastery Score (0..100)

الصيغة (في `mastery.py`):

```
score = 0.45 · accuracy
      + 0.35 · min(stability_days / 60, 1)
      + 0.20 · speed_score          (2s=1.0, 12s=0.0)
      − 3 · lapses (مقصورة على 10)
      − 8 · recent_errors (آخر 3 محاولات)
```

`accuracy` يستخدم تنعيم Laplace `(c+1)/(t+2)` كي لا تكون قيم الكروت الجديدة 0 أو 100.

`is_leech = lapses ≥ 6`.

---

## 6) المخطط: ماذا أُضيف للجداول؟

```sql
ALTER TABLE saved_words ADD COLUMN fsrs_stability   REAL DEFAULT 0;
ALTER TABLE saved_words ADD COLUMN fsrs_difficulty  REAL DEFAULT 0;
ALTER TABLE saved_words ADD COLUMN fsrs_state       TEXT DEFAULT 'new';
ALTER TABLE saved_words ADD COLUMN stage            TEXT DEFAULT 'new';
ALTER TABLE saved_words ADD COLUMN mastery_score    INTEGER DEFAULT 0;
ALTER TABLE saved_words ADD COLUMN correct_count    INTEGER DEFAULT 0;
ALTER TABLE saved_words ADD COLUMN incorrect_count  INTEGER DEFAULT 0;
ALTER TABLE saved_words ADD COLUMN total_attempts   INTEGER DEFAULT 0;
ALTER TABLE saved_words ADD COLUMN avg_response_ms  REAL DEFAULT 0;
ALTER TABLE saved_words ADD COLUMN is_leech         INTEGER DEFAULT 0;

ALTER TABLE word_reviews ADD COLUMN rating          INTEGER;
ALTER TABLE word_reviews ADD COLUMN stability       REAL;
ALTER TABLE word_reviews ADD COLUMN difficulty      REAL;
ALTER TABLE word_reviews ADD COLUMN interval_days   REAL;
ALTER TABLE word_reviews ADD COLUMN retrievability  REAL;
ALTER TABLE word_reviews ADD COLUMN response_ms     INTEGER;
ALTER TABLE word_reviews ADD COLUMN review_type     TEXT DEFAULT 'flashcard';

CREATE TABLE quiz_attempts (
  id            TEXT PRIMARY KEY,
  saved_word_id TEXT NOT NULL,
  user_id       TEXT DEFAULT '',
  question_type TEXT NOT NULL,
  is_correct    INTEGER NOT NULL,
  response_ms   INTEGER DEFAULT 0,
  picked_label  TEXT,
  error_type    TEXT,
  error_reason  TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

كل الهجرات **additive**، لا تكسر بيانات موجودة. الكلمات القديمة تُهاجَر تلقائياً من
SM-2 إلى FSRS عند أول مراجعة بعد التحديث (via `card_from_row`).

---

## 7) كيف تشغّل وتختبر؟

```bash
# Backend
pip install -r requirements.txt
python run.py

# Frontend
cd frontend && npm install && npm run dev

# الاختبارات الوحدية للـ SRS
PYTHONPATH=. python backend/tests/test_srs.py
# → 14/14 passed
```

---

## 8) ما الذي **لم** يُنفَّذ بعد (v3 roadmap)

تم إكمال v2 كاملاً. الميزات التالية متروكة لـ v3:

- 🤖 **FSRS-Optimizer per-user** (إعادة ضبط الأوزان حسب بيانات المستخدم).
- 🌐 **Online sync** (المشروع حالياً local-first).
- 🎓 **Adaptive new-word introduction** (تقديم كلمات جديدة بمعدل ذكي يومياً).
- 📊 **Heatmap calendar** بأسلوب GitHub لعرض النشاط السنوي.

## ✅ v2 — مُكتمَل

كل ما كان مُؤجَّلاً في الإصدار الأول أصبح متاحاً:

### 9 أنواع أسئلة كاملة
| النوع | الوصف |
|---|---|
| EN_TO_AR | اختر الترجمة العربية |
| AR_TO_EN | اختر الكلمة الإنجليزية |
| FILL_BLANK | أكمل الفراغ في الجملة |
| DEFINITION_MATCH | اختر الكلمة المناسبة للتعريف |
| **SYNONYM_MATCH** ✨ | اختر المرادف |
| **LISTENING** ✨ | استمع للكلمة واختر معناها |
| **REVERSE_LISTENING** ✨ | استمع للجملة واختر الكلمة الناقصة |
| **SENTENCE_BUILDING** ✨ | رتّب الكلمات لتكوين الجملة (tap-based) |
| **ERROR_DETECTION** ✨ | اضغط الكلمة الخاطئة في الجملة |

اختيار النوع تكيفي: low mastery → recognition، high mastery → production.

### نظام الإنجازات (18 إنجاز)
- 4 فئات: bronze / silver / gold / legendary
- 7 مجموعات: First steps, Vocabulary, Mastered, Streaks, Accuracy, Volume, Levels
- toasts تلقائية على الفتح + لوحة كاملة في Profile

### شاشة Daily/Weekly/Monthly
- Today: hero CTA + leech alerts + recommended preview
- Week: bar chart للنشاط + retention + avg mastery
- Month: heatmap 30 يوم قادم + pipeline bar

### Streak System
- `streak_days` + `longest_streak` (لا يُنقَص أبداً)
- يظهر في الـ XP bar مع tooltip للأطول

---

## 9) شجرة الـ commits في هذا الـ branch

```
feat/smart-review-system
├── feat(srs):    FSRS-v4 + Mastery + Quiz + Error engines (backend)
├── feat(api):    /review router (session/answer/rate/dashboard/...)
├── feat(frontend-api): types + reviewApi client + useReview hook
├── feat(ui):     redesign FlashcardsView as unified Smart Review session
├── feat(ui):     ReviewDashboard analytics component
└── test(srs):    14 unit tests for scheduler/mastery/quiz/errors
```

### رفع الـ branch

```bash
git push -u origin feat/smart-review-system
# ثم افتح PR على GitHub
```
