import { verifyAccessToken, type UserTokenPayload } from '../auth/model.js';
import { parseCookies } from '../auth/cookies.js';

export type { UserTokenPayload };

/**
 * Extract the access token from the Authorization: Bearer header or the
 * httpOnly `accessToken` cookie — mirroring the auth router's handleGetMe.
 */
export function extractAccessToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  const cookies = parseCookies(req.headers.get('cookie'));
  return cookies['accessToken'] || cookies['access_token'] || null;
}

/**
 * Verify the request's access token. Returns the decoded payload or null
 * when the token is missing/invalid/expired. Never throws.
 */
export function authenticate(req: Request): UserTokenPayload | null {
  const token = extractAccessToken(req);
  if (!token) return null;
  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}

// --- Shared JSON response helpers (envelope: { ok, ... | error }) ---

export function unauthorizedResponse(): Response {
  return Response.json(
    { ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
    { status: 401 },
  );
}

export function notFoundResponse(message = 'Not found'): Response {
  return Response.json(
    { ok: false, error: { code: 'NOT_FOUND', message } },
    { status: 404 },
  );
}

export function badRequestResponse(message: string, details?: unknown): Response {
  return Response.json(
    { ok: false, error: { code: 'BAD_REQUEST', message, details } },
    { status: 400 },
  );
}

export function conflictResponse(message: string): Response {
  return Response.json(
    { ok: false, error: { code: 'CONFLICT', message } },
    { status: 409 },
  );
}

export function serverErrorResponse(message = 'Internal server error'): Response {
  return Response.json(
    { ok: false, error: { code: 'INTERNAL', message } },
    { status: 500 },
  );
}
