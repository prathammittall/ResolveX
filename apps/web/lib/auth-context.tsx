'use client';

import { refreshSession } from './api';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type UserRole = 'owner' | 'admin' | 'responder' | 'member' | 'viewer';

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  username: string | null;
  role: UserRole;
  companyId: number;
  orgId: string;
  createdAt?: string;
  updatedAt?: string;
}

export type AuthResult = {
  ok: boolean;
  error?: string;
  user?: AuthUser;
  requireOtp?: boolean;
  email?: string;
  otpToken?: string;
  message?: string;
};

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  verifyOtp: (data: { email: string; otp: string; otpToken?: string }) => Promise<AuthResult>;
  resendOtp: (data: { email: string; otpToken?: string }) => Promise<{ ok: boolean; error?: string; message?: string; otpToken?: string }>;
  loginWithGoogle: (data: { credential?: string; email?: string; name?: string }) => Promise<AuthResult>;
  register: (data: {
    email: string;
    password: string;
    name?: string;
    companyName?: string;
  }) => Promise<AuthResult>;
  logout: () => Promise<void>;
  /** Re-issue the session for another organization the user belongs to. */
  switchOrg: (organizationId: string) => Promise<{ ok: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Session model: the API sets httpOnly `accessToken` / `refreshToken` cookies, which JavaScript
 * cannot read. Nothing secret is kept in localStorage; the user profile is always re-fetched
 * from /api/auth/me (refreshing the access token once if it has expired).
 */
async function fetchMe(): Promise<AuthUser | null> {
  const attempt = async () => fetch('/api/auth/me', { credentials: 'same-origin' });
  let res = await attempt();
  if (res.status === 401) {
    // Shared with the API client so concurrent callers never spend the same refresh token twice.
    if (!(await refreshSession())) return null;
    res = await attempt();
  }
  if (!res.ok) return null;
  const data = await res.json();
  return data.ok && data.user ? (data.user as AuthUser) : null;
}

function registrationErrorMessage(data: {
  error?: { message?: string; code?: string; details?: { fieldErrors?: Record<string, string[]> } };
}): string {
  let errorMsg = data?.error?.message || 'Registration failed';
  if (data?.error?.code === 'EMAIL_ALREADY_EXISTS') {
    errorMsg = 'An account with this email already exists. Please sign in instead.';
  } else if (data?.error?.details?.fieldErrors) {
    const firstKey = Object.keys(data.error.details.fieldErrors)[0];
    if (firstKey) {
      errorMsg = data.error.details.fieldErrors[firstKey]?.[0] || errorMsg;
    }
  }
  return errorMsg;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        // Offline or backend unreachable: treat as signed out.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      setUser(await fetchMe());
    } catch (e) {
      console.warn('Failed to refresh user', e);
    }
  }, []);

  const authRequest = useCallback(
    async (path: string, payload: unknown, fallbackError: string, mapError?: typeof registrationErrorMessage) => {
      try {
        const res = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          const message = mapError ? mapError(data) : data?.error?.message || fallbackError;
          return { ok: false, error: message } satisfies AuthResult;
        }
        const authUser: AuthUser = data.user;
        setUser(authUser);
        return { ok: true, user: authUser } satisfies AuthResult;
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Network error occurred. Please try again.',
        } satisfies AuthResult;
      }
    },
    [],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          const message =
            data?.error?.code === 'INVALID_CREDENTIALS'
              ? 'Invalid email or password'
              : data?.error?.message || 'Login failed. Please try again.';
          return { ok: false, error: message };
        }
        if (data.requireOtp) {
          return {
            ok: true,
            requireOtp: true,
            email: data.email || email,
            otpToken: data.otpToken,
            message: data.message || 'Verification code sent to your email',
          };
        }
        const authUser: AuthUser = data.user;
        setUser(authUser);
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

  const verifyOtp = useCallback(
    async (payload: { email: string; otp: string; otpToken?: string }): Promise<AuthResult> => {
      try {
        const res = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          const message = data?.error?.message || 'OTP verification failed. Please check your code.';
          return { ok: false, error: message };
        }
        const authUser: AuthUser = data.user;
        setUser(authUser);
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

  const resendOtp = useCallback(
    async (payload: { email: string; otpToken?: string }): Promise<{ ok: boolean; error?: string; message?: string; otpToken?: string }> => {
      try {
        const res = await fetch('/api/auth/resend-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          return { ok: false, error: data?.error?.message || 'Failed to resend verification code.' };
        }
        return { ok: true, message: data.message, otpToken: data.otpToken };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Network error occurred. Please try again.',
        };
      }
    },
    [],
  );

  const loginWithGoogle = useCallback(
    async (payload: { credential?: string; email?: string; name?: string }): Promise<AuthResult> => {
      return authRequest(
        '/api/auth/google',
        payload,
        'Google sign-in failed. Please try again.',
        (data) => data?.error?.message || 'Google sign-in failed.',
      );
    },
    [authRequest],
  );

  const register = useCallback(
    (payload: { email: string; password: string; name?: string; companyName?: string }) =>
      authRequest('/api/auth/register', payload, 'Registration failed', registrationErrorMessage),
    [authRequest],
  );

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: '{}',
      });
    } catch {
      // Ignore network errors on logout
    } finally {
      setUser(null);
    }
  }, []);

  const switchOrg = useCallback(async (organizationId: string) => {
    try {
      const res = await fetch('/api/auth/switch-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ organizationId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) return { ok: false, error: data?.error?.message || 'Could not switch organization' };
      setUser(data.user as AuthUser);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error. Please try again.' };
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, verifyOtp, resendOtp, loginWithGoogle, register, logout, switchOrg, refreshUser }}>
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
