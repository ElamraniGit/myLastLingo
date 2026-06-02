# 🎯 LinguaLearn - تعلم الإنجليزية بالفيديو

<p align="center">
  <img src="frontend/public/icons/icon-512x512.svg" alt="LinguaLearn Logo" width="128" height="128">
</p>

<p align="center" dir="rtl">
  <b>منصة تعلم لغة إنجليزية ذكية تعمل محليًا بالكامل على هاتفك الأندرويد</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Android%20%7C%20Termux-green?style=flat-square">
  <img src="https://img.shields.io/badge/Stack-FastAPI%20%7C%20React%20%7C%20Whisper-blue?style=flat-square">
  <img src="https://img.shields.io/badge/Mode-100%25%20Local-orange?style=flat-square">
  <img src="https://img.shields.io/badge/Language-Arabic%20%7C%20English-lightgrey?style=flat-square">
</p>

---

## 📚 Documentation

| Document | Purpose |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture, data flow, design decisions |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Setup, run, test, build, configuration |
| [AI_AGENT_GUIDE.md](AI_AGENT_GUIDE.md) | Repo map + golden rules for AI agents / new devs |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Workflow, coding standards, commit format |
| [docs/API.md](docs/API.md) | Full REST API reference |
| [docs/DATABASE.md](docs/DATABASE.md) | Database schema & data flow |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common problems & fixes |
| [docs/history/](docs/history/) | Archived audit/diagnostic reports |

---

## ✨ المميزات

### 🎬 تشغيل فيديوهات YouTube
- إدخال رابط YouTube واستخراج الفيديو تلقائيًا
- تشغيل كامل مع تحكمات: تشغيل/إيقاف، تقديم/تأخير، تغيير السرعة
- تكرار الجمل والعبارات

### 📝 النصوص المتزامنة (Karaoke Subtitles)
- استخراج الترجمة الرسمية من YouTube تلقائيًا
- إذا لم توجد ترجمة: استخدام **Whisper** محليًا للنسخ الصوتي
- تظليل الكلمة المنطوقة لحظيًا
- تمرير تلقائي للنص مع الفيديو

### 📖 القاموس المحلي المدمج
- الضغط على أي كلمة لمعرفة: المعنى، النطق، نوع الكلمة، الأمثلة
- الترجمة للعربية
- مستوى الكلمة (A1-C2)
- المرادفات والأضداد والتصريفات
- **يعمل بدون إنترنت - لا حاجة لـ API خارجي**

### 🧠 نظام الحفظ الذكي (Spaced Repetition)
- حفظ الكلمات الجديدة بنقرة واحدة
- Flashcards تفاعلية
- نظام SM-2 للتكرار المتباعد
- تتبع المستوى والتقدم

### 🔒 الخصوصية والاتصال بالإنترنت

> ⚠️ **تصحيح مهم:** النسخة الحالية **ليست** بلا اتصال بالكامل. بياناتك (الحساب،
> الكلمات المحفوظة، التقدم، سجل المراجعة) تبقى **محلية على جهازك في SQLite**،
> لكن بعض الميزات تحتاج إنترنت:

| الميزة | تعمل بدون إنترنت؟ | الخدمة الخارجية |
|--------|:---:|------|
| الحساب وقاعدة البيانات | ✅ نعم | محلي (SQLite) |
| الكلمات المحفوظة + التكرار المتباعد | ✅ نعم | محلي |
| تشغيل فيديو YouTube | ❌ لا | YouTube |
| استخراج الترجمة (captions) | ❌ لا | yt-dlp / YouTube |
| القاموس (التعريفات) | ❌ لا | `api.dictionaryapi.dev` |
| الترجمة العربية | ❌ لا | `api.mymemory.translated.net` |
| النطق الطبيعي (TTS) | ❌ لا* | Microsoft Edge TTS |
| مساعد الذكاء الاصطناعي | ❌ لا | Groq API (مفتاح مجاني) |
| النسخ الصوتي Whisper | ✅ نعم | محلي (faster-whisper) |

\* الكلمات المنطوقة سابقًا تُخزَّن مؤقتًا وتعمل بدون إنترنت لاحقًا، وإلا يستخدم صوت المتصفح.

- ✅ بدون Firebase - بدون Supabase - بدون OpenAI - بدون تتبّع
- ✅ بياناتك الشخصية لا تغادر جهازك أبدًا

---

## 📱 التثبيت على Termux (أندرويد)

### المتطلبات
- **Termux** من F-Droid (وليس Google Play)
- اتصال إنترنت (للتحميل الأول فقط)
- 2GB مساحة تخزين على الأقل
- أندرويد 8+

