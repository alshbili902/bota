export interface User {
  username: string;
  is_authenticated: boolean;
}

export interface MediaFormat {
  format_id: string;
  format_type: 'video' | 'audio';
  resolution?: string;
  height?: number;
  ext: string;
  filesize_estimate_mb?: number;
  label: string;
  note?: string;
  is_best: boolean;
}

export interface MediaMetadata {
  url: string;
  title: string;
  thumbnail?: string;
  duration?: number;
  duration_formatted?: string;
  uploader?: string;
  source: string;
  formats: MediaFormat[];
}

export interface DownloadTask {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
  source: string;
  format_id: string;
  format_note: string;
  is_audio_only: boolean;
  status: 'queued' | 'analyzing' | 'downloading' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  speed_text: string;
  eta_text: string;
  downloaded_bytes: number;
  total_bytes: number;
  filename?: string;
  download_url?: string;
  error_message?: string;
  created_at?: string;
}

export interface HistoryItem {
  id: string;
  task_id: string;
  title: string;
  source: string;
  format: string;
  file_size_mb: number;
  filename: string;
  download_url?: string;
  completed_at: string;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'error';
  ytdlp_available: boolean;
  ffmpeg_available: boolean;
  ffprobe_available: boolean;
  storage_used_mb: number;
  storage_free_mb: number;
  max_storage_gb: number;
  active_downloads: number;
  environment: string;
}
