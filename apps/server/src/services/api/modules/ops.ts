import { z } from 'zod';
import { and } from '@prisma/orm-postgres/orm-client';
import { db } from '../../../prisma/db.js';
import { encryptSecret } from '../../../lib/crypto.js';
import { badRequest, conflict, displayName, intParam, notFound, ok, pageParams, parseBody, type RouteContext } from '../../../lib/http.js';
import { assertSafeUrl, UnsafeTargetError } from '../../../lib/safe-http.js';
import { performCheck, runMonitor, summarizeChecks } from '../../monitoring/engine.js';
import { onCallAt, participantIds, shiftsBetween } from '../../oncall/resolve.js';
import { emitEvent } from '../../integrations/webhooks.js';
import { activeMaintenanceFor } from '../../incident-engine/maintenance.js';

const severity = z.enum(['sev1', 'sev2', 'sev3', 'sev4']);
const assertion = z.discriminatedUnion('type', [
  z.object({ type: z.literal('body_contains'), value: z.string().min(1).max(500) }),
  z.object({ type: z.literal('body_not_contains'), value: z.string().min(1).max(500) }),
  z.object({ type: z.literal('header_equals'), name: z.string().min(1).max(100), value: z.string().max(500) }),
  z.object({ type: z.literal('json_path_equals'), path: z.string().min(1).max(200), value: z.string().max(500) }),
  z.object({ type: z.literal('latency_below'), ms: z.number().int().min(1).max(60_000) }),
]);
const monitorFields = {
  name: z.string().trim().min(1).max(100),
  url: z.string().trim().url().max(2000),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']).default('GET'),
  headers: z.record(z.string().regex(/^[A-Za-z0-9-]{1,64}$/), z.string().max(4000)).optional(),
  body: z.string().max(64_000).nullable().optional(),
  timeoutMs: z.number().int().min(500).max(60_000).default(10_000),
  intervalSeconds: z.number().int().min(30).max(86_400).default(60),
  expectedStatusCodes: z.array(z.number().int().min(100).max(599)).max(20).default([200]),
  assertions: z.array(assertion).max(10).default([]),
  retries: z.number().int().min(0).max(5).default(1),
  failureThreshold: z.number().int().min(1).max(20).default(3),
  recoveryThreshold: z.number().int().min(1).max(20).default(2),
  degradedLatencyMs: z.number().int().min(1).max(60_000).nullable().optional(),
  severity: severity.default('sev2'),
  autoCreateTask: z.boolean().default(true),
  enabled: z.boolean().default(true),
};
const monitorCreate = z.object({ serviceId: z.number().int().positive(), ...monitorFields }).strict();
const monitorUpdate = z
  .object(Object.fromEntries(Object.entries(monitorFields).map(([k, v]) => [k, (v as z.ZodTypeAny).optional()])) as { [K in keyof typeof monitorFields]: z.ZodOptional<(typeof monitorFields)[K]> })
  .strict();

function shapeMonitor(m: Record<string, unknown> & { headersEncrypted: string | null; headerNames: unknown }) {
  const { headersEncrypted: _secret, lockedUntil: _lock, ...rest } = m;
  // Header values (which may contain credentials) are write-only; only names come back.
  return { ...rest, headerNames: Array.isArray(m.headerNames) ? m.headerNames : [] };
}

function safeUrlOrThrow(url: string) {
  try {
    assertSafeUrl(url);
  } catch (error) {
    throw badRequest(error instanceof UnsafeTargetError ? error.message : 'Invalid URL');
  }
}

async function serviceOf(companyId: number, id: number) {
  const s = await db.orm.public.Service.where({ id, companyId }).first();
  if (!s) throw notFound('Service');
  return s;
}

async function userMap(ids: Array<number | null | undefined>) {
  const unique = [...new Set(ids.filter((v): v is number => typeof v === 'number'))];
  const users = unique.length ? await db.orm.public.User.where((u) => u.id.in(unique)).all() : [];
  return new Map(users.map((u) => [u.id, { id: u.id, name: displayName(u), email: u.email, avatarUrl: u.avatarUrl }]));
}

