import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
import { env } from '../config/env.js';
import { DownloadFormat, DownloadTask, MediaMetadata } from '../types/download.js';
import { DownloadResult, ProgressCallback } from '../types/provider.js';
import { getMimeType } from '../utils/file-utils.js';
import { logger } from '../utils/logger.js';
import { sanitizeFilename } from '../utils/sanitizer.js';
import { BaseDownloadProvider } from './base-provider.js';

interface YtDlpFormat {
  format_id: string;
  ext: string;
  resolution?: string;
  height?: number;
  width?: number;
  filesize?: number;
  filesize_approx?: number;
  vcodec?: string;
  acodec?: string;
  format_note?: string;
  fps?: number;
}

interface YtDlpInfo {
  id: string;
  title: string;
  webpage_url?: string;
  duration?: number;
  thumbnail?: string;
  formats?: YtDlpFormat[];
  filesize?: number;
  filesize_approx?: number;
  ext?: string;
  is_live?: boolean;
}

export class YtDlpProvider extends BaseDownloadProvider {
  readonly name = 'ytdlp';

  private getBinaryPath(): string {
    return env.YTDLP_PATH && env.YTDLP_PATH.trim().length > 0 ? env.YTDLP_PATH.trim() : 'yt-dlp';
  }

  private getFfmpegLocationArg(): string[] {
    if (env.FFMPEG_PATH && env.FFMPEG_PATH.trim().length > 0) {
      return ['--ffmpeg-location', env.FFMPEG_PATH.trim()];
    }
    return [];
  }

  /**
   * yt-dlp can handle most web video/audio platforms
   */
  async canHandle(url: string): Promise<boolean> {
    // Quick heuristic: if it's a direct file extension like .zip or .pdf, defer to HTTP provider
    const lower = url.toLowerCase().split('?')[0];
    if (
      lower.endsWith('.zip') ||
      lower.endsWith('.tar') ||
      lower.endsWith('.gz') ||
      lower.endsWith('.pdf') ||
      lower.endsWith('.iso') ||
      lower.endsWith('.exe') ||
      lower.endsWith('.apk')
    ) {
      return false;
    }
    return true;
  }

