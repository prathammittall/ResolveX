import { z } from 'zod';
import { and } from '@prisma/orm-postgres/orm-client';
import { db } from '../../prisma/db.js';
import { randomToken, sha256 } from '../../lib/crypto.js';
import { log } from '../../lib/logger.js';
import { authenticateWebhookKey } from '../incident-engine/webhook-keys.js';
import { isAlertProcessingError } from '../incident-engine/errors.js';
import { sendGenericEmail } from '../email/mailer.js';
import { sendPasswordResetEmail } from '../mailer.js';
import { hashPassword } from '../auth/model.js';
import { handleGithubCallback, handleGithubWebhook } from '../integrations/github.js';
import { deploymentSchema, recordDeployment, renderStatusPage } from './modules/ops.js';
import { authenticate } from './auth.js';

const json = (body: unknown, status = 200) => Response.json(body, { status });
const fail = (code: string, message: string, status: number, details?: unknown) => json({ ok: false, error: { code, message, details } }, status);

const TOKEN_TTL: Record<string, number> = { verify_email: 48 * 3_600_000, reset_password: 60 * 60_000 };

async function issueUserToken(userId: number, purpose: 'verify_email' | 'reset_password'): Promise<string> {
  // One live token per purpose: older ones are invalidated.
  await db.orm.public.UserToken.where((t) => and(t.userId.eq(userId), t.purpose.eq(purpose), t.usedAt.isNull())).updateAll({ usedAt: new Date().toISOString() });
  const token = randomToken('', 32);
  await db.orm.public.UserToken.create({ userId, purpose, tokenHash: sha256(token), expiresAt: new Date(Date.now() + TOKEN_TTL[purpose]!).toISOString() });
  return token;
}

async function consumeUserToken(token: string, purpose: string) {
  const row = await db.orm.public.UserToken.where({ tokenHash: sha256(token), purpose }).first();
  if (!row || row.usedAt || Date.parse(row.expiresAt) < Date.now()) return null;
  const claimed = await db.orm.public.UserToken.where((t) => and(t.id.eq(row.id), t.usedAt.isNull())).update({ usedAt: new Date().toISOString() });
  return claimed ? row : null;
}

export async function sendVerificationEmail(userId: number, email: string): Promise<boolean> {
  const token = await issueUserToken(userId, 'verify_email');
  return sendGenericEmail({ to: email, subject: 'Verify your ResolveX email', heading: 'Confirm your email address', body: 'Confirm this address to receive incident alerts and invitations.', link: `/verify-email?token=${encodeURIComponent(token)}`, linkLabel: 'Verify email' });
}

/**
 * Routes that do not use a dashboard session. Returns null when the path is not one of them.
 * The caller applies rate limits (auth limiter for account recovery, webhook limiter for webhooks).
 */
