import { z } from 'zod';
import { and } from '@prisma/orm-postgres/orm-client';
import { db } from '../../../prisma/db.js';
import { withTenant } from '../../../prisma/tenant.js';
import { badRequest, conflict, displayName, intParam, notFound, ok, pageParams, parseBody, type RouteContext } from '../../../lib/http.js';
import { createLinkedTask, openOrAttachIncident } from '../../incident-engine/lifecycle.js';
import { notifyUsers } from '../../notify/index.js';
import { emitEvent } from '../../integrations/webhooks.js';
import { aiEnabled, complete, heuristicHints } from '../../ai/assistant.js';
import { getTask } from '../../work/tasks.js';

const severity = z.enum(['sev1', 'sev2', 'sev3', 'sev4']);
const status = z.enum(['open', 'acknowledged', 'investigating', 'mitigated', 'resolved']);
const STATUS_ORDER = ['open', 'acknowledged', 'investigating', 'mitigated', 'resolved'];

const createSchema = z
  .object({
    serviceId: z.number().int().positive(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(10_000).nullable().optional(),
    severity,
    assigneeId: z.number().int().positive().nullable().optional(),
    projectId: z.string().uuid().nullable().optional(),
    createTask: z.boolean().default(false),
  })
  .strict();
const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(10_000).nullable().optional(),
    severity: severity.optional(),
    status: status.optional(),
    assigneeId: z.number().int().positive().nullable().optional(),
    projectId: z.string().uuid().nullable().optional(),
    customerImpact: z.string().trim().max(5000).nullable().optional(),
    note: z.string().trim().max(2000).optional(),
  })
  .strict();
const postmortemSchema = z
  .object({
    status: z.enum(['draft', 'in_review', 'published']).optional(),
    summary: z.string().max(20_000).nullable().optional(),
    rootCause: z.string().max(20_000).nullable().optional(),
    customerImpact: z.string().max(20_000).nullable().optional(),
    contributingFactors: z.string().max(20_000).nullable().optional(),
    resolution: z.string().max(20_000).nullable().optional(),
    preventiveMeasures: z.string().max(20_000).nullable().optional(),
    lessonsLearned: z.string().max(20_000).nullable().optional(),
  })
  .strict();
const actionItemSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    ownerId: z.number().int().positive().nullable().optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).nullable().optional(),
    status: z.enum(['open', 'done']).optional(),
    createTaskInProject: z.string().uuid().optional(),
  })
  .strict();

async function loadIncident(companyId: number, id: number) {
  const incident = await db.orm.public.Incident.where({ id, companyId }).first();
  if (!incident) throw notFound('Incident');
  return incident;
}

async function assertMember(orgId: string, userId: number) {
  const m = await withTenant(orgId, (tx) => tx.orm.public.Membership.where({ organizationId: orgId, userId }).first());
  if (!m) throw badRequest('That user is not a member of this organization');
}

/** Cancel pending escalation when someone takes ownership. */
async function stopEscalation(incidentId: number, at: string) {
  const esc = await db.orm.public.IncidentEscalation.where({ incidentId }).first();
  if (esc && esc.status === 'active') await db.orm.public.IncidentEscalation.where({ id: esc.id }).update({ status: 'acknowledged', acknowledgedAt: at, nextEscalationAt: null });
  await db.orm.public.QueueJob.where({ incidentId, status: 'pending' }).updateAll({ status: 'cancelled', lockedUntil: null });
}

