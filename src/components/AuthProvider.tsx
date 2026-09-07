'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

export interface AuthUser {
  userId: string;
  name: string;
  email: string;
  username: string;
  gender?: string;
  profilePic?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  checkAuth: () => Promise<void>;
  updateUser: (updatedData: Partial<AuthUser>) => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    name: string,
    email: string,
    password: string,
    username: string,
    gender?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const storedToken =
        typeof window !== 'undefined'
          ? localStorage.getItem('token') || localStorage.getItem('rag_auth_token')
          : null;
      const headers: Record<string, string> = {};
      if (storedToken) {
        headers['Authorization'] = `Bearer ${storedToken}`;
      }

      const res = await fetch('/api/auth/me', {
        credentials: 'include',
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
        } else {
          setUser(null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('rag_auth_token');
          }
        }
      } else {
        setUser(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('rag_auth_token');
        }
      }
    } catch (err) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const updateUser = (updatedData: Partial<AuthUser>) => {
    setUser((prev) => (prev ? { ...prev, ...updatedData } : null));
  };

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to sign in');
    }
    if (data.token && typeof window !== 'undefined') {
      localStorage.setItem('token', data.token);
      localStorage.setItem('rag_auth_token', data.token);
    }
    setUser(data.user);
  };

  const signup = async (
    name: string,
    email: string,
    password: string,
    username: string,
    gender?: string
  ) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, email, password, username, gender }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to create account');
    }
    if (data.token && typeof window !== 'undefined') {
      localStorage.setItem('token', data.token);
      localStorage.setItem('rag_auth_token', data.token);
    }
    setUser(data.user);
  };

  const logout = async () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('rag_auth_token');
      }
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        checkAuth,
        updateUser,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
