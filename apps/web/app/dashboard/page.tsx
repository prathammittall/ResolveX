'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock,
  Gauge,
  ListTodo,
  RefreshCw,
  Server,
  ShieldCheck,
  Timer,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import type { IncidentSeverity, IncidentStatus } from '../../lib/types';
import { ErrorBanner, MetricCard, SectionCard, SeverityBadge, StatusBadge, timeAgo, formatDateTime } from './_components/ui';
import { Avatar } from './_components/work';
import { BarChart, Button, Donut, HBarList, LineChart, PageHeader, Pill, Select, Skeleton, formatDuration, pct, useApi } from './_components/kit';

type Overview = {
  range: { days: number; since: string };
  services: { total: number; healthy: number; degraded: number; down: number; maintenance: number; unknown: number };
  incidents: {
    active: number;
    resolvedInRange: number;
    openedInRange: number;
    mttaSeconds: number | null;
    mttrSeconds: number | null;
    bySeverity: Array<{ severity: IncidentSeverity; count: number }>;
    activeList: Array<{ id: number; title: string; severity: IncidentSeverity; status: IncidentStatus; detectedAt: string; serviceName: string }>;
  };
  tasks: { open: number; overdue: number; completedInRange: number };
  monitoring: { uptimePercent: number | null; avgLatencyMs: number | null; p95LatencyMs: number | null; totalChecks: number };
  series: Array<{ date: string; incidents: number; uptime: number | null; avgLatencyMs: number | null; tasksCreated: number; tasksCompleted: number }>;
  workload: Array<{ userId: number; name: string; openTasks: number; activeIncidents: number }>;
};

type OnCallPerson = { id: number; name: string; email: string; avatarUrl?: string | null } | null;
type OnCallNow = {
  onCall: Array<{
    schedule: { id: number; name: string };
    primary: number | null;
    secondary: number | null;
    shiftStart: string | null;
    shiftEnd: string | null;
    overridden: boolean;
    primaryUser: OnCallPerson;
    secondaryUser: OnCallPerson;
  }>;
};

const SEVERITY_COLORS: Record<IncidentSeverity, string> = { sev1: '#dc2626', sev2: '#e3a008', sev3: '#0284c7', sev4: '#7c3aed' };
const RANGES = [7, 30, 90] as const;

