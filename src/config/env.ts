import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  BOT_TOKEN: z.string().min(10, 'BOT_TOKEN is required and must be valid'),
  ALLOWED_USERS: z
    .string()
    .min(1, 'ALLOWED_USERS is required')
    .transform((val, ctx) => {
      const parts = val
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
        .map((p) => {
          const num = Number(p);
          if (isNaN(num) || num <= 0 || !Number.isSafeInteger(num)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Invalid Telegram User ID in ALLOWED_USERS: "${p}". Must be a positive integer.`,
            });
            return z.NEVER;
          }
          return num;
        });

      if (parts.length !== 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `ALLOWED_USERS must contain EXACTLY TWO comma-separated Telegram User IDs. Found: ${parts.length}`,
        });
        return z.NEVER;
      }
      return parts as [number, number];
    }),
  MAX_FILE_SIZE: z
    .string()
    .default('52428800') // 50 MB standard Bot API limit
    .transform((val, ctx) => {
      const num = Number(val);
      if (isNaN(num) || num <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `MAX_FILE_SIZE must be a positive number of bytes. Received: "${val}"`,
        });
        return z.NEVER;
      }
      return num;
    }),
  DOWNLOAD_TIMEOUT: z
    .string()
    .default('900000') // 15 minutes
    .transform((val, ctx) => {
      const num = Number(val);
      if (isNaN(num) || num < 10000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `DOWNLOAD_TIMEOUT must be at least 10000 ms. Received: "${val}"`,
        });
        return z.NEVER;
      }
      return num;
    }),
  TEMP_DIRECTORY: z.string().default('./temp'),
  YTDLP_PATH: z.string().optional(),
  FFMPEG_PATH: z.string().optional(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  TELEGRAM_API_ROOT: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema> & {
  allowedUserIds: ReadonlySet<number>;
};

function loadConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ` - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Environment configuration error:\n${issues}`);
  }

  const data = result.data;
  return {
    ...data,
    allowedUserIds: new Set<number>(data.ALLOWED_USERS),
  };
}

export const env = loadConfig();
