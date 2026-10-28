import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '../../prisma/db.js';
import {
  AuthError,
  getMe,
  login,
  logout,
  refresh,
  register,
} from './controller.js';
import {
  comparePassword,
  generateTokenPair,
  hashPassword,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from './model.js';
import {
  authRouter,
  handleGetMe,
  handleLogin,
  handleLogout,
  handleRefreshToken,
  handleRegister,
} from './route.js';

describe('Auth Service', () => {
  const testCompaniesToClean: number[] = [];

  afterAll(async () => {
    for (const companyId of testCompaniesToClean) {
      try {
        await db.orm.public.Company.where({ id: companyId }).delete();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('Password Hashing & Comparison', () => {
    it('hashes passwords and verifies correctly', async () => {
      const password = 'mySecretPassword123!';
      const hash = await hashPassword(password);

      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2')).toBe(true);

      const isValid = await comparePassword(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await comparePassword('wrongPassword', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('JWT Helpers', () => {
    const payload = {
      userId: 42,
      email: 'test@example.com',
      role: 'member',
      companyId: 10,
    };

    it('generates and verifies access tokens', () => {
      const token = signAccessToken(payload);
      const verified = verifyAccessToken(token);

      expect(verified.userId).toBe(payload.userId);
      expect(verified.email).toBe(payload.email);
      expect(verified.role).toBe(payload.role);
      expect(verified.companyId).toBe(payload.companyId);
    });

    it('generates and verifies refresh tokens', () => {
      const token = signRefreshToken({ userId: payload.userId, email: payload.email });
      const verified = verifyRefreshToken(token);

      expect(verified.userId).toBe(payload.userId);
      expect(verified.email).toBe(payload.email);
    });

    it('generates a token pair with Bearer tokenType', () => {
      const pair = generateTokenPair({
        id: 42,
        email: 'test@example.com',
        role: 'member',
        companyId: 10,
      });

      expect(pair.accessToken).toBeDefined();
      expect(pair.refreshToken).toBeDefined();
      expect(pair.tokenType).toBe('Bearer');
      expect(pair.expiresIn).toBeDefined();
    });

    it('throws error when verifying tampered token', () => {
      const token = signAccessToken(payload);
      const tampered = token.slice(0, -5) + 'abcde';

      expect(() => verifyAccessToken(tampered)).toThrow();
    });
  });

  describe('Controller - Register, Login, Refresh, Logout, and GetMe', () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `testuser_${suffix}@example.com`;
    const password = 'SecurePassword123!';

    let createdUserId: number;
    let createdCompanyId: number;
    let currentRefreshToken: string;
    let currentAccessToken: string;

    it('registers a new user successfully', async () => {
      const result = await register({
        email,
        password,
        name: 'Test User',
        username: `user_${suffix}`,
        companyName: `Test Company ${suffix}`,
        role: 'owner',
      });

      expect(result.ok).toBe(true);
      expect(result.user.email).toBe(email.toLowerCase());
      expect(result.user.name).toBe('Test User');
      expect(result.user.role).toBe('owner');
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();

      createdUserId = result.user.id;
      createdCompanyId = result.user.companyId;
      currentRefreshToken = result.tokens.refreshToken;
      currentAccessToken = result.tokens.accessToken;
      testCompaniesToClean.push(createdCompanyId);

      // Verify that user record in DB has hashed password and stored refreshToken
      const dbUser = await db.orm.public.User.where({ id: createdUserId }).first();
      expect(dbUser).toBeDefined();
      expect(dbUser?.passwordHash).not.toBe(password);
      expect(dbUser?.refreshToken).toBe(currentRefreshToken);
    });

    it('rejects registering with an already existing email', async () => {
      await expect(
        register({
          email,
          password: 'AnotherPassword456',
        }),
      ).rejects.toThrow(AuthError);
    });

    it('logs in successfully with valid credentials', async () => {
      const result = await login({
        email,
        password,
      });

      expect(result.ok).toBe(true);
      expect(result.user.id).toBe(createdUserId);
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();

      currentRefreshToken = result.tokens.refreshToken;
      currentAccessToken = result.tokens.accessToken;

      // Verify db was updated with new refresh token
      const dbUser = await db.orm.public.User.where({ id: createdUserId }).first();
      expect(dbUser?.refreshToken).toBe(currentRefreshToken);
    });

    it('rejects login with an incorrect password', async () => {
      await expect(
        login({
          email,
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(AuthError);
    });

    it('rejects login for non-existent email', async () => {
      await expect(
        login({
          email: 'nonexistent_user_9999@example.com',
          password: 'AnyPassword',
        }),
      ).rejects.toThrow(AuthError);
    });

    it('refreshes token pair using a valid refresh token', async () => {
      const result = await refresh({
        refreshToken: currentRefreshToken,
      });

      expect(result.ok).toBe(true);
      expect(result.user.id).toBe(createdUserId);
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();

      const newRefreshToken = result.tokens.refreshToken;
      expect(newRefreshToken).toBeDefined();

      // Old refresh token must no longer work
      await expect(
        refresh({
          refreshToken: currentRefreshToken,
        }),
      ).rejects.toThrow(AuthError);

      currentRefreshToken = newRefreshToken;
    });

    it('gets profile with getMe', async () => {
      const result = await getMe(createdUserId);
      expect(result.ok).toBe(true);
      expect(result.user.id).toBe(createdUserId);
      expect(result.user.email).toBe(email.toLowerCase());
    });

    it('logs out and clears the stored refresh token', async () => {
      const result = await logout({
        refreshToken: currentRefreshToken,
      });

      expect(result.ok).toBe(true);

      const dbUser = await db.orm.public.User.where({ id: createdUserId }).first();
      expect(dbUser?.refreshToken).toBeNull();

      // Refreshing after logout must fail
      await expect(
        refresh({
          refreshToken: currentRefreshToken,
        }),
      ).rejects.toThrow(AuthError);
    });
  });

  describe('Route Handlers & authRouter', () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `route_user_${suffix}@example.com`;
    const password = 'PasswordForRouteTest1!';

    let createdCompanyId: number;
    let accessToken: string;
    let refreshToken: string;

    it('handles POST /register via handleRegister', async () => {
      const request = new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          name: 'Route Tester',
          companyName: `Route Company ${suffix}`,
        }),
      });

      const response = await handleRegister(request);
      expect(response.status).toBe(201);

      const body = (await response.json()) as any;
      expect(body.ok).toBe(true);
      expect(body.user.email).toBe(email);
      expect(body.tokens.accessToken).toBeDefined();
      expect(body.tokens.refreshToken).toBeDefined();

      const setCookies = typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : [response.headers.get('set-cookie') || ''];
      expect(setCookies.some((c) => c.includes('accessToken='))).toBe(true);
      expect(setCookies.some((c) => c.includes('refreshToken='))).toBe(true);

      accessToken = body.tokens.accessToken;
      refreshToken = body.tokens.refreshToken;
      createdCompanyId = body.user.companyId;
      testCompaniesToClean.push(createdCompanyId);
    });

    it('handles POST /login via authRouter and sets cookies', async () => {
      const request = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const response = await authRouter(request);
      expect(response.status).toBe(200);

      const body = (await response.json()) as any;
      expect(body.ok).toBe(true);
      expect(body.tokens.accessToken).toBeDefined();

      const setCookies = typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : [response.headers.get('set-cookie') || ''];
      expect(setCookies.some((c) => c.includes(`accessToken=${body.tokens.accessToken}`))).toBe(true);
      expect(setCookies.some((c) => c.includes(`refreshToken=${body.tokens.refreshToken}`))).toBe(true);

      refreshToken = body.tokens.refreshToken;
      accessToken = body.tokens.accessToken;
    });

    it('handles GET /me via handleGetMe with Authorization header', async () => {
      const request = new Request('http://localhost:3000/api/auth/me', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const response = await handleGetMe(request);
      expect(response.status).toBe(200);

      const body = (await response.json()) as any;
      expect(body.ok).toBe(true);
      expect(body.user.email).toBe(email);
    });

    it('handles GET /me via cookie when Authorization header is absent', async () => {
      const request = new Request('http://localhost:3000/api/auth/me', {
        method: 'GET',
        headers: {
          Cookie: `accessToken=${accessToken}`,
        },
      });

      const response = await handleGetMe(request);
      expect(response.status).toBe(200);

      const body = (await response.json()) as any;
      expect(body.ok).toBe(true);
      expect(body.user.email).toBe(email);
    });

    it('rejects GET /me when Authorization header and cookie are missing', async () => {
      const request = new Request('http://localhost:3000/api/auth/me', {
        method: 'GET',
      });

      const response = await handleGetMe(request);
      expect(response.status).toBe(401);

      const body = (await response.json()) as any;
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('handles POST /refresh via authRouter and updates cookies', async () => {
      const request = new Request('http://localhost:3000/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken,
        }),
      });

      const response = await authRouter(request);
      expect(response.status).toBe(200);

      const body = (await response.json()) as any;
      expect(body.ok).toBe(true);
      expect(body.tokens.accessToken).toBeDefined();

      const setCookies = typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : [response.headers.get('set-cookie') || ''];
      expect(setCookies.some((c) => c.includes(`accessToken=${body.tokens.accessToken}`))).toBe(true);
      expect(setCookies.some((c) => c.includes(`refreshToken=${body.tokens.refreshToken}`))).toBe(true);

      refreshToken = body.tokens.refreshToken;
    });

    it('handles POST /refresh via cookie when body is empty', async () => {
      const request = new Request('http://localhost:3000/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `refreshToken=${refreshToken}`,
        },
        body: JSON.stringify({}),
      });

      const response = await authRouter(request);
      expect(response.status).toBe(200);

      const body = (await response.json()) as any;
      expect(body.ok).toBe(true);
      expect(body.tokens.accessToken).toBeDefined();
      refreshToken = body.tokens.refreshToken;
    });

    it('handles POST /logout via authRouter and clears cookies', async () => {
      const request = new Request('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `refreshToken=${refreshToken}`,
        },
      });

      const response = await authRouter(request);
      expect(response.status).toBe(200);

      const body = (await response.json()) as any;
      expect(body.ok).toBe(true);
      expect(body.message).toContain('Logged out');

      const setCookies = typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : [response.headers.get('set-cookie') || ''];
      expect(setCookies.some((c) => c.includes('accessToken=') && c.includes('Max-Age=0'))).toBe(true);
      expect(setCookies.some((c) => c.includes('refreshToken=') && c.includes('Max-Age=0'))).toBe(true);
    });
  });
});
