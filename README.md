# Rahami — رهامي
### منصة التحميل الشخصية الخاصة (Private Personal Media Downloader)

تطبيق ويب حديث، فائق السرعة، ومصمم خصيصًا ليكون مساحة تحميل شخصية راقية وخاصة ومحمية بالكامل ومحصورة **بمستخدمين اثنين فقط**.

---

## 🌟 المميزات الرئيسية

- **وصول خاص وحصري (Strict 2-User Access)**:
  - المنصة مغلقة بالكامل ولا تحتوي على أي تسجيل عام أو إنشاء حسابات.
  - مصممة بدقة لتعمل فقط لحسابين مصرح لهما ومحددين مسبقًا عبر تشفير Bcrypt غير القابل للاختراق.
  - حماية مدمجة ضد هجمات التخمين (Brute-Force) مع قفل مؤقت للطلبات الخاطئة.
- **محرك تحميل قوي وآمن (Powered by yt-dlp & FFmpeg)**:
  - دعم أشهر منصات الفيديو والتواصل: YouTube, TikTok, Instagram, X (Twitter), Pinterest, SoundCloud, والروابط المباشرة.
  - تنفيذ آمن خالي من استدعاءات `shell=True` مع عزل لكل عملية تحميل في مجلد مستقل.
- **متابعة فورية حيّة (Real-time WebSocket Progress)**:
  - عرض نسبة الإنجاز المئوية (%)، سرعة التحميل (MB/s)، الوقت المتبقي المقدر (ETA)، وحجم البيانات المحملة لحظة بلحظة.
- **فحص ذكي للصيغ والجودات (Smart Format Extraction)**:
  - استخراج الجودات الحقيقية المتوفرة فعليًا (1080p, 720p, 480p, 360p) أو استخراج الصوت النقي (MP3 / M4A).
- **إدارة التخزين والتنظيف الذاتي (Auto-Cleanup & Diagnostics)**:
  - فحص مستمر للقرص والذاكرة والأدوات التنفيذية (`/api/health`).
  - تنظيف دوري آلي للمجلدات المؤقتة والملفات القديمة لضمان عدم تجاوز السعة المحددة (`MAX_STORAGE_GB`).
- **واجهة مستخدم أنثوية فاخرة (Refined Luxury Aesthetic)**:
  - تصميم عربي أنيق (RTL)، يدعم الوضعين المظلم والفاتح (Dark / Light Mode).
  - تجربة متكاملة للهواتف المحمولة وأجهزة سطح المكتب، مع دعم زر اللصق المباشر من الحافظة.

---

## 🛠️ البنية التقنية

- **الخلفية (Backend)**: Python 3.12+ / 3.14, FastAPI, Uvicorn, yt-dlp, FFmpeg, aiosqlite, slowapi, PyJWT, Bcrypt.
- **الواجهة (Frontend)**: React 19, TypeScript, Tailwind CSS, Vite, Lucide Icons.
- **التخزين وقاعدة البيانات**: SQLite عبر `aiosqlite` للعزل والأمان وخفة الأداء.
- **النشر على الخوادم (Production)**: Ubuntu Linux, Systemd Service, Nginx Reverse Proxy مع SSL.

---

## 🚀 التثبيت والتشغيل المحلي (Local Development)

### 1. المتطلبات الأساسية
- Python 3.12 أو أحدث
- Node.js 18+ و npm
- تثبيت `yt-dlp` و `ffmpeg` في مسار النظام (PATH)

### 2. إعداد الخادم الخلفي (Backend)
```bash
# تثبيت الحزم المطلوبة
pip install -r requirements.txt

# إنشاء نسخة من ملف الإعدادات
cp .env.example .env
```

### 3. توليد كلمات المرور للمستخدمين الاثنين
استخدم الأداة المساعدة المرفقة لتوليد هاش آمن لكل مستخدم:
```bash
python -m app.cli.hash_password "كلمة_المرور_الأولى"
python -m app.cli.hash_password "كلمة_المرور_الثانية"
```
ثم ضع الناتج في ملف `.env`:
```env
ALLOWED_USERS=user1:$2b$12$...,user2:$2b$12$...
```

### 4. تشغيل الخادم
```bash
uvicorn app.main:app --host 127.0.0.1 --port 5001 --reload
```

### 5. تشغيل الواجهة الأمامية (Frontend Dev)
```bash
cd frontend
npm install
npm run dev
```
أو لبناء النسخة الإنتاجية المدمجة:
```bash
cd frontend
npm run build
```
عند بناء الواجهة، يقوم خادم FastAPI تلقائيًا بتقديمها على نفس المنفذ `5001`.

---

## 🌐 النشر على خادم الإنتاج (Ubuntu Deployment)

### 1. استنساخ المشروع وتجهيز البيئة
```bash
cd /opt
git clone <repository-url> rahami
cd /opt/rahami

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# بناء الواجهة الأمامية
cd frontend
npm install
npm run build
cd ..
```

### 2. ضبط الصلاحيات والمجلدات
```bash
sudo chown -R www-data:www-data /opt/rahami
sudo chmod -R 750 /opt/rahami/storage
```

### 3. تفعيل خدمة Systemd
```bash
sudo cp deploy/rahami.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now rahami
sudo systemctl status rahami
```

### 4. إعداد Nginx وشهادة SSL المجانية (Certbot)
```bash
sudo cp deploy/rahami.conf /etc/nginx/sites-available/rahami.conf
sudo ln -s /etc/nginx/sites-available/rahami.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# استخراج شهادة SSL
sudo certbot --nginx -d rahami.yourdomain.com
```

---

## 🔒 الأمان والخصوصية (Security & Privacy)

- كل مهمة تحميل معزولة تمامًا عن المستخدم الآخر ولا يمكن لأي مستخدم الاطلاع على سجلات أو ملفات المستخدم الآخر.
- مسارات الملفات مؤمنة بالكامل ضد هجمات مسار المجلدات (Path Traversal Prevention).
- الجلسات مؤمنة بملفات تعريف ارتباط محمية (`HttpOnly`, `SameSite=Lax`, `Secure`).
- حظر تلقائي مؤقت عند تكرار محاولات تسجيل الدخول الفاشلة.
