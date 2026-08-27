export interface AdminUser {
  username: string;
  is_admin: boolean;
  created_at?: string;
  last_login?: string;
}

export interface DashboardStats {
  total_users: number;
  active_users: number;
  total_downloads: number;
  successful_downloads: number;
  failed_downloads: number;
  active_downloads: number;
  storage_used_mb: number;
  total_errors: number;
  system_status: 'healthy' | 'warning' | 'critical' | string;
  maintenance_mode: boolean;
}

export interface PlatformUser {
  id: string;
  username: string;
  display_name?: string;
  email?: string;
  is_active: boolean;
  total_downloads: number;
  successful_downloads: number;
  failed_downloads: number;
  last_activity?: string;
  created_at?: string;
}

export interface DownloadItem {
  id: string;
  user_id: string;
  url: string;
  source: string;
  title: string;
  filename?: string;
  format?: string;
  file_size_mb: number;
  status: 'queued' | 'analyzing' | 'downloading' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  duration_seconds?: number;
}

export interface DownloadsResponse {
  items: DownloadItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface SiteSettings {
  site_name: string;
  site_description: string;
  logo_url: string;
  favicon_url: string;
  primary_language: string;
  default_theme: string;
  maintenance_mode: boolean;
  maintenance_message: string;
  max_file_size_mb: number;
  download_timeout: number;
  max_concurrent_downloads: number;
  max_retries: number;
  retention_hours: number;
  auto_cleanup_enabled: boolean;
  auto_healing_enabled: boolean;
}

export interface SystemHealth {
  status: string;
  ytdlp_available: boolean;
  ffmpeg_available: boolean;
  ffprobe_available: boolean;
  supabase_connected: boolean;
  database_engine: string;
  cpu_percent: number;
  memory_used_mb: number;
  memory_total_mb: number;
  memory_percent: number;
  disk_used_gb: number;
  disk_total_gb: number;
  disk_percent: number;
  active_downloads: number;
  queue_length: number;
  uptime_seconds: number;
}

export interface ErrorItem {
  id: string;
  error_type: string;
  summary: string;
  details?: string;
  source: string;
  user_id: string;
  status: 'active' | 'resolved' | 'ignored';
  occurrences: number;
  last_occurred_at?: string;
  created_at?: string;
}

export interface AuditLog {
  id: string;
  admin_username: string;
  action: string;
  target?: string;
  details?: Record<string, any>;
  ip_address?: string;
  created_at: string;
}

export interface DatabaseOverview {
  connected: boolean;
  engine: string;
  latency_ms: number;
  tables: Record<string, number>;
  health_status: string;
}
