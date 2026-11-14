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
        <h1 className="font-sans text-2xl sm:text-3xl font-black tracking-tight text-[#171a1f] dark:text-white">Overview</h1>
        <p className="mt-1 text-sm text-[#574f47] dark:text-zinc-400">
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
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent incidents */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-[#cbbaa9] dark:border-zinc-800 bg-[#eedccb] dark:bg-[#101117] shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#cbbaa9]/80 dark:border-zinc-800/80 px-5 py-4">
              <h3 className="font-sans text-base font-bold text-[#171a1f] dark:text-white">
                Active Incidents
              </h3>
              <Link
                href="/dashboard/incidents"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#ff5414] hover:underline"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {incidents.filter((i) => i.status !== 'resolved').length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <ShieldCheck className="h-8 w-8 text-emerald-500" />
                <p className="mt-3 text-sm font-bold text-[#171a1f] dark:text-white">All systems operational</p>
                <p className="mt-1 text-xs text-[#574f47] dark:text-zinc-400">No active incidents right now.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#cbbaa9]/60 dark:divide-zinc-800">
                {incidents
                  .filter((i) => i.status !== 'resolved')
                  .slice(0, 6)
                  .map((inc) => (
                    <li key={inc.id}>
                      <Link
                        href={`/dashboard/incidents/${inc.id}`}
                        className="flex items-center justify-between px-5 py-3.5 transition hover:bg-[#dfcebe]/60 dark:hover:bg-zinc-800/50"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <SeverityBadge severity={inc.severity} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#171a1f] dark:text-zinc-200">
                              {inc.title}
                            </p>
                            <p className="truncate text-xs text-[#675d54] dark:text-zinc-400">
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
          <div className="rounded-2xl border border-[#cbbaa9] dark:border-zinc-800 bg-[#eedccb] dark:bg-[#101117] p-5 shadow-sm">
            <h3 className="font-sans text-base font-bold text-[#171a1f] dark:text-white">
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
                      <span className="font-semibold text-[#574f47] dark:text-zinc-400">{sev.toUpperCase()}</span>
                      <span className="font-bold text-[#171a1f] dark:text-white font-mono">{count}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#dfcebe] dark:bg-zinc-800">
                      <div className={cn('h-full rounded-full transition-all', barCls)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {metrics && metrics.incidents.active === 0 && (
                <p className="pt-2 text-xs text-[#675d54] dark:text-zinc-500">No active incidents to break down.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[#cbbaa9] dark:border-zinc-800 bg-[#eedccb] dark:bg-[#101117] p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-[#ff5414]" />
              <h3 className="font-sans text-base font-bold text-[#171a1f] dark:text-white">
                Service Health
              </h3>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {(
                [
                  ['Healthy', metrics?.services.healthy ?? 0, 'text-emerald-600 dark:text-emerald-400'],
                  ['Degraded', metrics?.services.degraded ?? 0, 'text-amber-600 dark:text-amber-400'],
                  ['Down', metrics?.services.down ?? 0, 'text-rose-600 dark:text-rose-400'],
                  ['Unknown', metrics?.services.unknown ?? 0, 'text-zinc-500 dark:text-zinc-400'],
                ] as const
              ).map(([label, val, color]) => (
                <div key={label} className="flex items-center justify-between rounded-xl bg-[#dfcebe]/80 dark:bg-zinc-900 border border-[#cbbaa9]/50 dark:border-zinc-800 px-3 py-2">
                  <span className="text-xs font-medium text-[#574f47] dark:text-zinc-300">{label}</span>
                  <span className={cn('font-bold font-mono', color)}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Resolved incidents (compact) */}
      {incidents.some((i) => i.status === 'resolved') && (
        <div className="rounded-2xl border border-[#cbbaa9] dark:border-zinc-800 bg-[#eedccb] dark:bg-[#101117] shadow-sm overflow-hidden">
          <div className="border-b border-[#cbbaa9]/80 dark:border-zinc-800/80 px-5 py-4">
            <h3 className="font-sans text-base font-bold text-[#171a1f] dark:text-white">
              Recently Resolved
            </h3>
          </div>
          <ul className="divide-y divide-[#cbbaa9]/60 dark:divide-zinc-800">
            {incidents
              .filter((i) => i.status === 'resolved')
              .slice(0, 5)
              .map((inc) => (
                <li key={inc.id} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-[#dfcebe]/60 dark:hover:bg-zinc-800/50 transition">
                  <Link href={`/dashboard/incidents/${inc.id}`} className="flex items-center gap-3 hover:underline">
                    <SeverityBadge severity={inc.severity} />
                    <span className="truncate font-semibold text-[#171a1f] dark:text-zinc-200">{inc.title}</span>
                  </Link>
                  <span className="text-xs text-[#675d54] dark:text-zinc-400">
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
