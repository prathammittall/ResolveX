import { z } from 'zod';
import { db } from '../../prisma/db.js';
import {
  badRequestResponse,
  conflictResponse,
  notFoundResponse,
  serverErrorResponse,
} from './auth.js';

// --- Validation ---

const commentSchema = z
  .object({
    message: z.string().trim().min(1, 'Comment cannot be empty').max(4000, 'Comment is too long'),
  })
  .strict();

// --- Shaping ---

function shapeIncident(i: {
  id: number;
  companyId: number;
  serviceId: number;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  assignedResponderId: number | null;
  detectedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: i.id,
    companyId: i.companyId,
    serviceId: i.serviceId,
    title: i.title,
    description: i.description,
    severity: i.severity,
    status: i.status,
    assignedResponderId: i.assignedResponderId,
    detectedAt: i.detectedAt,
    acknowledgedAt: i.acknowledgedAt,
    resolvedAt: i.resolvedAt,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

function userDisplayName(u: { name: string | null; username: string | null; email: string } | null): string | null {
  if (!u) return null;
  return u.name || u.username || u.email;
}

// --- Handlers ---

/**
 * GET /api/incidents?status=&severity=
 */
export async function listIncidents(
  companyId: number,
  searchParams: URLSearchParams,
): Promise<Response> {
  try {
    const statusFilter = searchParams.get('status');
    const severityFilter = searchParams.get('severity');

    const [incidents, services] = await Promise.all([
      db.orm.public.Incident.where({ companyId }).all(),
      db.orm.public.Service.where({ companyId }).all(),
    ]);
    const serviceName = new Map(services.map((s) => [s.id, s.name]));

    let result = incidents;
    if (statusFilter) result = result.filter((i) => i.status === statusFilter);
    if (severityFilter) result = result.filter((i) => i.severity === severityFilter);

    result.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));

    const data = result.map((i) => ({
      ...shapeIncident(i),
      serviceName: serviceName.get(i.serviceId) ?? 'Unknown',
    }));

    return Response.json({ ok: true, incidents: data });
  } catch (err) {
    console.error('[api/incidents] list error:', err);
    return serverErrorResponse();
  }
}

/**
 * GET /api/incidents/:id — detail with timeline + linked alerts + assignee.
 */
export async function getIncident(companyId: number, id: number): Promise<Response> {
  try {
    const incident = await db.orm.public.Incident.where({ id }).first();
    if (!incident || incident.companyId !== companyId) {
      return notFoundResponse('Incident not found');
    }

    const [service, events, alerts] = await Promise.all([
      db.orm.public.Service.where({ id: incident.serviceId }).first(),
      db.orm.public.IncidentEvent.where({ incidentId: id }).all(),
      db.orm.public.AlertEvent.where({ incidentId: id }).all(),
    ]);

    // Resolve actor names for the timeline (bounded by number of unique actors).
    const actorIds = [...new Set(events.map((e) => e.actorId).filter((a): a is number => a != null))];
    const actors = await Promise.all(
      actorIds.map((aid) => db.orm.public.User.where({ id: aid }).first()),
    );
    const actorName = new Map<number, string>();
    actors.forEach((u, idx) => {
      const name = userDisplayName(u);
      if (name) actorName.set(actorIds[idx], name);
    });

    const assignee = incident.assignedResponderId
      ? await db.orm.public.User.where({ id: incident.assignedResponderId }).first()
      : null;

    events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    alerts.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

    return Response.json({
      ok: true,
      incident: {
        ...shapeIncident(incident),
        serviceName: service?.name ?? 'Unknown',
        assignedResponderName: userDisplayName(assignee),
      },
      events: events.map((e) => ({
        id: e.id,
        incidentId: e.incidentId,
        actorId: e.actorId,
        actorName: e.actorId != null ? (actorName.get(e.actorId) ?? null) : null,
        eventType: e.eventType,
        message: e.message,
        occurredAt: e.occurredAt,
      })),
      alerts: alerts.map((a) => ({
        id: a.id,
        provider: a.provider,
        providerEventId: a.providerEventId,
        processingStatus: a.processingStatus,
        receivedAt: a.receivedAt,
      })),
    });
  } catch (err) {
    console.error('[api/incidents] get error:', err);
    return serverErrorResponse();
  }
}

/**
 * POST /api/incidents/:id/acknowledge
 */
export async function acknowledgeIncident(
  companyId: number,
  id: number,
  userId: number,
  _body: unknown,
): Promise<Response> {
  try {
    const incident = await db.orm.public.Incident.where({ id }).first();
    if (!incident || incident.companyId !== companyId) {
      return notFoundResponse('Incident not found');
    }
    if (incident.status === 'resolved') {
      return conflictResponse('Incident is already resolved');
    }

    const now = new Date().toISOString();
    await db.orm.public.Incident.where({ id }).update({
      status: 'acknowledged',
      acknowledgedAt: now,
    });
    await db.orm.public.IncidentEvent.create({
      incidentId: id,
      actorId: userId,
      eventType: 'acknowledged',
      message: 'Incident acknowledged',
      occurredAt: now,
    });

    const updated = await db.orm.public.Incident.where({ id }).first();
    return Response.json({ ok: true, incident: updated ? shapeIncident(updated) : null });
  } catch (err) {
    console.error('[api/incidents] acknowledge error:', err);
    return serverErrorResponse();
  }
}

/**
 * POST /api/incidents/:id/resolve
 */
export async function resolveIncident(
  companyId: number,
  id: number,
  userId: number,
  _body: unknown,
): Promise<Response> {
  try {
    const incident = await db.orm.public.Incident.where({ id }).first();
    if (!incident || incident.companyId !== companyId) {
      return notFoundResponse('Incident not found');
    }
    if (incident.status === 'resolved') {
      return conflictResponse('Incident is already resolved');
    }

    const now = new Date().toISOString();
    await db.orm.public.Incident.where({ id }).update({
      status: 'resolved',
      resolvedAt: now,
    });
    await db.orm.public.IncidentEvent.create({
      incidentId: id,
      actorId: userId,
      eventType: 'resolved',
      message: 'Incident resolved',
      occurredAt: now,
    });
    // A resolved incident implies the underlying service is healthy again.
    await db.orm.public.Service.where({ id: incident.serviceId }).update({
      healthStatus: 'healthy',
    });

    const updated = await db.orm.public.Incident.where({ id }).first();
    return Response.json({ ok: true, incident: updated ? shapeIncident(updated) : null });
  } catch (err) {
    console.error('[api/incidents] resolve error:', err);
    return serverErrorResponse();
  }
}

/**
 * POST /api/incidents/:id/comments
 */
export async function commentIncident(
  companyId: number,
  id: number,
  userId: number,
  body: unknown,
): Promise<Response> {
  try {
    const incident = await db.orm.public.Incident.where({ id }).first();
    if (!incident || incident.companyId !== companyId) {
      return notFoundResponse('Incident not found');
    }

    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) {
      return badRequestResponse('Invalid comment', parsed.error.flatten());
    }

    const now = new Date().toISOString();
    const event = await db.orm.public.IncidentEvent.create({
      incidentId: id,
      actorId: userId,
      eventType: 'comment',
      message: parsed.data.message,
      occurredAt: now,
    });

    return Response.json(
      {
        ok: true,
        event: {
          id: event.id,
          incidentId: event.incidentId,
          actorId: event.actorId,
          eventType: event.eventType,
          message: event.message,
          occurredAt: event.occurredAt,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[api/incidents] comment error:', err);
    return serverErrorResponse();
  }
}
