'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Activity, AlertTriangle, ArrowLeft, Gauge, Pause, Pencil, Play, Timer, Trash2 } from 'lucide-react';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { can } from '../../../../lib/permissions';
import type { ServiceHealthStatus, ServiceItem } from '../../../../lib/types';
import { ErrorBanner, HealthBadge, MetricCard, SectionCard, SeverityBadge, formatDateTime, timeAgo } from '../../_components/ui';
import { Button, LineChart, PageHeader, Select, Skeleton, SkeletonRows, pct, useApi, useConfirm, useToast } from '../../_components/kit';
import { MonitorFormModal, describeAssertion, formatInterval, type CheckStats, type Monitor, type MonitorCheck, type SeriesPoint } from '../MonitorForm';

const CHECK_PAGE = 50;

function shortTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function MonitorDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { user } = useAuth();
  const canManage = can(user?.role, 'monitors:manage');
  const toast = useToast();
  const confirm = useConfirm();
  const detail = useApi<{ monitor: Monitor; stats24h: CheckStats; series: SeriesPoint[] }>(id ? `/api/monitors/${id}` : null);
  const services = useApi<{ services: ServiceItem[] }>('/api/services');
  const [formOpen, setFormOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [toggling, setToggling] = useState(false);

  // Check history with status filter + "load more".
  const [statusFilter, setStatusFilter] = useState<'' | ServiceHealthStatus>('');
  const [checks, setChecks] = useState<MonitorCheck[]>([]);
  const [checksLoading, setChecksLoading] = useState(true);
  const [checksMore, setChecksMore] = useState(false);
  const [checksError, setChecksError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const checksUrl = useCallback(
    (offset: number) => {
      const p = new URLSearchParams({ limit: String(CHECK_PAGE), offset: String(offset) });
      if (statusFilter) p.set('status', statusFilter);
      return `/api/monitors/${id}/checks?${p.toString()}`;
    },
    [id, statusFilter],
  );

  const loadChecks = useCallback(async () => {
    if (!id) return;
    setChecksLoading(true);
    setChecksError(null);
    try {
      const res = await api.get<{ checks: MonitorCheck[] }>(checksUrl(0));
      setChecks(res.checks);
      setHasMore(res.checks.length === CHECK_PAGE);
    } catch (err) {
      setChecksError(err instanceof Error ? err.message : 'Failed to load checks');
    } finally {
      setChecksLoading(false);
    }
  }, [id, checksUrl]);

  useEffect(() => {
    void loadChecks();
  }, [loadChecks]);

  async function moreChecks() {
    setChecksMore(true);
    try {
      const res = await api.get<{ checks: MonitorCheck[] }>(checksUrl(checks.length));
      setChecks((c) => [...c, ...res.checks]);
      setHasMore(res.checks.length === CHECK_PAGE);
    } catch (err) {
      toast.error(err);
    } finally {
      setChecksMore(false);
    }
  }

  const m = detail.data?.monitor;
  const serviceList = useMemo(() => services.data?.services ?? [], [services.data]);
  const service = m ? serviceList.find((s) => s.id === m.serviceId) : undefined;

  async function runNow() {
    if (!m) return;
    setRunning(true);
    try {
      const res = await api.post<{ monitor: Monitor | null }>(`/api/monitors/${m.id}/run`);
      toast.success(`Check complete: ${res.monitor?.status ?? 'done'}`);
      detail.reload();
      void loadChecks();
    } catch (err) {
      toast.error(err);
    } finally {
      setRunning(false);
    }
  }

  async function toggleEnabled() {
    if (!m) return;
    setToggling(true);
    try {
      await api.patch(`/api/monitors/${m.id}`, { enabled: !m.enabled });
      toast.success(m.enabled ? 'Monitor paused' : 'Monitor enabled');
      detail.reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setToggling(false);
    }
  }

  async function remove() {
    if (!m) return;
    const ok = await confirm({ title: `Delete ${m.name}?`, message: 'The monitor and its entire check history will be removed. This cannot be undone.', confirmLabel: 'Delete monitor', danger: true });
    if (!ok) return;
    try {
      await api.del(`/api/monitors/${m.id}`);
      toast.success('Monitor deleted');
      router.push('/dashboard/monitors');
    } catch (err) {
      toast.error(err);
    }
  }

  const closeForm = useCallback(() => setFormOpen(false), []);

  if (detail.loading && !detail.data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-56" />
        <SkeletonRows rows={5} />
      </div>
    );
  }
  if (detail.error || !m) {
    return (
      <div className="space-y-3">
        <Link href="/dashboard/monitors" className="inline-flex items-center gap-1 text-sm font-semibold text-[#5f6b64] hover:text-[#14201a]"><ArrowLeft className="h-4 w-4" /> Monitors</Link>
        <ErrorBanner message={detail.error ?? 'Monitor not found'} />
        <Button variant="secondary" size="sm" onClick={detail.reload}>Retry</Button>
      </div>
    );
  }

  const stats = detail.data!.stats24h;
  const series = detail.data!.series;
  const labels = series.map((p) => shortTime(p.t));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link href="/dashboard/monitors" className="hover:underline">Monitors</Link>
            <span>/</span>
            <Link href={`/dashboard/services/${m.serviceId}`} className="hover:underline">{service?.name ?? `Service #${m.serviceId}`}</Link>
          </span>
        }
        title={m.name}
        description={`${m.method} ${m.url}`}
        actions={
          canManage && (
            <>
              <Button variant="secondary" onClick={runNow} loading={running}><Play className="h-4 w-4" /> Run now</Button>
              <Button variant="secondary" onClick={toggleEnabled} loading={toggling}>{m.enabled ? <><Pause className="h-4 w-4" /> Pause</> : <><Play className="h-4 w-4" /> Enable</>}</Button>
              <Button variant="secondary" onClick={() => setFormOpen(true)}><Pencil className="h-4 w-4" /> Edit</Button>
              <Button variant="danger" onClick={remove} aria-label="Delete monitor"><Trash2 className="h-4 w-4" /></Button>
            </>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-3 text-sm text-[#3d4a42]">
        <HealthBadge status={m.status} />
        {!m.enabled && <span className="rounded-full border border-[#fde68a] bg-[#fef3c7] px-2.5 py-0.5 text-xs font-semibold text-[#92400e]">Paused</span>}
        <span>Last check: <b className="text-[#14201a]">{m.lastCheckedAt ? timeAgo(m.lastCheckedAt) : 'never'}</b></span>
        {m.lastStatusCode !== null && <span>HTTP <b className="text-[#14201a]">{m.lastStatusCode}</b></span>}
        {m.enabled && m.nextCheckAt && <span>Next: {formatDateTime(m.nextCheckAt)}</span>}
      </div>
      {m.lastError && m.status !== 'healthy' && (
        <div className="flex items-start gap-2 rounded-xl border border-[#fecaca] bg-[#fee2e2] px-4 py-3 text-sm text-[#991b1b]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="break-words"><b>Last error:</b> {m.lastError}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Uptime (24h)" value={pct(stats.uptimePercent)} icon={Activity} accent={stats.uptimePercent === null ? 'slate' : stats.uptimePercent >= 99.5 ? 'emerald' : stats.uptimePercent >= 95 ? 'amber' : 'rose'} sub={`${stats.totalChecks} checks`} />
        <MetricCard label="Avg latency" value={stats.avgLatencyMs !== null ? `${stats.avgLatencyMs} ms` : '—'} icon={Timer} accent="blue" />
        <MetricCard label="p95 latency" value={stats.p95LatencyMs !== null ? `${stats.p95LatencyMs} ms` : '—'} icon={Gauge} accent="violet" sub={stats.p99LatencyMs != null ? `p99 ${stats.p99LatencyMs} ms` : undefined} />
        <MetricCard label="Failures (24h)" value={stats.failures} icon={AlertTriangle} accent={stats.failures ? 'rose' : 'emerald'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Latency" subtitle="Average per 15 minutes, last 24h">
          <LineChart labels={labels} series={[{ label: 'Avg latency', color: '#0284c7', values: series.map((p) => p.avgLatencyMs) }]} unit=" ms" area />
        </SectionCard>
        <SectionCard title="Uptime" subtitle="Successful checks per 15 minutes, last 24h">
          <LineChart labels={labels} series={[{ label: 'Uptime', color: '#177a43', values: series.map((p) => p.uptime) }]} unit="%" area />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard
          title="Check history"
          action={
            <Select className="w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ServiceHealthStatus | '')} aria-label="Filter checks by status">
              <option value="">All results</option>
              <option value="healthy">Healthy</option>
              <option value="degraded">Degraded</option>
              <option value="down">Down</option>
              <option value="maintenance">Maintenance</option>
            </Select>
          }
        >
          {checksError ? (
            <div className="space-y-2"><ErrorBanner message={checksError} /><Button variant="secondary" size="sm" onClick={loadChecks}>Retry</Button></div>
          ) : checksLoading ? (
            <SkeletonRows rows={5} />
          ) : checks.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#5f6b64]">{statusFilter ? 'No checks with this result.' : 'No checks have run yet.'}</p>
          ) : (
            <>
              <div className="-mx-5 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#dfdbcc] text-xs font-bold uppercase tracking-wide text-[#5f6b64]">
                      <th className="px-5 py-2">Time</th>
                      <th className="px-3 py-2">Result</th>
                      <th className="px-3 py-2">HTTP</th>
                      <th className="px-3 py-2">Latency</th>
                      <th className="px-3 py-2">Attempt</th>
                      <th className="px-5 py-2">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#dfdbcc]">
                    {checks.map((c) => (
                      <tr key={c.id}>
                        <td className="whitespace-nowrap px-5 py-2 text-xs text-[#3d4a42]">{formatDateTime(c.checkedAt)}</td>
                        <td className="px-3 py-2"><HealthBadge status={c.status} /></td>
                        <td className="px-3 py-2 font-mono text-xs">{c.statusCode ?? '—'}</td>
                        <td className="px-3 py-2 text-xs">{c.latencyMs !== null ? `${c.latencyMs} ms` : '—'}</td>
                        <td className="px-3 py-2 text-xs">{c.attempt}</td>
                        <td className="max-w-[260px] truncate px-5 py-2 text-xs text-[#991b1b]" title={c.error ?? undefined}>{c.error ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {hasMore && (
                <div className="mt-3 flex justify-center">
                  <Button variant="secondary" size="sm" onClick={moreChecks} loading={checksMore}>Load more</Button>
                </div>
              )}
            </>
          )}
        </SectionCard>

        <SectionCard title="Configuration">
          <dl className="space-y-2.5 text-sm">
            <Row k="Interval">{formatInterval(m.intervalSeconds)}</Row>
            <Row k="Timeout">{m.timeoutMs} ms</Row>
            <Row k="Expected codes">{(m.expectedStatusCodes ?? [200]).join(', ')}</Row>
            <Row k="Retries">{m.retries}</Row>
            <Row k="Fails before down">{m.failureThreshold}</Row>
            <Row k="Passes to recover">{m.recoveryThreshold}</Row>
            <Row k="Degraded above">{m.degradedLatencyMs ? `${m.degradedLatencyMs} ms` : '—'}</Row>
            <Row k="Incident severity"><SeverityBadge severity={m.severity} /></Row>
            <Row k="Auto-create task">{m.autoCreateTask ? 'Yes' : 'No'}</Row>
            <Row k="Headers">{m.headerNames.length ? <span className="font-mono text-xs">{m.headerNames.join(', ')}</span> : '—'}</Row>
            {m.body && <Row k="Body"><span className="font-mono text-xs">{m.body.length > 80 ? `${m.body.slice(0, 80)}…` : m.body}</span></Row>}
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Assertions</dt>
              <dd className="mt-1">
                {(m.assertions ?? []).length === 0 ? (
                  <span className="text-[#5f6b64]">Status code only</span>
                ) : (
                  <ul className="space-y-1">
                    {(m.assertions ?? []).map((a, i) => <li key={i} className="rounded-md bg-[#fbfaf6] px-2 py-1 font-mono text-xs text-[#3d4a42]">{describeAssertion(a)}</li>)}
                  </ul>
                )}
              </dd>
            </div>
            <Row k="Consecutive">{m.consecutiveFailures} fail / {m.consecutiveSuccesses} pass</Row>
            <Row k="Created">{formatDateTime(m.createdAt)}</Row>
          </dl>
        </SectionCard>
      </div>

      <MonitorFormModal open={formOpen} monitor={m} services={serviceList} onClose={closeForm} onSaved={() => { detail.reload(); }} />
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-xs font-bold uppercase tracking-wide text-[#5f6b64]">{k}</dt>
      <dd className="text-right text-[#14201a]">{children}</dd>
    </div>
  );
}