### طريقة التثبيت السريعة

```bash
# 1. نسخ المستودع
git clone https://github.com/yourusername/lingualearn.git
cd lingualearn

# 2. تشغيل سكريبت التثبيت
chmod +x scripts/install_termux.sh
./scripts/install_termux.sh

# 3. تشغيل التطبيق
./scripts/start_all.sh
```

### دليل التثبيت التفصيلي

#### الخطوة 1: تجهيز Termux
```bash
# تحديث الحزم
pkg update && pkg upgrade -y

# منح صلاحيات التخزين
termux-setup-storage
```

#### الخطوة 2: تثبيت المتطلبات الأساسية
```bash
pkg install -y python nodejs-lts git ffmpeg build-essential cmake rust binutils
```

#### الخطوة 3: تثبيت حزم Python
```bash
pip install --upgrade pip
pip install fastapi uvicorn[standard] websockets aiosqlite pyyaml aiohttp yt-dlp

# للنسخ الصوتي المحلي (اختياري - يتطلب ~1GB)
pip install faster-whisper numpy
```

#### الخطوة 4: تثبيت واجهة المستخدم
```bash
cd frontend
npm install
cd ..
```
> على Termux **لا تشغّل `npm run build`** (لن يكتمل على ARM — انظر الملاحظة أدناه).
> التشغيل يتم في وضع dev عبر `./scripts/start_all.sh`.

> 📱 **مهم لـ Termux / أندرويد (ARM):** لا تتوفر نواة **SWC** الأصلية لـ Next.js
> على أندرويد/arm64، لذلك **لا يكتمل أمر `next build` (وضع الإنتاج)** على Termux
> وستظهر رسالة `Failed to load SWC binary for android/arm64`.
>
> الحل المعتمد: **شغّل الواجهة في وضع التطوير (dev)** — فهو يترجم الصفحات عند
> الطلب عبر **Babel** (إعداد `frontend/.babelrc` مرفق في المستودع) ولا يحتاج SWC
> ولا إلى بناء إنتاجي. لذلك على Termux لا تستخدم `npm run build` / `npm run start`،
> بل استخدم:
> ```bash
> ./scripts/start_all.sh        # الوضع الافتراضي = dev (يعمل على Termux)
> # أو للواجهة فقط:
> cd frontend && npm run dev
> ```
> أما `--prod` (الإنتاج) فاستخدمه فقط على جهاز يكتمل فيه `next build` (سطح مكتب/CI).

#### الخطوة 5: إنشاء المجلدات
```bash
mkdir -p data/{downloads,cache/{videos,transcripts,thumbnails},dictionary}
mkdir -p models/whisper logs
```

---

## 🚀 التشغيل

### تشغيل الكل مرة واحدة
```bash
./scripts/start_all.sh
```

### تشغيل كل جزء على حدة

#### الخادم الخلفي (Backend)
```bash
./scripts/start_backend.sh
# أو يدويًا:
python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8080
```

#### الواجهة الأمامية (Frontend)
```bash
./scripts/start_frontend.sh
# أو يدويًا:
cd frontend && npm run dev
```

### فتح التطبيق
افتح المتصفح على: **http://127.0.0.1:3000**

---

## 🏗️ بنية المشروع

```
lingualearn/
├── backend/
│   ├── main.py                    # مدخل الخادم الرئيسي (FastAPI)
│   ├── app/
│   │   ├── api/                   # نقاط API
│   │   │   ├── videos.py          # إدارة الفيديوهات
│   │   │   ├── transcripts.py     # استخراج النصوص
│   │   │   ├── dictionary.py      # القاموس
│   │   │   ├── vocabulary.py      # المفردات المحفوظة
│   │   │   └── player.py          # التحكم بالمشغل
│   │   ├── db/
│   │   │   └── database.py        # قاعدة البيانات المحلية (SQLite)
│   │   ├── services/
│   │   │   └── cache.py           # نظام التخزين المؤقت
│   │   └── utils/
│   │       └── logger.py          # تسجيل الأحداث
│   ├── ai/
│   │   ├── whisper/
│   │   │   └── service.py         # Whisper للنسخ الصوتي المحلي
│   │   └── dictionary/
│   │       ├── service.py         # القاموس المحلي
│   │       └── level_estimator.py # تقدير مستوى الكلمة (CEFR)
│
├── frontend/
│   ├── src/
│   │   ├── pages/                 # صفحات التطبيق
│   │   ├── components/            # المكونات
│   │   │   ├── player/            # مشغل الفيديو
│   │   │   ├── transcript/        # عرض النص المتزامن
│   │   │   ├── dictionary/        # نافذة القاموس
│   │   │   ├── flashcards/        # البطاقات التعليمية
│   │   │   └── common/            # مكونات عامة
│   │   ├── hooks/                 # React Hooks مخصصة
│   │   ├── services/              # خدمات API
│   │   ├── store/                 # إدارة الحالة (Zustand)
│   │   └── types/                 # أنواع TypeScript
│   ├── public/
│   │   ├── sw.js                  # Service Worker (PWA)
│   │   └── manifest.json          # بيان التطبيق
│
├── config/
│   ├── settings.yaml              # إعدادات التطبيق
│   └── settings.py                # محمل الإعدادات
│
├── scripts/
│   ├── install_termux.sh          # سكريبت التثبيت التلقائي
│   ├── start_backend.sh           # تشغيل الخادم
│   ├── start_frontend.sh          # تشغيل الواجهة
│   ├── start_all.sh               # تشغيل الكل
│   ├── quick_install.sh           # تثبيت سريع
│   └── check_environment.sh       # فحص البيئة
│
└── requirements.txt               # متطلبات Python
```