/** Hourly buckets of checks for charts (avg latency + uptime). */
function bucketize(checks: Array<{ status: string; latencyMs: number | null; checkedAt: string }>, bucketMs: number) {
  const map = new Map<number, { up: number; total: number; lat: number[] }>();
  for (const c of checks) {
    const k = Math.floor(Date.parse(c.checkedAt) / bucketMs) * bucketMs;
    const b = map.get(k) ?? { up: 0, total: 0, lat: [] };
    if (c.status !== 'maintenance') {
      b.total++;
      if (c.status === 'healthy' || c.status === 'degraded') b.up++;
    }
    if (c.latencyMs !== null) b.lat.push(c.latencyMs);
    map.set(k, b);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, b]) => ({ t: new Date(k).toISOString(), uptime: b.total ? Math.round((b.up / b.total) * 1000) / 10 : null, avgLatencyMs: b.lat.length ? Math.round(b.lat.reduce((x, y) => x + y, 0) / b.lat.length) : null }));
}

export async function opsRoutes(ctx: RouteContext): Promise<Response | null> {
  const { segments: seg, method, auth, searchParams } = ctx;
  const companyId = auth.companyId;

  // ================= Monitors =================
  if (seg[0] === 'monitors') {
    if (method === 'GET') ctx.need('services:read');
    else ctx.need('monitors:manage');

    if (seg.length === 1 && method === 'GET') {
      const serviceId = Number(searchParams.get('serviceId'));
      const rows = await db.orm.public.Monitor.where(Number.isInteger(serviceId) && serviceId > 0 ? { companyId, serviceId } : { companyId }).orderBy((m) => m.name.asc()).all();
      return ok({ monitors: rows.map(shapeMonitor) });
    }
    if (seg.length === 1 && method === 'POST') {
      const body = await parseBody(ctx, monitorCreate);
      await serviceOf(companyId, body.serviceId);
      safeUrlOrThrow(body.url);
      const headers = body.headers ?? {};
      const row = await db.orm.public.Monitor.create({
        companyId,
        serviceId: body.serviceId,
        name: body.name,
        url: body.url,
        method: body.method,
        headersEncrypted: Object.keys(headers).length ? encryptSecret(JSON.stringify(headers)) : null,
        headerNames: Object.keys(headers) as never,
        body: body.body ?? null,
        timeoutMs: body.timeoutMs,
        intervalSeconds: body.intervalSeconds,
        expectedStatusCodes: body.expectedStatusCodes as never,
        assertions: body.assertions as never,
        retries: body.retries,
        failureThreshold: body.failureThreshold,
        recoveryThreshold: body.recoveryThreshold,
        degradedLatencyMs: body.degradedLatencyMs ?? null,
        severity: body.severity,
        autoCreateTask: body.autoCreateTask,
        enabled: body.enabled,
        status: 'pending',
        nextCheckAt: new Date().toISOString(),
      });
      await db.orm.public.Service.where({ id: body.serviceId, companyId, healthStatus: 'unknown' }).update({ healthStatus: 'pending' });
      return ok({ monitor: shapeMonitor(row) }, 201);
    }
    // POST /monitors/test — dry run with an unsaved configuration.
    if (seg[1] === 'test' && method === 'POST') {
      const body = await parseBody(ctx, monitorCreate.partial({ serviceId: true, name: true }));
      safeUrlOrThrow(body.url);
      const headers = body.headers ?? {};
      const result = await performCheck({
        ...body,
        retries: 0,
        headersEncrypted: Object.keys(headers).length ? encryptSecret(JSON.stringify(headers)) : null,
      } as never);
      return ok({ result });
    }

    const id = intParam(seg[1], 'Monitor');
    const monitor = await db.orm.public.Monitor.where({ id, companyId }).first();
    if (!monitor) throw notFound('Monitor');

    if (seg.length === 2 && method === 'GET') {
      const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
      const checks = await db.orm.public.MonitorCheck.where((c) => and(c.monitorId.eq(id), c.checkedAt.gte(since))).orderBy((c) => c.checkedAt.asc()).all();
      return ok({ monitor: shapeMonitor(monitor), stats24h: summarizeChecks(checks), series: bucketize(checks, 15 * 60_000) });
    }
    if (seg.length === 2 && method === 'PATCH') {
      const body = await parseBody(ctx, monitorUpdate);
      if (body.url) safeUrlOrThrow(body.url);
      const update: Record<string, unknown> = { ...body };
      if (body.headers !== undefined) {
        delete update.headers;
        update.headersEncrypted = Object.keys(body.headers).length ? encryptSecret(JSON.stringify(body.headers)) : null;
        update.headerNames = Object.keys(body.headers);
      }
      if (body.enabled === true && !monitor.enabled) update.nextCheckAt = new Date().toISOString();
      const row = await db.orm.public.Monitor.where({ id }).update(update as never);
      return ok({ monitor: row ? shapeMonitor(row) : null });
    }
    if (seg.length === 2 && method === 'DELETE') {
      await db.orm.public.Monitor.where({ id }).delete();
      return ok();
    }
    if (seg[2] === 'run' && method === 'POST') {
      await runMonitor(id);
      const fresh = await db.orm.public.Monitor.where({ id }).first();
      return ok({ monitor: fresh ? shapeMonitor(fresh) : null });
    }
    if (seg[2] === 'checks' && method === 'GET') {
      const { limit, offset } = pageParams(searchParams, 100, 500);
      const status = searchParams.get('status');
      let q = db.orm.public.MonitorCheck.where({ monitorId: id });
      if (status) q = q.where({ status: status as never });
      const checks = await q.orderBy((c) => c.checkedAt.desc()).offset(offset).limit(limit).all();
      return ok({ checks });
    }
  }

  // ================= Service overview, dependencies, map, maintenance status =================
  if (seg[0] === 'services' && seg[1] && ['overview', 'dependencies', 'metrics'].includes(seg[2] ?? '')) {
    const id = intParam(seg[1], 'Service');
    const service = await serviceOf(companyId, id);
    if (method === 'GET') ctx.need('services:read');
    else ctx.need('services:manage');

    if (seg[2] === 'metrics' && method === 'GET') {
      const hours = Math.min(Math.max(Number(searchParams.get('hours')) || 24, 1), 24 * 30);
      const since = new Date(Date.now() - hours * 3_600_000).toISOString();
      const checks = await db.orm.public.MonitorCheck.select('status', 'latencyMs', 'checkedAt').where((c) => and(c.serviceId.eq(id), c.checkedAt.gte(since))).orderBy((c) => c.checkedAt.asc()).all();
      const deployments = await db.orm.public.Deployment.where((d) => and(d.serviceId.eq(id), d.deployedAt.gte(since))).orderBy((d) => d.deployedAt.asc()).all();
      return ok({ summary: summarizeChecks(checks), series: bucketize(checks, hours <= 24 ? 15 * 60_000 : hours <= 168 ? 3_600_000 : 6 * 3_600_000), deployments: deployments.map((d) => ({ id: d.id, version: d.version, deployedAt: d.deployedAt, status: d.status })) });
    }

    if (seg[2] === 'overview' && method === 'GET') {
      const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const [monitors, incidents, deployments, deps, dependents, checks30] = await Promise.all([
        db.orm.public.Monitor.where({ serviceId: id, companyId }).all(),
        db.orm.public.Incident.where({ serviceId: id }).orderBy((i) => i.detectedAt.desc()).limit(20).all(),
        db.orm.public.Deployment.where({ serviceId: id }).orderBy((d) => d.deployedAt.desc()).limit(10).all(),
        db.orm.public.ServiceDependency.where({ serviceId: id }).all(),
        db.orm.public.ServiceDependency.where({ dependsOnId: id }).all(),
        db.orm.public.MonitorCheck.select('status', 'latencyMs', 'checkedAt').where((c) => and(c.serviceId.eq(id), c.checkedAt.gte(since30))).all(),
      ]);
      const relatedIds = [...deps.map((d) => d.dependsOnId), ...dependents.map((d) => d.serviceId)];
      const related = relatedIds.length ? await db.orm.public.Service.where((s) => and(s.companyId.eq(companyId), s.id.in(relatedIds))).all() : [];
      const users = await userMap([service.ownerId, service.backupOwnerId]);
      const day = checks30.filter((c) => Date.parse(c.checkedAt) >= Date.now() - 86_400_000);
      const week = checks30.filter((c) => Date.parse(c.checkedAt) >= Date.now() - 7 * 86_400_000);
      const team = service.teamId ? await import('../../../prisma/tenant.js').then(({ withTenant }) => withTenant(auth.orgId, (tx) => tx.orm.public.Team.where({ id: service.teamId!, organizationId: auth.orgId }).first())) : null;
      const maintenance = await activeMaintenanceFor(companyId, id, null);
      const shapeRel = (sid: number, kind: string, depId: number) => {
        const s = related.find((r) => r.id === sid);
        return s ? { dependencyId: depId, id: s.id, name: s.name, serviceType: s.serviceType, healthStatus: s.healthStatus, kind } : null;
      };
      return ok({
        owner: service.ownerId ? users.get(service.ownerId) ?? null : null,
        backupOwner: service.backupOwnerId ? users.get(service.backupOwnerId) ?? null : null,
        team: team ? { id: team.id, name: team.name } : null,
        maintenance: maintenance ? { id: maintenance.id, name: maintenance.name, endsAt: maintenance.endsAt } : null,
        monitors: monitors.map(shapeMonitor),
        uptime: { day: summarizeChecks(day), week: summarizeChecks(week), month: summarizeChecks(checks30) },
        dailyUptime: bucketize(checks30, 86_400_000),
        incidents: incidents.map((i) => ({ id: i.id, title: i.title, severity: i.severity, status: i.status, detectedAt: i.detectedAt, resolvedAt: i.resolvedAt })),
        deployments,
        dependencies: deps.map((d) => shapeRel(d.dependsOnId, d.kind, d.id)).filter(Boolean),
        dependents: dependents.map((d) => shapeRel(d.serviceId, d.kind, d.id)).filter(Boolean),
      });
    }

    if (seg[2] === 'dependencies') {
      if (method === 'POST') {
        const body = await parseBody(ctx, z.object({ dependsOnId: z.number().int().positive(), kind: z.enum(['hard', 'soft']).default('hard') }).strict());
        if (body.dependsOnId === id) throw badRequest('A service cannot depend on itself');
        await serviceOf(companyId, body.dependsOnId);
        const reverse = await db.orm.public.ServiceDependency.where({ serviceId: body.dependsOnId, dependsOnId: id }).first();
        if (reverse) throw badRequest('That would create a circular dependency');
        const exists = await db.orm.public.ServiceDependency.where({ serviceId: id, dependsOnId: body.dependsOnId }).first();
        if (exists) throw conflict('This dependency already exists');
        const row = await db.orm.public.ServiceDependency.create({ companyId, serviceId: id, dependsOnId: body.dependsOnId, kind: body.kind });
        return ok({ dependency: row }, 201);
      }
      if (method === 'DELETE' && seg[3]) {
        const depId = intParam(seg[3], 'Dependency');
        await db.orm.public.ServiceDependency.where({ id: depId, companyId, serviceId: id }).delete();
        return ok();
      }
    }
  }

  if (seg[0] === 'dependency-map' && method === 'GET') {
    ctx.need('services:read');
    const [services, edges, open] = await Promise.all([
      db.orm.public.Service.where({ companyId }).all(),
      db.orm.public.ServiceDependency.where({ companyId }).all(),
      db.orm.public.Incident.where((i) => and(i.companyId.eq(companyId), i.status.neq('resolved'))).all(),
    ]);
    // Impact analysis: everything downstream (transitively) of a failing service is "at risk".
    const failing = new Set(services.filter((s) => s.healthStatus === 'down' || s.healthStatus === 'degraded').map((s) => s.id));
    const atRisk = new Set<number>();
    const queue = [...failing];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const e of edges.filter((x) => x.dependsOnId === cur)) {
        if (!atRisk.has(e.serviceId) && !failing.has(e.serviceId)) {
          atRisk.add(e.serviceId);
          queue.push(e.serviceId);
        }
      }
    }
    return ok({
      nodes: services.map((s) => ({
        id: s.id,
        name: s.name,
        serviceType: s.serviceType,
        environment: s.environment,
        criticality: s.criticality,
        healthStatus: s.healthStatus,
        atRisk: atRisk.has(s.id),
        openIncidentId: open.find((i) => i.serviceId === s.id)?.id ?? null,
      })),
      edges: edges.map((e) => ({ id: e.id, from: e.serviceId, to: e.dependsOnId, kind: e.kind })),
    });
  }

  // ================= Deployments =================
  if (seg[0] === 'deployments') {
    if (method === 'GET' && seg.length === 1) {
      ctx.need('services:read');
      const { limit, offset } = pageParams(searchParams, 50, 200);
      const serviceId = Number(searchParams.get('serviceId'));
      const env = searchParams.get('environment');
      let q = db.orm.public.Deployment.where({ companyId });
      if (Number.isInteger(serviceId) && serviceId > 0) q = q.where({ serviceId });
      if (env) q = q.where({ environment: env });
      const rows = await q.orderBy((d) => d.deployedAt.desc()).offset(offset).limit(limit).all();
      const services = await db.orm.public.Service.where({ companyId }).all();
      // Related incidents: opened on the same service within 2h after the deployment.
      const incidents = rows.length
        ? await db.orm.public.Incident.where((i) => and(i.companyId.eq(companyId), i.detectedAt.gte(rows[rows.length - 1]!.deployedAt))).all()
        : [];
      return ok({
        deployments: rows.map((d) => ({
          ...d,
          serviceName: services.find((s) => s.id === d.serviceId)?.name ?? 'Unknown',
          relatedIncidents: incidents
            .filter((i) => i.serviceId === d.serviceId && Date.parse(i.detectedAt) >= Date.parse(d.deployedAt) && Date.parse(i.detectedAt) - Date.parse(d.deployedAt) <= 2 * 3_600_000)
            .map((i) => ({ id: i.id, title: i.title, severity: i.severity })),
        })),
      });
    }
    if (method === 'POST' && seg.length === 1) {
      ctx.need('deployments:create');
      const body = await parseBody(ctx, deploymentSchema);
      const service = await serviceOf(companyId, body.serviceId);
      const row = await recordDeployment(companyId, service, { ...body, source: 'manual', createdById: auth.userId });
      return ok({ deployment: row }, 201);
    }
  }

  // ================= Status pages (admin) =================
  if (seg[0] === 'status-pages') {
    if (method === 'GET') ctx.need('services:read');
    else ctx.need('statuspages:manage');
    if (seg.length === 1 && method === 'GET') {
      const pages = await db.orm.public.StatusPage.where({ companyId }).orderBy((p) => p.name.asc()).all();
      const links = pages.length ? await db.orm.public.StatusPageService.where((l) => l.statusPageId.in(pages.map((p) => p.id))).all() : [];
      return ok({ statusPages: pages.map((p) => ({ ...p, serviceIds: links.filter((l) => l.statusPageId === p.id).sort((a, b) => a.position - b.position).map((l) => l.serviceId) })) });
    }
    if (seg.length === 1 && method === 'POST') {
      const body = await parseBody(ctx, statusPageSchema);
      const clash = await db.orm.public.StatusPage.where({ slug: body.slug }).first();
      if (clash) throw conflict('That URL slug is already taken');
      const page = await db.orm.public.StatusPage.create({ companyId, name: body.name, slug: body.slug, description: body.description ?? null, isPublic: body.isPublic, brandColor: body.brandColor ?? null, logoUrl: body.logoUrl ?? null, supportUrl: body.supportUrl ?? null, showIncidentHistory: body.showIncidentHistory });
      await setStatusPageServices(companyId, page.id, body.serviceIds);
      return ok({ statusPage: page }, 201);
    }
    const id = intParam(seg[1], 'Status page');
    const page = await db.orm.public.StatusPage.where({ id, companyId }).first();
    if (!page) throw notFound('Status page');
    if (method === 'PATCH') {
      const body = await parseBody(ctx, statusPageSchema.partial());
      if (body.slug && body.slug !== page.slug) {
        const clash = await db.orm.public.StatusPage.where({ slug: body.slug }).first();
        if (clash) throw conflict('That URL slug is already taken');
      }
      const { serviceIds, ...rest } = body;
      const updated = await db.orm.public.StatusPage.where({ id }).update(rest as never);
      if (serviceIds) await setStatusPageServices(companyId, id, serviceIds);
      return ok({ statusPage: updated });
    }
    if (method === 'DELETE') {
      await db.orm.public.StatusPage.where({ id }).delete();
      return ok();
    }
    if (method === 'GET' && seg[2] === 'preview') return ok({ page: await renderStatusPage(page) });
  }

  // ================= On-call =================
  if (seg[0] === 'oncall') {
    if (method === 'GET') ctx.need('incidents:read');
    else ctx.need('oncall:manage');
    if (seg[1] === 'schedules' && seg.length === 2) {
      if (method === 'GET') {
        const schedules = await db.orm.public.OnCallSchedule.where({ companyId }).orderBy((s) => s.name.asc()).all();
        const overrides = schedules.length ? await db.orm.public.OnCallOverride.where((o) => o.scheduleId.in(schedules.map((s) => s.id))).all() : [];
        const users = await userMap([...schedules.flatMap((s) => participantIds(s.participants)), ...overrides.map((o) => o.userId)]);
        return ok({
          schedules: schedules.map((s) => {
            const mine = overrides.filter((o) => o.scheduleId === s.id);
            const now = onCallAt(s, mine);
            return {
              ...s,
              participants: participantIds(s.participants).map((id) => users.get(id) ?? { id, name: `User #${id}`, email: '' }),
              current: { ...now, primaryUser: now.primary ? users.get(now.primary) ?? null : null, secondaryUser: now.secondary ? users.get(now.secondary) ?? null : null },
              overrides: mine.filter((o) => Date.parse(o.endsAt) > Date.now()).map((o) => ({ ...o, user: users.get(o.userId) ?? null })),
            };
          }),
        });
      }
      if (method === 'POST') {
        const body = await parseBody(ctx, scheduleSchema);
        await assertMembers(ctx, body.participants);
        const row = await db.orm.public.OnCallSchedule.create({ companyId, name: body.name, description: body.description ?? null, teamId: body.teamId ?? null, timezone: body.timezone, rotationHours: body.rotationHours, rotationStart: body.rotationStart, participants: body.participants as never });
        return ok({ schedule: row }, 201);
      }
    }
    if (seg[1] === 'schedules' && seg[2]) {
      const id = intParam(seg[2], 'Schedule');
      const schedule = await db.orm.public.OnCallSchedule.where({ id, companyId }).first();
      if (!schedule) throw notFound('Schedule');
      if (seg.length === 3 && method === 'PATCH') {
        const body = await parseBody(ctx, scheduleSchema.partial());
        if (body.participants) await assertMembers(ctx, body.participants);
        return ok({ schedule: await db.orm.public.OnCallSchedule.where({ id }).update(body as never) });
      }
      if (seg.length === 3 && method === 'DELETE') {
        await db.orm.public.OnCallSchedule.where({ id }).delete();
        return ok();
      }
      if (seg[3] === 'calendar' && method === 'GET') {
        const from = new Date(searchParams.get('from') ?? Date.now());
        const days = Math.min(Math.max(Number(searchParams.get('days')) || 28, 1), 90);
        const to = new Date(from.getTime() + days * 86_400_000);
        const overrides = await db.orm.public.OnCallOverride.where({ scheduleId: id }).all();
        const shifts = shiftsBetween(schedule, from, to);
        const users = await userMap([...shifts.map((s) => s.userId), ...overrides.map((o) => o.userId)]);
        return ok({
          shifts: shifts.map((s) => ({ ...s, user: users.get(s.userId) ?? null })),
          overrides: overrides.filter((o) => Date.parse(o.endsAt) >= from.getTime() && Date.parse(o.startsAt) <= to.getTime()).map((o) => ({ ...o, user: users.get(o.userId) ?? null })),
        });
      }
      if (seg[3] === 'overrides' && method === 'POST') {
        const body = await parseBody(ctx, z.object({ userId: z.number().int().positive(), startsAt: z.string().datetime({ offset: true }), endsAt: z.string().datetime({ offset: true }), reason: z.string().max(500).nullable().optional() }).strict());
        if (Date.parse(body.endsAt) <= Date.parse(body.startsAt)) throw badRequest('Override must end after it starts');
        await assertMembers(ctx, [body.userId]);
        const row = await db.orm.public.OnCallOverride.create({ scheduleId: id, userId: body.userId, startsAt: body.startsAt, endsAt: body.endsAt, reason: body.reason ?? null, createdById: auth.userId });
        return ok({ override: row }, 201);
      }
      if (seg[3] === 'overrides' && seg[4] && method === 'DELETE') {
        await db.orm.public.OnCallOverride.where({ id: intParam(seg[4], 'Override'), scheduleId: id }).delete();
        return ok();
      }
    }
    if (seg[1] === 'now' && method === 'GET') {
      const schedules = await db.orm.public.OnCallSchedule.where({ companyId }).all();
      const overrides = schedules.length ? await db.orm.public.OnCallOverride.where((o) => o.scheduleId.in(schedules.map((s) => s.id))).all() : [];
      const rows = schedules.map((s) => ({ schedule: { id: s.id, name: s.name }, ...onCallAt(s, overrides.filter((o) => o.scheduleId === s.id)) }));
      const users = await userMap(rows.flatMap((r) => [r.primary, r.secondary]));
      return ok({ onCall: rows.map((r) => ({ ...r, primaryUser: r.primary ? users.get(r.primary) ?? null : null, secondaryUser: r.secondary ? users.get(r.secondary) ?? null : null })) });
    }
  }

  return null;
}

