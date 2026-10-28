import { describe, expect, it } from 'vitest';
import {
  buildAuthCookies,
  buildLogoutCookies,
  clearCookie,
  jsonWithCookies,
  parseCookies,
  parseDurationToSeconds,
  serializeCookie,
} from './cookies.js';

describe('Auth Cookies Module', () => {
  describe('parseDurationToSeconds', () => {
    it('parses seconds, minutes, hours, days', () => {
      expect(parseDurationToSeconds('30s', 0)).toBe(30);
      expect(parseDurationToSeconds('15m', 0)).toBe(900);
      expect(parseDurationToSeconds('2h', 0)).toBe(7200);
      expect(parseDurationToSeconds('7d', 0)).toBe(604800);
      expect(parseDurationToSeconds('1w', 0)).toBe(604800);
    });

    it('falls back to defaultSeconds on invalid or undefined format', () => {
      expect(parseDurationToSeconds(undefined, 900)).toBe(900);
      expect(parseDurationToSeconds('invalid', 900)).toBe(900);
    });

    it('handles numeric input', () => {
      expect(parseDurationToSeconds(120, 0)).toBe(120);
    });
  });

  describe('serializeCookie & clearCookie', () => {
    it('serializes a cookie with options', () => {
      const cookie = serializeCookie('testName', 'testValue', {
        httpOnly: true,
        maxAge: 3600,
        path: '/',
        sameSite: 'Lax',
        secure: false,
      });

      expect(cookie).toContain('testName=testValue');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('Max-Age=3600');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
    });

    it('creates clearing cookie with Max-Age=0', () => {
      const cookie = clearCookie('testName', { path: '/', sameSite: 'Lax', secure: false });
      expect(cookie).toContain('testName=');
      expect(cookie).toContain('Max-Age=0');
      expect(cookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    });
  });

  describe('parseCookies', () => {
    it('parses multiple cookies from Cookie header', () => {
      const header = 'accessToken=xyz123; refreshToken=abc789; theme=dark';
      const parsed = parseCookies(header);

      expect(parsed['accessToken']).toBe('xyz123');
      expect(parsed['refreshToken']).toBe('abc789');
      expect(parsed['theme']).toBe('dark');
    });

    it('handles empty or malformed strings gracefully', () => {
      expect(parseCookies(undefined)).toEqual({});
      expect(parseCookies('')).toEqual({});
      expect(parseCookies(';;;')).toEqual({});
    });
  });

  describe('buildAuthCookies & buildLogoutCookies', () => {
    const tokens = {
      accessToken: 'sample.access.token',
      refreshToken: 'sample.refresh.token',
      tokenType: 'Bearer' as const,
      expiresIn: '15m',
    };

    it('builds accessToken and refreshToken Set-Cookie strings', () => {
      const cookies = buildAuthCookies(tokens, { secure: false });
      expect(cookies).toHaveLength(2);

      const [accessCookie, refreshCookie] = cookies;
      expect(accessCookie).toContain('accessToken=sample.access.token');
      expect(accessCookie).toContain('HttpOnly');
      expect(accessCookie).toContain('Path=/');
      expect(accessCookie).toContain('SameSite=Lax');
      expect(accessCookie).toContain('Max-Age=900');

      expect(refreshCookie).toContain('refreshToken=sample.refresh.token');
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('Path=/');
      expect(refreshCookie).toContain('SameSite=Lax');
      expect(refreshCookie).toContain('Max-Age=604800');
    });

    it('builds logout cookies to expire both tokens', () => {
      const cookies = buildLogoutCookies({ secure: false });
      expect(cookies).toHaveLength(2);

      const [accessCookie, refreshCookie] = cookies;
      expect(accessCookie).toContain('accessToken=;');
      expect(accessCookie).toContain('Max-Age=0');
      expect(refreshCookie).toContain('refreshToken=;');
      expect(refreshCookie).toContain('Max-Age=0');
    });
  });

  describe('jsonWithCookies', () => {
    it('attaches multiple Set-Cookie headers to Response', () => {
      const cookies = [
        'accessToken=access123; Path=/; HttpOnly',
        'refreshToken=refresh456; Path=/; HttpOnly',
      ];
      const res = jsonWithCookies({ ok: true }, cookies, { status: 200 });
      expect(res.status).toBe(200);

      const setCookies = typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : [res.headers.get('set-cookie')];

      expect(setCookies.some((c) => c?.includes('accessToken=access123'))).toBe(true);
      expect(setCookies.some((c) => c?.includes('refreshToken=refresh456'))).toBe(true);
    });
  });
});