function shortDate(d: string) {
  const dt = new Date(`${d}T00:00:00Z`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <SectionCard title={title} subtitle={subtitle}>
      {children}
    </SectionCard>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading dashboard">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[240px] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function OnCallCard() {
  const { data, error, loading, reload } = useApi<OnCallNow>('/api/oncall/now');
  return (
    <SectionCard
      title="On call now"
      action={
        <Link href="/dashboard/oncall" className="inline-flex items-center gap-1 text-xs font-bold text-[#177a43] hover:underline">
          Schedules <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >
      {loading && !data ? (
        <div className="space-y-2" role="status" aria-label="Loading on-call">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : error ? (
        <div className="space-y-2">
          <ErrorBanner message={error} />
          <Button size="sm" variant="secondary" onClick={reload}>Retry</Button>
        </div>
      ) : !data || data.onCall.length === 0 ? (
        <div className="text-center text-sm text-[#5f6b64]">
          <CalendarClock className="mx-auto mb-2 h-6 w-6 text-[#5f6b64]" />
          No on-call schedules yet.{' '}
          <Link href="/dashboard/oncall" className="font-semibold text-[#177a43] hover:underline">Create one</Link>
        </div>
      ) : (
        <ul className="divide-y divide-[#dfdbcc]">
          {data.onCall.map((row) => (
            <li key={row.schedule.id} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-bold uppercase tracking-wide text-[#5f6b64]">{row.schedule.name}</span>
                {row.overridden && <Pill tone="violet">Override</Pill>}
              </div>
              {row.primaryUser ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <Avatar name={row.primaryUser.name} size={24} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#14201a]">{row.primaryUser.name}</p>
                    <p className="truncate text-xs text-[#5f6b64]">
                      {row.secondaryUser ? `Backup: ${row.secondaryUser.name}` : 'No backup'}
                      {row.shiftEnd ? ` · until ${formatDateTime(row.shiftEnd)}` : ''}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-sm text-[#92400e]">Nobody on call — add participants to this schedule.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export default function OverviewPage() {
  const { user } = useAuth();
  const [days, setDays] = useState<number>(30);
  const { data, error, loading, reload } = useApi<Overview>(`/api/analytics/overview?days=${days}`);

  const displayName = user?.name || user?.username || user?.email?.split('@')[0] || 'there';
  const labels = data?.series.map((s) => shortDate(s.date)) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations overview"
        title={`${greeting()}, ${displayName}`}
        description="Live health, incident and delivery metrics across your organization, computed from recorded data."
        actions={
          <>
            <label className="flex items-center gap-2 text-xs font-semibold text-[#5f6b64]">
              <span>Range</span>
              <Select aria-label="Time range" value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-auto py-1.5">
                {RANGES.map((r) => (
                  <option key={r} value={r}>Last {r} days</option>
                ))}
              </Select>
            </label>
            <Button variant="secondary" size="sm" onClick={reload} loading={loading && Boolean(data)} aria-label="Refresh dashboard">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Link href="/dashboard/insights" className="inline-flex items-center gap-1.5 rounded-xl border border-[#177a43] bg-[#177a43] px-2.5 py-1.5 text-xs font-semibold text-white">
              <TrendingUp className="h-3.5 w-3.5" /> Insights
            </Link>
          </>
        }
      />

      {error && (
        <div className="space-y-2">
          <ErrorBanner message={error} />
          <Button size="sm" variant="secondary" onClick={reload}>Try again</Button>
        </div>
      )}

      {loading && !data ? (
        <DashboardSkeleton />
      ) : data ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Services" value={data.services.total} icon={Server} accent="blue" sub={`${data.services.maintenance} in maintenance · ${data.services.unknown} unknown`} />
            <MetricCard label="Healthy" value={data.services.healthy} icon={CheckCircle2} accent="emerald" sub={data.services.total ? `${Math.round((data.services.healthy / data.services.total) * 100)}% of services` : 'No services yet'} />
            <MetricCard label="Degraded" value={data.services.degraded} icon={CircleAlert} accent="amber" sub="Responding with issues" />
            <MetricCard label="Down" value={data.services.down} icon={XCircle} accent="rose" sub="Failing health checks" />
            <MetricCard label="Active incidents" value={data.incidents.active} icon={AlertTriangle} accent="rose" sub={`${data.incidents.openedInRange} opened in ${days}d`} />
            <MetricCard label="Resolved" value={data.incidents.resolvedInRange} icon={ShieldCheck} accent="emerald" sub={`Of incidents opened in ${days}d`} />
            <MetricCard label="Incidents opened" value={data.incidents.openedInRange} icon={Activity} accent="violet" sub={`Last ${days} days`} />
            <MetricCard label="Overall uptime" value={pct(data.monitoring.uptimePercent, 2)} icon={Gauge} accent="emerald" sub={`${data.monitoring.totalChecks.toLocaleString()} checks recorded`} />
            <MetricCard label="Avg latency" value={data.monitoring.avgLatencyMs === null ? '—' : `${data.monitoring.avgLatencyMs}ms`} icon={Timer} accent="blue" sub={data.monitoring.p95LatencyMs === null ? 'No latency data' : `p95 ${data.monitoring.p95LatencyMs}ms`} />
            <MetricCard label="MTTA" value={formatDuration(data.incidents.mttaSeconds)} icon={Clock} accent="amber" sub="Mean time to acknowledge" />
            <MetricCard label="MTTR" value={formatDuration(data.incidents.mttrSeconds)} icon={Clock} accent="violet" sub="Mean time to resolve" />
            <MetricCard label="Open tasks" value={data.tasks.open} icon={ListTodo} accent="slate" sub={`${data.tasks.overdue} overdue · ${data.tasks.completedInRange} done in ${days}d`} />
          </div>

          {data.tasks.overdue > 0 && (
            <Link href="/dashboard/work" className="flex items-center gap-2 rounded-xl border border-[#fde68a] bg-[#fef3c7] px-4 py-2.5 text-sm font-semibold text-[#92400e] hover:underline">
              <AlertTriangle className="h-4 w-4" /> {data.tasks.overdue} overdue task{data.tasks.overdue === 1 ? '' : 's'} need attention
            </Link>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Active incidents */}
            <div className="lg:col-span-2">
              <SectionCard
                title="Active incidents"
                subtitle="Most recent unresolved incidents"
                action={
                  <Link href="/dashboard/incidents" className="inline-flex items-center gap-1 text-xs font-bold text-[#177a43] hover:underline">
                    View all <ArrowRight className="h-3 w-3" />
                  </Link>
                }
              >
                {data.incidents.activeList.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#dcefd8] text-[#177a43]">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-bold text-[#14201a]">All systems operational</p>
                    <p className="mt-1 text-xs text-[#5f6b64]">No active incidents right now.</p>
                  </div>
                ) : (
                  <ul className="-mx-5 -my-5 divide-y divide-[#dfdbcc]">
                    {data.incidents.activeList.map((inc) => (
                      <li key={inc.id}>
                        <Link href={`/dashboard/incidents/${inc.id}`} className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-[#f6f4ec]">
                          <div className="flex min-w-0 items-center gap-3">
                            <SeverityBadge severity={inc.severity} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-[#14201a]">{inc.title}</p>
                              <p className="truncate text-xs text-[#5f6b64]">
                                {inc.serviceName || 'Unknown service'} · Detected {timeAgo(inc.detectedAt)}
                              </p>
                            </div>
                          </div>
                          <StatusBadge status={inc.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>
            <OnCallCard />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title="Incident frequency" subtitle={`Incidents detected per day · last ${days} days`}>
              <BarChart data={data.series.map((s) => ({ label: shortDate(s.date), value: s.incidents, color: '#dc2626' }))} />
              <div className="mt-2 flex justify-between text-[10px] text-[#5f6b64]">
                <span>{labels[0]}</span>
                <span>{labels[labels.length - 1]}</span>
              </div>
            </ChartCard>
            <ChartCard title="Uptime trend" subtitle="Daily uptime % from monitor checks">
              <LineChart labels={labels} series={[{ label: 'Uptime', color: '#22a35a', values: data.series.map((s) => s.uptime) }]} unit="%" area />
            </ChartCard>
            <ChartCard title="Average latency" subtitle="Daily mean response time">
              <LineChart labels={labels} series={[{ label: 'Avg latency', color: '#0284c7', values: data.series.map((s) => s.avgLatencyMs) }]} unit="ms" area />
            </ChartCard>
            <ChartCard title="Tasks created vs completed" subtitle="Delivery flow per day">
              <LineChart
                labels={labels}
                series={[
                  { label: 'Created', color: '#7c3aed', values: data.series.map((s) => s.tasksCreated) },
                  { label: 'Completed', color: '#177a43', values: data.series.map((s) => s.tasksCompleted) },
                ]}
              />
              <div className="mt-2 flex gap-4 text-xs text-[#3d4a42]">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#7c3aed]" />Created</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#177a43]" />Completed</span>
              </div>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <ChartCard title="Incident severity" subtitle={`Incidents opened in ${days}d`}>
              {data.incidents.openedInRange === 0 ? (
                <p className="py-6 text-center text-sm text-[#5f6b64]">No incidents in this period.</p>
              ) : (
                <Donut items={data.incidents.bySeverity.map((s) => ({ label: s.severity.toUpperCase(), value: s.count, color: SEVERITY_COLORS[s.severity] ?? '#5f6b64' }))} />
              )}
            </ChartCard>
            <ChartCard title="Service health" subtitle="Current status of all services">
              {data.services.total === 0 ? (
                <p className="py-6 text-center text-sm text-[#5f6b64]">
                  No services yet. <Link href="/dashboard/services" className="font-semibold text-[#177a43] hover:underline">Register one</Link>
                </p>
              ) : (
                <Donut
                  items={[
                    { label: 'Healthy', value: data.services.healthy, color: '#22a35a' },
                    { label: 'Degraded', value: data.services.degraded, color: '#e3a008' },
                    { label: 'Down', value: data.services.down, color: '#dc2626' },
                    { label: 'Maintenance', value: data.services.maintenance, color: '#7c3aed' },
                    { label: 'Unknown', value: data.services.unknown, color: '#94a3b8' },
                  ]}
                />
              )}
            </ChartCard>
            <ChartCard title="Team workload" subtitle="Open tasks + active incidents per person">
              <HBarList
                items={data.workload.map((w) => ({
                  label: `${w.name} — ${w.openTasks} task${w.openTasks === 1 ? '' : 's'}, ${w.activeIncidents} incident${w.activeIncidents === 1 ? '' : 's'}`,
                  value: w.openTasks + w.activeIncidents,
                  color: w.activeIncidents > 0 ? '#dc2626' : '#177a43',
                }))}
              />
            </ChartCard>
          </div>
        </>
      ) : null}
    </div>
  );
}
