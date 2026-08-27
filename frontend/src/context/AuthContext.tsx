import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';
import { wsService } from '../services/websocket';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('rahami_token');
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const currentUser = await api.getMe();
        setUser(currentUser);
        wsService.connect();
      } catch {
        localStorage.removeItem('rahami_token');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const data = await api.login(username, password);
    setUser({ username: data.username, is_authenticated: true });
    wsService.connect();
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      wsService.disconnect();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
