import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { db } from '../../../prisma/db.js';
import { decryptSecret, encryptSecret, randomToken, sha256 } from '../../../lib/crypto.js';
import { badRequest, conflict, intParam, notFound, ok, pageParams, parseBody, type RouteContext } from '../../../lib/http.js';
import { assertSafeUrl, UnsafeTargetError } from '../../../lib/safe-http.js';
import { attemptDelivery, WEBHOOK_EVENTS } from '../../integrations/webhooks.js';
import { canAssignRole, ROLES, type Role } from '../../org/permissions.js';
import { githubAuthorizeUrl, githubConfigured, listRepoActivity } from '../../integrations/github.js';

const endpointSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    url: z.string().url().max(2000),
    events: z.array(z.enum([...WEBHOOK_EVENTS, '*'] as [string, ...string[]])).min(1).max(20),
    enabled: z.boolean().default(true),
  })
  .strict();

function safeUrl(url: string) {
  try {
    const u = assertSafeUrl(url);
    if (process.env.NODE_ENV === 'production' && u.protocol !== 'https:') throw new UnsafeTargetError('Webhook endpoints must use HTTPS');
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : 'Invalid URL');
  }
}

const shapeEndpoint = (e: { secretEncrypted: string } & Record<string, unknown>) => {
  const { secretEncrypted: _s, ...rest } = e;
  return rest;
};

