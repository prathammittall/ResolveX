import { and, or } from '@prisma/orm-postgres/orm-client';
import { db } from '../../prisma/db.js';
import { decryptSecret } from '../../lib/crypto.js';
import { log } from '../../lib/logger.js';
import { safeRequest, UnsafeTargetError } from '../../lib/safe-http.js';
import { activeMaintenanceFor } from '../incident-engine/maintenance.js';
import { openOrAttachIncident, recordRecovery } from '../incident-engine/lifecycle.js';
import { emitEvent } from '../integrations/webhooks.js';
import type { IncidentSeverityValue } from '../incident-engine/types.js';

export type Assertion =
  | { type: 'body_contains'; value: string }
  | { type: 'body_not_contains'; value: string }
  | { type: 'header_equals'; name: string; value: string }
  | { type: 'json_path_equals'; path: string; value: string }
  | { type: 'latency_below'; ms: number };

export type MonitorRow = Awaited<ReturnType<typeof loadMonitor>> & {};
async function loadMonitor(id: number) {
  return db.orm.public.Monitor.where({ id }).first();
}

export type CheckOutcome = {
  status: 'healthy' | 'degraded' | 'down';
  statusCode: number | null;
  latencyMs: number | null;
  error: string | null;
  attempt: number;
};

function readJsonPath(value: unknown, path: string): unknown {
  return path
    .replace(/^\$\.?/, '')
    .split('.')
    .filter(Boolean)
    .reduce<unknown>((acc, key) => {
      if (acc === null || acc === undefined) return undefined;
      const m = /^(\w+)\[(\d+)\]$/.exec(key);
      if (m) {
        const arr = (acc as Record<string, unknown>)[m[1]!];
        return Array.isArray(arr) ? arr[Number(m[2])] : undefined;
      }
      return (acc as Record<string, unknown>)[key];
    }, value);
}

function evaluateAssertions(assertions: Assertion[], res: { body: string; headers: Record<string, string>; latencyMs: number }): string | null {
  let parsed: unknown;
  for (const a of assertions) {
    switch (a.type) {
      case 'body_contains':
        if (!res.body.includes(a.value)) return `Response body does not contain "${a.value}"`;
        break;
      case 'body_not_contains':
        if (res.body.includes(a.value)) return `Response body contains forbidden text "${a.value}"`;
        break;
      case 'header_equals':
        if ((res.headers[a.name.toLowerCase()] ?? '') !== a.value) return `Header ${a.name} is "${res.headers[a.name.toLowerCase()] ?? ''}", expected "${a.value}"`;
        break;
      case 'json_path_equals': {
        try {
          parsed ??= JSON.parse(res.body);
        } catch {
          return 'Response body is not valid JSON';
        }
        const actual = readJsonPath(parsed, a.path);
        if (String(actual) !== a.value) return `${a.path} is ${JSON.stringify(actual)}, expected ${a.value}`;
        break;
      }
      case 'latency_below':
        if (res.latencyMs >= a.ms) return `Latency ${res.latencyMs}ms is above ${a.ms}ms`;
        break;
    }
  }
  return null;
}

