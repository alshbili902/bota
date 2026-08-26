import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);

export interface VideoMetadata {
  codec?: string;
  width?: number;
  height?: number;
  pixFmt?: string;
  duration?: number;
}

export class FfmpegService {
  private getBinaryPath(): string {
    return env.FFMPEG_PATH && env.FFMPEG_PATH.trim().length > 0 ? env.FFMPEG_PATH.trim() : 'ffmpeg';
  }

  private getProbeBinaryPath(): string {
    if (env.FFMPEG_PATH && env.FFMPEG_PATH.trim().length > 0) {
      const dir = path.dirname(env.FFMPEG_PATH.trim());
      const ext = path.extname(env.FFMPEG_PATH.trim());
      return path.join(dir, `ffprobe${ext}`);
    }
    return 'ffprobe';
  }

  /**
   * Probe video file to get codec, resolution, pixel format, and duration
   */
  public async getVideoMetadata(filePath: string): Promise<VideoMetadata> {
    const probeBin = this.getProbeBinaryPath();
    const args = [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=codec_name,width,height,pix_fmt',
      '-show_entries',
      'format=duration',
      '-of',
      'json',
      filePath,
    ];

    try {
      const { stdout } = await execFileAsync(probeBin, args, {
        timeout: 15000,
        windowsHide: true,
      });

      const parsed = JSON.parse(stdout);
      const stream = parsed.streams?.[0] || {};
      const format = parsed.format || {};

      return {
        codec: stream.codec_name,
        width: stream.width ? Number(stream.width) : undefined,
        height: stream.height ? Number(stream.height) : undefined,
        pixFmt: stream.pix_fmt,
        duration: format.duration ? parseFloat(format.duration) : undefined,
      };
    } catch (err) {
      logger.warn({ filePath, error: (err as Error).message }, 'ffprobe metadata inspection failed');
      return {};
    }
  }

  /**
   * Generate a thumbnail JPEG image from a video for Telegram mobile preview
   */
  public async generateThumbnail(videoPath: string, thumbPath: string, signal?: AbortSignal): Promise<string | null> {
    const binary = this.getBinaryPath();
    const args = [
      '-y',
      '-ss',
      '00:00:01',
      '-i',
      videoPath,
      '-vframes',
      '1',
      '-q:v',
      '2',
      thumbPath,
    ];

    try {
      await execFileAsync(binary, args, {
        signal,
        windowsHide: true,
        timeout: 30000,
      });
      return thumbPath;
    } catch {
      // Retry with 0.1s in case video is shorter than 1s
      try {
        const fallbackArgs = ['-y', '-ss', '00:00:00.1', '-i', videoPath, '-vframes', '1', '-q:v', '2', thumbPath];
        await execFileAsync(binary, fallbackArgs, { signal, windowsHide: true, timeout: 30000 });
        return thumbPath;
      } catch {
        return null;
      }
    }
  }

  /**
   * Converts an audio file to clean MP3 using FFmpeg
   */
  public async convertToMp3(inputPath: string, outputPath: string, signal?: AbortSignal): Promise<string> {
    const binary = this.getBinaryPath();
    const args = [
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-acodec',
      'libmp3lame',
      '-q:a',
      '2',
      outputPath,
    ];

    logger.debug({ inputPath, outputPath }, 'Converting audio to MP3 with FFmpeg');

    try {
      await execFileAsync(binary, args, {
        signal,
        windowsHide: true,
        timeout: 300000,
      });
      return outputPath;
    } catch (err) {
      logger.error({ error: (err as Error).message }, 'FFmpeg MP3 conversion failed');
      throw new Error('FAILED_CONVERSION');
    }
  }

  /**
   * Ensures 100% mobile playback compatibility for Telegram (iOS & Android):
   * - Transcodes AV1, VP9, HEVC, and non-yuv420p videos to H.264 + AAC + yuv420p
   * - Applies faststart (+movflags) so video streams immediately without buffering
   * - If already H.264 yuv420p, performs fast stream copy with faststart
   */
  public async ensureMobileCompatibility(
    inputPath: string,
    outputPath: string,
    signal?: AbortSignal
  ): Promise<{ path: string; metadata: VideoMetadata }> {
    const binary = this.getBinaryPath();
    const meta = await this.getVideoMetadata(inputPath);

    const isH264 = meta.codec === 'h264';
    const isYuv420p = meta.pixFmt === 'yuv420p';

    logger.info(
      { codec: meta.codec, pixFmt: meta.pixFmt, width: meta.width, height: meta.height },
      'Inspected video for mobile compatibility'
    );

    let args: string[];

    if (isH264 && isYuv420p) {
      // Fast remux: copy video stream, ensure AAC audio, add faststart
      args = [
        '-y',
        '-i',
        inputPath,
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        outputPath,
      ];
    } else {
      // Transcode incompatible codecs (AV1, VP9, HEVC, etc.) to universal H.264
      logger.info(
        { originalCodec: meta.codec, pixFmt: meta.pixFmt },
        'Transcoding video to H.264 (yuv420p) for universal mobile compatibility'
      );
      args = [
        '-y',
        '-i',
        inputPath,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-profile:v',
        'main',
        '-level',
        '4.0',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        outputPath,
      ];
    }

    try {
      await execFileAsync(binary, args, {
        signal,
        windowsHide: true,
        timeout: 600000, // 10 min max
      });

      const updatedMeta = await this.getVideoMetadata(outputPath);
      return {
        path: outputPath,
        metadata: {
          ...meta,
          ...updatedMeta,
        },
      };
    } catch (err) {
      logger.warn({ error: (err as Error).message }, 'Mobile compatibility processing failed, using original file');
      return { path: inputPath, metadata: meta };
    }
  }
}

export const ffmpegService = new FfmpegService();
