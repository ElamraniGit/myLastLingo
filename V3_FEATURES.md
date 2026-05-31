# 🚀 v3 — Personal Adaptation Features

> ثلاث ميزات تجعل التطبيق يتكيّف مع طريقة تعلّمك الشخصية، كلها محلية
> 100% بدون الحاجة لخوادم خارجية أو مزامنة سحابية.

| الميزة | الوصف القصير | الفائدة |
|---|---|---|
| 🤖 FSRS-Optimizer | يضبط أوزان خوارزمية الجدولة على بياناتك | فترات مراجعة مُحسَّنة لذاكرتك |
| 🎓 Adaptive Intro | يقترح كم كلمة جديدة تضيف اليوم | يمنع الإرهاق ويحافظ على التقدم |
| 📊 Activity Heatmap | خريطة سنوية بأسلوب GitHub | تحفيز بصري + رؤية الاتساق |

---

## 🤖 1) FSRS-Optimizer per-user

### المشكلة
أوزان FSRS الافتراضية مُعايَرة على بيانات عامة. كل شخص مختلف:
- بعض المتعلّمين ينسون أسرع → يحتاجون فترات مراجعة أقصر
- آخرون يحتفظون جيداً → الفترات الافتراضية مُضيِّعة لوقتهم
- البعض يجد Hard أصعب من المعدل → معامل Hard يحتاج تعديل

### الحل
بعد ≥ 50 مراجعة، شغّل المُحسِّن من Profile > Progress. يقوم بـ:
1. سحب سجل مراجعاتك الكامل (`word_reviews` table)
2. حساب معدّل تذكّرك الفعلي vs ما تتنبّأ به الخوارزمية
3. تشغيل grid search على 3 معاملات (request_retention, w8, w11) لإيجاد الأفضل
4. حفظ الأوزان المُخصَّصة في `user_fsrs_params`
5. كل مراجعة لاحقة تستعمل **أوزانك أنت**، ليس الافتراضية

### مثال على النتائج

| نوع المستخدم | الدقة | RR المقترح | w8 | w11 |
|---|---|---|---|---|
| سريع النسيان | 60% | 80% | 0.93 ↓ | 3.00 ↑ |
| متوسط | 88% | 87% | 1.51 ≈ | 2.15 ≈ |
| ذاكرة قوية | 96% | 95% | 1.53 ↑ | 2.13 ≈ |

### الأمان
- إذا كانت بياناتك متوافقة مع الافتراضي ⇒ يُبقيها (لا يدمّر ما يعمل)
- زر "Reset" يعيد كل شيء إلى الافتراضي في أي وقت
- تشغيل المُحسِّن متاح متى شئت (بعد كل 200 مراجعة جديدة فكرة جيدة)

### الـ API
```http
POST /api/v1/v3/optimizer/run     # شغّل تحليل + احفظ الأوزان
GET  /api/v1/v3/optimizer/status  # حالة الأوزان الحالية
POST /api/v1/v3/optimizer/reset   # عُد إلى الافتراضي
```

---

## 🎓 2) Adaptive New-Word Introduction

### المشكلة
أحد أكبر أسباب فشل تعلّم اللغات: إضافة كلمات جديدة كثيرة دون قدرة على مراجعتها → جبل تراكمي → إحباط.

### الحل
المستخدم يحدد **الهدف اليومي** (افتراضي 5). نظام التوصية يقترح كم يضيف **الآن** بناءً على:
- **حمل المراجعة**: due_count > 50 ⇒ يقلّل العدد
- **معدل الأخطاء الحديثة**: > 30 خطأ في الشهر ⇒ يقلّل
- **التقدّم اليومي**: أكملت الهدف ⇒ يقترح 0

كل تخفيض يأتي بـ "note" بالعربية يشرح السبب.

### مثال

```
🎯 هدفك اليومي: 10 | أضفت اليوم: 3 | المقترح الآن: 5
📚 لديك 65 مراجعة مستحقة — تقليل 2 كلمة جديدة لتخفيف الحمل.
```

### الـ API
```http
GET   /v3/intro/settings              # الإعدادات + إنجاز اليوم
PATCH /v3/intro/settings              # تعديل الهدف / auto-adjust
GET   /v3/intro/recommendation        # الاقتراح الذكي الآن
```

---

