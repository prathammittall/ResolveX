import { z } from 'zod';
import { MAX_ALERT_MESSAGE_LENGTH } from './constants.js';
import type { AlertWebhookPayload } from './types.js';
import { AlertProcessingError } from './errors.js';

const isoTimestamptz = z
  .string()
  .trim()
  .refine((value) => {
    // Accept Instant-style ISO 8601 with timezone (Z or ±offset).
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      return false;
    }
    return /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  }, 'occurredAt must be a valid ISO-8601 timestamp with timezone');

export const alertWebhookPayloadSchema = z
  .object({
    eventId: z.string().trim().min(1).max(256),
    serviceId: z.number().int().positive(),
    severity: z.enum(['sev1', 'sev2', 'sev3', 'sev4']),
    message: z.string().trim().min(1).max(MAX_ALERT_MESSAGE_LENGTH),
    eventType: z.enum(['firing', 'recovery']),
    occurredAt: isoTimestamptz.optional(),
  })
  .strict();

export function parseAlertWebhookPayload(body: unknown): AlertWebhookPayload {
  const result = alertWebhookPayloadSchema.safeParse(body);
  if (!result.success) {
    throw new AlertProcessingError(
      'VALIDATION_ERROR',
      'Invalid alert webhook payload',
      400,
      result.error.flatten(),
    );
  }
  return result.data;
}

export function parseJsonBody(rawBody: string): unknown {
  if (rawBody.length > 64_000) {
    throw new AlertProcessingError('VALIDATION_ERROR', 'Request body is too large', 413);
  }
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new AlertProcessingError('VALIDATION_ERROR', 'Request body must be valid JSON', 400);
  }
}
