import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Api } from 'grammy';
import { MESSAGES } from '../config/constants.js';
import { env } from '../config/env.js';
import { providerRegistry } from '../downloader/provider-registry.js';
import { isUserAuthorized } from '../middleware/auth.js';
import { DownloadFormat, DownloadTask, MediaMetadata } from '../types/download.js';
import { createTempTaskDir, formatBytes } from '../utils/file-utils.js';
import { logger } from '../utils/logger.js';
import { ProgressThrottler } from '../utils/progress-throttler.js';
import { cleanupService } from './cleanup-service.js';
import { ffmpegService } from './ffmpeg-service.js';
import { queueManager } from './queue-manager.js';
import { telegramService } from './telegram-service.js';

interface CachedDownload {
  id: string;
  userId: number;
  metadata: MediaMetadata;
  createdAt: number;
}

export class DownloadManager {
  // Short-lived cache for extracted metadata pending format selection (5 min TTL)
  private metadataCache = new Map<string, CachedDownload>();

  constructor() {
    // Periodic garbage collection of expired metadata cache items
    setInterval(() => {
      const now = Date.now();
      for (const [id, cached] of this.metadataCache.entries()) {
        if (now - cached.createdAt > 300000) {
          this.metadataCache.delete(id);
        }
      }
    }, 60000).unref();
  }

  /**
   * Analyze a URL, verify user authorization, check queue, and extract metadata
   */
  public async analyzeUrl(userId: number, url: string): Promise<{ downloadId: string; metadata: MediaMetadata }> {
    // Defense-in-depth authorization check
    if (!isUserAuthorized(userId)) {
      throw new Error('UNAUTHORIZED');
    }

    // Check if user already has an active download
    if (queueManager.hasActiveDownload(userId)) {
      throw new Error('ACTIVE_DOWNLOAD_EXISTS');
    }

    // Resolve matching provider
    const provider = await providerRegistry.getProviderForUrl(url);
    if (!provider) {
      throw new Error('UNSUPPORTED_SOURCE');
    }

    logger.info({ userId, provider: provider.name }, 'Extracting metadata for URL');

    try {
      const metadata = await provider.extractMetadata(url, AbortSignal.timeout(20000));

      // Generate a short unique ID for inline button callback data
      const downloadId = crypto.randomBytes(4).toString('hex');
      this.metadataCache.set(downloadId, {
        id: downloadId,
        userId,
        metadata,
        createdAt: Date.now(),
      });

      return { downloadId, metadata };
    } catch (err) {
      logger.error({ error: (err as Error).message, userId }, 'Failed to extract metadata');
      throw new Error('UNSUPPORTED_SOURCE');
    }
  }

