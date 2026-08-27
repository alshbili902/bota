import React, { createContext, useContext, useEffect, useState } from 'react';
import { AdminUser } from '../types';
import { adminApi } from '../services/api';

interface AdminAuthContextType {
  admin: AdminUser | null;
  isLoading: boolean;
  login: (u: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAdmin: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const data = await adminApi.getMe();
      setAdmin(data);
    } catch {
      setAdmin(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();

    const handleUnauthorized = () => {
      setAdmin(null);
    };

    window.addEventListener('admin-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('admin-unauthorized', handleUnauthorized);
  }, []);

  const login = async (username: string, pass: string) => {
    await adminApi.login(username, pass);
    await checkAuth();
  };

  const logout = async () => {
    await adminApi.logout();
    setAdmin(null);
  };

  const refreshAdmin = async () => {
    await checkAuth();
  };

  return (
    <AdminAuthContext.Provider value={{ admin, isLoading, login, logout, refreshAdmin }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
