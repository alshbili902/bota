# 🤖 Private Telegram Downloader Bot
### بوت تحميل تيليجرام خاص وعالي الأداء (Node.js & TypeScript)

A production-ready, secure, and lightweight private Telegram bot designed to download media (videos, audio, and direct files) from supported URLs with strict **two-user access control**, live throttled progress bars, format selection, and PM2 process management.

---

## 🌟 Key Features / المميزات الرئيسية

* **Strict 2-User Access Control (حماية صارمة لشخصين فقط):**
  Enforced globally at the middleware level and verified again at the service level (defense-in-depth). Unauthorized users cannot execute commands, trigger downloads, or interact with inline keyboard buttons.
* **Modern Arabic Interface (واجهة عربية عصرية وسريعة):**
  Clear, user-friendly messages, interactive inline buttons, and rich formatting.
* **Multi-Source Support (دعم مصادر متعددة):**
  - **yt-dlp Engine:** Supports video & audio platforms (YouTube, Twitter/X, Instagram, TikTok, Facebook, SoundCloud, Reddit, Vimeo, etc.).
  - **Direct HTTP Streaming:** Downloads direct files (MP4, MP3, PDF, ZIP, MKV, etc.) with streaming pipelines.
* **Format & Quality Selection (اختيار الجودة والصيغة):**
  Inspects media and displays only genuine available resolutions (Best, 1080p, 720p, 480p, 360p, or Audio MP3).
* **Smooth Progress Tracking (تتبع التقدم المباشر):**
  Visual progress bar (`[▓▓▓▓▓▓░░░░] 60%`), real-time speed, downloaded size, and ETA, rate-limited to avoid Telegram 429 errors.
* **Queue & Concurrency Management (إدارة الطابور والأمان):**
  Enforces a limit of 1 active download per authorized user. Provides instant cancellation via `/cancel`.
* **FFmpeg Processing (معالجة وتحويل الصوت والفيديو):**
  High-quality MP3 audio extraction and streaming-compatible MP4 container remuxing.
* **Production Ready (جاهز للإنتاج والاستضافة):**
  Clean TypeScript architecture, structured redacting logger (`pino`), graceful shutdown, orphaned temp file cleanup on startup, and PM2 ecosystem configuration.

---

## 📋 System Requirements / المتطلبات

* **Operating System:** Linux (Ubuntu 20.04+, Debian 11+, CentOS, Alpine) or Windows 10/11 / Server.
* **Node.js:** `v20.0.0` or higher (tested on Node `v24`).
* **npm:** `v9.0.0` or higher.
* **yt-dlp:** Latest release.
* **FFmpeg:** `v4.4` or higher.
* **PM2:** For production daemon process management (`npm install -g pm2`).

---

## 🛠️ Step-by-Step Installation (Linux VPS) / التثبيت على خادم لينكس

### 1. Update System Packages
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential
```

### 2. Install Node.js (v20+ LTS)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v # Should display v20.x or higher
npm -v
```

### 3. Install FFmpeg
```bash
sudo apt install -y ffmpeg
ffmpeg -version
```

### 4. Install yt-dlp
```bash
# Download latest yt-dlp standalone binary
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
yt-dlp --version
```

### 5. Clone and Install Dependencies
```bash
git clone <your-repository-url> boterhamy
cd boterhamy

# Install production and development dependencies
npm install

# Build TypeScript to JavaScript
npm run build
```

---

## 🛠️ Installation on Windows / التثبيت على ويندوز