// ---------- helpers shared with public routes ----------

export const deploymentSchema = z
  .object({
    serviceId: z.number().int().positive(),
    environment: z.enum(['production', 'staging', 'development']),
    version: z.string().trim().min(1).max(100),
    commitSha: z.string().trim().regex(/^[0-9a-f]{7,40}$/i).nullable().optional(),
    repositoryUrl: z.string().url().max(500).nullable().optional(),
    author: z.string().trim().max(100).nullable().optional(),
    status: z.enum(['pending', 'in_progress', 'succeeded', 'failed', 'rolled_back']).default('succeeded'),
    description: z.string().trim().max(2000).nullable().optional(),
    url: z.string().url().max(500).nullable().optional(),
    externalId: z.string().max(200).nullable().optional(),
    deployedAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export async function recordDeployment(
  companyId: number,
  service: { id: number; name: string },
  d: z.infer<typeof deploymentSchema> & { source: string; createdById?: number | null },
) {
  const deployedAt = d.deployedAt ?? new Date().toISOString();
  if (d.externalId) {
    const existing = await db.orm.public.Deployment.where({ serviceId: service.id, source: d.source, externalId: d.externalId }).first();
    if (existing) return db.orm.public.Deployment.where({ id: existing.id }).update({ status: d.status });
  }
  const row = await db.orm.public.Deployment.create({
    companyId,
    serviceId: service.id,
    environment: d.environment,
    version: d.version,
    commitSha: d.commitSha ?? null,
    repositoryUrl: d.repositoryUrl ?? null,
    author: d.author ?? null,
    status: d.status,
    description: d.description ?? null,
    url: d.url ?? null,
    source: d.source,
    externalId: d.externalId ?? null,
    deployedAt,
    createdById: d.createdById ?? null,
  });
  if (d.status === 'succeeded') await db.orm.public.Service.where({ id: service.id }).update({ currentVersion: d.version, lastDeployedAt: deployedAt });
  // Deployment marker on any open incident of the service.
  const open = await db.orm.public.Incident.where((i) => and(i.serviceId.eq(service.id), i.status.neq('resolved'))).first();
  if (open) {
    await db.orm.public.IncidentEvent.create({ incidentId: open.id, eventType: 'deployment', message: `Deployment ${d.version} to ${d.environment} (${d.status})${d.commitSha ? ` · ${d.commitSha.slice(0, 7)}` : ''}${d.author ? ` by ${d.author}` : ''}`, occurredAt: deployedAt });
  }
  await emitEvent(companyId, 'deployment.created', { deployment: { id: row.id, version: row.version, environment: row.environment, status: row.status }, service: { id: service.id, name: service.name } });
  return row;
}

const statusPageSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{2,62}$/, 'Use 3-63 lowercase letters, digits and dashes'),
    description: z.string().trim().max(1000).nullable().optional(),
    isPublic: z.boolean().default(false),
    brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
    logoUrl: z.string().url().max(500).refine((v) => v.startsWith('https://'), 'Logo must use HTTPS').nullable().optional(),
    supportUrl: z.string().url().max(500).nullable().optional(),
    showIncidentHistory: z.boolean().default(true),
    serviceIds: z.array(z.number().int().positive()).max(100).default([]),
  })
  .strict();

