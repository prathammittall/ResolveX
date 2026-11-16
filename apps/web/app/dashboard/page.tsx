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
  Sparkles,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
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
  const { user } = useAuth();
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

  const displayName = user?.name || user?.username || user?.email?.split('@')[0] || 'Engineer';

  return (
    <div className="space-y-7">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#dfdbcc] pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#dcefd8] text-[#177a43] text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Operations Pulse
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#14201a]">
            Good morning, {displayName}
          </h1>
          <p className="mt-1 text-sm text-[#5f6b64]">
            Here’s what’s happening across your connected engineering projects and services today.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link href="/dashboard/projects" className="btn-kizupi-white text-xs px-3.5 py-2">
            View Projects
          </Link>
          <Link href="/dashboard/services" className="btn-kizupi-go text-xs px-3.5 py-2">
            Register Service
          </Link>
        </div>
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
          sub={`${metrics?.services.healthy ?? 0} healthy operational`}
        />
        <MetricCard
          label="Total Services"
          value={metrics?.services.total ?? 0}
          icon={Server}
          accent="blue"
          sub={`${metrics?.services.unknown ?? 0} awaiting telemetry`}
        />
        <MetricCard
          label="Alerts (24h)"
          value={metrics?.alerts.total ?? 0}
          icon={Activity}
          accent="violet"
          sub={`${metrics?.alerts.processed ?? 0} deduplicated & processed`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent incidents */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#dfdbcc]/80 px-5 py-4 bg-[#fbfaf6]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#dc2626]" />
                <h3 className="font-display text-base font-bold text-[#14201a]">
                  Active Incidents
                </h3>
              </div>
              <Link
                href="/dashboard/incidents"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#177a43] hover:underline"
              >
                View all incidents <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {incidents.filter((i) => i.status !== 'resolved').length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                <div className="w-12 h-12 rounded-full bg-[#dcefd8] flex items-center justify-center text-[#177a43] mb-3">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <p className="text-sm font-bold text-[#14201a]">All systems operational</p>
                <p className="mt-1 text-xs text-[#5f6b64]">No active production incidents right now. Great job!</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#dfdbcc]/60">
                {incidents
                  .filter((i) => i.status !== 'resolved')
                  .slice(0, 6)
                  .map((inc) => (
                    <li key={inc.id}>
                      <Link
                        href={`/dashboard/incidents/${inc.id}`}
                        className="flex items-center justify-between px-5 py-3.5 transition hover:bg-[#f6f4ec]"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <SeverityBadge severity={inc.severity} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[#14201a]">
                              {inc.title}
                            </p>
                            <p className="truncate text-xs text-[#5f6b64]">
                              {inc.serviceName} · Detected {timeAgo(inc.detectedAt)}
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
          <div className="rounded-2xl border border-[#dfdbcc] bg-white p-5 shadow-[0_2px_0_#dfdbcc]">
            <h3 className="font-display text-base font-bold text-[#14201a]">
              Active by Severity
            </h3>
            <div className="mt-4 space-y-3">
              {(['sev1', 'sev2', 'sev3', 'sev4'] as const).map((sev) => {
                const count = metrics?.severity[sev] ?? 0;
                const total = metrics?.incidents.active ?? 0;
                const pct = total > 0 ? (count / total) * 100 : 0;
                const barCls =
                  sev === 'sev1'
                    ? 'bg-[#dc2626]'
                    : sev === 'sev2'
                      ? 'bg-[#ea580c]'
                      : sev === 'sev3'
                        ? 'bg-[#d97706]'
                        : 'bg-[#0284c7]';
                return (
                  <div key={sev}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-bold text-[#5f6b64]">{sev.toUpperCase()}</span>
                      <span className="font-extrabold text-[#14201a]">{count}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#eeebe0]">
                      <div className={cn('h-full rounded-full transition-all duration-300', barCls)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {metrics && metrics.incidents.active === 0 && (
                <p className="pt-2 text-xs text-[#5f6b64]">No active incidents to break down.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[#dfdbcc] bg-white p-5 shadow-[0_2px_0_#dfdbcc]">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-[#177a43]" />
              <h3 className="font-display text-base font-bold text-[#14201a]">
                Service Health Breakdown
              </h3>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2.5 text-sm">
              {(
                [
                  ['Healthy', metrics?.services.healthy ?? 0, 'text-[#177a43]', 'bg-[#dcefd8]/50 border-[#b2e2a8]'],
                  ['Degraded', metrics?.services.degraded ?? 0, 'text-[#b45309]', 'bg-[#fef3c7]/60 border-[#fde68a]'],
                  ['Down', metrics?.services.down ?? 0, 'text-[#dc2626]', 'bg-[#fee2e2]/60 border-[#fecaca]'],
                  ['Unknown', metrics?.services.unknown ?? 0, 'text-[#64748b]', 'bg-[#f1f5f9] border-[#cbd5e1]'],
                ] as const
              ).map(([label, val, color, boxStyle]) => (
                <div key={label} className={cn('flex items-center justify-between rounded-xl border px-3 py-2', boxStyle)}>
                  <span className="text-xs font-semibold text-[#3d4a42]">{label}</span>
                  <span className={cn('font-extrabold text-base', color)}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Resolved incidents (compact) */}
      {incidents.some((i) => i.status === 'resolved') && (
        <div className="rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc] overflow-hidden">
          <div className="border-b border-[#dfdbcc]/80 px-5 py-4 bg-[#fbfaf6]">
            <h3 className="font-display text-base font-bold text-[#14201a]">
              Recently Resolved
            </h3>
          </div>
          <ul className="divide-y divide-[#dfdbcc]/60">
            {incidents
              .filter((i) => i.status === 'resolved')
              .slice(0, 5)
              .map((inc) => (
                <li key={inc.id} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-[#f6f4ec] transition">
                  <Link href={`/dashboard/incidents/${inc.id}`} className="flex items-center gap-3 hover:underline">
                    <SeverityBadge severity={inc.severity} />
                    <span className="truncate font-semibold text-[#14201a]">{inc.title}</span>
                  </Link>
                  <span className="text-xs text-[#5f6b64]">
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
