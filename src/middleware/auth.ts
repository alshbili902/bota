import { MiddlewareFn } from 'grammy';
import { MESSAGES } from '../config/constants.js';
import { env } from '../config/env.js';
import { BotContext } from '../types/bot.js';
import { logger } from '../utils/logger.js';

/**
 * Defense-in-depth check: verify if a Telegram user ID is authorized
 */
export function isUserAuthorized(userId?: number): boolean {
  if (!userId || typeof userId !== 'number') return false;
  return env.allowedUserIds.has(userId);
}

/**
 * Global Authorization Middleware:
 * Strictly blocks any update from users not present in ALLOWED_USERS.
 * Unauthorized users cannot run commands, send URLs, or click inline buttons.
 */
export const authMiddleware: MiddlewareFn<BotContext> = async (ctx, next) => {
  const userId = ctx.from?.id;

  // If there is no user associated with the update or user is not in the allowlist
  if (!userId || !isUserAuthorized(userId)) {
    logger.warn(
      {
        userId: userId ?? 'unknown',
        username: ctx.from?.username,
        updateType: ctx.update ? Object.keys(ctx.update)[1] : 'unknown',
      },
      'Unauthorized access attempt blocked by authMiddleware'
    );

    // Answer callback queries if the unauthorized update was an inline button click
    if (ctx.callbackQuery) {
      try {
        await ctx.answerCallbackQuery({
          text: MESSAGES.UNAUTHORIZED,
          show_alert: true,
        });
      } catch {
        // ignore answerCallbackQuery failure
      }
    }

    // Send the rejection message without disclosing technical details
    try {
      if (ctx.chat) {
        await ctx.reply(MESSAGES.UNAUTHORIZED);
      }
    } catch {
      // ignore reply failure
    }

    // Halt update processing immediately
    return;
  }

  // User is authorized, proceed to next handler
  await next();
};
