'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Server,
  ShieldCheck,
  Activity,
  ArrowRight,
  CircleAlert,
  Gauge,
} from 'lucide-react';
import { api } from '../../lib/api';
import type {
  IncidentsResponse,
  MetricsResponse,
  IncidentItem,
  Metrics,
} from '../../lib/types';
import {
  ErrorBanner,
  MetricCard,
  PageLoader,
  SeverityBadge,
  StatusBadge,
  cn,
  formatDateTime,
  timeAgo,
} from './_components/ui';

export default function OverviewPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [m, inc] = await Promise.all([
          api.get<MetricsResponse>('/api/metrics'),
          api.get<IncidentsResponse>('/api/incidents'),
        ]);
        if (cancelled) return;
        setMetrics(m.metrics);
        setIncidents(inc.incidents);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-title text-2xl font-semibold text-slate-900">Overview</h1>
        <p className="mt-1 text-sm text-slate-500">
          Real-time health and incident summary for your workspace.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Active Incidents"
          value={metrics?.incidents.active ?? 0}
          icon={AlertTriangle}
          accent="rose"
          sub={`${metrics?.incidents.open ?? 0} open · ${metrics?.incidents.acknowledged ?? 0} acknowledged`}
        />
        <MetricCard
          label="Services Down / Degraded"
          value={(metrics?.services.down ?? 0) + (metrics?.services.degraded ?? 0)}
          icon={CircleAlert}
          accent="amber"
          sub={`${metrics?.services.healthy ?? 0} healthy`}
        />
        <MetricCard
          label="Total Services"
          value={metrics?.services.total ?? 0}
          icon={Server}
          accent="blue"
          sub={`${metrics?.services.unknown ?? 0} unknown status`}
        />
        <MetricCard
          label="Alerts (24h)"
          value={metrics?.alerts.total ?? 0}
          icon={Activity}
          accent="violet"
          sub={`${metrics?.alerts.processed ?? 0} processed`}
        />
        <MetricCard
          label="Average MTTA"
          value={metrics?.mtta.averageSeconds == null ? '—' : `${Math.round(metrics.mtta.averageSeconds / 60)}m`}
          icon={Gauge}
          accent="blue"
          sub={`${metrics?.mtta.acknowledgedIncidents ?? 0} incidents acknowledged`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="font-serif-title text-base font-semibold text-slate-900">Escalation health</h3>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-rose-50 px-3 py-2">
              <p className="text-xs text-rose-700">Awaiting acknowledgment</p>
              <p className="mt-1 text-xl font-semibold text-rose-800">
                {metrics?.escalation.unacknowledgedActiveIncidents ?? 0}
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-700">Exhausted</p>
              <p className="mt-1 text-xl font-semibold text-amber-800">{metrics?.escalation.exhausted ?? 0}</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Queue: {metrics?.queue.pending ?? 0} pending · {metrics?.queue.failed ?? 0} failed
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-2">
          <h3 className="font-serif-title text-base font-semibold text-slate-900">MTTA by severity</h3>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['sev1', 'sev2', 'sev3', 'sev4'] as const).map((severity) => {
              const seconds = metrics?.mtta[`${severity}Seconds`];
              return (
                <div key={severity} className="rounded-lg bg-slate-50 px-3 py-3">
                  <p className="text-xs font-medium uppercase text-slate-500">{severity}</p>
                  <p className="mt-1 text-lg font-semibold text-slate-800">
                    {seconds == null ? '—' : `${Math.round(seconds / 60)}m`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent incidents */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="font-serif-title text-base font-semibold text-slate-900">
                Active Incidents
              </h3>
              <Link
                href="/dashboard/incidents"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#25396e] hover:underline"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {incidents.filter((i) => i.status !== 'resolved').length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <ShieldCheck className="h-8 w-8 text-emerald-500" />
                <p className="mt-3 text-sm font-medium text-slate-700">All systems operational</p>
                <p className="mt-1 text-xs text-slate-400">No active incidents right now.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {incidents
                  .filter((i) => i.status !== 'resolved')
                  .slice(0, 6)
                  .map((inc) => (
                    <li key={inc.id}>
                      <Link
                        href={`/dashboard/incidents/${inc.id}`}
                        className="flex items-center justify-between px-5 py-3.5 transition hover:bg-slate-50"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <SeverityBadge severity={inc.severity} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {inc.title}
                            </p>
                            <p className="truncate text-xs text-slate-400">
                              {inc.serviceName} · {timeAgo(inc.detectedAt)}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={inc.status} />
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>

        {/* Severity breakdown + health */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="font-serif-title text-base font-semibold text-slate-900">
              Active by Severity
            </h3>
            <div className="mt-4 space-y-3">
              {(['sev1', 'sev2', 'sev3', 'sev4'] as const).map((sev) => {
                const count = metrics?.severity[sev] ?? 0;
                const total = metrics?.incidents.active ?? 0;
                const pct = total > 0 ? (count / total) * 100 : 0;
                const barCls =
                  sev === 'sev1'
                    ? 'bg-rose-500'
                    : sev === 'sev2'
                      ? 'bg-orange-500'
                      : sev === 'sev3'
                        ? 'bg-amber-500'
                        : 'bg-sky-500';
                return (
                  <div key={sev}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600">{sev.toUpperCase()}</span>
                      <span className="font-semibold text-slate-800">{count}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className={cn('h-full rounded-full transition-all', barCls)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {metrics && metrics.incidents.active === 0 && (
                <p className="pt-2 text-xs text-slate-400">No active incidents to break down.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-slate-400" />
              <h3 className="font-serif-title text-base font-semibold text-slate-900">
                Service Health
              </h3>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {(
                [
                  ['Healthy', metrics?.services.healthy ?? 0, 'text-emerald-600'],
                  ['Degraded', metrics?.services.degraded ?? 0, 'text-amber-600'],
                  ['Down', metrics?.services.down ?? 0, 'text-rose-600'],
                  ['Unknown', metrics?.services.unknown ?? 0, 'text-slate-500'],
                ] as const
              ).map(([label, val, color]) => (
                <div key={label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-slate-600">{label}</span>
                  <span className={cn('font-semibold', color)}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Resolved incidents (compact) */}
      {incidents.some((i) => i.status === 'resolved') && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="font-serif-title text-base font-semibold text-slate-900">
              Recently Resolved
            </h3>
          </div>
          <ul className="divide-y divide-slate-100">
            {incidents
              .filter((i) => i.status === 'resolved')
              .slice(0, 5)
              .map((inc) => (
                <li key={inc.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <Link href={`/dashboard/incidents/${inc.id}`} className="flex items-center gap-3 hover:underline">
                    <SeverityBadge severity={inc.severity} />
                    <span className="truncate font-medium text-slate-700">{inc.title}</span>
                  </Link>
                  <span className="text-xs text-slate-400">
                    {inc.resolvedAt ? `Resolved ${timeAgo(inc.resolvedAt)}` : formatDateTime(inc.detectedAt)}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
