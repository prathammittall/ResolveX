import type { NextFunction, Request, Response } from 'express';

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window resets. */
  retryAfterSec: number;
};

/**
 * Fixed-window counter held in process memory.
 *
 * Good enough for a single API instance. With several instances each keeps its own counters, so
 * the effective limit is `max * instances`; swap in a Redis-backed implementation of `hit` when the
 * API is scaled out (Phase 6 introduces Redis).
 */
export class MemoryRateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();
  private readonly sweeper: NodeJS.Timeout;

  constructor(
    private readonly options: { windowMs: number; max: number; maxKeys?: number },
    private readonly now: () => number = Date.now,
  ) {
    this.sweeper = setInterval(() => this.sweep(), Math.min(options.windowMs, 60_000));
    this.sweeper.unref();
  }

  hit(key: string): RateLimitResult {
    const now = this.now();
    const { windowMs, max } = this.options;
    let entry = this.windows.get(key);

    if (!entry || entry.resetAt <= now) {
      // Bound memory under a key-flooding attack: when full, drop expired entries, then refuse to track more
      // (fail closed for new keys rather than growing without limit).
      if (!entry && this.windows.size >= (this.options.maxKeys ?? 100_000)) {
        this.sweep();
        if (this.windows.size >= (this.options.maxKeys ?? 100_000)) {
          return { allowed: false, limit: max, remaining: 0, retryAfterSec: Math.ceil(windowMs / 1000) };
        }
      }
      entry = { count: 0, resetAt: now + windowMs };
      this.windows.set(key, entry);
    }

    entry.count += 1;
    return {
      allowed: entry.count <= max,
      limit: max,
      remaining: Math.max(0, max - entry.count),
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  private sweep(): void {
    const now = this.now();
    for (const [key, entry] of this.windows) {
      if (entry.resetAt <= now) this.windows.delete(key);
    }
  }

  dispose(): void {
    clearInterval(this.sweeper);
    this.windows.clear();
  }
}

export type RateLimitRule = { windowMs: number; max: number };

/**
 * Express middleware. `key` returns the identity to count (null = skip). Each rule has its own
 * namespace so the same IP can be limited independently per route group.
 */
export function rateLimit(
  name: string,
  rule: RateLimitRule,
  key: (req: Request) => string | null,
): { middleware: (req: Request, res: Response, next: NextFunction) => void; limiter: MemoryRateLimiter } {
  const limiter = new MemoryRateLimiter(rule);
  const middleware = (req: Request, res: Response, next: NextFunction): void => {
    const identity = key(req);
    if (identity === null) {
      next();
      return;
    }
    const result = limiter.hit(`${name}:${identity}`);
    res.setHeader('RateLimit-Limit', String(result.limit));
    res.setHeader('RateLimit-Remaining', String(result.remaining));
    res.setHeader('RateLimit-Reset', String(result.retryAfterSec));
    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfterSec));
      res.status(429).json({
        ok: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
      });
      return;
    }
    next();
  };
  return { middleware, limiter };
}

/** Identity for per-credential throttling: client IP + normalised email from a JSON body. */
export function ipAndEmailKey(req: Request): string | null {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0 || req.body.length > 10_000) return null;
  try {
    const parsed = JSON.parse(req.body.toString('utf8')) as { email?: unknown };
    if (typeof parsed.email !== 'string') return null;
    return `${req.ip}|${parsed.email.trim().toLowerCase().slice(0, 255)}`;
  } catch {
    return null;
  }
}
