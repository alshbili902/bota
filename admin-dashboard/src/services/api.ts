import {
  AdminUser,
  AuditLog,
  DashboardStats,
  DatabaseOverview,
  DownloadItem,
  DownloadsResponse,
  ErrorItem,
  PlatformUser,
  SiteSettings,
  SystemHealth,
} from '../types';

const API_BASE = '/api/admin';

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('rahami_admin_token');
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('Content-Type', 'application/json');

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401) {
    localStorage.removeItem('rahami_admin_token');
    window.dispatchEvent(new Event('admin-unauthorized'));
    throw new Error('جلسة تسجيل الدخول منتهية، يرجى تسجيل الدخول مجددًا.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'حدث خطأ غير متوقع أثناء معالجة الطلب.');
  }

  return data;
}

export const adminApi = {
  // Authentication
  login: async (username: string, password: string) => {
    const data = await fetchWithAuth(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (data.access_token) {
      localStorage.setItem('rahami_admin_token', data.access_token);
    }
    return data;
  },

  logout: async () => {
    try {
      await fetchWithAuth(`${API_BASE}/auth/logout`, { method: 'POST' });
    } finally {
      localStorage.removeItem('rahami_admin_token');
    }
  },

  getMe: async (): Promise<AdminUser> => {
    return await fetchWithAuth(`${API_BASE}/auth/me`);
  },

  updateAccount: async (payload: {
    current_password: string;
    new_username?: string;
    new_password?: string;
    confirm_password?: string;
  }) => {
    return await fetchWithAuth(`${API_BASE}/auth/account`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  // Dashboard Stats
  getStats: async (): Promise<DashboardStats> => {
    return await fetchWithAuth(`${API_BASE}/dashboard/stats`);
  },

  // Users Management
  getUsers: async (): Promise<PlatformUser[]> => {
    return await fetchWithAuth(`${API_BASE}/users`);
  },

  createUser: async (userData: {
    username: string;
    display_name?: string;
    email?: string;
    password: string;
    confirm_password?: string;
    is_active: boolean;
  }) => {
    return await fetchWithAuth(`${API_BASE}/users`, {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  updateUser: async (
    userId: string,
    updates: { username?: string; display_name?: string; email?: string; password?: string; is_active?: boolean }
  ) => {
    return await fetchWithAuth(`${API_BASE}/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  resetUserPassword: async (userId: string, new_password?: string) => {
    return await fetchWithAuth(`${API_BASE}/users/${encodeURIComponent(userId)}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ new_password: new_password || null }),
    });
  },

  changeUserPassword: async (userId: string, new_password: string, confirm_password?: string) => {
    return await fetchWithAuth(`${API_BASE}/users/${encodeURIComponent(userId)}/change-password`, {
      method: 'POST',
      body: JSON.stringify({ new_password, confirm_password }),
    });
  },

  // Downloads Management
  getDownloads: async (params: {
    page?: number;
    page_size?: number;
    status?: string;
    user_id?: string;
    search?: string;
  }): Promise<DownloadsResponse> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.page_size) query.set('page_size', params.page_size.toString());
    if (params.status && params.status !== 'all') query.set('status', params.status);
    if (params.user_id && params.user_id !== 'all') query.set('user_id', params.user_id);
    if (params.search) query.set('search', params.search);

    return await fetchWithAuth(`${API_BASE}/downloads?${query.toString()}`);
  },

  cancelDownload: async (downloadId: string) => {
    return await fetchWithAuth(`${API_BASE}/downloads/${encodeURIComponent(downloadId)}/cancel`, {
      method: 'POST',
    });
  },

  deleteDownload: async (downloadId: string) => {
    return await fetchWithAuth(`${API_BASE}/downloads/${encodeURIComponent(downloadId)}`, {
      method: 'DELETE',
    });
  },

  // Site Settings & Maintenance Mode
  getSettings: async (): Promise<SiteSettings> => {
    return await fetchWithAuth(`${API_BASE}/settings`);
  },

  updateSettings: async (settings: Partial<SiteSettings>): Promise<SiteSettings> => {
    return await fetchWithAuth(`${API_BASE}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  // System Health Telemetry
  getHealth: async (): Promise<SystemHealth> => {
    return await fetchWithAuth(`${API_BASE}/health`);
  },

  // Error Center
  getErrors: async (): Promise<ErrorItem[]> => {
    return await fetchWithAuth(`${API_BASE}/errors`);
  },

  updateErrorStatus: async (errorId: string, status: 'active' | 'resolved' | 'ignored') => {
    return await fetchWithAuth(`${API_BASE}/errors/${encodeURIComponent(errorId)}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  // Activity Audit Logs
  getActivityLogs: async (page = 1, page_size = 25): Promise<{ items: AuditLog[]; total: number; page: number; total_pages: number }> => {
    return await fetchWithAuth(`${API_BASE}/activity?page=${page}&page_size=${page_size}`);
  },

  // Database Overview
  getDatabaseOverview: async (): Promise<DatabaseOverview> => {
    return await fetchWithAuth(`${API_BASE}/database/overview`);
  },
};
