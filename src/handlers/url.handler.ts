import { InlineKeyboard } from 'grammy';
import { MESSAGES } from '../config/constants.js';
import { downloadManager } from '../services/download-manager.js';
import { queueManager } from '../services/queue-manager.js';
import { BotContext } from '../types/bot.js';
import { formatBytes, formatDuration } from '../utils/file-utils.js';
import { logger } from '../utils/logger.js';
import { isSafeUrl, isValidUrl } from '../utils/sanitizer.js';

export async function urlHandler(ctx: BotContext): Promise<void> {
  const userId = ctx.from?.id;
  const text = ctx.message?.text?.trim();

  if (!userId || !text) return;

  // Extract URL from text (handles both direct URL and text containing a URL)
  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  if (!urlMatch) {
    // If not a URL and not a command, guide the user
    if (!text.startsWith('/')) {
      await ctx.reply(MESSAGES.DIRECT_LINK_PROMPT);
    }
    return;
  }

  const rawUrl = urlMatch[0];

  // 1. URL syntax validation
  if (!isValidUrl(rawUrl)) {
    await ctx.reply(MESSAGES.INVALID_URL);
    return;
  }

  // 2. SSRF check
  const isSafe = await isSafeUrl(rawUrl);
  if (!isSafe) {
    logger.warn({ userId, url: rawUrl }, 'Blocked unsafe or internal URL attempt (SSRF prevention)');
    await ctx.reply(MESSAGES.INVALID_URL);
    return;
  }

  // 3. Check active download lock
  if (queueManager.hasActiveDownload(userId)) {
    await ctx.reply(MESSAGES.ACTIVE_DOWNLOAD_EXISTS);
    return;
  }

  // 4. Send analyzing status message
  const statusMsg = await ctx.reply(MESSAGES.ANALYZING_URL);

  try {
    const { downloadId, metadata } = await downloadManager.analyzeUrl(userId, rawUrl);

    // Build inline keyboard for available formats
    const keyboard = new InlineKeyboard();

    for (const format of metadata.formats) {
      keyboard.text(format.label, `dl:${downloadId}:${format.id}`).row();
    }

    // Add cancel button
    keyboard.text(MESSAGES.BTN_CANCEL, `dl_cancel:${downloadId}`);

    const durationText = metadata.duration ? `\n⏱ *المدة:* ${formatDuration(metadata.duration)}` : '';
    const sizeText = metadata.estimatedSize ? `\n💾 *الحجم التقريبي:* ${formatBytes(metadata.estimatedSize)}` : '';

    const textContent =
      `📋 *خيارات التحميل المتاحة:*\n\n` +
      `📁 *العنوان:* \`${escapeMarkdown(metadata.title)}\`` +
      durationText +
      sizeText +
      `\n\nاضغط على الخيار المناسب لبدء التحميل:`;

    await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, textContent, {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    });
  } catch (err: unknown) {
    const errorMsg = (err as Error).message || '';
    logger.error({ error: errorMsg, userId }, 'URL analysis failed');

    let replyError: string = MESSAGES.UNSUPPORTED_SOURCE;
    if (errorMsg === 'ACTIVE_DOWNLOAD_EXISTS') {
      replyError = MESSAGES.ACTIVE_DOWNLOAD_EXISTS;
    } else if (errorMsg === 'UNAUTHORIZED') {
      replyError = MESSAGES.UNAUTHORIZED;
    } else if (errorMsg === 'NO_VIDEO_IN_POST') {
      replyError = '⚠️ هذا المنشور لا يحتوي على مقطع فيديو مدعوم للتحميل.';
    } else if (errorMsg === 'PRIVATE_ACCOUNT') {
      replyError = '🔒 هذا الحساب خاص (Private) أو يتطلب تسجيل الدخول لعرض المحتوى.';
    }

    try {
      await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, replyError);
    } catch {
      await ctx.reply(replyError);
    }
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[`*_[\]()~>#+\-=|{}.!]/g, '\\$&');
}
