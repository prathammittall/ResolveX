import { and } from '@prisma/orm-postgres/orm-client';
import { db } from '../../prisma/db.js';
import { withTenant } from '../../prisma/tenant.js';
import { log } from '../../lib/logger.js';
import { orgIdForCompany } from '../../lib/tenant-bridge.js';
import { companyUserIdsWithRoles, notifyUsers } from '../notify/index.js';
import { currentOnCallForTeam } from '../oncall/resolve.js';
import { emitEvent } from '../integrations/webhooks.js';
import { createTask } from '../work/tasks.js';
import { isUniqueViolation } from './errors.js';
import { initializeIncidentEscalation } from './escalation.js';
import type { IncidentSeverityValue } from './types.js';

const SEV_RANK: Record<string, number> = { sev1: 1, sev2: 2, sev3: 3, sev4: 4 };

export type OpenIncidentInput = {
  companyId: number;
  serviceId: number;
  severity: IncidentSeverityValue;
  title: string;
  description?: string | null;
  source: 'monitor' | 'webhook' | 'manual';
  occurredAt?: string;
  createdById?: number | null;
  assigneeId?: number | null;
  projectId?: string | null;
  /** Monitors may opt out of the automatic engineering task. */
  autoCreateTask?: boolean;
};

export type OpenIncidentResult = { incidentId: number; created: boolean };

/**
 * Open an incident for a service, or attach to the one already open (one unresolved incident per service,
 * enforced by a partial unique index, so concurrent detections converge on one incident).
 */
