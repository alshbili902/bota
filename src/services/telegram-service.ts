import { Api, InputFile } from 'grammy';
import { env } from '../config/env.js';
import { DownloadResult } from '../types/provider.js';
import { formatBytes, formatDuration } from '../utils/file-utils.js';
import { logger } from '../utils/logger.js';

export class TelegramService {
  /**
   * Uploads the downloaded media/file to the user's Telegram chat
   */
  public async uploadMedia(
    api: Api,
    chatId: number,
    result: DownloadResult,
    isAudioOnly = false
  ): Promise<void> {
    const { filePath, filename, filesize, mimeType, duration, title } = result;

    // Check against max size limit configured
    if (env.MAX_FILE_SIZE > 0 && filesize > env.MAX_FILE_SIZE) {
      throw new Error('FILE_TOO_LARGE');
    }

    const inputFile = new InputFile(filePath, filename);

    // Build user-friendly Arabic caption
    const sizeFormatted = formatBytes(filesize);
    const durationFormatted = duration ? ` | ⏱ ${formatDuration(duration)}` : '';
    const caption = `📁 *${title}*\n💾 ${sizeFormatted}${durationFormatted}`;

    logger.info({ chatId, filename, filesize, mimeType }, 'Uploading media file to Telegram');

    try {
      if (isAudioOnly || mimeType.startsWith('audio/')) {
        await api.sendAudio(chatId, inputFile, {
          caption,
          parse_mode: 'Markdown',
          title,
          duration,
        });
      } else if (
        mimeType.startsWith('video/') ||
        filename.endsWith('.mp4') ||
        filename.endsWith('.mkv') ||
        filename.endsWith('.mov') ||
        filename.endsWith('.webm')
      ) {
        await api.sendVideo(chatId, inputFile, {
          caption,
          parse_mode: 'Markdown',
          duration: duration ? Math.round(duration) : undefined,
          width: result.width,
          height: result.height,
          thumbnail: result.thumbnailPath ? new InputFile(result.thumbnailPath) : undefined,
          supports_streaming: true,
        });
      } else if (
        mimeType.startsWith('image/') ||
        filename.endsWith('.jpg') ||
        filename.endsWith('.jpeg') ||
        filename.endsWith('.png') ||
        filename.endsWith('.webp')
      ) {
        await api.sendPhoto(chatId, inputFile, {
          caption,
          parse_mode: 'Markdown',
        });
      } else {
        await api.sendDocument(chatId, inputFile, {
          caption,
          parse_mode: 'Markdown',
        });
      }

      logger.info({ chatId, filename }, 'Successfully delivered file to Telegram user');
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || '';
      logger.error({ error: errorMsg, chatId, filename }, 'Failed to upload media to Telegram');

      if (
        errorMsg.includes('file is too big') ||
        errorMsg.includes('Payload Too Large') ||
        errorMsg.includes('request entity too large') ||
        errorMsg.includes('413')
      ) {
        throw new Error('FILE_TOO_LARGE');
      }

      throw new Error('TELEGRAM_UPLOAD_FAILED');
    }
  }
}

export const telegramService = new TelegramService();
