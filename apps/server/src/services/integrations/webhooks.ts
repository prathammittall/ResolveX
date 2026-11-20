import { randomUUID } from 'node:crypto';
import { and } from '@prisma/orm-postgres/orm-client';
import { db } from '../../prisma/db.js';
import { decryptSecret, hmacSha256Hex } from '../../lib/crypto.js';
import { log } from '../../lib/logger.js';
import { safeRequest } from '../../lib/safe-http.js';

/** Events customers can subscribe an outgoing webhook endpoint to. */
export const WEBHOOK_EVENTS = [
  'incident.created',
  'incident.acknowledged',
  'incident.status_changed',
  'incident.resolved',
  'service.health_changed',
  'deployment.created',
  'task.created',
  'task.updated',
  'postmortem.published',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/**
 * Fan an event out to every enabled endpoint of the company subscribed to it. Delivery happens in the
 * worker; the (endpointId, eventId) unique key makes emitting idempotent.
 */
export async function emitEvent(companyId: number, event: WebhookEvent, data: Record<string, unknown>, eventId = randomUUID()): Promise<void> {
  try {
    const endpoints = await db.orm.public.WebhookEndpoint.where({ companyId, enabled: true }).all();
    for (const endpoint of endpoints) {
      const events = Array.isArray(endpoint.events) ? (endpoint.events as string[]) : [];
      if (!events.includes(event) && !events.includes('*')) continue;
      try {
        await db.orm.public.WebhookDelivery.create({
          companyId,
          endpointId: endpoint.id,
          event,
          eventId,
          payload: { id: eventId, event, createdAt: new Date().toISOString(), data } as never,
          status: 'pending',
          nextAttemptAt: new Date().toISOString(),
        });
      } catch {
        // Duplicate (endpointId, eventId): already queued.
      }
    }
  } catch (error) {
    log.error('webhooks.emit_failed', { event, error: error instanceof Error ? error.message : 'unknown' });
  }
}

const MAX_ATTEMPTS = 8;

/** Sign and send one delivery. Exposed for manual "retry now" from the UI. */
export async function attemptDelivery(deliveryId: number): Promise<void> {
  const delivery = await db.orm.public.WebhookDelivery.where({ id: deliveryId }).first();
  if (!delivery) return;
  const endpoint = await db.orm.public.WebhookEndpoint.where({ id: delivery.endpointId }).first();
  const attempts = delivery.attempts + 1;
  if (!endpoint) {
    await db.orm.public.WebhookDelivery.where({ id: delivery.id }).update({ status: 'failed', attempts, error: 'Endpoint deleted', nextAttemptAt: null });
    return;
  }
  const body = JSON.stringify(delivery.payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  try {
    const secret = decryptSecret(endpoint.secretEncrypted);
    const signature = hmacSha256Hex(secret, `${timestamp}.${body}`);
    const res = await safeRequest({
      url: endpoint.url,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-resolvex-event': delivery.event,
        'x-resolvex-delivery': delivery.eventId,
        'x-resolvex-timestamp': timestamp,
        'x-resolvex-signature': `t=${timestamp},v1=${signature}`,
      },
      body,
      timeoutMs: 10_000,
      maxBodyBytes: 8 * 1024,
      maxRedirects: 0,
    });
    const success = res.status >= 200 && res.status < 300;
    const final = !success && attempts >= MAX_ATTEMPTS;
    await db.orm.public.WebhookDelivery.where({ id: delivery.id }).update({
      status: success ? 'delivered' : final ? 'failed' : 'pending',
      attempts,
      responseStatus: res.status,
      responseSnippet: res.body.slice(0, 1000),
      error: success ? null : `HTTP ${res.status}`,
      deliveredAt: success ? new Date().toISOString() : null,
      nextAttemptAt: success || final ? null : new Date(Date.now() + Math.min(2 ** attempts * 15_000, 6 * 3_600_000)).toISOString(),
    });
  } catch (error) {
    const final = attempts >= MAX_ATTEMPTS;
    await db.orm.public.WebhookDelivery.where({ id: delivery.id }).update({
      status: final ? 'failed' : 'pending',
      attempts,
      error: (error instanceof Error ? error.message : 'unknown').slice(0, 500),
      nextAttemptAt: final ? null : new Date(Date.now() + Math.min(2 ** attempts * 15_000, 6 * 3_600_000)).toISOString(),
    });
  }
}

/** Worker step: deliver due webhooks. */
export async function deliverPendingWebhooks(batch = 20): Promise<number> {
  const now = new Date().toISOString();
  const due = await db.orm.public.WebhookDelivery.where((d) => and(d.status.eq('pending'), d.nextAttemptAt.lte(now)))
    .orderBy((d) => d.nextAttemptAt.asc())
    .limit(batch)
    .all();
  for (const d of due) {
    const claimed = await db.orm.public.WebhookDelivery.where((x) => and(x.id.eq(d.id), x.status.eq('pending'), x.nextAttemptAt.lte(now))).update({
      nextAttemptAt: new Date(Date.now() + 120_000).toISOString(),
    });
    if (claimed) await attemptDelivery(d.id);
  }
  return due.length;
}
