import { DownloadTask } from '../types/download.js';
import { cleanupDirectory } from '../utils/file-utils.js';
import { logger } from '../utils/logger.js';

export class QueueManager {
  private activeDownloads = new Map<number, DownloadTask>();

  /**
   * Check if user currently has an ongoing download
   */
  public hasActiveDownload(userId: number): boolean {
    return this.activeDownloads.has(userId);
  }

  /**
   * Retrieve user's current active task
   */
  public getActiveDownload(userId: number): DownloadTask | undefined {
    return this.activeDownloads.get(userId);
  }

  /**
   * Attempt to register a new download task for a user.
   * Fails if user already has an active download.
   */
  public registerDownload(task: DownloadTask): boolean {
    if (this.hasActiveDownload(task.userId)) {
      return false;
    }
    this.activeDownloads.set(task.userId, task);
    logger.info({ userId: task.userId, taskId: task.id }, 'Registered active download task in queue');
    return true;
  }

  /**
   * Safely marks a task completed and removes it from active list
   */
  public removeDownload(userId: number, taskId?: string): void {
    const existing = this.activeDownloads.get(userId);
    if (existing && (!taskId || existing.id === taskId)) {
      this.activeDownloads.delete(userId);
      logger.info({ userId, taskId: existing.id }, 'Removed download task from queue');
    }
  }

  /**
   * Cancel an active download for a user, aborting processes and deleting temp files
   */
  public async cancelUserDownload(userId: number): Promise<boolean> {
    const task = this.activeDownloads.get(userId);
    if (!task) {
      return false;
    }

    logger.info({ userId, taskId: task.id }, 'Cancelling active download task');

    // Trigger abort signal for child processes / streams
    task.abortController.abort();
    task.status = 'cancelled';

    // Remove from active queue
    this.activeDownloads.delete(userId);

    // Clean up temporary files
    try {
      await cleanupDirectory(task.tempDir);
    } catch (err) {
      logger.warn({ taskId: task.id, error: (err as Error).message }, 'Failed to cleanup cancelled task files');
    }

    return true;
  }

  /**
   * Cancel all active tasks during system shutdown
   */
  public async cancelAll(): Promise<void> {
    logger.info({ count: this.activeDownloads.size }, 'Cancelling all active tasks for shutdown');
    for (const [userId, task] of this.activeDownloads.entries()) {
      task.abortController.abort();
      await cleanupDirectory(task.tempDir);
      this.activeDownloads.delete(userId);
    }
  }
}

export const queueManager = new QueueManager();
