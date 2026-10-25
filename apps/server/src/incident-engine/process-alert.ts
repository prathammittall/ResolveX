import { and } from '@prisma/orm-postgres/orm-client';
import { db as defaultDb } from '../prisma/db.js';
import { assertWebhookAuthorized, type WebhookAuthHeaders } from './auth.js';
import {
  ALERT_WEBHOOK_PROVIDER,
  AUTO_RESOLVE_ON_RECOVERY,
} from './constants.js';
import { AlertProcessingError, isUniqueViolation } from './errors.js';
import type { AlertProcessResult, AlertWebhookPayload, IncidentSeverityValue } from './types.js';
import { parseAlertWebhookPayload, parseJsonBody } from './validation.js';

type DbClient = typeof defaultDb;

export type ProcessAlertInput = {
  rawBody: string;
  headers: WebhookAuthHeaders;
  /** Override for tests; defaults to process.env.ALERT_WEBHOOK_SECRET */
  webhookSecret?: string;
  /** Override for tests */
  db?: DbClient;
};

/**
 * Ingest a monitoring alert:
 * 1) Verify webhook secret/signature (never logs secrets).
 * 2) Validate payload with Zod.
 * 3) Claim AlertEvent via unique (serviceId, provider, providerEventId).
 * 4) Group firing alerts by unresolved incident for the same service.
 * 5) Recovery updates health + timeline; does not auto-resolve incidents.
 *
 * Service health = monitoring signal.
 * Incident.status = responder workflow (manual resolve unless policy says otherwise).
 */
export async function processAlertWebhook(input: ProcessAlertInput): Promise<AlertProcessResult> {
  const client = input.db ?? defaultDb;

  assertWebhookAuthorized(input.headers, input.rawBody, input.webhookSecret);

  const json = parseJsonBody(input.rawBody);
  const payload = parseAlertWebhookPayload(json);

  // Reject untrusted companyId if a client mistakenly sends one.
  if (json && typeof json === 'object' && 'companyId' in (json as object)) {
    throw new AlertProcessingError(
      'VALIDATION_ERROR',
      'companyId must not be supplied in the webhook body',
      400,
    );
  }

  const service = await client.orm.public.Service.where({ id: payload.serviceId }).first();
  if (!service) {
    throw new AlertProcessingError('SERVICE_NOT_FOUND', 'Service not found', 404);
  }

  const claimed = await claimAlertEvent(client, payload);
  if (claimed.duplicate && claimed.alert.processingStatus === 'processed') {
    return {
      ok: true,
      duplicate: true,
      outcome: 'already_processed',
      alertEventId: claimed.alert.id,
      incidentId: claimed.alert.incidentId,
      serviceId: service.id,
      companyId: service.companyId,
    };
  }

  return finalizeAlert(client, {
    alertId: claimed.alert.id,
    companyId: service.companyId,
    payload,
  });
}

async function claimAlertEvent(client: DbClient, payload: AlertWebhookPayload) {
  try {
    const alert = await client.orm.public.AlertEvent.create({
      serviceId: payload.serviceId,
      provider: ALERT_WEBHOOK_PROVIDER,
      providerEventId: payload.eventId,
      payload: payload as unknown as Record<string, unknown>,
      processingStatus: 'pending',
      receivedAt: new Date().toISOString(),
    });
    return { duplicate: false as const, alert };
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
    const existing = await client.orm.public.AlertEvent.where({
      serviceId: payload.serviceId,
      provider: ALERT_WEBHOOK_PROVIDER,
      providerEventId: payload.eventId,
    }).first();

    if (!existing) {
      throw new AlertProcessingError(
        'INTERNAL',
        'Duplicate alert detected but record was not found',
        500,
      );
    }
    return { duplicate: true as const, alert: existing };
  }
}

async function finalizeAlert(
  client: DbClient,
  args: { alertId: number; companyId: number; payload: AlertWebhookPayload },
): Promise<AlertProcessResult> {
  try {
    return await client.transaction(async (tx) => {
      const service = await tx.orm.public.Service.where({ id: args.payload.serviceId })
        .forNoKeyUpdate()
        .first();
      if (!service) {
        throw new AlertProcessingError('SERVICE_NOT_FOUND', 'Service not found', 404);
      }

      const alert = await tx.orm.public.AlertEvent.where({ id: args.alertId }).forUpdate().first();
      if (!alert) {
        throw new AlertProcessingError('INTERNAL', 'Alert event missing during processing', 500);
      }

      if (alert.processingStatus === 'processed') {
        return {
          ok: true as const,
          duplicate: true,
          outcome: 'already_processed' as const,
          alertEventId: alert.id,
          incidentId: alert.incidentId,
          serviceId: service.id,
          companyId: service.companyId,
        };
      }

      const occurredAt = args.payload.occurredAt ?? new Date().toISOString();

      if (args.payload.eventType === 'recovery') {
        return handleRecovery(tx, {
          alert,
          service,
          companyId: service.companyId,
          payload: args.payload,
          occurredAt,
        });
      }

      return handleFiring(tx, {
        alert,
        service,
        companyId: service.companyId,
        payload: args.payload,
        occurredAt,
      });
    });
  } catch (error) {
    if (error instanceof AlertProcessingError) {
      throw error;
    }
    // Mark failed outside the rolled-back transaction when possible.
    try {
      await client.orm.public.AlertEvent.where({ id: args.alertId }).update({
        processingStatus: 'failed',
      });
    } catch {
      // Avoid masking the original failure.
    }
    throw error;
  }
}

