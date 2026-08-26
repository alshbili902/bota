import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import mime from 'mime-types';
import { env } from '../config/env.js';
import { DownloadTask, MediaMetadata } from '../types/download.js';
import { DownloadResult, ProgressCallback } from '../types/provider.js';
import { logger } from '../utils/logger.js';
import { sanitizeFilename } from '../utils/sanitizer.js';
import { BaseDownloadProvider } from './base-provider.js';

export class HttpProvider extends BaseDownloadProvider {
  readonly name = 'http';

  /**
   * Check if URL represents a direct file download
   */
  async canHandle(url: string): Promise<boolean> {
    try {
      const parsed = new URL(url);
      const ext = path.extname(parsed.pathname).toLowerCase();
      // Common direct media and file extensions
      const directExtensions = new Set([
        '.mp4',
        '.mkv',
        '.webm',
        '.mov',
        '.avi',
        '.mp3',
        '.m4a',
        '.wav',
        '.flac',
        '.aac',
        '.ogg',
        '.opus',
        '.pdf',
        '.zip',
        '.rar',
        '.7z',
        '.tar',
        '.gz',
        '.iso',
        '.apk',
        '.dmg',
        '.exe',
        '.jpg',
        '.jpeg',
        '.png',
        '.gif',
        '.webp',
        '.heic',
        '.heif',
      ]);

      if (directExtensions.has(ext)) {
        return true;
      }

      // If no recognized extension, attempt a quick HEAD request to inspect Content-Type
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
      const contentType = res.headers.get('content-type')?.toLowerCase() || '';
      if (
        contentType.startsWith('video/') ||
        contentType.startsWith('audio/') ||
        contentType.startsWith('application/octet-stream') ||
        contentType.startsWith('application/zip') ||
        contentType.startsWith('application/pdf')
      ) {
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }

  /**
   * Extracts metadata for a direct file via HEAD / GET header inspection
   */
  async extractMetadata(url: string, signal?: AbortSignal): Promise<MediaMetadata> {
    let title = 'file';
    let estimatedSize: number | undefined;
    let mimeType = 'application/octet-stream';
    let ext = '.bin';

    try {
      const parsed = new URL(url);
      const pathnameExt = path.extname(parsed.pathname);
      if (pathnameExt) {
        ext = pathnameExt;
        title = path.basename(parsed.pathname, ext);
      }

      // Fetch headers
      const res = await fetch(url, {
        method: 'HEAD',
        signal: signal || AbortSignal.timeout(5000),
      });

      const lengthHeader = res.headers.get('content-length');
      if (lengthHeader) {
        estimatedSize = parseInt(lengthHeader, 10);
      }

      const typeHeader = res.headers.get('content-type');
      if (typeHeader) {
        mimeType = typeHeader.split(';')[0].trim();
        const guessedExt = mime.extension(mimeType);
        if (guessedExt && (!ext || ext === '.bin')) {
          ext = `.${guessedExt}`;
        }
      }

      // Check Content-Disposition for original filename
      const disposition = res.headers.get('content-disposition');
      if (disposition) {
        const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
        if (match && match[1]) {
          const rawName = decodeURIComponent(match[1]);
          ext = path.extname(rawName) || ext;
          title = path.basename(rawName, ext);
        }
      }
    } catch (err) {
      logger.debug({ error: (err as Error).message }, 'HEAD request failed for direct URL');
    }

    const cleanTitle = sanitizeFilename(title, ext);
    const isAudio = mimeType.startsWith('audio/');

    return {
      url,
      title: cleanTitle,
      provider: 'http',
      estimatedSize,
      mimeType,
      filename: cleanTitle,
      isDirectFile: true,
      formats: [
        {
          id: 'direct',
          label: isAudio ? '🎵 تحميل صوتي مباشر' : '📁 تحميل مباشر للملف',
          extension: ext.replace('.', '') || 'bin',
          isAudioOnly: isAudio,
          filesize: estimatedSize,
        },
      ],
    };
  }

  /**
   * Downloads direct file with streaming, size enforcement, and throttled progress updates
   */
  async download(task: DownloadTask, onProgress: ProgressCallback): Promise<DownloadResult> {
    const res = await fetch(task.metadata.url, {
      signal: task.abortController.signal,
    });

    if (!res.ok) {
      throw new Error(`HTTP_${res.status}`);
    }

    const contentLength = res.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : task.metadata.estimatedSize;

    if (totalBytes && env.MAX_FILE_SIZE > 0 && totalBytes > env.MAX_FILE_SIZE) {
      throw new Error('FILE_TOO_LARGE');
    }

    const safeFilename = sanitizeFilename(task.metadata.title, task.selectedFormat.extension);
    const targetPath = path.join(task.tempDir, safeFilename);
    const writeStream = fs.createWriteStream(targetPath);

    if (!res.body) {
      throw new Error('DOWNLOAD_FAILED');
    }

    let downloadedBytes = 0;
    let lastProgressTime = Date.now();
    let lastProgressBytes = 0;

    const progressTracker = new (await import('node:stream')).Transform({
      transform(chunk: Buffer, _encoding, callback) {
        downloadedBytes += chunk.length;

        // Size limit check during stream
        if (env.MAX_FILE_SIZE > 0 && downloadedBytes > env.MAX_FILE_SIZE) {
          callback(new Error('FILE_TOO_LARGE'));
          return;
        }

        const now = Date.now();
        if (now - lastProgressTime >= 1000) {
          const timeDiff = (now - lastProgressTime) / 1000;
          const bytesDiff = downloadedBytes - lastProgressBytes;
          const speed = bytesDiff / timeDiff;

          let percent = 0;
          let eta: number | undefined;

          if (totalBytes && totalBytes > 0) {
            percent = (downloadedBytes / totalBytes) * 100;
            const remainingBytes = totalBytes - downloadedBytes;
            eta = speed > 0 ? Math.round(remainingBytes / speed) : undefined;
          }

          onProgress({
            percent,
            downloadedBytes,
            totalBytes,
            speedBytesPerSec: speed,
            etaSeconds: eta,
            phase: 'downloading',
          });

          lastProgressTime = now;
          lastProgressBytes = downloadedBytes;
        }

        callback(null, chunk);
      },
    });

    // Readable stream from Web Fetch reader
    const nodeReadable = (await import('node:stream')).Readable.fromWeb(
      res.body as Parameters<typeof import('node:stream').Readable.fromWeb>[0]
    );

    try {
      await pipeline(nodeReadable, progressTracker, writeStream, {
        signal: task.abortController.signal,
      });

      const stats = await fs.promises.stat(targetPath);
      const mimeType = mime.lookup(targetPath) || task.metadata.mimeType || 'application/octet-stream';

      return {
        filePath: targetPath,
        filename: safeFilename,
        filesize: stats.size,
        mimeType,
        title: task.metadata.title,
      };
    } catch (err) {
      if (task.abortController.signal.aborted) {
        throw new Error('DOWNLOAD_CANCELLED');
      }
      throw err;
    }
  }
}
