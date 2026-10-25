import { createHmac, randomUUID } from 'node:crypto';
import nodeProcess from 'node:process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '../prisma/db.js';
import { ALERT_WEBHOOK_PROVIDER } from './constants.js';
import { AlertProcessingError } from './errors.js';
import { processAlertWebhook } from './process-alert.js';

const WEBHOOK_SECRET = 'test-webhook-secret-do-not-use-in-prod';

type Fixture = {
  companyId: number;
  serviceAId: number;
  serviceBId: number;
};

let fixture: Fixture;

beforeAll(async () => {
  if (!nodeProcess.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for incident-engine tests');
  }

  const suffix = randomUUID().slice(0, 8);
  const company = await db.orm.public.Company.create({
    name: `WarRoom Test Co ${suffix}`,
  });

  const serviceA = await db.orm.public.Service.create({
    companyId: company.id,
    name: `api-a-${suffix}`,
    description: 'Test service A',
    serviceType: 'api',
    environment: 'production',
    criticality: 'high',
    healthStatus: 'unknown',
  });

  const serviceB = await db.orm.public.Service.create({
    companyId: company.id,
    name: `api-b-${suffix}`,
    description: 'Test service B',
    serviceType: 'api',
    environment: 'production',
    criticality: 'medium',
    healthStatus: 'unknown',
  });

  fixture = {
    companyId: company.id,
    serviceAId: serviceA.id,
    serviceBId: serviceB.id,
  };
});

afterAll(async () => {
  if (fixture?.companyId) {
    // Cascade removes services, incidents, alerts, events.
    await db.orm.public.Company.where({ id: fixture.companyId }).delete();
  }
  await db.close();
});

function buildBody(overrides: Record<string, unknown> = {}) {
  return {
    eventId: `evt_${randomUUID()}`,
    serviceId: fixture.serviceAId,
    severity: 'sev2',
    message: 'Latency spike above threshold',
    eventType: 'firing',
    occurredAt: new Date().toISOString(),
    ...overrides,
  };
}

function authorize(rawBody: string, mode: 'bearer' | 'signature' = 'bearer') {
  if (mode === 'bearer') {
    return {
      authorization: `Bearer ${WEBHOOK_SECRET}`,
      signature: null as string | null,
    };
  }
  const signature = `sha256=${createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex')}`;
  return { authorization: null as string | null, signature };
}

async function process(body: Record<string, unknown>, mode: 'bearer' | 'signature' = 'bearer') {
  const rawBody = JSON.stringify(body);
  return processAlertWebhook({
    rawBody,
    headers: authorize(rawBody, mode),
    webhookSecret: WEBHOOK_SECRET,
    db,
  });
}

