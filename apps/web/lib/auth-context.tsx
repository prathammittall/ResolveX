'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type UserRole = 'owner' | 'admin' | 'responder' | 'member' | 'viewer';

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  username: string | null;
  role: UserRole;
  companyId: number;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string; user?: AuthUser }>;
  register: (data: {
    email: string;
    password: string;
    name?: string;
    companyName?: string;
  }) => Promise<{ ok: boolean; error?: string; user?: AuthUser }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'resolvex_auth_user';
const TOKEN_STORAGE_KEY = 'resolvex_auth_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from localStorage and verify with /api/auth/me
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(USER_STORAGE_KEY);
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
      if (storedToken) {
        setToken(storedToken);
      }
    } catch (e) {
      console.warn('Failed to parse stored auth session', e);
    } finally {
      setIsLoading(false);
    }

    // Background verify session with server /api/auth/me
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.user) {
            setUser(data.user);
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
          }
        }
      })
      .catch(() => {
        // Ignore network or offline errors during initial verification
      });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/auth/me', { headers, credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.user) {
          setUser(data.user);
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
        }
      }
    } catch (e) {
      console.warn('Failed to refresh user', e);
    }
  }, [token]);

  const login = useCallback(
    async (email: string, password: string): Promise<{ ok: boolean; error?: string; user?: AuthUser }> => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          const errorMsg =
            data?.error?.message ||
            (res.status === 401 ? 'Invalid email or password' : 'Login failed. Please try again.');
          return { ok: false, error: errorMsg };
        }

        const authUser: AuthUser = data.user;
        const accessToken: string = data.tokens?.accessToken || '';

        setUser(authUser);
        setToken(accessToken);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authUser));
        if (accessToken) {
          localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
        }

        return { ok: true, user: authUser };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Network error occurred. Please try again.',
        };
      }
    },
    [],
  );

  const register = useCallback(
    async (payload: {
      email: string;
      password: string;
      name?: string;
      companyName?: string;
    }): Promise<{ ok: boolean; error?: string; user?: AuthUser }> => {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          let errorMsg = data?.error?.message || 'Registration failed';
          if (data?.error?.code === 'EMAIL_ALREADY_EXISTS') {
            errorMsg = 'An account with this email already exists. Please sign in instead.';
          } else if (data?.error?.details?.fieldErrors) {
            const firstKey = Object.keys(data.error.details.fieldErrors)[0];
            if (firstKey) {
              errorMsg = data.error.details.fieldErrors[firstKey][0] || errorMsg;
            }
          }
          return { ok: false, error: errorMsg };
        }

        const authUser: AuthUser = data.user;
        const accessToken: string = data.tokens?.accessToken || '';

        setUser(authUser);
        setToken(accessToken);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authUser));
        if (accessToken) {
          localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
        }

        return { ok: true, user: authUser };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Network error occurred. Please try again.',
        };
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
      });
    } catch {
      // Ignore network errors on logout
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
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
