import { DownloadProgress, DownloadTask, MediaMetadata } from '../types/download.js';
import { DownloadProvider, DownloadResult, ProgressCallback } from '../types/provider.js';

export abstract class BaseDownloadProvider implements DownloadProvider {
  abstract readonly name: string;

  abstract canHandle(url: string): Promise<boolean>;

  abstract extractMetadata(url: string, signal?: AbortSignal): Promise<MediaMetadata>;

  abstract download(task: DownloadTask, onProgress: ProgressCallback): Promise<DownloadResult>;

  protected updateProgress(
    onProgress: ProgressCallback,
    percent: number,
    downloadedBytes: number,
    totalBytes?: number,
    speedBytesPerSec?: number,
    etaSeconds?: number,
    phase: DownloadProgress['phase'] = 'downloading'
  ): void {
    onProgress({
      percent: Math.min(100, Math.max(0, percent)),
      downloadedBytes,
      totalBytes,
      speedBytesPerSec,
      etaSeconds,
      phase,
    });
  }
}