function headersOf(monitor: { headersEncrypted: string | null }): Record<string, string> {
  if (!monitor.headersEncrypted) return {};
  try {
    const parsed = JSON.parse(decryptSecret(monitor.headersEncrypted)) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Perform one check (with retries) without touching state. */
export async function performCheck(monitor: NonNullable<MonitorRow>): Promise<CheckOutcome> {
  const expected = Array.isArray(monitor.expectedStatusCodes) ? (monitor.expectedStatusCodes as number[]) : [200];
  const assertions = Array.isArray(monitor.assertions) ? (monitor.assertions as Assertion[]) : [];
  const attempts = Math.min(Math.max(monitor.retries, 0), 5) + 1;
  let last: CheckOutcome = { status: 'down', statusCode: null, latencyMs: null, error: 'Not attempted', attempt: 0 };
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await safeRequest({
        url: monitor.url,
        method: monitor.method,
        headers: headersOf(monitor),
        body: monitor.body ?? undefined,
        timeoutMs: monitor.timeoutMs,
        maxBodyBytes: 512 * 1024,
      });
      const statusOk = expected.length === 0 ? res.status >= 200 && res.status < 400 : expected.includes(res.status);
      const assertionError = statusOk ? evaluateAssertions(assertions, res) : null;
      if (!statusOk) {
        last = { status: 'down', statusCode: res.status, latencyMs: res.latencyMs, error: `Unexpected status ${res.status} (expected ${expected.join(', ') || '2xx/3xx'})`, attempt };
      } else if (assertionError) {
        last = { status: 'down', statusCode: res.status, latencyMs: res.latencyMs, error: assertionError, attempt };
      } else if (monitor.degradedLatencyMs && res.latencyMs > monitor.degradedLatencyMs) {
        return { status: 'degraded', statusCode: res.status, latencyMs: res.latencyMs, error: `Slow response: ${res.latencyMs}ms > ${monitor.degradedLatencyMs}ms`, attempt };
      } else {
        return { status: 'healthy', statusCode: res.status, latencyMs: res.latencyMs, error: null, attempt };
      }
    } catch (error) {
      const message = error instanceof UnsafeTargetError ? `Blocked: ${error.message}` : error instanceof Error ? error.message : 'Request failed';
      last = { status: 'down', statusCode: null, latencyMs: null, error: message.slice(0, 500), attempt };
      if (error instanceof UnsafeTargetError) break; // retrying a blocked target is pointless
    }
    if (attempt < attempts) await new Promise((r) => setTimeout(r, 1_000 * attempt));
  }
  return last;
}

/** Recompute a service's health from its monitors (worst wins). */
async function refreshServiceHealth(serviceId: number): Promise<string | null> {
  const monitors = await db.orm.public.Monitor.where({ serviceId, enabled: true }).all();
  if (monitors.length === 0) return null;
  const order = ['down', 'degraded', 'maintenance', 'pending', 'healthy', 'unknown'];
  const worst = monitors.map((m) => m.status).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] ?? 'pending';
  const service = await db.orm.public.Service.where({ id: serviceId }).first();
  if (service && service.healthStatus !== worst) {
    await db.orm.public.Service.where({ id: serviceId }).update({ healthStatus: worst as never });
    await emitEvent(service.companyId, 'service.health_changed', { service: { id: service.id, name: service.name, healthStatus: worst, previous: service.healthStatus } });
  }
  return worst;
}

/** Run a check and advance the monitor's state machine (thresholds, incidents, recovery). */
export async function runMonitor(monitorId: number): Promise<void> {
  const monitor = await loadMonitor(monitorId);
  if (!monitor || !monitor.enabled) return;
  const outcome = await performCheck(monitor);
  const now = new Date();
  const nowIso = now.toISOString();
  const maintenance = await activeMaintenanceFor(monitor.companyId, monitor.serviceId, monitor.severity);

  await db.orm.public.MonitorCheck.create({
    companyId: monitor.companyId,
    monitorId: monitor.id,
    serviceId: monitor.serviceId,
    status: maintenance && outcome.status !== 'healthy' ? 'maintenance' : outcome.status,
    statusCode: outcome.statusCode,
    latencyMs: outcome.latencyMs,
    error: outcome.error,
    attempt: outcome.attempt,
    checkedAt: nowIso,
  });

  const failing = outcome.status === 'down';
  const failures = failing ? monitor.consecutiveFailures + 1 : 0;
  const successes = failing ? 0 : monitor.consecutiveSuccesses + 1;
  let status = monitor.status as string;

  if (maintenance) {
    status = failing ? 'maintenance' : outcome.status;
  } else if (failing) {
    if (failures >= monitor.failureThreshold) status = 'down';
  } else if (status === 'down') {
    // Recovery must be verified by `recoveryThreshold` consecutive good checks.
    if (successes >= monitor.recoveryThreshold) status = outcome.status;
  } else {
    status = outcome.status;
  }

  await db.orm.public.Monitor.where({ id: monitor.id }).update({
    status: status as never,
    consecutiveFailures: failures,
    consecutiveSuccesses: successes,
    lastCheckedAt: nowIso,
    lastLatencyMs: outcome.latencyMs,
    lastStatusCode: outcome.statusCode,
    lastError: outcome.error,
    nextCheckAt: new Date(now.getTime() + monitor.intervalSeconds * 1000).toISOString(),
    lockedUntil: null,
  });
  await refreshServiceHealth(monitor.serviceId);

  const service = await db.orm.public.Service.where({ id: monitor.serviceId }).first();
  if (!service) return;

  // Verified outage: crossed the threshold (or still failing with no open incident, e.g. one was resolved early).
  if (status === 'down' && !maintenance) {
    const open = await db.orm.public.Incident.where((i) => and(i.serviceId.eq(service.id), i.status.neq('resolved'))).first();
    if (failures === monitor.failureThreshold || !open) {
      await openOrAttachIncident({
        companyId: monitor.companyId,
        serviceId: service.id,
        severity: monitor.severity as IncidentSeverityValue,
        title: `${service.name} is down — ${monitor.name}`,
        description: `${monitor.method} ${monitor.url} failed ${failures} consecutive checks: ${outcome.error ?? 'unknown error'}`,
        source: 'monitor',
        occurredAt: nowIso,
        autoCreateTask: monitor.autoCreateTask,
      });
    }
  }
  if (monitor.status === 'down' && status !== 'down' && !maintenance) {
    await recordRecovery(
      monitor.companyId,
      service.id,
      `Monitor "${monitor.name}" recovered: ${monitor.recoveryThreshold} consecutive successful checks (last ${outcome.latencyMs ?? '?'}ms, HTTP ${outcome.statusCode ?? '?'})`,
    );
  }
}

