import { createHmac, timingSafeEqual } from 'node:crypto';
import nodeProcess from 'node:process';
import { AlertProcessingError } from './errors.js';

export type WebhookAuthHeaders = {
  authorization?: string | null;
  signature?: string | null;
};

/**
 * Auth boundary for v1 (login/per-tenant secrets not available yet):
 * - Require `ALERT_WEBHOOK_SECRET` in the environment (never log this value).
 * - Accept either:
 *   1) `Authorization: Bearer <ALERT_WEBHOOK_SECRET>`
 *   2) `X-Webhook-Signature: sha256=<hmac-sha256-hex of raw body>`
 *
 * Ownership: companyId is NEVER taken from the request body. After auth,
 * the engine loads Service by serviceId and uses Service.companyId only.
 *
 * Limitation: a single shared secret authorizes alerts for every service.
 * Later phases should replace this with per-company/per-service hashed secrets.
 */
export function assertWebhookAuthorized(
  headers: WebhookAuthHeaders,
  rawBody: string,
  webhookSecret = nodeProcess.env.ALERT_WEBHOOK_SECRET,
): void {
  if (!webhookSecret || webhookSecret.trim().length === 0) {
    throw new AlertProcessingError(
      'MISCONFIGURED',
      'Alert webhook is not configured',
      503,
    );
  }

  const bearerOk = verifyBearer(headers.authorization, webhookSecret);
  const signatureOk = verifySignature(headers.signature, rawBody, webhookSecret);

  if (!bearerOk && !signatureOk) {
    throw new AlertProcessingError('UNAUTHORIZED', 'Invalid webhook credentials', 401);
  }
}

function verifyBearer(authorization: string | null | undefined, secret: string): boolean {
  if (!authorization) {
    return false;
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  if (!match?.[1]) {
    return false;
  }
  return timingSafeEqualStrings(match[1], secret);
}

function verifySignature(
  signatureHeader: string | null | undefined,
  rawBody: string,
  secret: string,
): boolean {
  if (!signatureHeader) {
    return false;
  }
  const match = /^sha256=([a-fA-F0-9]{64})$/.exec(signatureHeader.trim());
  if (!match?.[1]) {
    return false;
  }
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  return timingSafeEqualStrings(match[1].toLowerCase(), expected.toLowerCase());
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