export async function integrationRoutes(ctx: RouteContext): Promise<Response | null> {
  const { segments: seg, method, auth, searchParams } = ctx;
  const companyId = auth.companyId;

  // ================= Outgoing webhooks =================
  if (seg[0] === 'webhook-endpoints') {
    ctx.need('integrations:manage');
    if (seg.length === 1 && method === 'GET') {
      const rows = await db.orm.public.WebhookEndpoint.where({ companyId }).orderBy((e) => e.createdAt.desc()).all();
      return ok({ endpoints: rows.map(shapeEndpoint), events: WEBHOOK_EVENTS });
    }
    if (seg.length === 1 && method === 'POST') {
      const body = await parseBody(ctx, endpointSchema);
      safeUrl(body.url);
      const secret = randomToken('whsec_', 24);
      const row = await db.orm.public.WebhookEndpoint.create({ companyId, name: body.name, url: body.url, events: body.events as never, enabled: body.enabled, secretEncrypted: encryptSecret(secret), secretPrefix: secret.slice(0, 10), createdById: auth.userId });
      // The signing secret is shown exactly once.
      return ok({ endpoint: shapeEndpoint(row), secret }, 201);
    }
    const id = intParam(seg[1], 'Webhook endpoint');
    const endpoint = await db.orm.public.WebhookEndpoint.where({ id, companyId }).first();
    if (!endpoint) throw notFound('Webhook endpoint');
    if (seg.length === 2 && method === 'PATCH') {
      const body = await parseBody(ctx, endpointSchema.partial());
      if (body.url) safeUrl(body.url);
      return ok({ endpoint: shapeEndpoint((await db.orm.public.WebhookEndpoint.where({ id }).update(body as never))!) });
    }
    if (seg.length === 2 && method === 'DELETE') {
      await db.orm.public.WebhookEndpoint.where({ id }).delete();
      return ok();
    }
    if (seg[2] === 'rotate-secret' && method === 'POST') {
      const secret = randomToken('whsec_', 24);
      await db.orm.public.WebhookEndpoint.where({ id }).update({ secretEncrypted: encryptSecret(secret), secretPrefix: secret.slice(0, 10) });
      return ok({ secret });
    }
    if (seg[2] === 'test' && method === 'POST') {
      const { emitEvent } = await import('../../integrations/webhooks.js');
      await db.orm.public.WebhookDelivery.create({ companyId, endpointId: id, event: 'ping', eventId: `ping-${randomBytes(8).toString('hex')}`, payload: { event: 'ping', data: { message: 'ResolveX test delivery' }, createdAt: new Date().toISOString() } as never, status: 'pending', nextAttemptAt: new Date().toISOString() });
      void emitEvent;
      return ok({ queued: true });
    }
    if (seg[2] === 'deliveries' && method === 'GET') {
      const { limit, offset } = pageParams(searchParams, 50, 200);
      const rows = await db.orm.public.WebhookDelivery.where({ endpointId: id }).orderBy((d) => d.createdAt.desc()).offset(offset).limit(limit).all();
      return ok({ deliveries: rows });
    }
    if (seg[2] === 'deliveries' && seg[3] && seg[4] === 'retry' && method === 'POST') {
      const deliveryId = intParam(seg[3], 'Delivery');
      const d = await db.orm.public.WebhookDelivery.where({ id: deliveryId, endpointId: id }).first();
      if (!d) throw notFound('Delivery');
      await db.orm.public.WebhookDelivery.where({ id: deliveryId }).update({ status: 'pending', nextAttemptAt: new Date().toISOString() });
      await attemptDelivery(deliveryId);
      return ok({ delivery: await db.orm.public.WebhookDelivery.where({ id: deliveryId }).first() });
    }
  }

  // ================= API keys =================
  if (seg[0] === 'api-keys') {
    ctx.need('integrations:manage');
    if (seg.length === 1 && method === 'GET') {
      const rows = await db.orm.public.ApiKey.select('id', 'name', 'keyPrefix', 'role', 'userId', 'lastUsedAt', 'expiresAt', 'revokedAt', 'createdAt').where({ companyId }).orderBy((k) => k.createdAt.desc()).all();
      return ok({ apiKeys: rows });
    }
    if (seg.length === 1 && method === 'POST') {
      const body = await parseBody(ctx, z.object({ name: z.string().trim().min(1).max(100), role: z.enum(ROLES as unknown as [Role, ...Role[]]).default('viewer'), expiresInDays: z.number().int().min(1).max(730).nullable().optional() }).strict());
      if (body.role === 'owner' || !canAssignRole(ctx.role, body.role)) throw badRequest('You cannot create a key with that role');
      const key = randomToken('rxk_', 30);
      const row = await db.orm.public.ApiKey.create({ companyId, organizationId: auth.orgId, userId: auth.userId, name: body.name, keyPrefix: key.slice(0, 12), keyHash: sha256(key), role: body.role, expiresAt: body.expiresInDays ? new Date(Date.now() + body.expiresInDays * 86_400_000).toISOString() : null });
      return ok({ apiKey: { id: row.id, name: row.name, keyPrefix: row.keyPrefix, role: row.role }, key }, 201);
    }
    if (seg[1] && method === 'DELETE') {
      const id = intParam(seg[1], 'API key');
      const row = await db.orm.public.ApiKey.where({ id, companyId }).update({ revokedAt: new Date().toISOString() });
      if (!row) throw notFound('API key');
      return ok();
    }
  }

  // ================= GitHub =================
  if (seg[0] === 'integrations' && seg[1] === 'github') {
    if (method === 'GET') ctx.need('services:read');
    else ctx.need('integrations:manage');
    const sub = seg[2];
    if (!sub && method === 'GET') {
      const conn = await db.orm.public.GitHubConnection.where({ companyId }).first();
      const repos = await db.orm.public.RepositoryLink.select('id', 'fullName', 'projectId', 'serviceId', 'defaultBranch', 'createdAt').where({ companyId }).all();
      return ok({ configured: githubConfigured(), connection: conn ? { accountLogin: conn.accountLogin, scopes: conn.scopes, createdAt: conn.createdAt } : null, repositories: repos, webhookUrl: `${(process.env.PUBLIC_API_URL || process.env.APP_URL || '').replace(/\/$/, '')}/api/webhooks/github` });
    }
    if (sub === 'connect' && method === 'POST') {
      if (!githubConfigured()) throw badRequest('GitHub OAuth is not configured on this server (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET)');
      return ok({ url: githubAuthorizeUrl(companyId, auth.userId) });
    }
    if (sub === 'connection' && method === 'DELETE') {
      await db.orm.public.GitHubConnection.where({ companyId }).delete();
      return ok();
    }
    if (sub === 'repositories' && method === 'POST' && seg.length === 3) {
      const body = await parseBody(ctx, z.object({ fullName: z.string().regex(/^[\w.-]+\/[\w.-]+$/), projectId: z.string().uuid().nullable().optional(), serviceId: z.number().int().positive().nullable().optional() }).strict());
      const clash = await db.orm.public.RepositoryLink.where({ companyId, fullName: body.fullName }).first();
      if (clash) throw conflict('This repository is already linked');
      if (body.serviceId) {
        const s = await db.orm.public.Service.where({ id: body.serviceId, companyId }).first();
        if (!s) throw notFound('Service');
      }
      const secret = randomToken('', 24);
      const row = await db.orm.public.RepositoryLink.create({ companyId, fullName: body.fullName, projectId: body.projectId ?? null, serviceId: body.serviceId ?? null, webhookSecretEncrypted: encryptSecret(secret) });
      // Shown once: paste into the repository's webhook settings (content type JSON).
      return ok({ repository: { id: row.id, fullName: row.fullName }, webhookSecret: secret }, 201);
    }
    if (sub === 'repositories' && seg[3]) {
      const id = intParam(seg[3], 'Repository');
      const repo = await db.orm.public.RepositoryLink.where({ id, companyId }).first();
      if (!repo) throw notFound('Repository');
      if (method === 'DELETE') {
        await db.orm.public.RepositoryLink.where({ id }).delete();
        return ok();
      }
      if (method === 'PATCH') {
        const body = await parseBody(ctx, z.object({ projectId: z.string().uuid().nullable().optional(), serviceId: z.number().int().positive().nullable().optional() }).strict());
        return ok({ repository: await db.orm.public.RepositoryLink.where({ id }).update(body as never) });
      }
      if (seg[4] === 'activity' && method === 'GET') {
        const conn = await db.orm.public.GitHubConnection.where({ companyId }).first();
        const stored = await db.orm.public.GitHubEvent.where({ companyId, repository: repo.fullName }).orderBy((e) => e.occurredAt.desc()).limit(30).all();
        let live = null;
        if (conn) {
          try {
            live = await listRepoActivity(decryptSecret(conn.accessTokenEncrypted), repo.fullName);
          } catch (error) {
            live = { error: error instanceof Error ? error.message : 'GitHub request failed' };
          }
        }
        return ok({ events: stored, live });
      }
    }
    if (sub === 'events' && method === 'GET') {
      const ref = searchParams.get('taskRef');
      const rows = await db.orm.public.GitHubEvent.where({ companyId }).orderBy((e) => e.occurredAt.desc()).limit(ref ? 500 : 50).all();
      const filtered = ref ? rows.filter((e) => Array.isArray(e.taskRefs) && (e.taskRefs as string[]).includes(ref.toUpperCase())) : rows;
      return ok({ events: filtered.slice(0, 50) });
    }
  }
  return null;
}
