import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { AuthError, logout, register } from './services/auth/controller.js';
import { getAccessSecret, signAccessToken } from './services/auth/model.js';

// These tests never reach the database: every assertion is decided before any query runs.

describe('S1: public registration cannot choose role or tenant', () => {
  it.each([
    ['role', { role: 'owner' }],
    ['companyId', { companyId: 1 }],
  ])('rejects client-supplied %s', async (_name, extra) => {
    await expect(
      register({ email: 'attacker@example.com', password: 'SecurePassword123!', ...extra }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 } satisfies Partial<AuthError>);
  });
});

describe('S3: logout cannot target an arbitrary user', () => {
  it('ignores a body userId (schema is strict, so nothing is cleared)', async () => {
    const result = await logout({ userId: 1 });
    expect(result.ok).toBe(true);
  });
});

describe('S2: JWT secrets are mandatory', () => {
  it('throws when the secret is missing or too short', () => {
    const original = process.env.JWT_ACCESS_SECRET;
    try {
      vi.stubEnv('JWT_ACCESS_SECRET', '');
      expect(() => getAccessSecret()).toThrow(/JWT_ACCESS_SECRET/);
      vi.stubEnv('JWT_ACCESS_SECRET', 'short');
      expect(() => getAccessSecret()).toThrow(/at least 32/);
    } finally {
      vi.unstubAllEnvs();
      if (original !== undefined) process.env.JWT_ACCESS_SECRET = original;
    }
  });
});

describe('Express app: CORS, auth and role enforcement', () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const app = createApp({ allowedOrigins: ['http://localhost:3001'] });
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const tokenFor = (role: string) =>
    signAccessToken({ userId: 1, email: 'u@example.com', role, companyId: 1, orgId: '00000000-0000-4000-8000-000000000001' });

  it('serves health with a request id and hides x-powered-by', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-request-id')).toBeTruthy();
    expect(res.headers.get('x-powered-by')).toBeNull();
  });

  it('only reflects allow-listed origins in CORS', async () => {
    const good = await fetch(`${base}/health`, { headers: { Origin: 'http://localhost:3001' } });
    expect(good.headers.get('access-control-allow-origin')).toBe('http://localhost:3001');
    expect(good.headers.get('access-control-allow-credentials')).toBe('true');

    const evil = await fetch(`${base}/health`, { headers: { Origin: 'https://evil.example' } });
    expect(evil.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('requires authentication on the dashboard API', async () => {
    const res = await fetch(`${base}/api/metrics`);
    expect(res.status).toBe(401);
  });

  it('forbids a viewer from mutating data', async () => {
    const res = await fetch(`${base}/api/incidents/1/resolve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenFor('viewer')}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(403);
  });

  it('forbids non-admins from managing the service catalog', async () => {
    const res = await fetch(`${base}/api/services`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenFor('responder')}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(403);
  });

  it('rejects cookie-authenticated mutations from foreign or missing origins (CSRF)', async () => {
    const cookie = `accessToken=${tokenFor('owner')}`;
    const send = (origin?: string) =>
      fetch(`${base}/api/csrf-probe`, {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
        body: '{}',
      });

    const evil = await send('https://evil.example');
    expect(evil.status).toBe(403);
    expect((await evil.json()).error.code).toBe('CSRF_REJECTED');
    expect((await send()).status).toBe(403);
    // Allow-listed origin passes the CSRF gate (this probe route 404s before touching the database).
    const ok = await send('http://localhost:3001');
    expect(ok.status).toBe(404);
  });

  it('does not apply CSRF checks to bearer-token or cookie-less requests', async () => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
      body: '{}',
    });
    expect(res.status).not.toBe(403);
  });

  it('forbids non-admins from creating webhook keys and rejects unknown webhook tokens', async () => {
    const create = await fetch(`${base}/api/services/1/webhook-keys`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenFor('responder')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x' }),
    });
    expect(create.status).toBe(403);

    const hook = await fetch(`${base}/api/webhooks/alerts`, {
      method: 'POST',
      headers: { Authorization: 'Bearer rxwh_not-a-real-key', 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(hook.status).toBe(401);
    // The old shared-secret scheme and HMAC signature header no longer authenticate anything.
    const legacy = await fetch(`${base}/api/webhooks/alerts`, {
      method: 'POST',
      headers: { 'X-Webhook-Signature': 'sha256=' + 'a'.repeat(64), 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(legacy.status).toBe(401);
  });

  it('rejects oversized request bodies', async () => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'x'.repeat(2 * 1024 * 1024),
    });
    expect(res.status).toBe(413);
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await fetch(`${base}/nope`);
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('NOT_FOUND');
  });
});

describe('Rate limiting', () => {
  it('MemoryRateLimiter counts per key and resets after the window', async () => {
    const { MemoryRateLimiter } = await import('./rate-limit.js');
    let now = 1_000;
    const limiter = new MemoryRateLimiter({ windowMs: 10_000, max: 2 }, () => now);
    expect(limiter.hit('a').allowed).toBe(true);
    expect(limiter.hit('a').allowed).toBe(true);
    const blocked = limiter.hit('a');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(10);
    expect(limiter.hit('b').allowed).toBe(true); // other keys unaffected
    now += 10_001;
    expect(limiter.hit('a').allowed).toBe(true); // window reset
    limiter.dispose();
  });

  it('fails closed for new keys once the key table is full', async () => {
    const { MemoryRateLimiter } = await import('./rate-limit.js');
    const limiter = new MemoryRateLimiter({ windowMs: 10_000, max: 5, maxKeys: 2 });
    expect(limiter.hit('1').allowed).toBe(true);
    expect(limiter.hit('2').allowed).toBe(true);
    expect(limiter.hit('3').allowed).toBe(false);
    limiter.dispose();
  });

  describe('over HTTP', () => {
    let server: Server;
    let base: string;

    beforeAll(async () => {
      const app = createApp({
        allowedOrigins: [],
        rateLimits: {
          login: { windowMs: 60_000, max: 100 },
          loginPerEmail: { windowMs: 60_000, max: 2 },
          register: { windowMs: 60_000, max: 1 },
          api: { windowMs: 60_000, max: 1 },
        },
      });
      await new Promise<void>((resolve) => {
        server = app.listen(0, '127.0.0.1', () => resolve());
      });
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    const post = (path: string, body: unknown) =>
      fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

    it('throttles repeated login attempts for one account but not others', async () => {
      // Invalid bodies (password missing) fail validation before any DB access.
      const attempt = (email: string) => post('/api/auth/login', { email });
      expect((await attempt('victim@example.com')).status).toBe(400);
      expect((await attempt('Victim@Example.com')).status).toBe(400); // normalised: same account
      const blocked = await attempt('victim@example.com');
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get('retry-after')).toBeTruthy();
      expect((await blocked.json()).error.code).toBe('RATE_LIMITED');
      expect((await attempt('someone-else@example.com')).status).toBe(400);
    });

    it('throttles registration per IP', async () => {
      expect((await post('/api/auth/register', {})).status).toBe(400);
      expect((await post('/api/auth/register', {})).status).toBe(429);
    });

    it('throttles the dashboard API per IP, not health checks', async () => {
      expect((await fetch(`${base}/api/nope`)).status).toBe(401);
      expect((await fetch(`${base}/api/nope`)).status).toBe(429);
      expect((await fetch(`${base}/health`)).status).toBe(200);
    });
  });
});

