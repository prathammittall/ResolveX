import { and } from '@prisma/orm-postgres/orm-client';
import { db } from '../../../prisma/db.js';
import { withTenant } from '../../../prisma/tenant.js';
import { displayName, ok, type RouteContext } from '../../../lib/http.js';
import { summarizeChecks } from '../../monitoring/engine.js';

const DAY = 86_400_000;
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/** Dashboard and insights computed from recorded data only (no sample/fake values). */
export async function analyticsRoutes(ctx: RouteContext): Promise<Response | null> {
  const { segments: seg, method, auth, searchParams } = ctx;
  if (seg[0] !== 'analytics' || method !== 'GET') return null;
  ctx.need('incidents:read');
  const companyId = auth.companyId;
  const orgId = auth.orgId;
  const days = Math.min(Math.max(Number(searchParams.get('days')) || 30, 1), 180);
  const since = new Date(Date.now() - days * DAY).toISOString();

  const [services, incidents, checks] = await Promise.all([
    db.orm.public.Service.where({ companyId }).all(),
    db.orm.public.Incident.where((i) => and(i.companyId.eq(companyId), i.detectedAt.gte(since))).all(),
    db.orm.public.MonitorCheck.select('serviceId', 'status', 'latencyMs', 'checkedAt').where((c) => and(c.companyId.eq(companyId), c.checkedAt.gte(since))).all(),
  ]);
  const activeIncidents = await db.orm.public.Incident.where((i) => and(i.companyId.eq(companyId), i.status.neq('resolved'))).all();

  // Daily buckets
  const dayKey = (iso: string) => iso.slice(0, 10);
  const dayList: string[] = [];
  for (let i = days - 1; i >= 0; i--) dayList.push(new Date(Date.now() - i * DAY).toISOString().slice(0, 10));

  const mttr = incidents.filter((i) => i.resolvedAt).map((i) => (Date.parse(i.resolvedAt!) - Date.parse(i.detectedAt)) / 1000);
  const mtta = incidents.filter((i) => i.mttaSeconds !== null).map((i) => i.mttaSeconds!);

  if (seg[1] === 'overview') {
    const tasks = await withTenant(orgId, async (tx) => {
      const statuses = await tx.orm.public.ProjectStatus.where({ organizationId: orgId }).all();
      const rows = await tx.orm.public.Task.select('id', 'statusId', 'assigneeId', 'dueDate', 'createdAt', 'completedAt').where({ organizationId: orgId }).all();
      return { statuses, rows };
    });
    const doneIds = new Set(tasks.statuses.filter((s) => s.category === 'done').map((s) => s.id));
    const openTasks = tasks.rows.filter((t) => !doneIds.has(t.statusId));
    const workloadIds = [...new Set([...openTasks.map((t) => t.assigneeId), ...activeIncidents.map((i) => i.assignedResponderId)].filter((v): v is number => v !== null))];
    const users = workloadIds.length ? await db.orm.public.User.where((u) => u.id.in(workloadIds)).all() : [];
    const summary = summarizeChecks(checks);
    return ok({
      range: { days, since },
      services: {
        total: services.length,
        healthy: services.filter((s) => s.healthStatus === 'healthy').length,
        degraded: services.filter((s) => s.healthStatus === 'degraded').length,
        down: services.filter((s) => s.healthStatus === 'down').length,
        maintenance: services.filter((s) => s.healthStatus === 'maintenance').length,
        unknown: services.filter((s) => ['unknown', 'pending'].includes(s.healthStatus)).length,
      },
      incidents: {
        active: activeIncidents.length,
        resolvedInRange: incidents.filter((i) => i.status === 'resolved').length,
        openedInRange: incidents.length,
        mttaSeconds: avg(mtta),
        mttrSeconds: avg(mttr),
        bySeverity: ['sev1', 'sev2', 'sev3', 'sev4'].map((s) => ({ severity: s, count: incidents.filter((i) => i.severity === s).length })),
        activeList: activeIncidents.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)).slice(0, 8).map((i) => ({ id: i.id, title: i.title, severity: i.severity, status: i.status, detectedAt: i.detectedAt, serviceName: services.find((s) => s.id === i.serviceId)?.name ?? '' })),
      },
      tasks: {
        open: openTasks.length,
        overdue: openTasks.filter((t) => t.dueDate && Date.parse(t.dueDate) < Date.now()).length,
        completedInRange: tasks.rows.filter((t) => t.completedAt && t.completedAt >= since).length,
      },
      monitoring: { uptimePercent: summary.uptimePercent, avgLatencyMs: summary.avgLatencyMs, p95LatencyMs: summary.p95LatencyMs, totalChecks: summary.totalChecks },
      series: dayList.map((d) => {
        const dc = checks.filter((c) => dayKey(c.checkedAt) === d);
        const s = summarizeChecks(dc);
        return {
          date: d,
          incidents: incidents.filter((i) => dayKey(i.detectedAt) === d).length,
          uptime: s.uptimePercent,
          avgLatencyMs: s.avgLatencyMs,
          tasksCreated: tasks.rows.filter((t) => dayKey(t.createdAt) === d).length,
          tasksCompleted: tasks.rows.filter((t) => t.completedAt && dayKey(t.completedAt) === d).length,
        };
      }),
      workload: workloadIds
        .map((id) => ({ userId: id, name: displayName(users.find((u) => u.id === id)), openTasks: openTasks.filter((t) => t.assigneeId === id).length, activeIncidents: activeIncidents.filter((i) => i.assignedResponderId === id).length }))
        .sort((a, b) => b.openTasks + b.activeIncidents * 3 - (a.openTasks + a.activeIncidents * 3))
        .slice(0, 10),
    });
  }

  if (seg[1] === 'insights') {
    const monitors = await db.orm.public.Monitor.where({ companyId }).all();
    const allChecksFailures = await db.orm.public.MonitorCheck.select('monitorId', 'status', 'error').where((c) => and(c.companyId.eq(companyId), c.checkedAt.gte(since), c.status.eq('down'))).all();
    const teams = await withTenant(orgId, (tx) => tx.orm.public.Team.where({ organizationId: orgId }).all());

    const byService = services.map((s) => {
      const inc = incidents.filter((i) => i.serviceId === s.id);
      const sc = checks.filter((c) => c.serviceId === s.id);
      const half = Date.now() - (days * DAY) / 2;
      const before = avg(sc.filter((c) => Date.parse(c.checkedAt) < half && c.latencyMs !== null).map((c) => c.latencyMs!));
      const after = avg(sc.filter((c) => Date.parse(c.checkedAt) >= half && c.latencyMs !== null).map((c) => c.latencyMs!));
      return {
        id: s.id,
        name: s.name,
        teamId: s.teamId,
        incidents: inc.length,
        sev12: inc.filter((i) => i.severity === 'sev1' || i.severity === 'sev2').length,
        downtimeMinutes: Math.round(inc.filter((i) => i.resolvedAt).reduce((a, i) => a + (Date.parse(i.resolvedAt!) - Date.parse(i.detectedAt)), 0) / 60_000),
        uptimePercent: summarizeChecks(sc).uptimePercent,
        latencyBefore: before,
        latencyAfter: after,
        latencyChangePercent: before && after ? Math.round(((after - before) / before) * 100) : null,
        mttrSeconds: avg(inc.filter((i) => i.resolvedAt).map((i) => (Date.parse(i.resolvedAt!) - Date.parse(i.detectedAt)) / 1000)),
      };
    });

    // Recurring patterns: normalised incident title prefix per service.
    const patterns = new Map<string, { service: string; pattern: string; count: number; lastAt: string }>();
    for (const i of incidents) {
      const pattern = i.title.replace(/\d+/g, '#').split(' — ')[0]!.slice(0, 80);
      const key = `${i.serviceId}:${pattern}`;
      const p = patterns.get(key) ?? { service: services.find((s) => s.id === i.serviceId)?.name ?? '', pattern, count: 0, lastAt: i.detectedAt };
      p.count++;
      if (i.detectedAt > p.lastAt) p.lastAt = i.detectedAt;
      patterns.set(key, p);
    }

    const errorSignatures = new Map<number, Map<string, number>>();
    for (const f of allChecksFailures) {
      const sig = (f.error ?? 'unknown').replace(/\d+/g, '#').slice(0, 80);
      const m = errorSignatures.get(f.monitorId) ?? new Map();
      m.set(sig, (m.get(sig) ?? 0) + 1);
      errorSignatures.set(f.monitorId, m);
    }

    const recommendations: string[] = [];
    const worst = [...byService].sort((a, b) => b.incidents - a.incidents)[0];
    if (worst && worst.incidents >= 3) recommendations.push(`${worst.name} had ${worst.incidents} incidents in ${days} days — prioritise a reliability review and check its postmortem action items.`);
    for (const s of byService.filter((x) => (x.latencyChangePercent ?? 0) >= 30)) recommendations.push(`${s.name} latency rose ${s.latencyChangePercent}% (${s.latencyBefore}ms → ${s.latencyAfter}ms) between the first and second half of the period.`);
    const unowned = services.filter((s) => !s.ownerId);
    if (unowned.length) recommendations.push(`${unowned.length} service(s) have no owner, so incidents fall back to admins: ${unowned.slice(0, 5).map((s) => s.name).join(', ')}.`);
    const unmonitored = services.filter((s) => !monitors.some((m) => m.serviceId === s.id));
    if (unmonitored.length) recommendations.push(`${unmonitored.length} service(s) have no API monitor, so outages are only detected by external alerts: ${unmonitored.slice(0, 5).map((s) => s.name).join(', ')}.`);
    for (const p of [...patterns.values()].filter((x) => x.count >= 3)) recommendations.push(`Recurring incident on ${p.service}: "${p.pattern}" happened ${p.count} times.`);

    return ok({
      range: { days, since },
      mostUnreliableServices: [...byService].sort((a, b) => b.incidents - a.incidents || (a.uptimePercent ?? 100) - (b.uptimePercent ?? 100)).slice(0, 10),
      degradingLatency: byService.filter((s) => (s.latencyChangePercent ?? 0) > 10).sort((a, b) => (b.latencyChangePercent ?? 0) - (a.latencyChangePercent ?? 0)).slice(0, 10),
      failingEndpoints: monitors
        .map((m) => ({ id: m.id, name: m.name, url: m.url, service: services.find((s) => s.id === m.serviceId)?.name ?? '', failures: [...(errorSignatures.get(m.id)?.values() ?? [])].reduce((a, b) => a + b, 0), topErrors: [...(errorSignatures.get(m.id)?.entries() ?? [])].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([error, count]) => ({ error, count })) }))
        .filter((m) => m.failures > 0)
        .sort((a, b) => b.failures - a.failures)
        .slice(0, 10),
      recurringPatterns: [...patterns.values()].filter((p) => p.count >= 2).sort((a, b) => b.count - a.count).slice(0, 10),
      teamWorkload: teams.map((t) => {
        const ts = byService.filter((s) => s.teamId === t.id);
        return { teamId: t.id, name: t.name, incidents: ts.reduce((a, s) => a + s.incidents, 0), services: ts.length };
      }),
      mttrSeconds: avg(mttr),
      mttaSeconds: avg(mtta),
      trend: dayList.map((d) => ({ date: d, incidents: incidents.filter((i) => dayKey(i.detectedAt) === d).length, uptime: summarizeChecks(checks.filter((c) => dayKey(c.checkedAt) === d)).uptimePercent })),
      recommendations,
    });
  }
  return null;
}