describe('processAlertWebhook', () => {
  it('creates an incident for a valid firing alert', async () => {
    const suffix = randomUUID().slice(0, 8);
    const service = await db.orm.public.Service.create({
      companyId: fixture.companyId,
      name: `create-${suffix}`,
      serviceType: 'api',
      environment: 'production',
      criticality: 'high',
      healthStatus: 'unknown',
    });
    const body = buildBody({
      serviceId: service.id,
      message: 'Primary outage detected',
    });
    const result = await process(body);

    expect(result.ok).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result.outcome).toBe('incident_created');
    expect(result.incidentId).toBeTypeOf('number');
    expect(result.companyId).toBe(fixture.companyId);

    const incident = await db.orm.public.Incident.where({ id: result.incidentId! }).first();
    expect(incident?.status).toBe('open');
    expect(incident?.serviceId).toBe(service.id);

    const serviceRow = await db.orm.public.Service.where({ id: service.id }).first();
    expect(serviceRow?.healthStatus).toBe('down');
  });

  it('rejects an invalid payload', async () => {
    await expect(process(buildBody({ severity: 'critical' }))).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    } satisfies Partial<AlertProcessingError>);
  });

  it('rejects an unauthorized webhook', async () => {
    const rawBody = JSON.stringify(buildBody());
    await expect(
      processAlertWebhook({
        rawBody,
        headers: { authorization: 'Bearer wrong-secret', signature: null },
        webhookSecret: WEBHOOK_SECRET,
        db,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
  });

  it('rejects a nonexistent service', async () => {
    await expect(process(buildBody({ serviceId: 2_147_483_646 }))).rejects.toMatchObject({
      code: 'SERVICE_NOT_FOUND',
      status: 404,
    });
  });

  it('does not duplicate processing for repeated delivery of the same event', async () => {
    const suffix = randomUUID().slice(0, 8);
    const service = await db.orm.public.Service.create({
      companyId: fixture.companyId,
      name: `dedupe-${suffix}`,
      serviceType: 'api',
      environment: 'production',
      criticality: 'high',
      healthStatus: 'unknown',
    });
    const body = buildBody({
      serviceId: service.id,
      eventId: `dup_${suffix}`,
      message: 'Duplicate delivery check',
    });
    const first = await process(body);
    const second = await process(body);

    expect(first.outcome).toBe('incident_created');
    expect(second.duplicate).toBe(true);
    expect(second.outcome).toBe('already_processed');
    expect(second.alertEventId).toBe(first.alertEventId);
    expect(second.incidentId).toBe(first.incidentId);

    const alerts = await db.orm.public.AlertEvent.where({
      serviceId: service.id,
      provider: ALERT_WEBHOOK_PROVIDER,
      providerEventId: body.eventId as string,
    }).all();
    expect(alerts).toHaveLength(1);

    const events = await db.orm.public.IncidentEvent.where({
      incidentId: first.incidentId!,
    }).all();
    const createdEvents = events.filter((e) => e.eventType === 'created');
    expect(createdEvents).toHaveLength(1);
  });

  it('groups different alert events for the same service into one unresolved incident', async () => {
    const suffix = randomUUID().slice(0, 8);
    const service = await db.orm.public.Service.create({
      companyId: fixture.companyId,
      name: `group-${suffix}`,
      serviceType: 'api',
      environment: 'staging',
      criticality: 'high',
      healthStatus: 'unknown',
    });

    const first = await process(
      buildBody({
        serviceId: service.id,
        eventId: `g1_${suffix}`,
        message: 'First symptom',
      }),
    );
    const second = await process(
      buildBody({
        serviceId: service.id,
        eventId: `g2_${suffix}`,
        message: 'Second symptom',
        severity: 'sev1',
      }),
    );

    expect(first.outcome).toBe('incident_created');
    expect(second.outcome).toBe('incident_updated');
    expect(second.incidentId).toBe(first.incidentId);

    const openIncidents = await db.orm.public.Incident.where({
      serviceId: service.id,
      status: 'open',
    }).all();
    // After severity escalation the status remains open; only one unresolved row.
    const unresolved = await db.orm.public.Incident.where((i) => i.serviceId.eq(service.id)).all();
    const active = unresolved.filter((i) => i.status !== 'resolved');
    expect(active).toHaveLength(1);
    expect(active[0]?.severity).toBe('sev1');
    expect(openIncidents.length + active.filter((i) => i.status !== 'open').length).toBeGreaterThan(0);
  });

  it('does not group alerts for different services', async () => {
    const a = await process(
      buildBody({
        serviceId: fixture.serviceAId,
        eventId: `sep_a_${randomUUID()}`,
        message: 'Service A alert',
      }),
    );
    const b = await process(
      buildBody({
        serviceId: fixture.serviceBId,
        eventId: `sep_b_${randomUUID()}`,
        message: 'Service B alert',
      }),
    );

    expect(a.incidentId).not.toBe(b.incidentId);
    expect(a.serviceId).toBe(fixture.serviceAId);
    expect(b.serviceId).toBe(fixture.serviceBId);
  });

  it('records recovery without creating a new failure incident', async () => {
    const suffix = randomUUID().slice(0, 8);
    const service = await db.orm.public.Service.create({
      companyId: fixture.companyId,
      name: `recover-${suffix}`,
      serviceType: 'http',
      environment: 'production',
      criticality: 'critical',
      healthStatus: 'unknown',
    });

    const firing = await process(
      buildBody({
        serviceId: service.id,
        eventId: `fire_${suffix}`,
        message: 'Service down',
        severity: 'sev1',
      }),
    );

    const recovery = await process(
      buildBody({
        serviceId: service.id,
        eventId: `rec_${suffix}`,
        message: 'Service recovered',
        eventType: 'recovery',
        severity: 'sev4',
      }),
      'signature',
    );

    expect(recovery.outcome).toBe('recovery_recorded');
    expect(recovery.incidentId).toBe(firing.incidentId);

    const incidents = await db.orm.public.Incident.where({ serviceId: service.id }).all();
    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.status).toBe('mitigated');
    expect(incidents[0]?.status).not.toBe('resolved');

    const serviceRow = await db.orm.public.Service.where({ id: service.id }).first();
    expect(serviceRow?.healthStatus).toBe('healthy');
  });

  it('handles concurrent duplicate deliveries without duplicating records', async () => {
    const suffix = randomUUID().slice(0, 8);
    const service = await db.orm.public.Service.create({
      companyId: fixture.companyId,
      name: `concurrent-${suffix}`,
      serviceType: 'worker',
      environment: 'production',
      criticality: 'high',
      healthStatus: 'unknown',
    });
    const eventId = `conc_${suffix}`;
    const body = buildBody({
      serviceId: service.id,
      eventId,
      message: 'Concurrent duplicate',
    });

    const results = await Promise.all([process(body), process(body), process(body)]);
    const created = results.filter((r) => r.outcome === 'incident_created');
    const duplicates = results.filter((r) => r.outcome === 'already_processed');

    expect(created.length).toBe(1);
    expect(duplicates.length).toBe(2);
    expect(created.length + duplicates.length).toBe(3);

    const alerts = await db.orm.public.AlertEvent.where({
      serviceId: service.id,
      provider: ALERT_WEBHOOK_PROVIDER,
      providerEventId: eventId,
    }).all();
    expect(alerts).toHaveLength(1);

    const incidentIds = new Set(
      results.map((r) => r.incidentId).filter((id): id is number => id != null),
    );
    expect(incidentIds.size).toBe(1);
  });

  it('does not leave inconsistent records when processing fails mid-transaction', async () => {
    const eventId = `fail_${randomUUID()}`;
    const body = buildBody({
      serviceId: fixture.serviceAId,
      eventId,
      message: 'Failure injection',
    });

    // Claim succeeds, then force a failure by using an invalid nested update path:
    // process a recovery against a service that we delete after claim is impossible mid-flow,
    // so instead assert transactional atomicity by verifying a thrown error rolls back incident writes.
    // We simulate by passing a broken db wrapper for finalize only via unique path:
    // Create a pending alert manually, then run finalize through process with a sabotaged transaction.
    const pending = await db.orm.public.AlertEvent.create({
      serviceId: fixture.serviceAId,
      provider: ALERT_WEBHOOK_PROVIDER,
      providerEventId: eventId,
      payload: body,
      processingStatus: 'pending',
      receivedAt: new Date().toISOString(),
    });

    const sabotaged = {
      ...db,
      orm: db.orm,
      transaction: async <T>(_fn: (tx: unknown) => Promise<T>): Promise<T> => {
        throw new Error('simulated database failure');
      },
    } as unknown as typeof db;

    await expect(
      processAlertWebhook({
        rawBody: JSON.stringify(body),
        headers: authorize(JSON.stringify(body)),
        webhookSecret: WEBHOOK_SECRET,
        db: sabotaged,
      }),
    ).rejects.toThrow(/simulated database failure/);

    const alert = await db.orm.public.AlertEvent.where({ id: pending.id }).first();
    // Unique claim finds existing pending; finalize fails → marked failed, no incident link.
    expect(alert?.processingStatus).toBe('failed');
    expect(alert?.incidentId).toBeNull();

    const incidentsFromAlert = await db.orm.public.IncidentEvent.where((e) =>
      e.message.like(`%${eventId}%`),
    ).all();
    expect(incidentsFromAlert).toHaveLength(0);
  });
});
