import { Bot } from 'grammy';
import { env } from '../config/env.js';
import { callbackHandler } from '../handlers/callback.handler.js';
import { cancelHandler } from '../handlers/cancel.handler.js';
import { helpHandler } from '../handlers/help.handler.js';
import { startHandler } from '../handlers/start.handler.js';
import { statusHandler } from '../handlers/status.handler.js';
import { urlHandler } from '../handlers/url.handler.js';
import { authMiddleware } from '../middleware/auth.js';
import { globalErrorHandler } from '../middleware/error-handler.js';
import { loggingMiddleware } from '../middleware/logging.js';
import { BotContext } from '../types/bot.js';

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(env.BOT_TOKEN, {
    client: env.TELEGRAM_API_ROOT
      ? {
          apiRoot: env.TELEGRAM_API_ROOT,
        }
      : undefined,
  });

  // Top-level error boundary
  bot.catch(globalErrorHandler);

  // 1. Audit logging middleware
  bot.use(loggingMiddleware);

  // 2. Strict 2-User Authorization Middleware
  // Every incoming update MUST pass this middleware before any handler is reached
  bot.use(authMiddleware);

  // 3. Command handlers
  bot.command('start', startHandler);
  bot.command('help', helpHandler);
  bot.command('status', statusHandler);
  bot.command('cancel', cancelHandler);

  // 4. Inline button callback handler
  bot.on('callback_query:data', callbackHandler);

  // 5. Message text handler (processes URLs)
  bot.on('message:text', urlHandler);

  return bot;
}
