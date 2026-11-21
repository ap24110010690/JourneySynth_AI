import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, clearAuthToken, getAuthToken, setAuthToken } from '../services/api';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, fullName: string, password: string) => Promise<User>;
  demoLogin: () => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(getAuthToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    const existingToken = getAuthToken();
    if (!existingToken) {
      setUser(null);
      setTokenState(null);
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await api.getMe();
      setUser(currentUser);
      setTokenState(existingToken);
    } catch {
      // Invalid or expired token
      clearAuthToken();
      setUser(null);
      setTokenState(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const res = await api.login(email, password);
    setAuthToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(
    async (email: string, fullName: string, password: string): Promise<User> => {
      const res = await api.register(email, fullName, password);
      setAuthToken(res.token);
      setTokenState(res.token);
      setUser(res.user);
      return res.user;
    },
    []
  );

  const demoLogin = useCallback(async (): Promise<User> => {
    const res = await api.demoLogin();
    setAuthToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      clearAuthToken();
      setTokenState(null);
      setUser(null);
    }
  }, []);

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    demoLogin,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
