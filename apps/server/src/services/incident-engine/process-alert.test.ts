import { randomUUID } from 'node:crypto';
import nodeProcess from 'node:process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '../../prisma/db.js';
import { ALERT_WEBHOOK_PROVIDER } from './constants.js';
import { AlertProcessingError } from './errors.js';
import { processAlertWebhook } from './process-alert.js';
import { createWebhookKey, hashWebhookToken, revokeWebhookKey } from './webhook-keys.js';

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

const tokens = new Map<number, string>();

/** One real per-service key per test service, created through the production code path. */
async function tokenFor(serviceId: number): Promise<string> {
  let token = tokens.get(serviceId);
  if (!token) {
    const created = await createWebhookKey(db, { companyId: fixture.companyId, serviceId, name: 'test key' });
    if (!created) throw new Error('could not create webhook key for test service');
    token = created.token;
    tokens.set(serviceId, token);
  }
  return token;
}

async function authorize(serviceId: number) {
  return { authorization: `Bearer ${await tokenFor(serviceId)}` };
}

async function process(body: Record<string, unknown>) {
  const rawBody = JSON.stringify(body);
  return processAlertWebhook({
    rawBody,
    headers: await authorize(body.serviceId as number),
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

  it('creates escalation state and an initial notification job for a matching policy', async () => {
    const suffix = randomUUID().slice(0, 8);
    const service = await db.orm.public.Service.create({
      companyId: fixture.companyId,
      name: `policy-${suffix}`,
      serviceType: 'api',
      environment: 'production',
      criticality: 'critical',
      healthStatus: 'unknown',
    });
    const policy = await db.orm.public.EscalationPolicy.create({
      companyId: fixture.companyId,
      serviceId: service.id,
      name: `policy-${suffix}`,
      enabled: true,
    });
    await db.orm.public.EscalationStep.create({
      policyId: policy.id,
      position: 0,
      delaySeconds: 300,
      targetType: 'team',
      targetId: 'primary-on-call',
      notificationChannels: ['in_app', 'email'],
      acknowledgmentRequired: true,
    });

    const result = await process(
      buildBody({
        serviceId: service.id,
        message: 'Policy-backed outage',
      }),
    );

    const incident = await db.orm.public.Incident.where({ id: result.incidentId! }).first();
    const escalation = await db.orm.public.IncidentEscalation.where({ incidentId: result.incidentId! }).first();
    const jobs = await db.orm.public.QueueJob.where({ incidentId: result.incidentId! }).all();

    expect(incident?.escalationPolicyId).toBe(policy.id);
    expect(incident?.escalationStatus).toBe('active');
    expect(escalation?.currentStep).toBe(0);
    expect(escalation?.status).toBe('active');
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.type).toBe('notify');
    expect(jobs[0]?.status).toBe('pending');
  });

  it('suppresses escalation jobs during an active maintenance window', async () => {
    const suffix = randomUUID().slice(0, 8);
    const service = await db.orm.public.Service.create({
      companyId: fixture.companyId,
      name: `maintenance-${suffix}`,
      serviceType: 'api',
      environment: 'production',
      criticality: 'critical',
      healthStatus: 'unknown',
    });
    const policy = await db.orm.public.EscalationPolicy.create({
      companyId: fixture.companyId,
      serviceId: service.id,
      name: `maintenance-policy-${suffix}`,
      enabled: true,
    });
    await db.orm.public.EscalationStep.create({
      policyId: policy.id,
      position: 0,
      delaySeconds: 300,
      targetType: 'team',
      targetId: 'primary-on-call',
      notificationChannels: ['sms'],
      acknowledgmentRequired: true,
    });
    const now = new Date();
    await db.orm.public.MaintenanceWindow.create({
      companyId: fixture.companyId,
      serviceId: service.id,
      name: `Deploy ${suffix}`,
      startsAt: new Date(now.getTime() - 60_000).toISOString(),
      endsAt: new Date(now.getTime() + 3_600_000).toISOString(),
      timezone: 'UTC',
      enabled: true,
    });

    const result = await process(
      buildBody({
        serviceId: service.id,
        message: 'Maintenance-period alert',
      }),
    );

    const escalation = await db.orm.public.IncidentEscalation.where({ incidentId: result.incidentId! }).first();
    const jobs = await db.orm.public.QueueJob.where({ incidentId: result.incidentId! }).all();
    const events = await db.orm.public.IncidentEvent.where({ incidentId: result.incidentId! }).all();

    expect(escalation).toBeNull();
    expect(jobs).toHaveLength(0);
    expect(events.some((event) => event.message.includes('suppressed by maintenance window'))).toBe(true);
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
        headers: { authorization: 'Bearer rxwh_wrong-secret' },
        db,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });

    await expect(
      processAlertWebhook({ rawBody, headers: { authorization: null }, db }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
  });

  it('rejects a service the key is not valid for, whether it exists or not (no probing)', async () => {
    const keyForA = await authorize(fixture.serviceAId);
    for (const serviceId of [fixture.serviceBId, 2_147_483_646]) {
      await expect(
        processAlertWebhook({
          rawBody: JSON.stringify(buildBody({ serviceId })),
          headers: keyForA,
          db,
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    }
  });

  it('stores only a hash of the key, never the token', async () => {
    const token = await tokenFor(fixture.serviceAId);
    const row = await db.orm.public.WebhookKey.where({ keyHash: hashWebhookToken(token) }).first();
    expect(row?.serviceId).toBe(fixture.serviceAId);
    expect(JSON.stringify(row)).not.toContain(token);
  });

  it('rejects a revoked key immediately', async () => {
    const suffix = randomUUID().slice(0, 8);
    const service = await db.orm.public.Service.create({
      companyId: fixture.companyId,
      name: `revoke-${suffix}`,
      serviceType: 'api',
      environment: 'production',
      criticality: 'low',
      healthStatus: 'unknown',
    });
    const created = await createWebhookKey(db, {
      companyId: fixture.companyId,
      serviceId: service.id,
      name: 'to revoke',
    });
    const send = () =>
      processAlertWebhook({
        rawBody: JSON.stringify(buildBody({ serviceId: service.id })),
        headers: { authorization: `Bearer ${created!.token}` },
        db,
      });

    expect((await send()).ok).toBe(true);
    expect(
      await revokeWebhookKey(db, { companyId: fixture.companyId, serviceId: service.id, keyId: created!.key.id }),
    ).toBe(true);
    await expect(send()).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
  });

  it("another company cannot create or revoke a key for this company's service", async () => {
    expect(await createWebhookKey(db, { companyId: -1, serviceId: fixture.serviceAId, name: 'x' })).toBeNull();
    const created = await createWebhookKey(db, { companyId: fixture.companyId, serviceId: fixture.serviceAId, name: 'y' });
    expect(
      await revokeWebhookKey(db, { companyId: -1, serviceId: fixture.serviceAId, keyId: created!.key.id }),
    ).toBe(false);
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
        headers: await authorize(fixture.serviceAId),
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