type Tx = Parameters<Parameters<DbClient['transaction']>[0]>[0];

async function handleFiring(
  tx: Tx,
  args: {
    alert: { id: number };
    service: { id: number; companyId: number; name: string };
    companyId: number;
    payload: AlertWebhookPayload;
    occurredAt: string;
  },
): Promise<AlertProcessResult> {
  let incident = await tx.orm.public.Incident.where((i) =>
    and(i.serviceId.eq(args.service.id), i.status.neq('resolved')),
  ).first();

  let outcome: AlertProcessResult['outcome'] = 'incident_updated';

  if (!incident) {
    try {
      incident = await tx.orm.public.Incident.create({
        companyId: args.companyId,
        serviceId: args.service.id,
        title: `${args.service.name}: ${truncate(args.payload.message, 120)}`,
        description: args.payload.message,
        severity: args.payload.severity,
        status: 'open',
        detectedAt: args.occurredAt,
      });
      outcome = 'incident_created';

      await tx.orm.public.IncidentEvent.create({
        incidentId: incident.id,
        eventType: 'created',
        message: `Incident opened from alert ${args.payload.eventId}: ${args.payload.message}`,
        occurredAt: args.occurredAt,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      // Concurrent create for the same unresolved service — attach to the winner.
      incident = await tx.orm.public.Incident.where((i) =>
        and(i.serviceId.eq(args.service.id), i.status.neq('resolved')),
      ).first();
      if (!incident) {
        throw new AlertProcessingError(
          'INTERNAL',
          'Failed to locate grouped incident after concurrent create',
          500,
        );
      }
      outcome = 'incident_updated';
      await tx.orm.public.IncidentEvent.create({
        incidentId: incident.id,
        eventType: 'system',
        message: `Additional alert ${args.payload.eventId}: ${args.payload.message}`,
        occurredAt: args.occurredAt,
      });
    }
  } else {
    // Escalate severity if the new alert is worse (sev1 is highest).
    if (severityRank(args.payload.severity) < severityRank(incident.severity as IncidentSeverityValue)) {
      await tx.orm.public.Incident.where({ id: incident.id }).update({
        severity: args.payload.severity,
      });
    }
    await tx.orm.public.IncidentEvent.create({
      incidentId: incident.id,
      eventType: 'system',
      message: `Additional alert ${args.payload.eventId}: ${args.payload.message}`,
      occurredAt: args.occurredAt,
    });
  }

  await tx.orm.public.Service.where({ id: args.service.id }).update({
    healthStatus: healthFromSeverity(args.payload.severity),
  });

  await tx.orm.public.AlertEvent.where({ id: args.alert.id }).update({
    processingStatus: 'processed',
    incidentId: incident.id,
  });

  return {
    ok: true,
    duplicate: false,
    outcome,
    alertEventId: args.alert.id,
    incidentId: incident.id,
    serviceId: args.service.id,
    companyId: args.companyId,
  };
}

async function handleRecovery(
  tx: Tx,
  args: {
    alert: { id: number };
    service: { id: number; companyId: number };
    companyId: number;
    payload: AlertWebhookPayload;
    occurredAt: string;
  },
): Promise<AlertProcessResult> {
  const incident = await tx.orm.public.Incident.where((i) =>
    and(i.serviceId.eq(args.service.id), i.status.neq('resolved')),
  ).first();

  await tx.orm.public.Service.where({ id: args.service.id }).update({
    healthStatus: 'healthy',
  });

  if (incident) {
    await tx.orm.public.IncidentEvent.create({
      incidentId: incident.id,
      eventType: 'system',
      message: `Recovery alert ${args.payload.eventId}: ${args.payload.message}`,
      occurredAt: args.occurredAt,
    });

    // Move toward mitigated when still early in the workflow, but never auto-resolve in v1.
    if (
      !AUTO_RESOLVE_ON_RECOVERY &&
      (incident.status === 'open' ||
        incident.status === 'acknowledged' ||
        incident.status === 'investigating')
    ) {
      await tx.orm.public.Incident.where({ id: incident.id }).update({
        status: 'mitigated',
      });
      await tx.orm.public.IncidentEvent.create({
        incidentId: incident.id,
        eventType: 'status_change',
        message: 'Status set to mitigated after recovery (manual resolve still required)',
        occurredAt: args.occurredAt,
      });
    }
  }

  await tx.orm.public.AlertEvent.where({ id: args.alert.id }).update({
    processingStatus: 'processed',
    incidentId: incident?.id ?? null,
  });

  return {
    ok: true,
    duplicate: false,
    outcome: 'recovery_recorded',
    alertEventId: args.alert.id,
    incidentId: incident?.id ?? null,
    serviceId: args.service.id,
    companyId: args.companyId,
  };
}

function healthFromSeverity(severity: IncidentSeverityValue): 'down' | 'degraded' {
  return severity === 'sev1' || severity === 'sev2' ? 'down' : 'degraded';
}

function severityRank(severity: IncidentSeverityValue): number {
  switch (severity) {
    case 'sev1':
      return 1;
    case 'sev2':
      return 2;
    case 'sev3':
      return 3;
    case 'sev4':
      return 4;
  }
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
