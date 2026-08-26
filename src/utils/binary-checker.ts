import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const execFileAsync = promisify(execFile);

export interface BinaryStatus {
  name: string;
  available: boolean;
  path: string;
  version?: string;
  error?: string;
}

export interface SystemBinaries {
  ytdlp: BinaryStatus;
  ffmpeg: BinaryStatus;
}

/**
 * Checks for a binary's availability and version by executing --version or -version
 */
async function checkBinary(name: string, customPath?: string, versionFlag = '--version'): Promise<BinaryStatus> {
  const binaryToRun = customPath && customPath.trim().length > 0 ? customPath.trim() : name;
  try {
    const { stdout } = await execFileAsync(binaryToRun, [versionFlag], {
      timeout: 5000,
      windowsHide: true,
    });

    const firstLine = stdout.trim().split('\n')[0] || 'unknown';
    return {
      name,
      available: true,
      path: binaryToRun,
      version: firstLine,
    };
  } catch (err: unknown) {
    const errorMsg = (err as Error).message || String(err);
    return {
      name,
      available: false,
      path: binaryToRun,
      error: errorMsg,
    };
  }
}

/**
 * Verifies both yt-dlp and ffmpeg
 */
export async function verifySystemBinaries(): Promise<SystemBinaries> {
  const [ytdlp, ffmpeg] = await Promise.all([
    checkBinary('yt-dlp', env.YTDLP_PATH, '--version'),
    checkBinary('ffmpeg', env.FFMPEG_PATH, '-version'),
  ]);

  if (ytdlp.available) {
    logger.info({ binary: 'yt-dlp', path: ytdlp.path, version: ytdlp.version }, 'Binary verified');
  } else {
    logger.warn({ binary: 'yt-dlp', path: ytdlp.path, error: ytdlp.error }, 'yt-dlp binary not found or failed');
  }

  if (ffmpeg.available) {
    logger.info({ binary: 'ffmpeg', path: ffmpeg.path, version: ffmpeg.version }, 'Binary verified');
  } else {
    logger.warn(
      { binary: 'ffmpeg', path: ffmpeg.path, error: ffmpeg.error },
      'FFmpeg binary not found or failed. Audio conversion/muxing may be limited.'
    );
  }

  return { ytdlp, ffmpeg };
}
