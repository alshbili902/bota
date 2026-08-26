import { MESSAGES } from '../config/constants.js';
import { BotContext } from '../types/bot.js';

export async function helpHandler(ctx: BotContext): Promise<void> {
  await ctx.reply(MESSAGES.HELP, {
    parse_mode: 'Markdown',
  });
}
