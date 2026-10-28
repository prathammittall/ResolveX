import nodeProcess from 'node:process';
import { ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN, type TokenPair } from './model.js';

export type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  path?: string;
  maxAge?: number;
  domain?: string;
  expires?: Date;
};

export type CookieConfigOptions = {
  accessExpiresIn?: string;
  refreshExpiresIn?: string;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  domain?: string;
  path?: string;
};

/**
 * Parse time string (e.g. '15m', '7d', '1h', '60s') or number of seconds into seconds.
 */
export function parseDurationToSeconds(duration: string | number | undefined, defaultSeconds: number): number {
  if (typeof duration === 'number') {
    return Math.max(0, Math.floor(duration));
  }
  if (!duration || typeof duration !== 'string') {
    return defaultSeconds;
  }
  const trimmed = duration.trim();
  const match = trimmed.match(/^(\d+)\s*([smhdwy]?)$/i);
  if (!match) {
    const parsed = Number(trimmed);
    return isNaN(parsed) ? defaultSeconds : Math.max(0, Math.floor(parsed));
  }
  const val = parseInt(match[1]!, 10);
  const unit = (match[2] || 's').toLowerCase();
  switch (unit) {
    case 's':
      return val;
    case 'm':
      return val * 60;
    case 'h':
      return val * 3600;
    case 'd':
      return val * 86400;
    case 'w':
      return val * 604800;
    case 'y':
      return val * 31536000;
    default:
      return defaultSeconds;
  }
}

/**
 * Serialize a cookie name and value with attributes into a Set-Cookie header string.
 */
export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts: string[] = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  }
  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }
  parts.push(`Path=${options.path ?? '/'}`);
  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }
  if (options.httpOnly ?? true) {
    parts.push('HttpOnly');
  }
  const isSecure = options.secure ?? (nodeProcess.env.NODE_ENV === 'production');
  if (isSecure) {
    parts.push('Secure');
  }
  parts.push(`SameSite=${options.sameSite ?? 'Lax'}`);

  return parts.join('; ');
}

/**
 * Parse Cookie header string into key-value map.
 */
export function parseCookies(cookieHeader: string | null | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  const items = cookieHeader.split(';');
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const splitIndex = trimmed.indexOf('=');
    if (splitIndex === -1) continue;
    const rawKey = trimmed.slice(0, splitIndex).trim();
    const rawVal = trimmed.slice(splitIndex + 1).trim();
    if (!rawKey) continue;
    try {
      cookies[decodeURIComponent(rawKey)] = decodeURIComponent(rawVal);
    } catch {
      cookies[rawKey] = rawVal;
    }
  }
  return cookies;
}

/**
 * Generate a Set-Cookie header to clear a cookie immediately.
 */
export function clearCookie(name: string, options: CookieOptions = {}): string {
  return serializeCookie(name, '', {
    ...options,
    maxAge: 0,
    expires: new Date(0),
  });
}

/**
 * Build Set-Cookie headers for access token and refresh token.
 */
export function buildAuthCookies(tokens: TokenPair, options: CookieConfigOptions = {}): string[] {
  const accessMaxAge = parseDurationToSeconds(options.accessExpiresIn ?? ACCESS_TOKEN_EXPIRES_IN, 15 * 60);
  const refreshMaxAge = parseDurationToSeconds(options.refreshExpiresIn ?? REFRESH_TOKEN_EXPIRES_IN, 7 * 24 * 60 * 60);

  const isSecure = options.secure ?? (nodeProcess.env.NODE_ENV === 'production');
  const sameSite = options.sameSite ?? 'Lax';
  const path = options.path ?? '/';
  const domain = options.domain;

  const accessCookie = serializeCookie('accessToken', tokens.accessToken, {
    maxAge: accessMaxAge,
    path,
    domain,
    httpOnly: true,
    sameSite,
    secure: isSecure,
  });

  const refreshCookie = serializeCookie('refreshToken', tokens.refreshToken, {
    maxAge: refreshMaxAge,
    path,
    domain,
    httpOnly: true,
    sameSite,
    secure: isSecure,
  });

  return [accessCookie, refreshCookie];
}

/**
 * Build Set-Cookie headers to clear authentication cookies on logout.
 */
export function buildLogoutCookies(options: CookieConfigOptions = {}): string[] {
  const isSecure = options.secure ?? (nodeProcess.env.NODE_ENV === 'production');
  const sameSite = options.sameSite ?? 'Lax';
  const path = options.path ?? '/';
  const domain = options.domain;

  const accessCookie = clearCookie('accessToken', {
    path,
    domain,
    httpOnly: true,
    sameSite,
    secure: isSecure,
  });

  const refreshCookie = clearCookie('refreshToken', {
    path,
    domain,
    httpOnly: true,
    sameSite,
    secure: isSecure,
  });

  return [accessCookie, refreshCookie];
}

/**
 * Helper to return a JSON Response with multiple Set-Cookie headers.
 */
export function jsonWithCookies(body: unknown, cookies: string[], init?: ResponseInit): Response {
  const res = Response.json(body, init);
  for (const cookie of cookies) {
    res.headers.append('Set-Cookie', cookie);
  }
  return res;
}