export async function publicRoutes(req: Request, rawBody: string): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, '');
  const method = req.method.toUpperCase();
  const body = () => {
    try {
      return JSON.parse(rawBody || 'null') as unknown;
    } catch {
      return null;
    }
  };

  try {
    // ---- Public status page (only pages explicitly marked public) ----
    const status = /^\/api\/public\/status\/([a-z0-9-]{3,63})$/.exec(path);
    if (status && method === 'GET') {
      const page = await db.orm.public.StatusPage.where({ slug: status[1]!, isPublic: true }).first();
      if (!page) return fail('NOT_FOUND', 'Status page not found', 404);
      return new Response(JSON.stringify({ ok: true, page: await renderStatusPage(page) }), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=30' } });
    }

    // ---- Deployment webhook (per-service webhook key, same as alerts) ----
    if (path === '/api/webhooks/deployments' && method === 'POST') {
      const key = await authenticateWebhookKey(db, req.headers.get('authorization'));
      const parsed = deploymentSchema.safeParse(body());
      if (!parsed.success) return fail('VALIDATION_ERROR', 'Invalid deployment payload', 400, parsed.error.flatten());
      if (parsed.data.serviceId !== key.serviceId) return fail('FORBIDDEN', 'This key is not valid for the requested service', 403);
      const service = await db.orm.public.Service.where({ id: key.serviceId, companyId: key.companyId }).first();
      if (!service) return fail('NOT_FOUND', 'Service not found', 404);
      const row = await recordDeployment(key.companyId, service, { ...parsed.data, source: 'webhook' });
      return json({ ok: true, deploymentId: row?.id ?? null }, 201);
    }

    // ---- GitHub ----
    if (path === '/api/webhooks/github' && method === 'POST') {
      return handleGithubWebhook(rawBody, { signature: req.headers.get('x-hub-signature-256'), event: req.headers.get('x-github-event'), delivery: req.headers.get('x-github-delivery') });
    }
    if (path === '/api/integrations/github/callback' && method === 'GET') return handleGithubCallback(url);

    // ---- Email verification ----
    if (path === '/api/auth/verify-email' && method === 'POST') {
      const parsed = z.object({ token: z.string().min(10).max(200) }).safeParse(body());
      if (!parsed.success) return fail('VALIDATION_ERROR', 'Invalid token', 400);
      const row = await consumeUserToken(parsed.data.token, 'verify_email');
      if (!row) return fail('INVALID_TOKEN', 'This verification link is invalid or has expired', 400);
      await db.orm.public.User.where({ id: row.userId }).update({ emailVerifiedAt: new Date().toISOString() });
      return json({ ok: true });
    }
    if (path === '/api/auth/verify-email/request' && method === 'POST') {
      const auth = authenticate(req);
      if (!auth) return fail('UNAUTHORIZED', 'Authentication required', 401);
      const user = await db.orm.public.User.where({ id: auth.userId }).first();
      if (!user) return fail('NOT_FOUND', 'User not found', 404);
      if (user.emailVerifiedAt) return json({ ok: true, alreadyVerified: true });
      const sent = await sendVerificationEmail(user.id, user.email);
      return json({ ok: true, emailSent: sent });
    }

    // ---- Password reset (always answers the same way so it cannot be used to probe accounts) ----
    if ((path === '/api/auth/forgot-password' || path === '/auth/forgot-password') && method === 'POST') {
      const parsed = z.object({ email: z.string().trim().toLowerCase().email().max(255) }).safeParse(body());
      if (!parsed.success) return fail('VALIDATION_ERROR', 'Enter a valid email', 400);
      const user = await db.orm.public.User.where({ email: parsed.data.email }).first();
      if (user) {
        const token = await issueUserToken(user.id, 'reset_password');
        await sendPasswordResetEmail({
          to: user.email,
          token,
          name: user.name ?? undefined,
        }).catch((err) => {
          log.warn('auth.forgot-password.email_failed', { error: err instanceof Error ? err.message : 'unknown' });
          return { success: false };
        });
      }
      return json({ ok: true, message: 'If an account exists for that email, a reset link is on its way.' });
    }
    if ((path === '/api/auth/reset-password' || path === '/auth/reset-password') && method === 'POST') {
      const parsed = z.object({ token: z.string().min(10).max(200), password: z.string().min(8).max(200) }).safeParse(body());
      if (!parsed.success) return fail('VALIDATION_ERROR', 'Password must be at least 8 characters', 400, parsed.error.flatten());
      const row = await consumeUserToken(parsed.data.token, 'reset_password');
      if (!row) return fail('INVALID_TOKEN', 'This reset link is invalid or has expired', 400);
      await db.orm.public.User.where({ id: row.userId }).update({ passwordHash: await hashPassword(parsed.data.password), emailVerifiedAt: new Date().toISOString() });
      await db.orm.public.Session.where((s) => and(s.userId.eq(row.userId), s.revokedAt.isNull())).updateAll({ revokedAt: new Date().toISOString() });
      return json({ ok: true });
    }
  } catch (error) {
    if (isAlertProcessingError(error)) return fail(error.code, error.message, error.status);
    log.error('public.unhandled', { path, error: error instanceof Error ? error.message : 'unknown' });
    return fail('INTERNAL', 'Internal server error', 500);
  }
  return null;
}
