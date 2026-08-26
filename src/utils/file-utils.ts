import fs from 'node:fs/promises';
import path from 'node:path';
import mime from 'mime-types';
import { logger } from './logger.js';

/**
 * Format bytes into human readable string (KB, MB, GB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Format duration in seconds into HH:MM:SS or MM:SS
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0 || isNaN(seconds)) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Format speed into MB/s or KB/s
 */
export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s';
  return `${formatBytes(bytesPerSec)}/s`;
}

/**
 * Format ETA in seconds to MM:SS
 */
export function formatEta(seconds: number): string {
  if (!seconds || seconds < 0 || !isFinite(seconds)) return '--:--';
  return formatDuration(seconds);
}

/**
 * Returns the MIME type of a file or fallback
 */
export function getMimeType(filePath: string): string {
  const detected = mime.lookup(filePath);
  return detected || 'application/octet-stream';
}

/**
 * Creates a unique task temporary directory inside base temp
 */
export async function createTempTaskDir(baseTempDir: string, taskId: string): Promise<string> {
  const dirPath = path.resolve(baseTempDir, `task_${taskId}`);
  await fs.mkdir(dirPath, { recursive: true });
  return dirPath;
}

/**
 * Safely removes a directory and all its contents
 */
export async function cleanupDirectory(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    logger.debug({ dir: dirPath }, 'Cleaned up directory');
  } catch (err) {
    logger.warn({ dir: dirPath, error: (err as Error).message }, 'Failed to cleanup directory');
  }
}

/**
 * Cleans up orphaned temporary task directories older than maxAgeMs
 */
export async function cleanOrphanedTempDirs(baseTempDir: string, maxAgeMs = 3600000): Promise<number> {
  let cleanedCount = 0;
  try {
    await fs.mkdir(baseTempDir, { recursive: true });
    const entries = await fs.readdir(baseTempDir, { withFileTypes: true });
    const now = Date.now();

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('task_')) {
        const fullPath = path.join(baseTempDir, entry.name);
        try {
          const stats = await fs.stat(fullPath);
          const age = now - stats.mtimeMs;
          if (age > maxAgeMs) {
            await fs.rm(fullPath, { recursive: true, force: true });
            cleanedCount++;
          }
        } catch {
          // ignore stat errors
        }
      }
    }
  } catch (err) {
    logger.warn({ error: (err as Error).message }, 'Failed to inspect orphaned temp directories');
  }
  return cleanedCount;
}
