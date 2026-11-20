'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock, GitMerge, Lightbulb, RefreshCw, Repeat, Timer, TrendingUp, Users } from 'lucide-react';
import type { IncidentSeverity, IncidentStatus } from '../../../lib/types';
import { EmptyState, ErrorBanner, MetricCard, SectionCard, SeverityBadge, StatusBadge, timeAgo } from '../_components/ui';
import { BarChart, Button, HBarList, LineChart, PageHeader, Pill, Select, Skeleton, SkeletonRows, formatDuration, pct, useApi } from '../_components/kit';

type ServiceInsight = {
  id: number;
  name: string;
  teamId: number | null;
  incidents: number;
  sev12: number;
  downtimeMinutes: number;
  uptimePercent: number | null;
  latencyBefore: number | null;
  latencyAfter: number | null;
  latencyChangePercent: number | null;
  mttrSeconds: number | null;
};

type Insights = {
  range: { days: number; since: string };
  mostUnreliableServices: ServiceInsight[];
  degradingLatency: ServiceInsight[];
  failingEndpoints: Array<{ id: number; name: string; url: string; service: string; failures: number; topErrors: Array<{ error: string; count: number }> }>;
  recurringPatterns: Array<{ service: string; pattern: string; count: number; lastAt: string }>;
  teamWorkload: Array<{ teamId: number; name: string; incidents: number; services: number }>;
  mttrSeconds: number | null;
  mttaSeconds: number | null;
  trend: Array<{ date: string; incidents: number; uptime: number | null }>;
  recommendations: string[];
};

type Groups = {
  groups: Array<{
    groupId: number;
    incidents: Array<{ id: number; title: string; severity: IncidentSeverity; status: IncidentStatus; detectedAt: string; correlationReason: string | null }>;
  }>;
};

const RANGES = [7, 30, 90] as const;

