import { APP_CONSTANTS } from '../config/constants.js';
import { env } from '../config/env.js';
import { cleanOrphanedTempDirs, cleanupDirectory } from '../utils/file-utils.js';
import { logger } from '../utils/logger.js';

export class CleanupService {
  /**
   * Cleans orphaned temporary directories on bot startup
   */
  public async cleanOnStartup(): Promise<void> {
    try {
      const cleaned = await cleanOrphanedTempDirs(
        env.TEMP_DIRECTORY,
        APP_CONSTANTS.ORPHAN_TEMP_MAX_AGE_MS
      );
      if (cleaned > 0) {
        logger.info({ cleanedCount: cleaned }, 'Cleaned abandoned temporary directories on startup');
      }
    } catch (err) {
      logger.warn({ error: (err as Error).message }, 'Startup cleanup encountered an error');
    }
  }

  /**
   * Clean a specific task directory
   */
  public async cleanTaskDir(taskDir: string): Promise<void> {
    await cleanupDirectory(taskDir);
  }
}

export const cleanupService = new CleanupService();
