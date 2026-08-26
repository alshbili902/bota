import { Api } from 'grammy';
import { APP_CONSTANTS } from '../config/constants.js';
import { DownloadProgress, DownloadTask } from '../types/download.js';
import { formatBytes, formatEta, formatSpeed } from './file-utils.js';
import { logger } from './logger.js';

export class ProgressThrottler {
  private lastUpdateTime = 0;
  private isUpdating = false;
  private pendingText: string | null = null;
  private minIntervalMs: number;

  constructor(
    private readonly api: Api,
    private readonly chatId: number,
    private readonly messageId: number,
    minIntervalMs = APP_CONSTANTS.PROGRESS_UPDATE_INTERVAL_MS
  ) {
    this.minIntervalMs = minIntervalMs;
  }

  /**
   * Generates a 10-segment visual progress bar
   */
  private renderProgressBar(percent: number, length = 10): string {
    const clamped = Math.max(0, Math.min(100, percent));
    const filled = Math.round((clamped / 100) * length);
    const empty = length - filled;
    return `[${'▓'.repeat(filled)}${'░'.repeat(empty)}] ${clamped.toFixed(0)}%`;
  }

  /**
   * Formats the Arabic progress card based on the task and current progress
   */
  public formatProgressCard(task: DownloadTask, progress: DownloadProgress): string {
    const title = task.metadata.title;
    const quality = task.selectedFormat.label || task.selectedFormat.quality || 'عالية';
    const totalSize = progress.totalBytes || task.selectedFormat.filesize || task.metadata.estimatedSize;
    const sizeStr = totalSize ? formatBytes(totalSize) : 'غير معروف';

    if (progress.phase === 'uploading') {
      return (
        `📤 *جاري رفع الملف إلى تيليجرام...*\n\n` +
        `📁 *الملف:* \`${escapeMarkdown(title)}\`\n` +
        `💾 *الحجم:* ${sizeStr}\n\n` +
        `⏳ يرجى الانتظار قليلاً ريثما تكتمل عملية الرفع والإرسال.`
      );
    }

    if (progress.phase === 'processing') {
      return (
        `🔄 *جاري معالجة وتحويل الصيغة...*\n\n` +
        `📁 *الملف:* \`${escapeMarkdown(title)}\`\n` +
        `🎯 *الصيغة:* ${task.selectedFormat.extension.toUpperCase()}\n\n` +
        `⚙️ يتم استخدام FFmpeg لتجهيز الملف بأفضل جودة وتوافق.`
      );
    }

    const progressBar = this.renderProgressBar(progress.percent);
    const speedStr = progress.speedBytesPerSec ? formatSpeed(progress.speedBytesPerSec) : '-- KB/s';
    const etaStr = progress.etaSeconds !== undefined ? formatEta(progress.etaSeconds) : '--:--';

    return (
      `⏳ *جاري التحميل...*\n\n` +
      `📁 *الملف:* \`${escapeMarkdown(title)}\`\n` +
      `🎯 *الجودة:* ${quality}\n` +
      `💾 *الحجم:* ${sizeStr}\n\n` +
      `📊 *التقدم:* ${progressBar}\n` +
      `⚡ *السرعة:* ${speedStr}\n` +
      `⏱ *الوقت المتبقي:* ${etaStr}`
    );
  }

  /**
   * Updates the Telegram status message with rate limiting
   */
  public async update(text: string, force = false): Promise<void> {
    const now = Date.now();
    this.pendingText = text;

    if (!force && now - this.lastUpdateTime < this.minIntervalMs) {
      return;
    }

    if (this.isUpdating) {
      return;
    }

    this.isUpdating = true;
    const textToSend = this.pendingText;
    this.pendingText = null;

    try {
      if (textToSend) {
        await this.api.editMessageText(this.chatId, this.messageId, textToSend, {
          parse_mode: 'Markdown',
        });
        this.lastUpdateTime = Date.now();
      }
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || '';
      // Ignore "message is not modified" or "message to edit not found" errors
      if (!errorMsg.includes('message is not modified') && !errorMsg.includes('exact same text')) {
        logger.debug({ error: errorMsg }, 'Progress message edit skipped or failed');
      }
    } finally {
      this.isUpdating = false;
      // If a forced update arrived while we were updating, send it
      if (force && this.pendingText && this.pendingText !== textToSend) {
        await this.update(this.pendingText, true);
      }
    }
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[`*_[\]()~>#+\-=|{}.!]/g, '\\$&');
}
