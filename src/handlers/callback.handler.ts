import { MESSAGES } from '../config/constants.js';
import { downloadManager } from '../services/download-manager.js';
import { queueManager } from '../services/queue-manager.js';
import { BotContext } from '../types/bot.js';
import { logger } from '../utils/logger.js';

export async function callbackHandler(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;

  if (!data || !userId || !chatId) return;

  // Handle "prompt_url" button from /start
  if (data === 'prompt_url') {
    await ctx.answerCallbackQuery();
    await ctx.reply(MESSAGES.DIRECT_LINK_PROMPT);
    return;
  }

  // Handle format cancel button: dl_cancel:<downloadId>
  if (data.startsWith('dl_cancel:')) {
    await ctx.answerCallbackQuery({ text: 'تم الإلغاء' });
    try {
      await ctx.deleteMessage();
    } catch {
      await ctx.editMessageText('❌ تم إلغاء اختيار التحميل.');
    }
    return;
  }

  // Handle download format selection: dl:<downloadId>:<formatId>
  if (data.startsWith('dl:')) {
    const parts = data.split(':');
    if (parts.length < 3) {
      await ctx.answerCallbackQuery({ text: 'بيانات غير صالحة' });
      return;
    }

    const downloadId = parts[1];
    const formatId = parts.slice(2).join(':');

    // Check if user already has an active download
    if (queueManager.hasActiveDownload(userId)) {
      await ctx.answerCallbackQuery({
        text: 'لديك عملية تحميل جارية بالفعل!',
        show_alert: true,
      });
      return;
    }

    await ctx.answerCallbackQuery({ text: '🚀 جاري بدء التحميل...' });

    // Remove buttons to prevent multiple clicks
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    } catch {
      // ignore
    }

    // Launch download in background without blocking the bot update loop
    downloadManager
      .startDownload(userId, chatId, downloadId, formatId, ctx.api)
      .catch((err) => {
        logger.error({ error: (err as Error).message, userId, downloadId }, 'Async download failed in callback');
      });
  }
}
