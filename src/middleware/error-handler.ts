import { BotError, ErrorHandler } from 'grammy';
import { MESSAGES } from '../config/constants.js';
import { BotContext } from '../types/bot.js';
import { logger } from '../utils/logger.js';

export const globalErrorHandler: ErrorHandler<BotContext> = async (botError: BotError<BotContext>) => {
  const { ctx, error } = botError;
  const userId = ctx.from?.id;

  logger.error(
    {
      userId,
      updateId: ctx.update.update_id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    },
    'Unhandled error in Telegram Bot update handler'
  );

  // Send generic friendly Arabic error to the user without disclosing stack traces or technical details
  try {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({
        text: MESSAGES.GENERIC_ERROR,
        show_alert: true,
      });
    } else if (ctx.chat) {
      await ctx.reply(MESSAGES.GENERIC_ERROR);
    }
  } catch (replyErr) {
    logger.error({ error: (replyErr as Error).message }, 'Failed to deliver error message to user');
  }
};
