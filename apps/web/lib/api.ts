/**
 * Thin authenticated fetch client for the dashboard API.
 *
 * Authentication is carried only by httpOnly cookies set by the auth service; JavaScript never
 * sees or stores a token. On a 401 we try one refresh (rotating the refresh cookie) and retry
 * the request once before sending the user back to /login.
 */

export class ApiError extends Error {
  readonly code?: string;
  readonly status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  try {
    // Another tab may have refreshed while we waited for the lock; if the session is already valid, stop.
    const me = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (me.ok) return true;
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Renew the session cookies. Single-flight within a tab and serialised across tabs (Web Locks), because
 * the server rotates refresh tokens and treats a second use of the same token as theft, which would
 * sign the user out.
 */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (
    typeof navigator !== 'undefined' && 'locks' in navigator
      ? navigator.locks.request('resolvex-refresh', doRefresh)
      : doRefresh()
  ).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const send = () => fetch(path, { ...init, headers, credentials: 'same-origin' });

  let res = await send();
  if (res.status === 401 && (await refreshSession())) {
    res = await send();
  }

  let data: Record<string, unknown> | null = null;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON response
  }

  if (!res.ok || !data || data['ok'] !== true) {
    const errorObj = (data?.['error'] ?? null) as { message?: string; code?: string } | null;
    const message = errorObj?.message || `Request failed (${res.status})`;
    if (res.status === 401 && typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
    throw new ApiError(message, res.status, errorObj?.code);
  }

  return data as unknown as T;
}

export const api = {
  get: <T = unknown>(path: string) => apiFetch<T>(path, { method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  del: <T = unknown>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