function shortDate(d: string) {
  const dt = new Date(`${d}T00:00:00Z`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-sm text-[#5f6b64]">{children}</p>;
}

function CorrelatedGroups() {
  const { data, error, loading, reload } = useApi<Groups>('/api/incidents/groups');
  return (
    <SectionCard title="Correlated incident groups" subtitle="Incidents the engine linked together as one underlying problem">
      {loading && !data ? (
        <SkeletonRows rows={3} />
      ) : error ? (
        <div className="space-y-2">
          <ErrorBanner message={error} />
          <Button size="sm" variant="secondary" onClick={reload}>Retry</Button>
        </div>
      ) : !data || data.groups.length === 0 ? (
        <Muted>No correlated incident groups. Related incidents will be grouped here automatically.</Muted>
      ) : (
        <div className="space-y-4">
          {data.groups.map((g) => {
            const reason = g.incidents.find((i) => i.correlationReason)?.correlationReason;
            return (
              <div key={g.groupId} className="rounded-xl border border-[#dfdbcc] bg-[#fbfaf6]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dfdbcc] px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <GitMerge className="h-4 w-4 text-[#6d28d9]" />
                    <span className="text-sm font-bold text-[#14201a]">Group #{g.groupId}</span>
                    <Pill tone="violet">{g.incidents.length} incidents</Pill>
                  </div>
                  {reason && <span className="text-xs text-[#5f6b64]">{reason}</span>}
                </div>
                <ul className="divide-y divide-[#dfdbcc]">
                  {g.incidents.map((i) => (
                    <li key={i.id}>
                      <Link href={`/dashboard/incidents/${i.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[#f6f4ec]">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <SeverityBadge severity={i.severity} />
                          <span className="truncate text-sm font-semibold text-[#14201a]">{i.title}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="hidden text-xs text-[#5f6b64] sm:inline">{timeAgo(i.detectedAt)}</span>
                          <StatusBadge status={i.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

export default function InsightsPage() {
  const [days, setDays] = useState<number>(30);
  const { data, error, loading, reload } = useApi<Insights>(`/api/analytics/insights?days=${days}`);
  const labels = data?.trend.map((t) => shortDate(t.date)) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reliability"
        title="Insights"
        description="Patterns, weak spots and recommendations derived from your incidents and monitor checks."
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
            <Button variant="secondary" size="sm" onClick={reload} loading={loading && Boolean(data)} aria-label="Refresh insights">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
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
        <div className="space-y-6" role="status" aria-label="Loading insights">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[118px] rounded-2xl" />)}
          </div>
          <Skeleton className="h-[180px] rounded-2xl" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[220px] rounded-2xl" />)}
          </div>
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard label="MTTA" value={formatDuration(data.mttaSeconds)} icon={Clock} accent="amber" sub="Mean time to acknowledge" />
            <MetricCard label="MTTR" value={formatDuration(data.mttrSeconds)} icon={Timer} accent="violet" sub="Mean time to resolve" />
            <MetricCard label="Incidents" value={data.trend.reduce((a, t) => a + t.incidents, 0)} icon={AlertTriangle} accent="rose" sub={`Detected in the last ${days} days`} />
          </div>

          <SectionCard title="Recommendations" subtitle="Generated from the data in this period">
            {data.recommendations.length === 0 ? (
              <Muted>No recommendations right now — nothing in this period stands out.</Muted>
            ) : (
              <ul className="space-y-2.5">
                {data.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-3 rounded-xl border border-[#fde68a] bg-[#fef3c7] px-4 py-3 text-sm text-[#14201a]">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#92400e]" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Incident & uptime trend" subtitle={`Daily, last ${days} days`}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Incidents per day</p>
                <BarChart data={data.trend.map((t) => ({ label: shortDate(t.date), value: t.incidents, color: '#dc2626' }))} />
                <div className="mt-2 flex justify-between text-[10px] text-[#5f6b64]">
                  <span>{labels[0]}</span>
                  <span>{labels[labels.length - 1]}</span>
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Uptime %</p>
                <LineChart labels={labels} series={[{ label: 'Uptime', color: '#22a35a', values: data.trend.map((t) => t.uptime) }]} unit="%" area />
              </div>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard title="Most unreliable services" subtitle="Ranked by incidents, then uptime">
              {data.mostUnreliableServices.filter((s) => s.incidents > 0 || (s.uptimePercent !== null && s.uptimePercent < 100)).length === 0 ? (
                <Muted>No service had incidents or downtime in this period.</Muted>
              ) : (
                <div className="-mx-5 -my-5 overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="border-b border-[#dfdbcc] bg-[#fbfaf6] text-left text-xs uppercase tracking-wide text-[#5f6b64]">
                        <th className="px-5 py-2 font-semibold">Service</th>
                        <th className="px-3 py-2 font-semibold">Incidents</th>
                        <th className="px-3 py-2 font-semibold">Uptime</th>
                        <th className="px-3 py-2 font-semibold">Downtime</th>
                        <th className="px-5 py-2 font-semibold">MTTR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#dfdbcc]">
                      {data.mostUnreliableServices
                        .filter((s) => s.incidents > 0 || (s.uptimePercent !== null && s.uptimePercent < 100))
                        .map((s) => (
                          <tr key={s.id} className="hover:bg-[#fbfaf6]">
                            <td className="px-5 py-2.5">
                              <Link href={`/dashboard/services/${s.id}`} className="font-semibold text-[#14201a] hover:underline">{s.name}</Link>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="font-semibold text-[#14201a]">{s.incidents}</span>
                              {s.sev12 > 0 && <span className="ml-1.5"><Pill tone="red">{s.sev12} sev1/2</Pill></span>}
                            </td>
                            <td className="px-3 py-2.5 text-[#3d4a42]">{pct(s.uptimePercent)}</td>
                            <td className="px-3 py-2.5 text-[#3d4a42]">{formatDuration(s.downtimeMinutes * 60)}</td>
                            <td className="px-5 py-2.5 text-[#3d4a42]">{formatDuration(s.mttrSeconds)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Degrading latency" subtitle="Avg latency: first half vs second half of the period">
              {data.degradingLatency.length === 0 ? (
                <Muted>No service got more than 10% slower in this period.</Muted>
              ) : (
                <ul className="divide-y divide-[#dfdbcc]">
                  {data.degradingLatency.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <Link href={`/dashboard/services/${s.id}`} className="truncate text-sm font-semibold text-[#14201a] hover:underline">{s.name}</Link>
                      <div className="flex shrink-0 items-center gap-2 text-xs text-[#3d4a42]">
                        <span>{s.latencyBefore ?? '—'}ms → {s.latencyAfter ?? '—'}ms</span>
                        <Pill tone={(s.latencyChangePercent ?? 0) >= 30 ? 'red' : 'amber'}>
                          <TrendingUp className="h-3 w-3" /> +{s.latencyChangePercent}%
                        </Pill>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Most failing endpoints" subtitle="Failed monitor checks and top error signatures">
              {data.failingEndpoints.length === 0 ? (
                <Muted>No failed monitor checks in this period.</Muted>
              ) : (
                <ul className="space-y-3">
                  {data.failingEndpoints.map((m) => (
                    <li key={m.id} className="rounded-xl border border-[#dfdbcc] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#14201a]">{m.name}</p>
                          <p className="truncate font-mono text-xs text-[#5f6b64]" title={m.url}>{m.url}</p>
                          {m.service && <p className="text-xs text-[#5f6b64]">{m.service}</p>}
                        </div>
                        <Pill tone="red">{m.failures} failures</Pill>
                      </div>
                      {m.topErrors.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {m.topErrors.map((e) => (
                            <li key={e.error} className="flex items-center justify-between gap-2 rounded-lg bg-[#fee2e2] px-2.5 py-1 text-xs">
                              <code className="truncate text-[#991b1b]" title={e.error}>{e.error}</code>
                              <span className="shrink-0 font-semibold text-[#991b1b]">×{e.count}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Recurring incident patterns" subtitle="Same incident title on the same service, 2+ times">
              {data.recurringPatterns.length === 0 ? (
                <Muted>No recurring incidents detected.</Muted>
              ) : (
                <ul className="divide-y divide-[#dfdbcc]">
                  {data.recurringPatterns.map((p) => (
                    <li key={`${p.service}:${p.pattern}`} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="flex min-w-0 gap-2">
                        <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-[#6d28d9]" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#14201a]" title={p.pattern}>{p.pattern}</p>
                          <p className="text-xs text-[#5f6b64]">{p.service || 'Unknown service'} · last {timeAgo(p.lastAt)}</p>
                        </div>
                      </div>
                      <Pill tone={p.count >= 3 ? 'red' : 'amber'}>{p.count}×</Pill>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <SectionCard title="Team incident workload" subtitle="Incidents on services owned by each team" className="lg:col-span-1">
              {data.teamWorkload.length === 0 ? (
                <div className="py-2 text-center text-sm text-[#5f6b64]">
                  <Users className="mx-auto mb-2 h-6 w-6" />
                  No teams yet. <Link href="/dashboard/team" className="font-semibold text-[#177a43] hover:underline">Set up teams</Link>
                </div>
              ) : (
                <HBarList
                  items={[...data.teamWorkload]
                    .sort((a, b) => b.incidents - a.incidents)
                    .map((t) => ({ label: `${t.name} (${t.services} service${t.services === 1 ? '' : 's'})`, value: t.incidents, color: '#7c3aed' }))}
                />
              )}
            </SectionCard>
            <div className="lg:col-span-2">
              <CorrelatedGroups />
            </div>
          </div>
        </>
      ) : !error ? (
        <EmptyState title="No insights yet" description="Insights appear once services, monitors and incidents have recorded data." />
      ) : null}
    </div>
  );
}
