import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type NextFunction, type Request as ExpressRequest, type Response as ExpressResponse } from 'express';
import { ipAndEmailKey, rateLimit, type RateLimitRule } from './rate-limit.js';
import { authRouter } from './services/auth/index.js';
import { dashboardRouter } from './services/api/index.js';
import { processAlertWebhook, isAlertProcessingError, type AlertErrorBody } from './services/incident-engine/index.js';

const AUTH_PATHS = ['/api/auth', '/auth', '/register', '/login', '/refresh', '/logout', '/me', '/google'];
const BODY_LIMIT = '1mb';

const MIN = 60_000;
export type RateLimitName = 'login' | 'loginPerEmail' | 'register' | 'refresh' | 'webhook' | 'api';

/** Defaults are deliberately conservative for credential endpoints; override per environment via createApp. */
export const DEFAULT_RATE_LIMITS: Record<RateLimitName, RateLimitRule> = {
  login: { windowMs: 15 * MIN, max: 30 }, // per IP
  loginPerEmail: { windowMs: 15 * MIN, max: 8 }, // per IP + account: slows password guessing
  register: { windowMs: 60 * MIN, max: 10 }, // per IP
  refresh: { windowMs: 15 * MIN, max: 120 }, // per IP
  webhook: { windowMs: MIN, max: 600 }, // per IP
  api: { windowMs: MIN, max: 600 }, // per IP, dashboard API
};

const LOGIN_PATHS = ['/api/auth/login', '/auth/login', '/login', '/api/auth/google', '/auth/google', '/google'];
const REGISTER_PATHS = ['/api/auth/register', '/auth/register', '/register'];
const REFRESH_PATHS = ['/api/auth/refresh', '/auth/refresh', '/refresh'];

/** Comma-separated list of browser origins allowed to call the API with credentials. */
function parseAllowedOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

/** Convert an Express request (raw Buffer body) into a Web-standard Request for the existing handlers. */
function toWebRequest(req: ExpressRequest): Request {
  const host = req.get('host') ?? 'localhost';
  const url = `${req.protocol}://${host}${req.originalUrl}`;
  const headers = new Headers();
  for (const [key, val] of Object.entries(req.headers)) {
    if (val === undefined) continue;
    if (Array.isArray(val)) val.forEach((v) => headers.append(key, v));
    else headers.set(key, val);
  }
  const method = req.method.toUpperCase();
  const hasBody = Buffer.isBuffer(req.body) && req.body.length > 0 && method !== 'GET' && method !== 'HEAD';
  return new Request(url, { method, headers, body: hasBody ? new Uint8Array(req.body as Buffer) : undefined });
}

async function sendWebResponse(res: ExpressResponse, response: Response): Promise<void> {
  res.status(response.status);
  const setCookies = response.headers.getSetCookie?.() ?? [];
  if (setCookies.length > 0) res.setHeader('Set-Cookie', setCookies);
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'set-cookie') res.setHeader(key, value);
  });
  res.send(Buffer.from(await response.arrayBuffer()));
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * CSRF defence for cookie-authenticated requests. Browsers attach cookies automatically, so a
 * state-changing request that carries cookies (and no explicit Authorization header) must come
 * from an allow-listed origin. Requests without cookies, or with a bearer header, use credentials
 * a cross-site attacker cannot attach, so they are not CSRF-able.
 */
export function csrfGuard(allowedOrigins: string[]) {
  return (req: ExpressRequest, res: ExpressResponse, next: NextFunction): void => {
    if (SAFE_METHODS.has(req.method) || req.get('authorization') || !req.get('cookie')) {
      next();
      return;
    }
    const origin = originOf(req.get('origin')) ?? originOf(req.get('referer'));
    if (origin && allowedOrigins.includes(origin)) {
      next();
      return;
    }
    res.status(403).json(errorBody('CSRF_REJECTED', 'Cross-site request rejected'));
  };
}

function errorBody(code: string, message: string) {
  return { ok: false, error: { code, message } };
}