## 📊 3) GitHub-style Activity Heatmap

### المشكلة
الإحصائيات الرقمية مجرّدة. رؤية **سنة كاملة من النشاط** كخريطة بصرية تُحفّز بشكل عاطفي قوي.

### الحل
- جدول `daily_activity` (سطر لكل يوم لكل مستخدم) يُملأ تلقائياً من:
  - `update_review()` ← يضيف 1 لـ reviews_count
  - `save_word_to_vocabulary()` ← يضيف 1 لـ new_words_count
- المكوّن يعرض **365 يوم في 53 عمود × 7 صفوف** (SVG نقي).
- 5 درجات شدّة (0..4) ⇒ ألوان أخضر متدرّجة.
- Hover/Tap يُظهر تفاصيل اليوم.

### الإحصائيات المعروضة
- إجمالي المراجعات في السنة
- إجمالي الكلمات الجديدة
- عدد الأيام النشطة من 365
- أطول سلسلة
- السلسلة الحالية (إن وُجدت)

### مكان الوصول
- **Profile > Progress** (في الأعلى)
- **شاشة المراجعة → 📅 → tab "السنة"**

### الـ API
```http
GET /v3/activity/heatmap?days=365
# returns: cells[365] of { day, reviews, new_words, correct, total, intensity }
```

---

## 📁 الملفات المُضافة في v3

### Backend
```
backend/app/services/srs/optimizer.py    # Grid-search FSRS tuner
backend/app/api/optimizer.py             # 7 v3 endpoints
backend/app/db/database.py               # 3 new tables + helpers
backend/tests/test_srs.py                # +5 optimizer tests (24/24 pass)
```

### Frontend
```
frontend/src/components/review/
  ├── ActivityHeatmap.tsx               # 365-day SVG grid
  ├── OptimizerPanel.tsx                # Run/reset/status UI
  └── AdaptiveIntroPanel.tsx            # Daily target + recommendation
frontend/src/lib/api.ts                 # v3Api wrapper
frontend/src/types/index.ts             # 5 new types
frontend/src/views/
  ├── ProfileView.tsx                   # All 3 panels in Progress tab
  └── DailyReviewView.tsx               # New 'Year' tab → ActivityHeatmap
```

---

## 🗄️ Database Migrations (additive — لا تكسر شيئاً)

```sql
-- Per-user tuned FSRS weights
CREATE TABLE user_fsrs_params (
  user_id TEXT PRIMARY KEY,
  weights_json TEXT NOT NULL,
  request_retention REAL NOT NULL DEFAULT 0.9,
  sample_size INTEGER DEFAULT 0,
  improvement_pct REAL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily activity (one row per user per day)
CREATE TABLE daily_activity (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  reviews_count INTEGER DEFAULT 0,
  new_words_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  total_response_ms INTEGER DEFAULT 0,
  first_at TIMESTAMP,
  last_at TIMESTAMP,
  PRIMARY KEY (user_id, day)
);

-- Adaptive intro settings
CREATE TABLE user_intro_settings (
  user_id TEXT PRIMARY KEY,
  daily_new_target INTEGER DEFAULT 5,
  auto_adjust INTEGER DEFAULT 1,
  last_introduced_at TIMESTAMP,
  last_introduced_today INTEGER DEFAULT 0,
  last_introduced_date TEXT DEFAULT '',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## ✅ التحقق من النجاح

```bash
# اختبارات الوحدة
PYTHONPATH=. python backend/tests/test_srs.py
# → 24/24 passed

# اختبار الـ endpoints
curl http://127.0.0.1:8080/api/v1/v3/optimizer/status   # احصل على status
curl http://127.0.0.1:8080/api/v1/v3/intro/settings     # احصل على الإعدادات
curl http://127.0.0.1:8080/api/v1/v3/activity/heatmap?days=30  # heatmap قصير
```

---

## 🔮 ما الذي تبقى لـ v4 (إذا أردت لاحقاً)

- 🌐 Online sync (تجاهلناه عمداً في v3 — يبقى محلياً 100%)
- 🤝 Social features (مشاركة الإنجازات، تحديات أصدقاء)
- 🎯 Smart deck recommendations (تجميع تلقائي للكلمات حسب الموضوع)
- 🗣️ Pronunciation scoring (مقارنة نطق المستخدم بالـ TTS)