  /**
   * Extract video/media metadata and genuine formats using yt-dlp --dump-json
   */
  async extractMetadata(url: string, signal?: AbortSignal): Promise<MediaMetadata> {
    const binary = this.getBinaryPath();

    // Pre-resolve short links (e.g. vt.tiktok.com) to clean canonical URL
    let targetUrl = url;
    if (url.includes('tiktok.com/')) {
      try {
        const res = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(5000),
        });
        if (res.url && res.url.includes('/video/')) {
          const parsed = new URL(res.url);
          parsed.search = '';
          targetUrl = parsed.toString();
          logger.debug({ originalUrl: url, resolvedUrl: targetUrl }, 'Resolved clean TikTok URL');
        }
      } catch (redirectErr) {
        logger.debug({ error: (redirectErr as Error).message }, 'TikTok redirect pre-resolution skipped');
      }
    }

    const args = [
      '--impersonate',
      'chrome',
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      '--skip-download',
      ...this.getFfmpegLocationArg(),
      targetUrl,
    ];

    return new Promise((resolve, reject) => {
      const child = spawn(binary, args, {
        signal,
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        logger.error({ error: err.message }, 'Failed to spawn yt-dlp for metadata');
        reject(new Error('Failed to run yt-dlp. Please ensure yt-dlp is installed.'));
      });

      child.on('close', async (code) => {
        if (code !== 0) {
          logger.warn({ code, stderr: stderr.slice(0, 200) }, 'yt-dlp extractMetadata failed');

          // If Instagram post contains only photos (no video streams), fallback to photo extraction
          if (
            url.includes('instagram.com/') &&
            (stderr.includes('There is no video in this post') || stderr.includes('no video'))
          ) {
            try {
              const photoMeta = await this.extractInstagramPhoto(url, signal);
              if (photoMeta) {
                resolve(photoMeta);
                return;
              }
            } catch (fallbackErr) {
              logger.warn({ error: (fallbackErr as Error).message }, 'Instagram photo fallback failed');
            }
            reject(new Error('NO_VIDEO_IN_POST'));
            return;
          }

          if (stderr.includes('empty media response') || stderr.includes('login required') || stderr.includes('Login required')) {
            reject(new Error('PRIVATE_ACCOUNT'));
            return;
          }

          reject(new Error('Unsupported or inaccessible media URL.'));
          return;
        }

        try {
          const info: YtDlpInfo = JSON.parse(stdout);
          const metadata = this.parseYtDlpInfo(url, info);
          resolve(metadata);
        } catch (parseErr) {
          logger.error({ error: (parseErr as Error).message }, 'Failed to parse yt-dlp JSON output');
          reject(new Error('Failed to parse media metadata from yt-dlp.'));
        }
      });
    });
  }

  /**
   * Categorizes formats into clean, genuine options without duplicates or fake formats
   */
  private parseYtDlpInfo(url: string, info: YtDlpInfo): MediaMetadata {
    const title = info.title || 'media_file';
    const duration = info.duration;
    const thumbnail = info.thumbnail;
    const formats = info.formats || [];

    const availableFormats: DownloadFormat[] = [];

    // Always offer Best Quality
    availableFormats.push({
      id: 'best',
      label: '🎬 أفضل جودة (Best Quality)',
      quality: 'أفضل جودة',
      extension: 'mp4',
      isAudioOnly: false,
      filesize: info.filesize || info.filesize_approx,
    });

    // Detect distinct available video heights (e.g. 1080, 720, 480, 360)
    const heightsSet = new Set<number>();
    for (const f of formats) {
      if (f.vcodec && f.vcodec !== 'none' && f.height && f.height > 0) {
        heightsSet.add(f.height);
      }
    }

    const standardHeights = [1080, 720, 480, 360];
    for (const targetHeight of standardHeights) {
      // Check if this height or higher is available
      const match = Array.from(heightsSet).find((h) => Math.abs(h - targetHeight) <= 40);
      if (match) {
        availableFormats.push({
          id: `res_${targetHeight}`,
          label: `🎥 دقة ${targetHeight}p`,
          quality: `${targetHeight}p`,
          extension: 'mp4',
          isAudioOnly: false,
        });
      }
    }

    // Check if audio is available
    const hasAudio = formats.some((f) => f.acodec && f.acodec !== 'none');
    if (hasAudio) {
      availableFormats.push({
        id: 'audio_mp3',
        label: '🎵 صوت فقط MP3 (Audio Only)',
        quality: 'صوت عالي الجودة',
        extension: 'mp3',
        isAudioOnly: true,
      });
    }

    return {
      url: info.webpage_url || url,
      title,
      duration,
      thumbnail,
      provider: 'ytdlp',
      estimatedSize: info.filesize || info.filesize_approx,
      formats: availableFormats,
    };
  }

  /**
   * Execute the media download using yt-dlp
   */
  async download(task: DownloadTask, onProgress: ProgressCallback): Promise<DownloadResult> {
    const binary = this.getBinaryPath();
    const isAudio = task.selectedFormat.isAudioOnly;

    // Output template inside the isolated task temp directory
    const outputTemplate = path.join(task.tempDir, '%(title).100B.%(ext)s');

    let formatArg: string;
    const formatId = task.selectedFormat.id;

    if (isAudio) {
      formatArg = 'bestaudio/best';
    } else if (formatId.startsWith('res_')) {
      const height = formatId.replace('res_', '');
      formatArg = `bestvideo[height<=${height}][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=${height}][vcodec^=avc]+bestaudio/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best/b`;
    } else {
      formatArg = 'bestvideo[vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[vcodec^=avc]+bestaudio/best[vcodec^=avc]/bestvideo+bestaudio/best/b';
    }

    const args = [
      '--impersonate',
      'chrome',
      '--newline',
      '--no-playlist',
      '--no-warnings',
      '-f',
      formatArg,
      '-o',
      outputTemplate,
      ...this.getFfmpegLocationArg(),
    ];

    if (isAudio) {
      args.push('-x', '--audio-format', 'mp3');
    } else {
      args.push('--merge-output-format', 'mp4');
    }

    // Limit maximum filesize if configured
    if (env.MAX_FILE_SIZE > 0) {
      args.push('--max-filesize', `${env.MAX_FILE_SIZE}`);
    }

    args.push(task.metadata.url);

    logger.debug({ formatArg, tempDir: task.tempDir }, 'Starting yt-dlp download process');

    return new Promise((resolve, reject) => {
      const child = spawn(binary, args, {
        signal: task.abortController.signal,
        windowsHide: true,
      });

      let finalFilePath = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // Check for destination path
          if (trimmed.startsWith('[download] Destination:') || trimmed.startsWith('[Merger] Merging formats into')) {
            const match = trimmed.match(/"([^"]+)"/) || trimmed.match(/Destination:\s+(.+)$/);
            if (match && match[1]) {
              finalFilePath = match[1].trim();
            }
          }

          // Parse progress: [download]  45.2% of 100.00MiB at  5.40MiB/s ETA 00:10
          const progressMatch = trimmed.match(
            /\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+~?(\d+(?:\.\d+)?)([KMGTP]i?B)\s+at\s+~?(\d+(?:\.\d+)?)([KMGTP]i?B\/s)\s+ETA\s+(\d+:\d+(?::\d+)?)/i
          );

          if (progressMatch) {
            const percent = parseFloat(progressMatch[1]);
            const totalNum = parseFloat(progressMatch[2]);
            const totalUnit = progressMatch[3];
            const speedNum = parseFloat(progressMatch[4]);
            const speedUnit = progressMatch[5];
            const etaStr = progressMatch[6];

            const totalBytes = this.unitToBytes(totalNum, totalUnit);
            const speedBytes = this.unitToBytes(speedNum, speedUnit);
            const etaSeconds = this.parseEtaToSeconds(etaStr);
            const downloadedBytes = (totalBytes * percent) / 100;

            this.updateProgress(
              onProgress,
              percent,
              downloadedBytes,
              totalBytes,
              speedBytes,
              etaSeconds,
              'downloading'
            );
          }
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        if (task.abortController.signal.aborted) {
          reject(new Error('DOWNLOAD_CANCELLED'));
        } else {
          reject(err);
        }
      });

      child.on('close', async (code) => {
        if (task.abortController.signal.aborted) {
          reject(new Error('DOWNLOAD_CANCELLED'));
          return;
        }

        if (code !== 0) {
          logger.error({ code, stderr: stderr.slice(0, 300) }, 'yt-dlp process exited with error');
          if (stderr.includes('File is larger than max-filesize')) {
            reject(new Error('FILE_TOO_LARGE'));
          } else {
            reject(new Error('DOWNLOAD_FAILED'));
          }
          return;
        }

        try {
          // If destination wasn't captured from stdout, locate the file in task.tempDir
          let resolvedFile = finalFilePath;
          if (!resolvedFile || !(await this.fileExists(resolvedFile))) {
            const files = await fs.readdir(task.tempDir);
            const mediaFiles = files.filter((f) => !f.endsWith('.part') && !f.endsWith('.ytdl'));
            if (mediaFiles.length === 0) {
              throw new Error('DOWNLOAD_FAILED');
            }
            resolvedFile = path.join(task.tempDir, mediaFiles[0]);
          }

          const stats = await fs.stat(resolvedFile);
          const cleanName = sanitizeFilename(path.basename(resolvedFile));
          const mimeType = getMimeType(resolvedFile);

          resolve({
            filePath: resolvedFile,
            filename: cleanName,
            filesize: stats.size,
            mimeType,
            duration: task.metadata.duration,
            title: task.metadata.title,
          });
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  private unitToBytes(val: number, unit: string): number {
    const u = unit.toUpperCase().replace('/S', '');
    if (u.startsWith('K')) return val * 1024;
    if (u.startsWith('M')) return val * 1024 * 1024;
    if (u.startsWith('G')) return val * 1024 * 1024 * 1024;
    if (u.startsWith('T')) return val * 1024 * 1024 * 1024 * 1024;
    return val;
  }

  private parseEtaToSeconds(eta: string): number {
    const parts = eta.split(':').map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fallback for Instagram posts containing photos instead of video
   */
  private async extractInstagramPhoto(url: string, signal?: AbortSignal): Promise<MediaMetadata | null> {
    const pyScript = `
import yt_dlp, json, sys
from yt_dlp.utils import traverse_obj
try:
    url = sys.argv[1]
    video_id = url.split('/p/')[1].split('/')[0] if '/p/' in url else url.split('/reel/')[1].split('/')[0]
    ydl = yt_dlp.YoutubeDL({'quiet': True, 'no_warnings': True})
    ie = yt_dlp.extractor.get_info_extractor('Instagram')(ydl)
    webpage, _ = ie._download_webpage_handle(url, video_id)
    media = traverse_obj(webpage, ({ie._SJS_RE.findall}, ..., {json.loads}, 'require', ..., ..., ..., '__bbox', 'require', lambda _, v: v[0] == 'RelayPrefetchedStreamCache', ..., lambda _, v: v['__bbox']['result']['data']['xig_polaris_media'], '__bbox', 'result', 'data', 'xig_polaris_media', {dict}, any))
    product_info = traverse_obj(media, ('if_not_gated_logged_out', {dict})) or {}
    candidates = product_info.get('image_versions2', {}).get('candidates', [])
    img_url = candidates[0].get('url') if candidates else product_info.get('display_uri')
    caption = traverse_obj(product_info, ('caption', 'text', {str})) or 'Instagram Photo'
    first_line = caption.strip().split('\\n')[0][:80]
    print(json.dumps({'imageUrl': img_url, 'title': first_line or 'Instagram Photo'}))
except Exception as e:
    print(json.dumps({'error': str(e)}))
`;

    try {
      const { stdout } = await execFileAsync('python', ['-c', pyScript, url], {
        signal,
        timeout: 20000,
        windowsHide: true,
      });

      const data = JSON.parse(stdout.trim());
      if (data.imageUrl) {
        return {
          url: data.imageUrl,
          title: data.title || 'Instagram Photo',
          provider: 'http',
          isDirectFile: true,
          mimeType: 'image/jpeg',
          thumbnail: data.imageUrl,
          formats: [
            {
              id: 'photo_best',
              label: '🖼 تحميل الصورة بدقة أصلية كاملة',
              extension: 'jpg',
              isAudioOnly: false,
            },
          ],
        };
      }
    } catch (err) {
      logger.warn({ error: (err as Error).message }, 'Failed to extract Instagram photo fallback');
    }
    return null;
  }
}