export async function incidentRoutes(ctx: RouteContext): Promise<Response | null> {
  const { segments: seg, method, auth, searchParams } = ctx;
  const companyId = auth.companyId;
  if (seg[0] !== 'incidents' && seg[0] !== 'postmortems') return null;

  // GET /postmortems — list for the org
  if (seg[0] === 'postmortems' && seg.length === 1 && method === 'GET') {
    ctx.need('incidents:read');
    const rows = await db.orm.public.Postmortem.where({ companyId }).orderBy((p) => p.updatedAt.desc()).limit(100).all();
    const incidents = rows.length ? await db.orm.public.Incident.where((i) => i.id.in(rows.map((r) => r.incidentId))).all() : [];
    return ok({ postmortems: rows.map((p) => ({ ...p, incident: incidents.find((i) => i.id === p.incidentId) ?? null })) });
  }
  if (seg[0] === 'postmortems' && seg[1] === 'action-items' && seg[2] && method === 'PATCH') {
    ctx.need('postmortems:write');
    const id = intParam(seg[2], 'Action item');
    const item = await db.orm.public.PostmortemActionItem.where({ id }).first();
    const pm = item ? await db.orm.public.Postmortem.where({ id: item.postmortemId, companyId }).first() : null;
    if (!item || !pm) throw notFound('Action item');
    const body = await parseBody(ctx, actionItemSchema.partial());
    return ok({ actionItem: await db.orm.public.PostmortemActionItem.where({ id }).update({ ...body, dueDate: body.dueDate ? `${body.dueDate.slice(0, 10)}T00:00:00.000Z` : body.dueDate } as never) });
  }
  if (seg[0] === 'postmortems' && seg[1] === 'action-items' && seg[2] && method === 'DELETE') {
    ctx.need('postmortems:write');
    const id = intParam(seg[2], 'Action item');
    const item = await db.orm.public.PostmortemActionItem.where({ id }).first();
    const pm = item ? await db.orm.public.Postmortem.where({ id: item.postmortemId, companyId }).first() : null;
    if (!item || !pm) throw notFound('Action item');
    await db.orm.public.PostmortemActionItem.where({ id }).delete();
    return ok();
  }
  if (seg[0] === 'postmortems') return null;

  // POST /incidents — declare manually
  if (seg.length === 1 && method === 'POST') {
    ctx.need('incidents:respond');
    const body = await parseBody(ctx, createSchema);
    const service = await db.orm.public.Service.where({ id: body.serviceId, companyId }).first();
    if (!service) throw notFound('Service');
    if (body.assigneeId) await assertMember(auth.orgId, body.assigneeId);
    const result = await openOrAttachIncident({
      companyId,
      serviceId: service.id,
      severity: body.severity,
      title: body.title,
      description: body.description ?? null,
      source: 'manual',
      createdById: auth.userId,
      assigneeId: body.assigneeId ?? null,
      projectId: body.projectId ?? null,
      autoCreateTask: body.createTask,
    });
    return ok({ incidentId: result.incidentId, created: result.created }, result.created ? 201 : 200);
  }

  // GET /incidents/groups — correlated incident groups
  if (seg[1] === 'groups' && method === 'GET') {
    ctx.need('incidents:read');
    const rows = await db.orm.public.Incident.where((i) => and(i.companyId.eq(companyId), i.correlationGroupId.isNotNull())).orderBy((i) => i.detectedAt.desc()).limit(200).all();
    const groups = new Map<number, typeof rows>();
    for (const r of rows) groups.set(r.correlationGroupId!, [...(groups.get(r.correlationGroupId!) ?? []), r]);
    return ok({ groups: [...groups.entries()].filter(([, list]) => list.length > 1).map(([groupId, list]) => ({ groupId, incidents: list.map((i) => ({ id: i.id, title: i.title, severity: i.severity, status: i.status, detectedAt: i.detectedAt, correlationReason: i.correlationReason })) })) });
  }

  if (!seg[1] || !/^\d+$/.test(seg[1])) return null;
  const id = intParam(seg[1], 'Incident');
  const sub = seg[2];

  // GET /incidents/:id/context — related objects for the detail page
  if (sub === 'context' && method === 'GET') {
    ctx.need('incidents:read');
    const incident = await loadIncident(companyId, id);
    const service = await db.orm.public.Service.where({ id: incident.serviceId }).first();
    const [postmortem, related, deployments, monitors] = await Promise.all([
      db.orm.public.Postmortem.where({ incidentId: id }).first(),
      incident.correlationGroupId ? db.orm.public.Incident.where((i) => and(i.correlationGroupId.eq(incident.correlationGroupId!), i.id.neq(id))).all() : Promise.resolve([]),
      db.orm.public.Deployment.where({ serviceId: incident.serviceId }).orderBy((d) => d.deployedAt.desc()).limit(5).all(),
      db.orm.public.Monitor.where({ serviceId: incident.serviceId }).all(),
    ]);
    let task = null;
    if (incident.taskId) {
      try {
        task = (await getTask(auth.orgId, incident.taskId)).task;
      } catch {
        task = null;
      }
    }
    const items = postmortem ? await db.orm.public.PostmortemActionItem.where({ postmortemId: postmortem.id }).all() : [];
    return ok({
      incident: { ...incident },
      service: service ? { id: service.id, name: service.name, environment: service.environment, healthStatus: service.healthStatus, runbookUrl: service.runbookUrl, docsUrl: service.docsUrl, repositoryUrl: service.repositoryUrl, ownerId: service.ownerId, projectId: service.projectId } : null,
      task,
      postmortem: postmortem ? { ...postmortem, actionItems: items } : null,
      relatedIncidents: related.map((i) => ({ id: i.id, title: i.title, severity: i.severity, status: i.status, detectedAt: i.detectedAt })),
      recentDeployments: deployments,
      monitors: monitors.map((m) => ({ id: m.id, name: m.name, status: m.status, lastError: m.lastError, lastCheckedAt: m.lastCheckedAt })),
      aiEnabled: aiEnabled(),
    });
  }

  // PATCH /incidents/:id — lifecycle transitions and edits
  if (!sub && method === 'PATCH') {
    ctx.need('incidents:respond');
    const body = await parseBody(ctx, patchSchema);
    const incident = await loadIncident(companyId, id);
    const now = new Date().toISOString();
    const update: Record<string, unknown> = {};
    const events: Array<{ eventType: string; message: string }> = [];
    if (body.title !== undefined && body.title !== incident.title) update.title = body.title;
    if (body.description !== undefined) update.description = body.description;
    if (body.customerImpact !== undefined) update.customerImpact = body.customerImpact;
    if (body.projectId !== undefined) update.projectId = body.projectId;
    if (body.severity && body.severity !== incident.severity) {
      update.severity = body.severity;
      events.push({ eventType: 'severity_change', message: `Severity changed ${incident.severity.toUpperCase()} → ${body.severity.toUpperCase()}` });
    }
    if (body.assigneeId !== undefined && body.assigneeId !== incident.assignedResponderId) {
      if (body.assigneeId !== null) await assertMember(auth.orgId, body.assigneeId);
      update.assignedResponderId = body.assigneeId;
      const u = body.assigneeId ? await db.orm.public.User.where({ id: body.assigneeId }).first() : null;
      events.push({ eventType: 'assignment', message: body.assigneeId ? `Assigned to ${displayName(u)}` : 'Unassigned' });
    }
    if (body.status && body.status !== incident.status) {
      if (incident.status === 'resolved' && body.status !== 'open') throw conflict('Reopen a resolved incident before changing its state');
      update.status = body.status;
      if (body.status === 'acknowledged' || (!incident.acknowledgedAt && STATUS_ORDER.indexOf(body.status) > 0 && body.status !== 'resolved')) {
        if (!incident.acknowledgedAt) {
          update.acknowledgedAt = now;
          update.firstAcknowledgedAt = incident.firstAcknowledgedAt ?? now;
          update.mttaSeconds = Math.max(0, Math.round((Date.now() - Date.parse(incident.detectedAt)) / 1000));
          update.acknowledgmentDueAt = null;
          update.escalationStatus = incident.escalationStatus ? 'acknowledged' : null;
          if (!incident.assignedResponderId && body.assigneeId === undefined) update.assignedResponderId = auth.userId;
          await stopEscalation(id, now);
        }
      }
      if (body.status === 'mitigated') update.mitigatedAt = now;
      if (body.status === 'resolved') {
        update.resolvedAt = now;
        await stopEscalation(id, now);
      }
      if (body.status === 'open' && incident.status === 'resolved') {
        const other = await db.orm.public.Incident.where((i) => and(i.serviceId.eq(incident.serviceId), i.status.neq('resolved'), i.id.neq(id))).first();
        if (other) throw conflict(`Incident #${other.id} is already open for this service`);
        update.resolvedAt = null;
      }
      events.push({ eventType: body.status === 'resolved' ? 'resolved' : body.status === 'acknowledged' ? 'acknowledged' : 'status_change', message: `Status ${incident.status} → ${body.status}${body.note ? `: ${body.note}` : ''}` });
    }
    if (Object.keys(update).length === 0) return ok({ incident });
    const updated = await db.orm.public.Incident.where({ id }).update(update as never);
    for (const e of events) await db.orm.public.IncidentEvent.create({ incidentId: id, actorId: auth.userId, eventType: e.eventType as never, message: e.message, occurredAt: now });
    if (body.status === 'resolved') {
      const monitors = await db.orm.public.Monitor.where({ serviceId: incident.serviceId, enabled: true }).all();
      if (monitors.length === 0 || monitors.every((m) => m.status !== 'down')) await db.orm.public.Service.where({ id: incident.serviceId }).update({ healthStatus: monitors.length ? 'healthy' : 'healthy' });
      await notifyUsers(companyId, [incident.assignedResponderId, incident.createdById], { type: 'incident.resolved', title: `Resolved: ${incident.title}`, link: `/dashboard/incidents/${id}`, entityType: 'incident', entityId: id, excludeUserId: auth.userId });
      await emitEvent(companyId, 'incident.resolved', { incident: { id, title: incident.title, severity: incident.severity } });
    } else if (body.status) {
      await emitEvent(companyId, body.status === 'acknowledged' ? 'incident.acknowledged' : 'incident.status_changed', { incident: { id, title: incident.title, status: body.status } });
    }
    if (body.assigneeId) {
      await notifyUsers(companyId, [body.assigneeId], { type: 'incident.assigned', title: `[${(body.severity ?? incident.severity).toUpperCase()}] You are now responding to: ${incident.title}`, link: `/dashboard/incidents/${id}`, entityType: 'incident', entityId: id, excludeUserId: auth.userId });
    }
    return ok({ incident: updated });
  }

  // POST /incidents/:id/task — link an existing task (ref) or create a new one in a project
  if (sub === 'task' && method === 'POST') {
    ctx.need('tasks:create');
    const body = await parseBody(ctx, z.object({ ref: z.string().min(1).max(40).optional(), projectId: z.string().uuid().optional() }).strict());
    const incident = await loadIncident(companyId, id);
    if (body.ref) {
      const { task } = await getTask(auth.orgId, body.ref);
      await withTenant(auth.orgId, (tx) => tx.orm.public.Task.where({ id: task.id, organizationId: auth.orgId }).update({ incidentId: id, serviceId: incident.serviceId }));
      await db.orm.public.Incident.where({ id }).update({ taskId: task.id, projectId: task.projectId });
      await db.orm.public.IncidentEvent.create({ incidentId: id, actorId: auth.userId, eventType: 'task_linked', message: `Linked engineering task ${task.ref}`, occurredAt: new Date().toISOString() });
      return ok({ task });
    }
    const projectId = body.projectId ?? incident.projectId;
    if (!projectId) throw badRequest('Choose a project for the task');
    const task = await createLinkedTask(auth.orgId, id, projectId, incident.assignedResponderId, auth.userId);
    return ok({ task }, 201);
  }
  if (sub === 'task' && method === 'DELETE') {
    ctx.need('tasks:update');
    const incident = await loadIncident(companyId, id);
    if (incident.taskId) await withTenant(auth.orgId, (tx) => tx.orm.public.Task.where({ id: incident.taskId!, organizationId: auth.orgId }).update({ incidentId: null }));
    await db.orm.public.Incident.where({ id }).update({ taskId: null });
    return ok();
  }

  // /incidents/:id/postmortem
  if (sub === 'postmortem') {
    const incident = await loadIncident(companyId, id);
    if (method === 'GET') {
      ctx.need('incidents:read');
      const pm = await db.orm.public.Postmortem.where({ incidentId: id }).first();
      const items = pm ? await db.orm.public.PostmortemActionItem.where({ postmortemId: pm.id }).orderBy((a) => a.createdAt.asc()).all() : [];
      return ok({ postmortem: pm ? { ...pm, actionItems: items } : null });
    }
    ctx.need('postmortems:write');
    if (method === 'PUT') {
      const body = await parseBody(ctx, postmortemSchema);
      if (incident.status !== 'resolved' && body.status === 'published') throw conflict('Resolve the incident before publishing its postmortem');
      const existing = await db.orm.public.Postmortem.where({ incidentId: id }).first();
      const data = { ...body, publishedAt: body.status === 'published' ? (existing?.publishedAt ?? new Date().toISOString()) : body.status ? null : undefined };
      const pm = existing
        ? await db.orm.public.Postmortem.where({ id: existing.id }).update(data as never)
        : await db.orm.public.Postmortem.create({ companyId, incidentId: id, authorId: auth.userId, status: body.status ?? 'draft', summary: body.summary ?? null, rootCause: body.rootCause ?? null, customerImpact: body.customerImpact ?? incident.customerImpact ?? null, contributingFactors: body.contributingFactors ?? null, resolution: body.resolution ?? null, preventiveMeasures: body.preventiveMeasures ?? null, lessonsLearned: body.lessonsLearned ?? null });
      if (body.status === 'published' && existing?.status !== 'published') await emitEvent(companyId, 'postmortem.published', { incidentId: id, title: incident.title });
      return ok({ postmortem: pm });
    }
    if (method === 'POST' && seg[3] === 'action-items') {
      const body = await parseBody(ctx, actionItemSchema);
      let pm = await db.orm.public.Postmortem.where({ incidentId: id }).first();
      pm ??= await db.orm.public.Postmortem.create({ companyId, incidentId: id, authorId: auth.userId, status: 'draft' });
      if (body.ownerId) await assertMember(auth.orgId, body.ownerId);
      let taskId: string | null = null;
      if (body.createTaskInProject) {
        const { createTask } = await import('../../work/tasks.js');
        const t = await createTask(ctx.actor, body.createTaskInProject, { title: body.title, type: 'task', priority: 'high', assigneeId: body.ownerId ?? null, dueDate: body.dueDate ? `${body.dueDate.slice(0, 10)}T00:00:00.000Z` : null, labels: ['postmortem'], incidentId: id });
        taskId = t.id;
      }
      const item = await db.orm.public.PostmortemActionItem.create({ postmortemId: pm.id, title: body.title, ownerId: body.ownerId ?? null, dueDate: body.dueDate ? `${body.dueDate.slice(0, 10)}T00:00:00.000Z` : null, status: body.status ?? 'open', taskId });
      if (body.ownerId) await notifyUsers(companyId, [body.ownerId], { type: 'postmortem.action_item', title: `Action item: ${body.title}`, body: `From the postmortem of incident #${id}`, link: `/dashboard/incidents/${id}/postmortem`, entityType: 'incident', entityId: id, excludeUserId: auth.userId });
      return ok({ actionItem: item }, 201);
    }
  }

  // GET /incidents/:id/timeline — full chronological log incl. checks and deployments
  if (sub === 'timeline' && method === 'GET') {
    ctx.need('incidents:read');
    const incident = await loadIncident(companyId, id);
    const { limit } = pageParams(searchParams, 500, 2000);
    const events = await db.orm.public.IncidentEvent.where({ incidentId: id }).orderBy((e) => e.occurredAt.asc()).limit(limit).all();
    const actors = [...new Set(events.map((e) => e.actorId).filter((v): v is number => v !== null))];
    const users = actors.length ? await db.orm.public.User.where((u) => u.id.in(actors)).all() : [];
    const until = incident.resolvedAt ?? new Date().toISOString();
    const from = new Date(Date.parse(incident.detectedAt) - 30 * 60_000).toISOString();
    const checks = await db.orm.public.MonitorCheck.where((c) => and(c.serviceId.eq(incident.serviceId), c.checkedAt.gte(from), c.checkedAt.lte(until))).orderBy((c) => c.checkedAt.asc()).limit(500).all();
    return ok({ events: events.map((e) => ({ ...e, actorName: e.actorId ? displayName(users.find((u) => u.id === e.actorId)) : null })), checks });
  }

  // POST /incidents/:id/assistant — AI or heuristic analysis (always labelled as suggestions)
  if (sub === 'assistant' && method === 'POST') {
    ctx.need('incidents:read');
    const body = await parseBody(ctx, z.object({ task: z.enum(['summary', 'root_cause', 'troubleshooting', 'postmortem_draft']) }).strict());
    const incident = await loadIncident(companyId, id);
    const service = await db.orm.public.Service.where({ id: incident.serviceId }).first();
    const events = await db.orm.public.IncidentEvent.where({ incidentId: id }).orderBy((e) => e.occurredAt.asc()).limit(200).all();
    const monitors = await db.orm.public.Monitor.where({ serviceId: incident.serviceId }).all();
    const deployments = await db.orm.public.Deployment.where({ serviceId: incident.serviceId }).orderBy((d) => d.deployedAt.desc()).limit(5).all();
    const past = await db.orm.public.Incident.where((i) => and(i.serviceId.eq(incident.serviceId), i.id.neq(id))).orderBy((i) => i.detectedAt.desc()).limit(10).all();
    const failureText = [incident.title, incident.description ?? '', ...monitors.map((m) => m.lastError ?? ''), ...events.map((e) => e.message)].join('\n');
    const hints = heuristicHints(failureText);
    const recurring = past.filter((p) => p.title.split(' — ')[0] === incident.title.split(' — ')[0]).length;
    const timeline = events.map((e) => `${e.occurredAt} [${e.eventType}] ${e.message}`).join('\n');
    if (!aiEnabled()) {
      return ok({
        source: 'heuristic',
        disclaimer: 'Rule-based suggestions from failure signatures. These are hypotheses to investigate, not confirmed causes.',
        content: [
          `Incident #${id} on ${service?.name ?? 'unknown service'} (${incident.severity.toUpperCase()}, ${incident.status}).`,
          `Detected ${incident.detectedAt}; ${events.length} timeline events.`,
          recurring ? `This service had ${recurring} similar incident(s) recently — check whether earlier fixes regressed.` : '',
          deployments[0] ? `Most recent deployment: ${deployments[0].version} at ${deployments[0].deployedAt}.` : 'No recorded deployments.',
          service?.runbookUrl ? `Runbook: ${service.runbookUrl}` : 'No runbook linked to this service.',
          '',
          'Things to check:',
          ...hints.map((h) => `• ${h}`),
        ]
          .filter((l) => l !== '')
          .join('\n'),
      });
    }
    const instructions: Record<typeof body.task, string> = {
      summary: 'Summarize the incident for a responder joining now: impact, current state, what has been tried. Max 150 words.',
      root_cause: 'List the 3 most likely root-cause hypotheses ranked by evidence, citing timeline lines. Mark each as a hypothesis.',
      troubleshooting: 'Give a concise, ordered troubleshooting checklist specific to this evidence.',
      postmortem_draft: 'Draft a blameless postmortem with sections: Summary, Impact, Timeline, Root cause (hypothesis unless stated), Resolution, Action items.',
    };
    const content = await complete([
      { role: 'system', content: 'You are an SRE incident assistant inside ResolveX. Use only the provided data. Never state a cause as confirmed unless the timeline explicitly confirms it; label speculation clearly. Be concise.' },
      {
        role: 'user',
        content: `${instructions[body.task]}\n\nService: ${service?.name} (${service?.serviceType}, ${service?.environment}, criticality ${service?.criticality})\nIncident: ${incident.title} [${incident.severity}] status=${incident.status}\nDescription: ${incident.description ?? ''}\nMonitor errors: ${monitors.map((m) => `${m.name}: ${m.lastError ?? 'ok'}`).join('; ')}\nRecent deployments: ${deployments.map((d) => `${d.version}@${d.deployedAt}`).join(', ') || 'none'}\nSimilar past incidents: ${recurring}\nRule-based hints: ${hints.join(' | ')}\n\nTimeline:\n${timeline.slice(0, 12_000)}`,
      },
    ]).catch(() => null);
    if (!content) return ok({ source: 'heuristic', disclaimer: 'The AI provider is unavailable; showing rule-based suggestions instead.', content: hints.map((h) => `• ${h}`).join('\n') });
    return ok({ source: 'ai', disclaimer: 'AI-generated from incident data. Treat as suggestions to verify, not confirmed facts.', content });
  }

  return null;
}
