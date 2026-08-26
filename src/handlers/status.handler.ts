import { MESSAGES } from '../config/constants.js';
import { queueManager } from '../services/queue-manager.js';
import { BotContext } from '../types/bot.js';
import { formatBytes, formatEta, formatSpeed } from '../utils/file-utils.js';

export async function statusHandler(ctx: BotContext): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const activeTask = queueManager.getActiveDownload(userId);
  if (!activeTask) {
    await ctx.reply(MESSAGES.NO_ACTIVE_DOWNLOAD);
    return;
  }

  const { metadata, selectedFormat, progress, status } = activeTask;
  const sizeFormatted = progress.totalBytes ? formatBytes(progress.totalBytes) : 'غير معروف';
  const speedFormatted = progress.speedBytesPerSec ? formatSpeed(progress.speedBytesPerSec) : '-- KB/s';
  const etaFormatted = progress.etaSeconds !== undefined ? formatEta(progress.etaSeconds) : '--:--';

  let statusText = 'جاري التحميل';
  if (status === 'processing') statusText = 'معالجة وتحويل الصيغة';
  if (status === 'uploading') statusText = 'رفع إلى تيليجرام';

  const message =
    `📊 *حالة التحميل النشطة:*\n\n` +
    `📁 *الملف:* \`${escapeMarkdown(metadata.title)}\`\n` +
    `🎯 *الجودة:* ${selectedFormat.label}\n` +
    `⚙️ *الحالة:* ${statusText}\n` +
    `💾 *الحجم:* ${sizeFormatted}\n` +
    `📈 *النسبة:* ${progress.percent.toFixed(1)}%\n` +
    `⚡ *السرعة:* ${speedFormatted}\n` +
    `⏱ *الوقت المتبقي:* ${etaFormatted}\n\n` +
    `💡 لإلغاء هذا التحميل، أرسل الأمر /cancel`;

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

function escapeMarkdown(text: string): string {
  return text.replace(/[`*_[\]()~>#+\-=|{}.!]/g, '\\$&');
}