export async function openOrAttachIncident(input: OpenIncidentInput): Promise<OpenIncidentResult> {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const result = await db.transaction(async (tx) => {
    const service = await tx.orm.public.Service.where({ id: input.serviceId, companyId: input.companyId }).forNoKeyUpdate().first();
    if (!service) throw new Error('Service not found');

    const existing = await tx.orm.public.Incident.where((i) => and(i.serviceId.eq(input.serviceId), i.status.neq('resolved'))).first();
    if (existing) {
      if ((SEV_RANK[input.severity] ?? 4) < (SEV_RANK[existing.severity] ?? 4)) {
        await tx.orm.public.Incident.where({ id: existing.id }).update({ severity: input.severity });
        await tx.orm.public.IncidentEvent.create({
          incidentId: existing.id,
          eventType: 'severity_change',
          message: `Severity raised ${existing.severity.toUpperCase()} → ${input.severity.toUpperCase()} by a new ${input.source} signal`,
          occurredAt,
        });
      }
      await tx.orm.public.IncidentEvent.create({
        incidentId: existing.id,
        actorId: input.createdById ?? null,
        eventType: 'alert',
        message: `Additional ${input.source} signal: ${truncate(input.description || input.title, 500)}`,
        occurredAt,
      });
      return { incidentId: existing.id, created: false };
    }

    let incident;
    try {
      incident = await tx.orm.public.Incident.create({
        companyId: input.companyId,
        serviceId: input.serviceId,
        title: truncate(input.title, 200),
        description: input.description ?? null,
        severity: input.severity,
        status: 'open',
        detectedAt: occurredAt,
        source: input.source,
        createdById: input.createdById ?? null,
        assignedResponderId: input.assigneeId ?? null,
        projectId: input.projectId ?? service.projectId ?? null,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const winner = await tx.orm.public.Incident.where((i) => and(i.serviceId.eq(input.serviceId), i.status.neq('resolved'))).first();
      if (!winner) throw error;
      return { incidentId: winner.id, created: false };
    }
    await tx.orm.public.IncidentEvent.create({
      incidentId: incident.id,
      actorId: input.createdById ?? null,
      eventType: 'created',
      message:
        input.source === 'manual'
          ? `Incident declared manually: ${incident.title}`
          : `Incident opened automatically from ${input.source}: ${truncate(input.description || input.title, 500)}`,
      occurredAt,
    });
    await tx.orm.public.Service.where({ id: service.id }).update({
      healthStatus: input.severity === 'sev1' || input.severity === 'sev2' ? 'down' : 'degraded',
    });
    await initializeIncidentEscalation(tx, {
      incidentId: incident.id,
      companyId: input.companyId,
      serviceId: input.serviceId,
      severity: input.severity,
      occurredAt,
    });
    return { incidentId: incident.id, created: true };
  });

  if (result.created) {
    await afterIncidentOpened(result.incidentId, { autoCreateTask: input.autoCreateTask }).catch((error) =>
      log.error('incident.after_open_failed', { incidentId: result.incidentId, error: error instanceof Error ? error.message : 'unknown' }),
    );
  }
  return result;
}

/**
 * Post-commit automation for a new incident: route to an owner/on-call responder, notify people, open a
 * linked engineering task, correlate with related failures and recent deployments, emit webhooks.
 * Each step is best-effort so one failing integration never blocks the others.
 */
export async function afterIncidentOpened(incidentId: number, options: { autoCreateTask?: boolean } = {}): Promise<void> {
  const incident = await db.orm.public.Incident.where({ id: incidentId }).first();
  if (!incident) return;
  const service = await db.orm.public.Service.where({ id: incident.serviceId }).first();
  if (!service) return;
  const companyId = incident.companyId;
  const orgId = await orgIdForCompany(companyId);

  // 1. Routing: explicit assignee > service owner > on-call for the owning team > backup owner.
  let assignee = incident.assignedResponderId;
  if (!assignee) {
    assignee = service.ownerId ?? (await currentOnCallForTeam(companyId, service.teamId).catch(() => null)) ?? service.backupOwnerId ?? null;
    if (assignee) {
      await db.orm.public.Incident.where({ id: incident.id }).update({ assignedResponderId: assignee });
      const who = await db.orm.public.User.where({ id: assignee }).first();
      await db.orm.public.IncidentEvent.create({
        incidentId: incident.id,
        eventType: 'assignment',
        message: `Routed to ${who?.name || who?.email || `user #${assignee}`} (${assignee === service.ownerId ? 'service owner' : assignee === service.backupOwnerId ? 'backup owner' : 'on-call'})`,
        occurredAt: new Date().toISOString(),
      });
    }
  }

  // 2. Notify the responder, owners and (when nobody owns the service) the org's admins.
  const recipients = new Set<number>([assignee, service.ownerId, service.backupOwnerId].filter((v): v is number => typeof v === 'number'));
  if (recipients.size === 0 && orgId) {
    for (const id of await companyUserIdsWithRoles(orgId, ['owner', 'admin', 'manager'])) recipients.add(id);
  }
  await notifyUsers(companyId, [...recipients], {
    type: 'incident.created',
    title: `[${incident.severity.toUpperCase()}] ${incident.title}`,
    body: `${service.name} (${service.environment}) — ${incident.description ?? 'New incident'}${service.runbookUrl ? `\nRunbook: ${service.runbookUrl}` : ''}`,
    link: `/dashboard/incidents/${incident.id}`,
    entityType: 'incident',
    entityId: incident.id,
    dedupeKey: `incident:${incident.id}:created`,
    excludeUserId: incident.createdById,
  });
  if (service.healthStatus === 'down') {
    await notifyUsers(companyId, [service.ownerId, service.backupOwnerId], {
      type: 'service.down',
      title: `${service.name} is down`,
      body: incident.description ?? undefined,
      link: `/dashboard/services/${service.id}`,
      entityType: 'service',
      entityId: service.id,
      dedupeKey: `service:${service.id}:down:${incident.id}`,
    });
  }

  // 3. Engineering task for serious automatic incidents when the service belongs to a project.
  const projectId = incident.projectId ?? service.projectId;
  const wantTask = options.autoCreateTask ?? (incident.source !== 'manual' && (incident.severity === 'sev1' || incident.severity === 'sev2'));
  if (wantTask && projectId && orgId && !incident.taskId) {
    try {
      await createLinkedTask(orgId, incident.id, projectId, assignee);
    } catch (error) {
      log.warn('incident.auto_task_failed', { incidentId, error: error instanceof Error ? error.message : 'unknown' });
    }
  }

  // 4. Correlation and deployment context.
  await correlateIncident(incident.id).catch(() => undefined);

  await emitEvent(companyId, 'incident.created', {
    incident: { id: incident.id, title: incident.title, severity: incident.severity, status: incident.status, detectedAt: incident.detectedAt },
    service: { id: service.id, name: service.name, environment: service.environment },
  });
}

/** Create a bug ticket for an incident in a project and link both ways. */
export async function createLinkedTask(orgId: string, incidentId: number, projectId: string, assigneeId: number | null, actorUserId?: number) {
  const incident = await db.orm.public.Incident.where({ id: incidentId }).first();
  if (!incident) throw new Error('Incident not found');
  const reporter = actorUserId ?? assigneeId ?? (await companyUserIdsWithRoles(orgId, ['owner']))[0];
  if (!reporter) throw new Error('No user available to report the task');
  const priority = incident.severity === 'sev1' ? 'highest' : incident.severity === 'sev2' ? 'high' : incident.severity === 'sev3' ? 'medium' : 'low';
  const task = await createTask(
    { userId: reporter, orgId, role: 'admin', requestId: null },
    projectId,
    {
      title: `[INC-${incident.id}] ${incident.title}`.slice(0, 200),
      description: `Automatically created from incident INC-${incident.id}.\n\n${incident.description ?? ''}`,
      type: 'bug',
      priority,
      assigneeId: assigneeId ?? null,
      labels: ['incident'],
    },
  );
  await withTenant(orgId, (tx) => tx.orm.public.Task.where({ id: task.id, organizationId: orgId }).update({ incidentId, serviceId: incident.serviceId }));
  await db.orm.public.Incident.where({ id: incidentId }).update({ taskId: task.id, projectId });
  await db.orm.public.IncidentEvent.create({
    incidentId,
    actorId: actorUserId ?? null,
    eventType: 'task_linked',
    message: `Linked engineering task ${task.ref}`,
    occurredAt: new Date().toISOString(),
  });
  return task;
}

/**
 * Rule-based correlation. Looks at other unresolved incidents detected within 15 minutes and groups this
 * one with them when they share a dependency edge or a common upstream, or when several services fail at
 * once (≥ 3 within 5 minutes). Also records recent deployments of the service on the timeline.
 */
export async function correlateIncident(incidentId: number): Promise<void> {
  const incident = await db.orm.public.Incident.where({ id: incidentId }).first();
  if (!incident) return;
  const detected = Date.parse(incident.detectedAt);
  const since = new Date(detected - 15 * 60_000).toISOString();
  const recent = await db.orm.public.Incident.where((i) =>
    and(i.companyId.eq(incident.companyId), i.status.neq('resolved'), i.detectedAt.gte(since), i.id.neq(incident.id)),
  ).all();

  const now = new Date().toISOString();
  if (recent.length > 0) {
    const edges = await db.orm.public.ServiceDependency.where({ companyId: incident.companyId }).all();
    const upstream = (sid: number) => new Set(edges.filter((e) => e.serviceId === sid).map((e) => e.dependsOnId));
    const mine = upstream(incident.serviceId);
    let match: { id: number; groupId: number; reason: string } | null = null;
    for (const other of recent.sort((a, b) => a.detectedAt.localeCompare(b.detectedAt))) {
      const theirs = upstream(other.serviceId);
      const groupId = other.correlationGroupId ?? other.id;
      if (mine.has(other.serviceId)) {
        match = { id: other.id, groupId, reason: `depends on a failing upstream service (incident #${other.id})` };
      } else if (theirs.has(incident.serviceId)) {
        match = { id: other.id, groupId, reason: `is an upstream of a failing service (incident #${other.id})` };
      } else {
        const shared = [...mine].find((id) => theirs.has(id));
        if (shared) match = { id: other.id, groupId, reason: `shares upstream dependency #${shared} with incident #${other.id}` };
      }
      if (match) break;
    }
    const burst = recent.filter((r) => Date.parse(r.detectedAt) >= detected - 5 * 60_000);
    if (!match && burst.length >= 2) {
      const first = burst.sort((a, b) => a.detectedAt.localeCompare(b.detectedAt))[0]!;
      match = { id: first.id, groupId: first.correlationGroupId ?? first.id, reason: `${burst.length + 1} services failed within 5 minutes` };
    }
    if (match) {
      await db.orm.public.Incident.where({ id: incident.id }).update({ correlationGroupId: match.groupId, correlationReason: match.reason });
      const leader = await db.orm.public.Incident.where({ id: match.groupId }).first();
      if (leader && leader.correlationGroupId === null) {
        await db.orm.public.Incident.where({ id: leader.id }).update({ correlationGroupId: leader.id, correlationReason: 'Group leader' });
      }
      await db.orm.public.IncidentEvent.create({
        incidentId: incident.id,
        eventType: 'system',
        message: `Correlated with incident #${match.groupId}: this service ${match.reason.startsWith('depends') || match.reason.startsWith('is') || match.reason.startsWith('shares') ? match.reason : `— ${match.reason}`}`,
        occurredAt: now,
      });
    }
  }

  const deployments = await db.orm.public.Deployment.where((d) =>
    and(d.serviceId.eq(incident.serviceId), d.deployedAt.gte(new Date(detected - 2 * 3_600_000).toISOString()), d.deployedAt.lte(incident.detectedAt)),
  )
    .orderBy((d) => d.deployedAt.desc())
    .limit(3)
    .all();
  for (const d of deployments) {
    await db.orm.public.IncidentEvent.create({
      incidentId: incident.id,
      eventType: 'deployment',
      message: `Possible cause: ${d.version} was deployed to ${d.environment} ${Math.round((detected - Date.parse(d.deployedAt)) / 60_000)} min before detection${d.commitSha ? ` (commit ${d.commitSha.slice(0, 7)})` : ''}${d.author ? ` by ${d.author}` : ''}`,
      occurredAt: now,
    });
  }
}

/** Monitoring saw the service healthy again: record recovery, move early-stage incidents to mitigated. */
export async function recordRecovery(companyId: number, serviceId: number, message: string): Promise<void> {
  const now = new Date().toISOString();
  const incident = await db.orm.public.Incident.where((i) => and(i.serviceId.eq(serviceId), i.companyId.eq(companyId), i.status.neq('resolved'))).first();
  await db.orm.public.Service.where({ id: serviceId }).update({ healthStatus: 'healthy' });
  const service = await db.orm.public.Service.where({ id: serviceId }).first();
  if (!incident) return;
  await db.orm.public.IncidentEvent.create({ incidentId: incident.id, eventType: 'recovery', message, occurredAt: now });
  if (['open', 'acknowledged', 'investigating'].includes(incident.status)) {
    await db.orm.public.Incident.where({ id: incident.id }).update({ status: 'mitigated', mitigatedAt: now });
    await db.orm.public.IncidentEvent.create({
      incidentId: incident.id,
      eventType: 'status_change',
      message: 'Status set to mitigated after verified recovery — a responder must confirm and resolve',
      occurredAt: now,
    });
  }
  await notifyUsers(companyId, [incident.assignedResponderId, service?.ownerId], {
    type: 'service.recovered',
    title: `${service?.name ?? 'Service'} recovered`,
    body: `${message}\nIncident #${incident.id} is ready to be verified and resolved.`,
    link: `/dashboard/incidents/${incident.id}`,
    entityType: 'incident',
    entityId: incident.id,
    dedupeKey: `incident:${incident.id}:recovered:${now.slice(0, 16)}`,
  });
  await emitEvent(companyId, 'service.health_changed', { service: { id: serviceId, name: service?.name, healthStatus: 'healthy' }, incidentId: incident.id });
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
