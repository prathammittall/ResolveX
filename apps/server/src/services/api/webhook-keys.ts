import { z } from 'zod';
import { db } from '../../prisma/db.js';
import {
  createWebhookKey,
  listWebhookKeys,
  revokeWebhookKey,
} from '../incident-engine/webhook-keys.js';
import { badRequestResponse, notFoundResponse, serverErrorResponse } from './auth.js';

const createKeySchema = z.object({ name: z.string().trim().min(1).max(100) }).strict();

async function serviceInCompany(companyId: number, serviceId: number): Promise<boolean> {
  const service = await db.orm.public.Service.where({ id: serviceId }).first();
  return !!service && service.companyId === companyId;
}

/** GET /api/services/:id/webhook-keys — never includes the token or its hash. */
export async function listServiceWebhookKeys(companyId: number, serviceId: number): Promise<Response> {
  try {
    if (!(await serviceInCompany(companyId, serviceId))) return notFoundResponse('Service not found');
    return Response.json({ ok: true, keys: await listWebhookKeys(db, { companyId, serviceId }) });
  } catch (err) {
    console.error('[api/webhook-keys] list error:', err instanceof Error ? err.message : 'unknown');
    return serverErrorResponse();
  }
}

/** POST /api/services/:id/webhook-keys — the plaintext token is returned once, here, and never again. */
export async function createServiceWebhookKey(
  companyId: number,
  serviceId: number,
  userId: number,
  body: unknown,
): Promise<Response> {
  const parsed = createKeySchema.safeParse(body);
  if (!parsed.success) return badRequestResponse('Invalid request', parsed.error.flatten());
  try {
    const created = await createWebhookKey(db, { companyId, serviceId, name: parsed.data.name, createdById: userId });
    if (!created) return notFoundResponse('Service not found');
    return Response.json({ ok: true, key: created.key, token: created.token }, { status: 201 });
  } catch (err) {
    console.error('[api/webhook-keys] create error:', err instanceof Error ? err.message : 'unknown');
    return serverErrorResponse();
  }
}

/** DELETE /api/services/:id/webhook-keys/:keyId — revokes (soft); the row is kept for audit. */
export async function revokeServiceWebhookKey(
  companyId: number,
  serviceId: number,
  keyId: number,
): Promise<Response> {
  try {
    const ok = await revokeWebhookKey(db, { companyId, serviceId, keyId });
    return ok ? Response.json({ ok: true }) : notFoundResponse('Webhook key not found');
  } catch (err) {
    console.error('[api/webhook-keys] revoke error:', err instanceof Error ? err.message : 'unknown');
    return serverErrorResponse();
  }
}