/** Worker step: claim and run due monitors (bounded concurrency). */
export async function runDueMonitors(concurrency = Number(process.env.MONITOR_CONCURRENCY) || 10): Promise<number> {
  const now = new Date().toISOString();
  const due = await db.orm.public.Monitor.where((m) =>
    and(m.enabled.eq(true), or(m.nextCheckAt.isNull(), m.nextCheckAt.lte(now)), or(m.lockedUntil.isNull(), m.lockedUntil.lte(now))),
  )
    .orderBy((m) => m.nextCheckAt.asc({ nulls: 'first' }))
    .limit(concurrency)
    .all();
  const claimed: number[] = [];
  for (const m of due) {
    const lock = new Date(Date.now() + Math.max(m.timeoutMs * (m.retries + 1) + 30_000, 60_000)).toISOString();
    const row = await db.orm.public.Monitor.where((x) => and(x.id.eq(m.id), or(x.lockedUntil.isNull(), x.lockedUntil.lte(now)))).update({ lockedUntil: lock });
    if (row) claimed.push(m.id);
  }
  await Promise.all(
    claimed.map((id) =>
      runMonitor(id).catch(async (error) => {
        log.error('monitor.run_failed', { monitorId: id, error: error instanceof Error ? error.message : 'unknown' });
        await db.orm.public.Monitor.where({ id }).update({ lockedUntil: null, nextCheckAt: new Date(Date.now() + 60_000).toISOString() });
      }),
    ),
  );
  return claimed.length;
}

/** Retention: keep raw check history for MONITOR_RETENTION_DAYS (default 30). */
export async function pruneMonitorChecks(): Promise<void> {
  const days = Number(process.env.MONITOR_RETENTION_DAYS) || 30;
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  await db.orm.public.MonitorCheck.where((c) => c.checkedAt.lt(cutoff)).deleteAll();
}

/** Aggregate stats for a monitor/service over a window. */
export function summarizeChecks(checks: Array<{ status: string; latencyMs: number | null; checkedAt: string }>) {
  const counted = checks.filter((c) => c.status !== 'maintenance');
  const up = counted.filter((c) => c.status === 'healthy' || c.status === 'degraded').length;
  const latencies = checks.map((c) => c.latencyMs).filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);
  const pct = (p: number) => (latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))]! : null);
  return {
    totalChecks: checks.length,
    failures: counted.length - up,
    uptimePercent: counted.length ? Math.round((up / counted.length) * 100_000) / 1000 : null,
    avgLatencyMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
    p95LatencyMs: pct(95),
    p99LatencyMs: pct(99),
  };
}
