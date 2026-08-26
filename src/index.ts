import fs from 'node:fs/promises';
import { createBot } from './bot/index.js';
import { env } from './config/env.js';
import { cleanupService } from './services/cleanup-service.js';
import { queueManager } from './services/queue-manager.js';
import { verifySystemBinaries } from './utils/binary-checker.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  logger.info('========================================================');
  logger.info('Starting Private Telegram Download Bot');
  logger.info('========================================================');

  // 1. Verify environment configuration
  const allowedList = Array.from(env.allowedUserIds);
  logger.info(
    {
      allowedUsersCount: allowedList.length,
      allowedUsers: allowedList,
      maxFileSize: env.MAX_FILE_SIZE,
      downloadTimeoutMs: env.DOWNLOAD_TIMEOUT,
      tempDir: env.TEMP_DIRECTORY,
    },
    'Environment configuration loaded successfully'
  );

  // 2. Pre-flight binary verification
  const binaries = await verifySystemBinaries();
  if (!binaries.ytdlp.available) {
    logger.warn('WARNING: yt-dlp binary is not available in PATH or custom YTDLP_PATH.');
  }
  if (!binaries.ffmpeg.available) {
    logger.warn('WARNING: FFmpeg binary is not available. Media conversion may fail.');
  }

  // 3. Ensure base temporary directory exists
  await fs.mkdir(env.TEMP_DIRECTORY, { recursive: true });

  // 4. Clean abandoned temporary files from previous runs
  await cleanupService.cleanOnStartup();

  // 5. Initialize Telegram Bot
  const bot = createBot();

  // 6. Graceful shutdown handler
  let isShuttingDown = false;
  const handleShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, 'Received shutdown signal. Commencing graceful shutdown...');

    try {
      // Abort all active downloads and clean directories
      await queueManager.cancelAll();

      // Stop bot long polling
      await bot.stop();
      logger.info('Bot stopped successfully.');
    } catch (err) {
      logger.error({ error: (err as Error).message }, 'Error during graceful shutdown');
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  // 7. Start bot long polling
  logger.info('Connecting to Telegram Bot API...');
  await bot.start({
    onStart: (botInfo) => {
      logger.info(
        {
          botId: botInfo.id,
          username: botInfo.username,
        },
        'Telegram Bot is active, running, and listening for updates'
      );
    },
  });
}

bootstrap().catch((err) => {
  logger.fatal({ error: (err as Error).message, stack: (err as Error).stack }, 'Fatal error during startup');
  process.exit(1);
});
