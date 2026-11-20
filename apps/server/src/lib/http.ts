import { z } from 'zod';
import type { UserTokenPayload } from '../services/auth/model.js';
import { isOrgError } from '../services/org/errors.js';
import type { Actor } from '../services/org/members.js';
import { can, isRole, type Permission, type Role } from '../services/org/permissions.js';
import { log } from './logger.js';

/** Error thrown by route handlers; rendered as the standard `{ ok: false, error }` envelope. */
export class HttpError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (what = 'Resource') => new HttpError('NOT_FOUND', `${what} not found`, 404);
export const forbidden = (message = 'You do not have permission to perform this action') =>
  new HttpError('FORBIDDEN', message, 403);
export const badRequest = (message: string, details?: unknown) => new HttpError('VALIDATION_ERROR', message, 400, details);
export const conflict = (message: string) => new HttpError('CONFLICT', message, 409);

export const json = (body: unknown, status = 200) => Response.json(body, { status });
export const ok = (body: Record<string, unknown> = {}, status = 200) => json({ ok: true, ...body }, status);
export const fail = (code: string, message: string, status: number, details?: unknown) =>
  json({ ok: false, error: { code, message, details } }, status);

/** Everything a route module needs about the current request. */
export type RouteContext = {
  auth: UserTokenPayload;
  actor: Actor;
  role: Role;
  method: string;
  segments: string[];
  searchParams: URLSearchParams;
  readJson: () => Promise<unknown>;
  requestId: string | null;
  req: Request;
  /** Throws 403 unless the caller's role grants the permission. */
  need: (permission: Permission) => void;
};

export function buildContext(
  auth: UserTokenPayload,
  req: Request,
  segments: string[],
  searchParams: URLSearchParams,
  readJson: () => Promise<unknown>,
): RouteContext {
  const role: Role = isRole(auth.role) ? auth.role : 'viewer';
  const requestId = req.headers.get('x-request-id');
  return {
    auth,
    actor: { userId: auth.userId, orgId: auth.orgId, role, requestId },
    role,
    method: req.method.toUpperCase(),
    segments,
    searchParams,
    readJson,
    requestId,
    req,
    need: (permission) => {
      if (!can(role, permission)) throw forbidden();
    },
  };
}

export async function parseBody<S extends z.ZodTypeAny>(ctx: RouteContext, schema: S): Promise<z.infer<S>> {
  const parsed = schema.safeParse(await ctx.readJson());
  if (!parsed.success) throw badRequest('Invalid request', parsed.error.flatten());
  return parsed.data;
}

export function intParam(value: string | undefined, what = 'Resource'): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > 2_147_483_647) throw notFound(what);
  return n;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuidParam(value: string | undefined, what = 'Resource'): string {
  if (!value || !UUID_RE.test(value)) throw notFound(what);
  return value;
}
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value);

/** Pagination from `?limit=&offset=` with a hard cap. */
export function pageParams(searchParams: URLSearchParams, defaultLimit = 50, maxLimit = 200) {
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || defaultLimit, 1), maxLimit);
  const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);
  return { limit, offset };
}

export type RouteModule = (ctx: RouteContext) => Promise<Response | null>;

/** Run route modules in order; translate thrown errors into the error envelope. */
export async function runModules(ctx: RouteContext, modules: RouteModule[]): Promise<Response | null> {
  try {
    for (const mod of modules) {
      const res = await mod(ctx);
      if (res) return res;
    }
    return null;
  } catch (error) {
    if (error instanceof HttpError) return fail(error.code, error.message, error.status, error.details);
    if (isOrgError(error)) return fail(error.code, error.message, error.status, error.details);
    log.error('api.unhandled', {
      requestId: ctx.requestId,
      path: ctx.segments.join('/'),
      error: error instanceof Error ? error.message : 'unknown',
    });
    return fail('INTERNAL', 'Internal server error', 500);
  }
}

export const nowIso = () => new Date().toISOString();

export function displayName(u: { name: string | null; username: string | null; email: string } | null | undefined): string {
  if (!u) return 'Unknown';
  return u.name || u.username || u.email.split('@')[0] || u.email;
}
