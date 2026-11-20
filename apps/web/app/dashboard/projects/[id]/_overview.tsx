'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, CircleDot, Clock, PlusCircle, UserX } from 'lucide-react';
import type { IncidentSeverity, IncidentStatus, ServiceHealthStatus, TaskPriority, TaskType } from '../../../../lib/types';
import { Donut, HBarList, LineChart, Pill, Skeleton, useApi } from '../../_components/kit';
import { ErrorBanner, HealthBadge, MetricCard, SectionCard, SeverityBadge, StatusBadge, formatDateTime, timeAgo } from '../../_components/ui';
import { CATEGORY_COLOR, PRIORITY_COLOR, PRIORITY_LABEL, TYPE_COLOR, TYPE_LABEL, fmtDay, type Burndown, type Sprint } from './_shared';

type Overview = {
  health: 'on_track' | 'behind' | 'at_risk';
  stats: {
    total: number;
    open: number;
    done: number;
    overdue: number;
    unassigned: number;
    createdLast7d: number;
    completedLast7d: number;
    byStatus: Array<{ id: string; name: string; category: string; count: number }>;
    byPriority: Array<{ priority: TaskPriority; count: number }>;
    byType: Array<{ type: TaskType; count: number }>;
  };
  activeSprint: (Sprint & { burndown: Burndown | null }) | null;
  services: Array<{ id: number; name: string; healthStatus: ServiceHealthStatus; environment: string }>;
  incidents: Array<{ id: number; title: string; severity: IncidentSeverity; status: IncidentStatus; detectedAt: string }>;
};
type Activity = { id: string; type: string; data: Record<string, unknown> | null; createdAt: string; actor: string | null; task: { ref: string; title: string } | null };

const HEALTH = {
  on_track: { label: 'On track', tone: 'green' as const },
  behind: { label: 'Behind', tone: 'amber' as const },
  at_risk: { label: 'At risk', tone: 'red' as const },
};

export function describeActivity(type: string, d: Record<string, unknown> | null): string {
  const data = d ?? {};
  switch (type) {
    case 'created': return `created the ticket in ${String(data.status ?? 'the first status')}`;
    case 'status_changed': return `moved it from ${String(data.from ?? '—')} to ${String(data.to ?? '—')}`;
    case 'assigned': return data.to === null || data.to === undefined ? 'unassigned it' : 'changed the assignee';
    case 'priority_changed': return `changed priority from ${String(data.from)} to ${String(data.to)}`;
    case 'title_changed': return 'renamed the ticket';
    case 'description_changed': return 'edited the description';
    case 'due_date_changed': return data.to ? `set the due date to ${fmtDay(String(data.to))}` : 'removed the due date';
    case 'labels_changed': return 'updated the labels';
    case 'type_changed': return `changed the type from ${String(data.from)} to ${String(data.to)}`;
    case 'sprint_changed': return data.to ? 'moved it into a sprint' : 'moved it to the backlog';
    case 'points_changed': return `changed story points to ${data.to ?? 'none'}`;
    case 'service_linked': return data.to ? 'linked a service' : 'unlinked the service';
    case 'incident_linked': return data.to ? 'linked an incident' : 'unlinked the incident';
    case 'dependency_added': return `added a dependency on ${String(data.dependsOn ?? 'another ticket')}`;
    case 'attachment_added': return `attached ${String(data.fileName ?? 'a file')}`;
    case 'commented': return 'commented';
    default: return type.replace(/_/g, ' ');
  }
}

