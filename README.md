# Rahami (رهامي) - Private Telegram Downloader Bot

بوت تيليجرام خاص وعالي الأداء لتحميل الوسائط والملفات من الروابط المدعومة (TikTok، Instagram، YouTube، وروابط التنزيل المباشرة)، مبرمج بالكامل بلغة **Python 3.12+**.

---

## 🌟 المميزات الرئيسية

- **نظام وصول صارم وحصري**: البوت مقيد برقمي معرّف (User IDs) مصرح لهما فقط. لا يمكن لأي مستخدم آخر تنفيذ أوامر، أو إرسال روابط، أو الضغط على أزرار التفاعل.
- **تخطي حماية TikTok المتقدمة**: استخدام مكتبة `curl-cffi` مع انتحال متصفح Chrome (`--impersonate chrome`) لتجاوز فحوصات Slardar WAF وحل الروابط المختصرة (`vt.tiktok.com`).
- **توافق كامل مع مشغل تيليجرام للهواتف**: التحقق من الترميز وتحويل الفيديوهات تلقائياً إلى صيغة **H.264 (yuv420p)** مع صوت **AAC** وتطبيق خاصية `+faststart` وتوليد صورة مصغرة (Thumbnail) لبدء التشغيل الفوري داخل التطبيق.
- **دعم صور إنستغرام**: في حال كان رابط إنستغرام لصورة أو ألبوم صور بدون فيديو، يقوم البوت تلقائياً باستخراج الصورة الأصلية بأعلى دقة وتوفير خيار تنزيلها.
- **لوحة تقدم تفاعلية سريعة ومحمية**: تحديث مباشر لنسبة التقدم وحجم الملف وسرعة التنزيل والوقت المتبقي مع ضبط معدل الإرسال (Rate Throttling) كل 2.5 ثانية لحماية البوت من حظر تيليجرام (Telegram 429).
- **إدارة الطوابير والتزامن**:
  - معالجة تحميلين متزامنين على مستوى البوت (`MAX_CONCURRENT_DOWNLOADS=2`).
  - قفل تحميل واحد لكل مستخدم في نفس الوقت لمنع ازدحام السيرفر.
  - إمكانية الإلغاء الفوري للتحميل الجاري عبر أمر `/cancel`.
- **أمان متقدم**:
  - حماية كاملة من ثغرات تزوير الطلبات بالخادم (SSRF) بحظر عناوين الشبكات الداخلية والمحلية وبيانات سحابية (Cloud Metadata).
  - تنظيف ذاتي للملفات المؤقتة في مجلد `temp/` عند اكتمال التحميل أو فشله أو إلغائه أو إعادة تشغيل البوت.

---

## 📋 متطلبات التشغيل

1. **Python 3.12+**
2. **FFmpeg و FFprobe** (مضافين إلى مسار النظام `PATH`)
3. **yt-dlp** (محدث لأحدث إصدار)

---

## 🚀 التثبيت والتشغيل المحلي (Local Setup)

### 1. استنساخ المستودع وتثبيت المكتبات
```bash
# إنشاء بيئة افتراضية (اختياري لكن يُنصح به)
python -m venv venv

# تفعيل البيئة (Linux/macOS)
source venv/bin/activate

# تفعيل البيئة (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# تثبيت الحزم المطلوبة
pip install -r requirements.txt
```

### 2. ضبط الإعدادات (.env)
انسخ ملف الإعدادات وقم بتعديله:
```bash
cp .env.example .env
```
محتوى ملف `.env`:
```env
BOT_TOKEN=1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ
ALLOWED_USER_IDS=937470619,596354371
MAX_FILE_SIZE_MB=50
DOWNLOAD_TIMEOUT=900
TEMP_DIR=./temp
MAX_CONCURRENT_DOWNLOADS=2
LOG_LEVEL=INFO
```

### 3. تشغيل البوت
```bash
python main.py
```

---

## 🐧 النشر على سيرفر لينكس (Ubuntu Server Production Deployment)

### الخطوة 1: تثبيت الحزم الأساسية و FFmpeg
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-pip python3-venv ffmpeg git
```

### الخطوة 2: تثبيت المشروع وضبط الصلاحيات
```bash
# الانتقال إلى المجلد المخصص للتطبيقات
cd /opt
sudo git clone <REPO_URL> rahami
cd /opt/rahami

# إنشاء البيئة الافتراضية وتثبيت المتطلبات
sudo python3 -m venv venv
sudo ./venv/bin/pip install --upgrade pip
sudo ./venv/bin/pip install -r requirements.txt

# إنشاء ملف الإعدادات
sudo cp .env.example .env
sudo nano .env
```

### الخطوة 3: إعداد خدمة Systemd للتشغيل التلقائي والمستمر
قم بإنشاء ملف الخدمة:
```bash
sudo nano /etc/systemd/system/rahami.service
```

ألصق الإعدادات التالية:
```ini
[Unit]
Description=Rahami Telegram Downloader Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rahami
ExecStart=/opt/rahami/venv/bin/python main.py
Restart=always
RestartSec=5
EnvironmentFile=/opt/rahami/.env

# حماية الموارد والحدود
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

### الخطوة 4: تفعيل وتشغيل الخدمة
```bash
# إعادة تحميل خدمات systemd
sudo systemctl daemon-reload

# تفعيل الخدمة للعمل التلقائي عند إقلاع السيرفر
sudo systemctl enable rahami

# تشغيل الخدمة
sudo systemctl start rahami

# فحص حالة الخدمة
sudo systemctl status rahami
```

### فحص السجلات المباشرة (Logs)
```bash
journalctl -u rahami -f
```

---

## 🛠️ أوامر التحكم بالبوت

| الأمر | الوظيفة |
| :--- | :--- |
| `/start` | عرض الترحيب وقائمة الأزرار التفاعلية الرئيسية |
| `/status` | فحص حالة ونسبة التحميل الجاري للمستخدم |
| `/cancel` | إلغاء فوري للتحميل الجاري للمستخدم وتنظيف ملفاته |
| `/help` | عرض تعليمات الاستخدام والأوامر المدعومة |

---

## 🧪 تشغيل الاختبارات الآلية (Unit Tests)

```bash
python -m unittest discover -s tests -p "test_*.py" -v
```
