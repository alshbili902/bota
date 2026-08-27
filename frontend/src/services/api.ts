import type { MediaMetadata, DownloadTask, HistoryItem, SystemHealth, User } from '../types';

const BASE_URL = '';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('rahami_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    let errorDetail = 'حدث خطأ غير متوقع';
    try {
      const data = await response.json();
      errorDetail = data.detail || errorDetail;
    } catch {
      // ignore
    }
    throw new ApiError(response.status, errorDetail);
  }

  return response.json();
}

export const api = {
  login: async (username: string, password: string): Promise<{ access_token: string; username: string }> => {
    const data = await request<{ access_token: string; username: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem('rahami_token', data.access_token);
    return data;
  },

  logout: async (): Promise<void> => {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      localStorage.removeItem('rahami_token');
    }
  },

  getMe: async (): Promise<User> => {
    return request<User>('/api/auth/me');
  },

  analyzeUrl: async (url: string): Promise<MediaMetadata> => {
    return request<MediaMetadata>('/api/download/analyze', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  },

  startDownload: async (payload: {
    url: string;
    format_id: string;
    format_type: string;
    title?: string;
    thumbnail?: string;
    source?: string;
  }): Promise<DownloadTask> => {
    return request<DownloadTask>('/api/download/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getDownloadStatus: async (taskId: string): Promise<DownloadTask> => {
    return request<DownloadTask>(`/api/download/${taskId}`);
  },

  cancelDownload: async (taskId: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/api/download/${taskId}/cancel`, {
      method: 'POST',
    });
  },

  getHistory: async (): Promise<HistoryItem[]> => {
    return request<HistoryItem[]>('/api/download/user/history');
  },

  deleteHistoryItem: async (historyId: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/api/download/history/${historyId}`, {
      method: 'DELETE',
    });
  },

  getHealth: async (): Promise<SystemHealth> => {
    return request<SystemHealth>('/api/health');
  },
};
