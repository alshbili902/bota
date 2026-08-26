import pino from 'pino';
import { env } from '../config/env.js';

// Setup redacting structured logger
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'token',
      'bot_token',
      'BOT_TOKEN',
      'authorization',
      'headers.authorization',
      'password',
      'secret',
      'api_key',
      'apiKey',
    ],
    censor: '[REDACTED]',
  },
  transport:
    env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});
