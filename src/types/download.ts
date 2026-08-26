export type MediaType = 'video' | 'audio' | 'document';

export interface DownloadFormat {
  id: string;
  label: string;
  quality?: string;
  extension: string;
  isAudioOnly: boolean;
  filesize?: number;
  note?: string;
  vcodec?: string;
  acodec?: string;
}

export interface MediaMetadata {
  url: string;
  title: string;
  duration?: number;
  thumbnail?: string;
  provider: 'ytdlp' | 'http';
  estimatedSize?: number;
  formats: DownloadFormat[];
  isDirectFile?: boolean;
  mimeType?: string;
  filename?: string;
}

export type DownloadPhase = 'queued' | 'downloading' | 'processing' | 'uploading' | 'completed' | 'cancelled' | 'failed';

export interface DownloadProgress {
  percent: number;
  downloadedBytes: number;
  totalBytes?: number;
  speedBytesPerSec?: number;
  etaSeconds?: number;
  phase: DownloadPhase;
  details?: string;
}

export interface DownloadTask {
  id: string;
  userId: number;
  chatId: number;
  statusMessageId?: number;
  metadata: MediaMetadata;
  selectedFormat: DownloadFormat;
  abortController: AbortController;
  status: DownloadPhase;
  progress: DownloadProgress;
  tempDir: string;
  outputPath?: string;
  error?: string;
  startTime: number;
}
