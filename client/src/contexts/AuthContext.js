'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem('lms_token');
      const savedUser = localStorage.getItem('currentUser');
      if (savedToken && savedUser) {
        try {
          setTokenState(savedToken);
          setUser(JSON.parse(savedUser));
        } catch {
          localStorage.removeItem('lms_token');
          localStorage.removeItem('currentUser');
        }
      }
      setReady(true);
    }
  }, []);

  const login = useCallback((userData, tokenValue) => {
    setUser(userData);
    setTokenState(tokenValue);
    localStorage.setItem('lms_token', tokenValue);
    localStorage.setItem('currentUser', JSON.stringify(userData));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setTokenState(null);
    localStorage.removeItem('lms_token');
    localStorage.removeItem('currentUser');
    window.location.href = '/';
  }, []);

  const updateUser = useCallback((updatedFields) => {
    setUser(prev => {
      const updated = { ...prev, ...updatedFields };
      localStorage.setItem('currentUser', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const value = {
    user,
    token,
    ready,
    login,
    logout,
    updateUser,
    isAdmin: user?.role === 'admin',
    isViewer: user?.role === 'viewer',
    isStudent: user?.role === 'student',
    isAdminOrViewer: user?.role === 'admin' || user?.role === 'viewer',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