export function createApp(
  options: { allowedOrigins?: string[]; rateLimits?: Partial<Record<RateLimitName, RateLimitRule>> } = {},
): express.Express {
  const limits = { ...DEFAULT_RATE_LIMITS, ...options.rateLimits };
  const allowedOrigins = options.allowedOrigins ?? parseAllowedOrigins(process.env.CORS_ORIGINS);
  const app = express();

  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) {
    app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);
  }

  // Request id + baseline security headers.
  app.use((req, res, next) => {
    const requestId = randomUUID();
    // Overwrite any client-supplied value so audit rows can trust it.
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // CORS allow-list: unknown browser origins get no CORS headers (the browser blocks the response).
  app.use(
    cors({
      origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin.replace(/\/$/, ''))),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  app.use(csrfGuard(allowedOrigins));

  // Raw body for every route: the webhook needs the exact bytes for HMAC verification.
  app.use(express.raw({ type: () => true, limit: BODY_LIMIT }));

  const ip = (req: ExpressRequest) => req.ip ?? 'unknown';
  app.post(LOGIN_PATHS, rateLimit('login', limits.login, ip).middleware);
  app.post(LOGIN_PATHS, rateLimit('login-email', limits.loginPerEmail, ipAndEmailKey).middleware);
  app.post(REGISTER_PATHS, rateLimit('register', limits.register, ip).middleware);
  app.post(REFRESH_PATHS, rateLimit('refresh', limits.refresh, ip).middleware);
  app.post(['/api/webhooks/alerts', '/webhooks/alerts'], rateLimit('webhook', limits.webhook, ip).middleware);
  // Everything else under /api (auth routes and the webhook are limited above and skipped here).
  const apiLimiter = rateLimit('api', limits.api, ip).middleware;
  app.use('/api', (req, res, next) =>
    req.originalUrl.startsWith('/api/auth') || req.originalUrl.startsWith('/api/webhooks') ? next() : apiLimiter(req, res, next),
  );

  app.get(['/', '/health', '/api/health'], (_req, res) => {
    res.json({ ok: true, service: 'ResolveX Server', status: 'healthy', timestamp: new Date().toISOString() });
  });

  app.use(AUTH_PATHS, async (req, res, next) => {
    try {
      await sendWebResponse(res, await authRouter(toWebRequest(req)));
    } catch (err) {
      next(err);
    }
  });

  app.post(['/api/webhooks/alerts', '/webhooks/alerts'], async (req, res) => {
    try {
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
      const result = await processAlertWebhook({
        rawBody,
        headers: { authorization: req.get('authorization') ?? null },
      });
      res.status(result.duplicate ? 200 : 201).json(result);
    } catch (error) {
      if (isAlertProcessingError(error)) {
        const body: AlertErrorBody = {
          ok: false,
          error: { code: error.code, message: error.message, details: error.details },
        };
        res.status(error.status).json(body);
        return;
      }
      console.error('[webhooks/alerts] unexpected error:', error instanceof Error ? error.name : 'unknown');
      res.status(500).json(errorBody('INTERNAL', 'Failed to process alert'));
    }
  });

  // Authenticated dashboard API (previously never mounted).
  app.use('/api', async (req, res, next) => {
    try {
      await sendWebResponse(res, await dashboardRouter(toWebRequest(req)));
    } catch (err) {
      next(err);
    }
  });

  app.use((req, res) => {
    res.status(404).json(errorBody('NOT_FOUND', `Route ${req.method} ${req.path} not found`));
  });

  app.use((err: unknown, _req: ExpressRequest, res: ExpressResponse, _next: NextFunction) => {
    if ((err as { status?: number })?.status === 413) {
      res.status(413).json(errorBody('PAYLOAD_TOO_LARGE', 'Request body is too large'));
      return;
    }
    console.error('Unhandled server error:', err instanceof Error ? err.message : 'unknown');
    if (!res.headersSent) res.status(500).json(errorBody('INTERNAL', 'Internal server error'));
  });

  return app;
}
