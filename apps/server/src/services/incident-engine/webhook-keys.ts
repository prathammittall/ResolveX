import { createHash, randomBytes } from 'node:crypto';
import { db as defaultDb } from '../../prisma/db.js';
import { AlertProcessingError } from './errors.js';

type DbClient = typeof defaultDb;

const TOKEN_PREFIX = 'rxwh_';
/** Do not write `lastUsedAt` on every alert; once a minute is plenty for "is this key still used". */
const LAST_USED_GRANULARITY_MS = 60_000;

export type WebhookKeyView = {
  id: number;
  serviceId: number;
  name: string;
  /** Non-secret identifier shown in the UI so keys can be told apart. */
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export function hashWebhookToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toView(row: {
  id: number;
  serviceId: number;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}): WebhookKeyView {
  return {
    id: row.id,
    serviceId: row.serviceId,
    name: row.name,
    keyPrefix: row.keyPrefix,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}

/**
 * Create a key scoped to one service of one company. The plaintext token is returned exactly once
 * and is never stored; only its SHA-256 hash is. Returns null if the service is not in the company.
 */
export async function createWebhookKey(
  client: DbClient,
  args: { companyId: number; serviceId: number; name: string; createdById?: number | null },
): Promise<{ key: WebhookKeyView; token: string } | null> {
  const service = await client.orm.public.Service.where({ id: args.serviceId }).first();
  if (!service || service.companyId !== args.companyId) return null;

  const token = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
  const row = await client.orm.public.WebhookKey.create({
    companyId: args.companyId,
    serviceId: args.serviceId,
    name: args.name,
    keyPrefix: token.slice(0, TOKEN_PREFIX.length + 6),
    keyHash: hashWebhookToken(token),
    createdById: args.createdById ?? null,
  });
  return { key: toView(row), token };
}

export async function listWebhookKeys(
  client: DbClient,
  args: { companyId: number; serviceId: number },
): Promise<WebhookKeyView[]> {
  const rows = await client.orm.public.WebhookKey.where({
    companyId: args.companyId,
    serviceId: args.serviceId,
  }).all();
  return rows.map(toView).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Revoke a key. Returns false when it does not exist in this company (no cross-tenant probing). */
export async function revokeWebhookKey(
  client: DbClient,
  args: { companyId: number; serviceId: number; keyId: number },
): Promise<boolean> {
  const row = await client.orm.public.WebhookKey.where({ id: args.keyId }).first();
  if (!row || row.companyId !== args.companyId || row.serviceId !== args.serviceId) return false;
  if (!row.revokedAt) {
    await client.orm.public.WebhookKey.where({ id: args.keyId }).update({
      revokedAt: new Date().toISOString(),
    });
  }
  return true;
}

export type AuthenticatedWebhookKey = { id: number; companyId: number; serviceId: number };

/** Resolve `Authorization: Bearer <token>` to an active key, or throw 401. */
export async function authenticateWebhookKey(
  client: DbClient,
  authorization: string | null | undefined,
): Promise<AuthenticatedWebhookKey> {
  const match = authorization ? /^Bearer\s+(\S+)$/i.exec(authorization.trim()) : null;
  const token = match?.[1];
  const unauthorized = () => new AlertProcessingError('UNAUTHORIZED', 'Invalid webhook credentials', 401);
  if (!token || !token.startsWith(TOKEN_PREFIX) || token.length > 200) throw unauthorized();

  // Lookup is by hash of a 256-bit random token, so there is no timing channel worth defending.
  const key = await client.orm.public.WebhookKey.where({ keyHash: hashWebhookToken(token) }).first();
  if (!key || key.revokedAt) throw unauthorized();

  const lastUsed = key.lastUsedAt ? Date.parse(key.lastUsedAt) : 0;
  if (Date.now() - lastUsed > LAST_USED_GRANULARITY_MS) {
    await client.orm.public.WebhookKey.where({ id: key.id }).update({ lastUsedAt: new Date().toISOString() });
  }
  return { id: key.id, companyId: key.companyId, serviceId: key.serviceId };
}