export function BurndownChart({ burndown, height = 200 }: { burndown: Burndown; height?: number }) {
  return (
    <div>
      <LineChart
        height={height}
        labels={burndown.series.map((p) => fmtDay(p.date))}
        unit={burndown.unit === 'points' ? ' pts' : ''}
        series={[
          { label: 'Remaining', color: '#177a43', values: burndown.series.map((p) => p.remaining) },
          { label: 'Ideal', color: '#0284c7', values: burndown.series.map((p) => p.ideal) },
        ]}
        area
      />
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-[#5f6b64]">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#177a43]" />Remaining</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: '#0284c7' }} />Ideal</span>
        <span>
          {burndown.completed} of {burndown.total} {burndown.unit} done · {burndown.doneCount}/{burndown.taskCount} tickets
        </span>
      </div>
    </div>
  );
}

export function OverviewTab({ projectId }: { projectId: string }) {
  const ov = useApi<Overview>(`/api/projects/${projectId}/overview`);
  const act = useApi<{ activity: Activity[] }>(`/api/projects/${projectId}/activity`);

  if (ov.loading && !ov.data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (ov.error || !ov.data) return <ErrorBanner message={ov.error ?? 'Could not load the overview'} />;
  const { stats, health, activeSprint, services, incidents } = ov.data;
  const h = HEALTH[health] ?? HEALTH.on_track;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-[#3d4a42]">Project health</span>
        <Pill tone={h.tone}>{h.label}</Pill>
        <span className="text-xs text-[#5f6b64]">
          {stats.total} tickets · {stats.done} done · {stats.createdLast7d} created and {stats.completedLast7d} completed in the last 7 days
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Open" value={stats.open} icon={CircleDot} accent="blue" sub={`${stats.total} total`} />
        <MetricCard label="Done" value={stats.done} icon={CheckCircle2} accent="emerald" sub={`${stats.completedLast7d} this week`} />
        <MetricCard label="Overdue" value={stats.overdue} icon={Clock} accent={stats.overdue > 0 ? 'rose' : 'slate'} />
        <MetricCard label="Unassigned" value={stats.unassigned} icon={UserX} accent={stats.unassigned > 0 ? 'amber' : 'slate'} sub={`${stats.createdLast7d} created this week`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard title="By status">
          <HBarList items={stats.byStatus.map((s) => ({ label: s.name, value: s.count, color: CATEGORY_COLOR[s.category] }))} />
        </SectionCard>
        <SectionCard title="Open by priority">
          <Donut items={stats.byPriority.filter((p) => p.count > 0).map((p) => ({ label: PRIORITY_LABEL[p.priority] ?? p.priority, value: p.count, color: PRIORITY_COLOR[p.priority] ?? '#5f6b64' }))} />
        </SectionCard>
        <SectionCard title="Open by type">
          <Donut items={stats.byType.filter((p) => p.count > 0).map((p) => ({ label: TYPE_LABEL[p.type] ?? p.type, value: p.count, color: TYPE_COLOR[p.type] ?? '#5f6b64' }))} />
        </SectionCard>
      </div>

      <SectionCard
        title={activeSprint ? `Active sprint · ${activeSprint.name}` : 'Active sprint'}
        subtitle={activeSprint ? `${fmtDay(activeSprint.startDate)} – ${fmtDay(activeSprint.endDate)}${activeSprint.goal ? ` · ${activeSprint.goal}` : ''}` : undefined}
      >
        {activeSprint?.burndown ? (
          <BurndownChart burndown={activeSprint.burndown} />
        ) : (
          <p className="text-sm text-[#5f6b64]">No sprint is running. Start one from the Backlog &amp; sprints tab to see its burndown here.</p>
        )}
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Linked services" subtitle="Services that point at this project">
          {services.length === 0 ? (
            <p className="text-sm text-[#5f6b64]">No services are linked to this project yet. Set the project on a service to link it.</p>
          ) : (
            <ul className="divide-y divide-[#dfdbcc]">
              {services.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/dashboard/services/${s.id}`} className="truncate text-sm font-semibold text-[#14201a] hover:text-[#177a43]">{s.name}</Link>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-[#5f6b64]">{s.environment}</span>
                    <HealthBadge status={s.healthStatus} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="Recent incidents">
          {incidents.length === 0 ? (
            <p className="text-sm text-[#5f6b64]">No incidents linked to this project.</p>
          ) : (
            <ul className="divide-y divide-[#dfdbcc]">
              {incidents.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <Link href={`/dashboard/incidents/${i.id}`} className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[#14201a] hover:text-[#177a43]">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#dc2626]" />
                    <span className="truncate">{i.title}</span>
                  </Link>
                  <span className="flex items-center gap-2">
                    <SeverityBadge severity={i.severity} />
                    <StatusBadge status={i.status} />
                    <span className="text-xs text-[#5f6b64]">{timeAgo(i.detectedAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Recent activity">
        {act.loading && !act.data ? (
          <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-5" />)}</div>
        ) : act.error ? (
          <ErrorBanner message={act.error} />
        ) : !act.data || act.data.activity.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-[#5f6b64]"><PlusCircle className="h-4 w-4" />Nothing has happened yet. Create a ticket to get started.</p>
        ) : (
          <ol className="space-y-2.5">
            {act.data.activity.slice(0, 30).map((a) => (
              <li key={a.id} className="text-sm text-[#3d4a42]">
                <span className="font-semibold text-[#14201a]">{a.actor ?? 'Someone'}</span> {describeActivity(a.type, a.data)}
                {a.task && (
                  <>
                    {' '}on{' '}
                    <Link href={`/dashboard/tasks/${a.task.ref}`} className="font-mono text-xs font-bold text-[#177a43] hover:underline">{a.task.ref}</Link>{' '}
                    <span className="text-[#5f6b64]">{a.task.title}</span>
                  </>
                )}{' '}
                <span className="text-xs text-[#5f6b64]" title={formatDateTime(a.createdAt)}>· {timeAgo(a.createdAt)}</span>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>
    </div>
  );
}