---

## 🛠️ التقنيات المستخدمة

### الواجهة الأمامية
- **Next.js 14** - إطار العمل
- **React 18** - مكتبة الواجهات
- **TypeScript** - أمان الأنواع
- **TailwindCSS** - التصميم والتنسيق
- **Framer Motion** - الرسوم المتحركة
- **Zustand** - إدارة الحالة
- **PWA** - دعم التثبيت على الجهاز

### الخادم الخلفي
- **FastAPI** - إطار العمل
- **SQLite** - قاعدة البيانات المحلية
- **WebSockets** - المزامنة المباشرة
- **yt-dlp** - تحميل الفيديوهات

### الذكاء الاصطناعي المحلي
- **faster-whisper** - النسخ الصوتي (اختياري)
- **القاموس المحلي المدمج** - تصنيف CEFR

---

## 📊 النظام الذكي

### التكرار المتباعد (SM-2)
يستخدم التطبيق خوارزمية SM-2 المعدلة لتحديد مواعيد المراجعة المثلى لكل كلمة بناءً على مستوى تذكرك.

### تقدير المستوى (CEFR)
يقوم النظام بتقدير مستوى الكلمة (من A1 للمبتدئين إلى C2 للمتقدمين) باستخدام:
- قوائم كلمات مصنفة مسبقًا
- تحليل طول الكلمة
- تحليل التعقيد الصوتي

---

## 🔧 استكشاف الأخطاء

### المشكلة: المنفذ مشغول
```bash
# قتل العملية على المنفذ
fuser -k 8080/tcp
fuser -k 3000/tcp
```

### المشكلة: yt-dlp لا يعمل
```bash
# تحديث yt-dlp
pip install --upgrade yt-dlp
```

### المشكلة: Whisper لا يعمل
```bash
# تحقق من تثبيت faster-whisper
pip install --upgrade faster-whisper numpy
```

---

## 🧪 الاختبارات (Tests)

```bash
# تثبيت متطلبات التطوير
pip install -r requirements-dev.txt

# تشغيل اختبارات الـ backend
pytest -q
```

تغطّي الاختبارات: المصادقة وإبطال الجلسات، عزل المستخدمين (IDOR)، خوارزمية
التكرار المتباعد، وتهيئة قاعدة البيانات. يعمل CI تلقائيًا على كل push عبر
GitHub Actions (`.github/workflows/ci.yml`).

---

## 🔑 مفتاح الذكاء الاصطناعي (Groq) — لكل مستخدم

كل مستخدم يُدخل مفتاحه الخاص من داخل التطبيق (الإعدادات)، ويُخزَّن **لكل مستخدم
على حدة** في قاعدة البيانات. احصل على مفتاح مجاني من:
https://console.groq.com/keys

---

## 🤝 المساهمة

نرحب بمساهماتك! يرجى:
1. Fork المستودع
2. إنشاء فرع للميزة (`git checkout -b feature/amazing-feature`)
3. Commit التغييرات (`git commit -m 'Add amazing feature'`)
4. Push إلى الفرع (`git push origin feature/amazing-feature`)
5. إنشاء Pull Request

---

## 📄 الترخيص

هذا المشروع مرخص تحت **MIT License**.

---

## 🙏 الشكر

- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) للنسخ الصوتي المحلي
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) لتحميل فيديوهات YouTube
- [TailwindCSS](https://tailwindcss.com/) للتصميم الحديث

---

<p align="center" dir="rtl">
  <b>بُني بحب ❤️ لتعلم اللغة الإنجليزية</b>
</p>