async function setStatusPageServices(companyId: number, pageId: number, serviceIds: number[]) {
  const owned = serviceIds.length ? await db.orm.public.Service.where((s) => and(s.companyId.eq(companyId), s.id.in(serviceIds))).all() : [];
  await db.orm.public.StatusPageService.where({ statusPageId: pageId }).deleteAll();
  for (const [position, sid] of serviceIds.entries()) {
    if (owned.some((s) => s.id === sid)) await db.orm.public.StatusPageService.create({ statusPageId: pageId, serviceId: sid, position });
  }
}

/**
 * The data a status page shows. Only explicitly listed services appear, and only customer-safe fields:
 * display name, health, daily uptime, and titles/status of incidents on those services. No internal ids
 * of people, descriptions, URLs or timelines are exposed.
 */
export async function renderStatusPage(page: { id: number; companyId: number; name: string; slug: string; description: string | null; brandColor: string | null; logoUrl: string | null; supportUrl: string | null; showIncidentHistory: boolean }) {
  const links = (await db.orm.public.StatusPageService.where({ statusPageId: page.id }).all()).sort((a, b) => a.position - b.position);
  const ids = links.map((l) => l.serviceId);
  const services = ids.length ? await db.orm.public.Service.where((s) => and(s.companyId.eq(page.companyId), s.id.in(ids))).all() : [];
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const checks = ids.length ? await db.orm.public.MonitorCheck.select('serviceId', 'status', 'latencyMs', 'checkedAt').where((c) => and(c.serviceId.in(ids), c.checkedAt.gte(since))).all() : [];
  const incidents = ids.length ? await db.orm.public.Incident.where((i) => and(i.serviceId.in(ids), i.detectedAt.gte(since))).orderBy((i) => i.detectedAt.desc()).limit(50).all() : [];
  const windows = await db.orm.public.MaintenanceWindow.where((w) => and(w.companyId.eq(page.companyId), w.enabled.eq(true), w.endsAt.gte(new Date().toISOString()))).all();
  const publicStatus = (h: string) => (h === 'down' ? 'major_outage' : h === 'degraded' ? 'degraded_performance' : h === 'maintenance' ? 'under_maintenance' : h === 'healthy' ? 'operational' : 'unknown');
  const rows = links
    .map((l) => {
      const s = services.find((x) => x.id === l.serviceId);
      if (!s) return null;
      const mine = checks.filter((c) => c.serviceId === s.id);
      return { key: `svc-${l.position}`, name: l.displayName || s.name, status: publicStatus(s.healthStatus), uptime90d: summarizeChecks(mine).uptimePercent, daily: bucketize(mine, 86_400_000).map((d) => ({ date: d.t.slice(0, 10), uptime: d.uptime })) };
    })
    .filter(Boolean);
  const worst = rows.some((r) => r!.status === 'major_outage') ? 'major_outage' : rows.some((r) => r!.status === 'degraded_performance') ? 'degraded_performance' : rows.some((r) => r!.status === 'under_maintenance') ? 'under_maintenance' : 'operational';
  const nameOf = (sid: number) => {
    const l = links.find((x) => x.serviceId === sid);
    return l?.displayName || services.find((s) => s.id === sid)?.name || 'Service';
  };
  const shapeInc = (i: (typeof incidents)[number]) => ({ title: i.title, status: i.status, severity: i.severity, service: nameOf(i.serviceId), startedAt: i.detectedAt, resolvedAt: i.resolvedAt });
  return {
    name: page.name,
    slug: page.slug,
    description: page.description,
    brandColor: page.brandColor,
    logoUrl: page.logoUrl,
    supportUrl: page.supportUrl,
    overallStatus: worst,
    services: rows,
    activeIncidents: incidents.filter((i) => i.status !== 'resolved').map(shapeInc),
    incidentHistory: page.showIncidentHistory ? incidents.filter((i) => i.status === 'resolved').map(shapeInc) : [],
    scheduledMaintenance: windows
      .filter((w) => {
        const wIds = [...(Array.isArray(w.serviceIds) ? (w.serviceIds as number[]) : []), ...(w.serviceId ? [w.serviceId] : [])];
        return wIds.length === 0 || wIds.some((id) => ids.includes(id));
      })
      .map((w) => ({ name: w.name, description: w.description, startsAt: w.startsAt, endsAt: w.endsAt, recurrence: w.recurrence })),
    generatedAt: new Date().toISOString(),
  };
}

const scheduleSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(1000).nullable().optional(),
    teamId: z.string().uuid().nullable().optional(),
    timezone: z.string().trim().min(1).max(64).default('UTC'),
    rotationHours: z.number().int().min(1).max(24 * 28).default(168),
    rotationStart: z.string().datetime({ offset: true }),
    participants: z.array(z.number().int().positive()).min(1).max(50),
  })
  .strict();

async function assertMembers(ctx: RouteContext, userIds: number[]) {
  const { withTenant } = await import('../../../prisma/tenant.js');
  const members = await withTenant(ctx.auth.orgId, (tx) => tx.orm.public.Membership.where({ organizationId: ctx.auth.orgId }).all());
  const allowed = new Set(members.map((m) => m.userId));
  if (userIds.some((id) => !allowed.has(id))) throw badRequest('Every participant must be a member of this organization');
}
