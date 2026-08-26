import { InlineKeyboard } from 'grammy';
import { MESSAGES } from '../config/constants.js';
import { BotContext } from '../types/bot.js';

export async function startHandler(ctx: BotContext): Promise<void> {
  const keyboard = new InlineKeyboard().text(MESSAGES.BTN_SEND_URL, 'prompt_url');

  await ctx.reply(MESSAGES.WELCOME, {
    reply_markup: keyboard,
    parse_mode: 'Markdown',
  });
}
