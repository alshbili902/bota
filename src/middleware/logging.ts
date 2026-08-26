import { MiddlewareFn } from 'grammy';
import { BotContext } from '../types/bot.js';
import { logger } from '../utils/logger.js';
import { sanitizeLogUrl } from '../utils/sanitizer.js';

export const loggingMiddleware: MiddlewareFn<BotContext> = async (ctx, next) => {
  const userId = ctx.from?.id;
  const username = ctx.from?.username;
  const text = ctx.message?.text;
  const callbackData = ctx.callbackQuery?.data;

  let actionSummary = 'unknown';
  if (text) {
    if (text.startsWith('/')) {
      actionSummary = text.split(' ')[0]; // command name
    } else if (text.startsWith('http://') || text.startsWith('https://')) {
      actionSummary = `URL: ${sanitizeLogUrl(text)}`;
    } else {
      actionSummary = 'text_message';
    }
  } else if (callbackData) {
    actionSummary = `callback: ${callbackData.split(':')[0]}`;
  }

  logger.info(
    {
      userId,
      username,
      action: actionSummary,
    },
    'Authorized user interaction'
  );

  const start = Date.now();
  await next();
  const duration = Date.now() - start;

  logger.debug({ userId, durationMs: duration }, 'Completed handling update');
};