1. Install **Node.js 20+** from [nodejs.org](https://nodejs.org/).
2. Install **yt-dlp** via winget or Python pip:
   ```cmd
   winget install yt-dlp
   # or: pip install yt-dlp
   ```
3. Install **FFmpeg** via winget:
   ```cmd
   winget install Gyan.FFmpeg
   ```
4. Install dependencies and build:
   ```cmd
   npm.cmd install
   npm.cmd run build
   ```

---

## 🔑 How to Obtain Telegram User IDs / كيفية الحصول على معرّف تيليجرام

To ensure only you and your partner can use the bot, obtain your numeric Telegram User IDs:

1. Open Telegram and search for [@userinfobot](https://t.me/userinfobot) or [@raw_data_bot](https://t.me/raw_data_bot).
2. Click **Start** (`/start`).
3. The bot will reply with your numeric `Id` (e.g. `123456789`).
4. Repeat this step for the second authorized user (e.g. `987654321`).

---

## ⚙️ Configuration (.env) / إعداد متغيرات البيئة

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` using your favorite editor (`nano .env`):

```env
# =================================================================
# Private Telegram Download Bot Configuration
# =================================================================

# Telegram Bot Token obtained from @BotFather
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Strict Allowlist: Exactly TWO comma-separated Telegram User IDs
ALLOWED_USERS=123456789,987654321

# Maximum file size in bytes (Default: 52428800 = 50 MB standard Bot API limit)
MAX_FILE_SIZE=52428800

# Download Timeout in milliseconds (Default: 900000 = 15 minutes)
DOWNLOAD_TIMEOUT=900000

# Directory for temporary files
TEMP_DIRECTORY=./temp

# Custom binary paths (leave empty to auto-detect from PATH)
YTDLP_PATH=
FFMPEG_PATH=

# Logging level: info, debug, warn, error
LOG_LEVEL=info

# Node environment
NODE_ENV=production
```

> [!IMPORTANT]
> **Telegram Bot API Size Limit**:
> Standard Telegram bots have an upload ceiling of **50 MB** via official Telegram cloud servers.
> If you wish to send files up to **2000 MB (2 GB)**, run a local [Telegram Bot API Server](https://core.telegram.org/bots/api#using-a-local-bot-api-server) and specify `TELEGRAM_API_ROOT=http://localhost:8081` in your `.env`, then increase `MAX_FILE_SIZE=2097152000`.

---

## 🚀 Running the Bot / تشغيل البوت

### Local Development / وضع التطوير
```bash
# Runs TypeScript directly with live reloading
npm run dev
```

### Running Unit Tests / تشغيل الاختبارات
```bash
npm test
```

### Production Deployment with PM2 / التشغيل في الإنتاج بواسطة PM2
PM2 keeps your bot running 24/7, restarts it automatically if it crashes or the server reboots, and manages log files.

```bash
# 1. Install PM2 globally (if not already installed)
sudo npm install -g pm2

# 2. Build the TypeScript source code
npm run build

# 3. Start the bot via the ecosystem configuration
pm2 start ecosystem.config.cjs

# 4. Save PM2 state to resurrect on server reboot
pm2 save
pm2 startup
```

### Managing the PM2 Process
```bash
# Check status
pm2 status

# View live streaming logs
pm2 logs telegram-downloader-bot

# Restart the bot
pm2 restart telegram-downloader-bot

# Stop the bot
pm2 stop telegram-downloader-bot
```

---

## 💬 Bot Commands & Usage / أوامر البوت والاستخدام

| الأمر / Command | الوصف / Description |
| :--- | :--- |
| `/start` | عرض رسالة الترحيب وزر بدء إرسال الروابط |
| `/help` | شرح مفصل عن كيفية الاستخدام والمنصات المدعومة |
| `/status` | عرض تفاصيل التحميل الجاري (الملف، التقدم، السرعة، الوقت المتبقي) |
| `/cancel` | إلغاء فوري للتحميل النشط وحذف الملفات المؤقتة وإيقاف العمليات |

### Download Workflow:
1. Send any supported link (e.g. YouTube, Instagram, X/Twitter, or direct `.mp4` / `.zip` file URL).
2. The bot inspects and verifies the link, guarding against SSRF and private IP addresses.
3. Available genuine formats are displayed as interactive buttons:
   - `[ 🎬 أفضل جودة (Best Quality) ]`
   - `[ 🎥 1080p ]`, `[ 🎥 720p ]`, `[ 📱 480p ]`
   - `[ 🎵 صوت فقط MP3 ]`
   - `[ ❌ إلغاء ]`
4. Click your desired format.
5. The bot streams progress updates and automatically delivers the file to your chat.

---

## 🔒 Security Architecture / المعايير الأمنية

* **Zero Arbitrary Execution:** No `child_process.exec()` or `shell: true` calls. Arguments are passed as sanitized arrays directly to `spawn` / `execFile`.
* **SSRF Protection:** All URLs are checked against private RFC1918 networks, loopback (`127.0.0.1`, `localhost`), link-local metadata endpoints (`169.254.169.254`), and IPv6 equivalents.
* **Filename Sanitization:** Path traversal patterns (`../`, `..\\`), non-printable control characters, and reserved filesystem symbols are stripped before creating local files.
* **Isolated Temporary Directories:** Each download is placed inside its own uniquely generated `temp/task_<id>` folder and guaranteed to be deleted in a `finally` block.
* **Data Privacy:** Tokens, passwords, and sensitive URL query parameters are automatically redacted from logs.
* **Strict Allowlist:** All updates from users not listed in `ALLOWED_USERS` are immediately dropped and audited.

---

## 🔄 Updating the Bot / تحديث البوت

```bash
cd /path/to/boterhamy
git pull
npm install
npm run build
pm2 restart telegram-downloader-bot
```

To update `yt-dlp` to the latest version:
```bash
sudo yt-dlp -U
```

---

## ❓ Troubleshooting / حل المشكلات الشائعة

1. **Bot says: "هذا البوت خاص وأنت غير مصرح لك باستخدامه."**
   - Check your Telegram ID using [@userinfobot](https://t.me/userinfobot).
   - Ensure the ID is correctly set in `.env` under `ALLOWED_USERS` (e.g., `ALLOWED_USERS=123456789,987654321` with no spaces).
   - Restart the bot with `pm2 restart telegram-downloader-bot`.

2. **File too large error ("حجم هذا الملف يتجاوز الحد الأقصى"):**
   - The standard Telegram Bot API has a 50MB limit. For larger files (up to 2GB), configure a local Telegram Bot API Server.

3. **yt-dlp or FFmpeg not found on startup:**
   - Verify yt-dlp is installed and in PATH: `yt-dlp --version`.
   - Set the exact path in `.env` if necessary:
     `YTDLP_PATH=/usr/local/bin/yt-dlp`
     `FFMPEG_PATH=/usr/bin/ffmpeg`

---

## 📄 License

MIT License. Designed for private, high-performance personal use.
