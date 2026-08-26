import { DownloadProgress, DownloadTask, MediaMetadata } from './download.js';

export type ProgressCallback = (progress: DownloadProgress) => void;

export interface DownloadResult {
  filePath: string;
  filename: string;
  filesize: number;
  mimeType: string;
  duration?: number;
  width?: number;
  height?: number;
  thumbnailPath?: string;
  title: string;
}

export interface DownloadProvider {
  readonly name: string;

  /**
   * Check if this provider can handle the given URL
   */
  canHandle(url: string): Promise<boolean>;

  /**
   * Analyze the URL and retrieve metadata, formats, and title
   */
  extractMetadata(url: string, signal?: AbortSignal): Promise<MediaMetadata>;

  /**
   * Execute the download for the given task and return the resulting file path
   */
  download(task: DownloadTask, onProgress: ProgressCallback): Promise<DownloadResult>;
}
