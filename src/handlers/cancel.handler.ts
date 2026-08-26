import { MESSAGES } from '../config/constants.js';
import { queueManager } from '../services/queue-manager.js';
import { BotContext } from '../types/bot.js';

export async function cancelHandler(ctx: BotContext): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (!queueManager.hasActiveDownload(userId)) {
    await ctx.reply(MESSAGES.NO_ACTIVE_DOWNLOAD);
    return;
  }

  const cancelled = await queueManager.cancelUserDownload(userId);
  if (cancelled) {
    await ctx.reply(MESSAGES.DOWNLOAD_CANCELLED);
  } else {
    await ctx.reply(MESSAGES.NO_ACTIVE_DOWNLOAD);
  }
}