  /**
   * Start executing the download after format selection
   */
  public async startDownload(
    userId: number,
    chatId: number,
    downloadId: string,
    formatId: string,
    api: Api
  ): Promise<void> {
    // Defense-in-depth authorization check
    if (!isUserAuthorized(userId)) {
      throw new Error('UNAUTHORIZED');
    }

    // Verify metadata from cache
    const cached = this.metadataCache.get(downloadId);
    if (!cached || cached.userId !== userId) {
      throw new Error('DOWNLOAD_EXPIRED');
    }

    // Check if user already has an active download
    if (queueManager.hasActiveDownload(userId)) {
      throw new Error('ACTIVE_DOWNLOAD_EXISTS');
    }

    const { metadata } = cached;
    const selectedFormat =
      metadata.formats.find((f) => f.id === formatId) || metadata.formats[0] || ({
        id: 'default',
        label: 'Default',
        extension: 'mp4',
        isAudioOnly: false,
      } as DownloadFormat);

    // Check file size against limit if already known
    const knownSize = selectedFormat.filesize || metadata.estimatedSize;
    if (knownSize && env.MAX_FILE_SIZE > 0 && knownSize > env.MAX_FILE_SIZE) {
      throw new Error('FILE_TOO_LARGE');
    }

    // Prepare task
    const abortController = new AbortController();
    const tempDir = await createTempTaskDir(env.TEMP_DIRECTORY, downloadId);

    const task: DownloadTask = {
      id: downloadId,
      userId,
      chatId,
      metadata,
      selectedFormat,
      abortController,
      status: 'queued',
      progress: {
        percent: 0,
        downloadedBytes: 0,
        totalBytes: knownSize,
        phase: 'downloading',
      },
      tempDir,
      startTime: Date.now(),
    };

    // Register with queue manager (locks user to 1 active download)
    if (!queueManager.registerDownload(task)) {
      await cleanupService.cleanTaskDir(tempDir);
      throw new Error('ACTIVE_DOWNLOAD_EXISTS');
    }

    // Send initial Telegram progress status message
    let statusMsgId: number | undefined;
    try {
      const initialMsg = await api.sendMessage(
        chatId,
        `⏳ *بدء عملية التحميل...*\n\n` +
          `📁 *الملف:* \`${escapeMarkdown(metadata.title)}\`\n` +
          `🎯 *الجودة:* ${selectedFormat.label}\n\n` +
          `يرجى الانتظار، جاري تنزيل الملف...`,
        { parse_mode: 'Markdown' }
      );
      statusMsgId = initialMsg.message_id;
      task.statusMessageId = statusMsgId;
    } catch (msgErr) {
      logger.warn({ error: (msgErr as Error).message }, 'Failed to send initial status message');
    }

    const throttler = statusMsgId
      ? new ProgressThrottler(api, chatId, statusMsgId)
      : null;

    // Setup download timeout
    const timeoutId = setTimeout(() => {
      logger.warn({ taskId: task.id, userId }, 'Download timeout exceeded. Aborting task.');
      task.abortController.abort();
    }, env.DOWNLOAD_TIMEOUT);

    try {
      task.status = 'downloading';

      const provider = metadata.provider
        ? providerRegistry.getProviderByName(metadata.provider) || (await providerRegistry.getProviderForUrl(metadata.url))
        : await providerRegistry.getProviderForUrl(metadata.url);
      if (!provider) {
        throw new Error('UNSUPPORTED_SOURCE');
      }

      // 1. Download
      let result = await provider.download(task, (progress) => {
        task.progress = progress;
        if (throttler) {
          throttler.update(throttler.formatProgressCard(task, progress));
        }
      });

      // 2. FFmpeg processing if requested and needed
      if (selectedFormat.isAudioOnly && !result.filename.endsWith('.mp3')) {
        task.status = 'processing';
        if (throttler) {
          await throttler.update(
            throttler.formatProgressCard(task, {
              percent: 100,
              downloadedBytes: result.filesize,
              phase: 'processing',
            }),
            true
          );
        }

        const mp3Path = path.join(tempDir, `${path.basename(result.filename, path.extname(result.filename))}.mp3`);
        await ffmpegService.convertToMp3(result.filePath, mp3Path, task.abortController.signal);

        result = {
          ...result,
          filePath: mp3Path,
          filename: path.basename(mp3Path),
          mimeType: 'audio/mpeg',
        };
      } else if (!selectedFormat.isAudioOnly) {
        // Ensure video is 100% compatible with mobile phones (H.264 + AAC + yuv420p + faststart)
        const isVideo =
          result.mimeType.startsWith('video/') ||
          result.filename.endsWith('.mp4') ||
          result.filename.endsWith('.mov') ||
          result.filename.endsWith('.mkv') ||
          result.filename.endsWith('.webm');

        if (isVideo) {
          task.status = 'processing';
          if (throttler) {
            await throttler.update(
              throttler.formatProgressCard(task, {
                percent: 100,
                downloadedBytes: result.filesize,
                phase: 'processing',
              }),
              true
            );
          }

          const baseName = path.basename(result.filename, path.extname(result.filename));
          const mobileOutPath = path.join(tempDir, `${baseName}_mobile.mp4`);
          const { path: finalVideoPath, metadata: videoMeta } = await ffmpegService.ensureMobileCompatibility(
            result.filePath,
            mobileOutPath,
            task.abortController.signal
          );

          const thumbPath = path.join(tempDir, `${baseName}_thumb.jpg`);
          const generatedThumb = await ffmpegService.generateThumbnail(
            finalVideoPath,
            thumbPath,
            task.abortController.signal
          );

          const stats = await fs.stat(finalVideoPath);
          result = {
            ...result,
            filePath: finalVideoPath,
            filename: `${baseName}.mp4`,
            filesize: stats.size,
            mimeType: 'video/mp4',
            width: videoMeta.width,
            height: videoMeta.height,
            duration: videoMeta.duration || result.duration,
            thumbnailPath: generatedThumb || undefined,
          };
        }
      }

      // 3. Upload to Telegram
      task.status = 'uploading';
      if (throttler) {
        await throttler.update(
          throttler.formatProgressCard(task, {
            percent: 100,
            downloadedBytes: result.filesize,
            totalBytes: result.filesize,
            phase: 'uploading',
          }),
          true
        );
      }

      await telegramService.uploadMedia(api, chatId, result, selectedFormat.isAudioOnly);

      // 4. Update status to completed
      task.status = 'completed';
      if (statusMsgId) {
        try {
          await api.editMessageText(chatId, statusMsgId, MESSAGES.DOWNLOAD_COMPLETED);
        } catch {
          // ignore
        }
      }
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || '';
      logger.error({ error: errorMsg, taskId: task.id, userId }, 'Download execution failed');

      if (statusMsgId) {
        let userErrorMessage: string = MESSAGES.DOWNLOAD_FAILED;
        if (errorMsg === 'DOWNLOAD_CANCELLED' || task.abortController.signal.aborted) {
          userErrorMessage = MESSAGES.DOWNLOAD_CANCELLED;
        } else if (errorMsg === 'FILE_TOO_LARGE') {
          userErrorMessage = `${MESSAGES.FILE_TOO_LARGE}\nالحد المسموح به: ${formatBytes(env.MAX_FILE_SIZE)}`;
        } else if (errorMsg === 'TELEGRAM_UPLOAD_FAILED') {
          userErrorMessage = MESSAGES.TELEGRAM_UPLOAD_FAILED;
        }

        try {
          await api.editMessageText(chatId, statusMsgId, userErrorMessage);
        } catch {
          // ignore
        }
      }
    } finally {
      clearTimeout(timeoutId);
      // Clean up task directory and remove from active queue
      await cleanupService.cleanTaskDir(task.tempDir);
      queueManager.removeDownload(userId, task.id);
      this.metadataCache.delete(downloadId);
    }
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[`*_[\]()~>#+\-=|{}.!]/g, '\\$&');
}

export const downloadManager = new DownloadManager();
