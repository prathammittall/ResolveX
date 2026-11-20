'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Activity, ArrowLeft, BookOpen, ExternalLink, FileText, GitBranch, KeyRound, Pencil, Play, Plus, Rocket, Trash2, Wrench } from 'lucide-react';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { can } from '../../../../lib/permissions';
import type { IncidentSeverity, IncidentStatus, ServiceHealthStatus, ServiceItem, ServiceType } from '../../../../lib/types';
import { EmptyState, ErrorBanner, HealthBadge, MetricCard, SectionCard, SeverityBadge, StatusBadge, cn, formatDateTime, timeAgo } from '../../_components/ui';
import { Button, Field, LineChart, Modal, PageHeader, Pill, Select, Skeleton, SkeletonRows, Tabs, UptimeBars, pct, useApi, useConfirm, useToast } from '../../_components/kit';
import WebhookKeysModal from '../WebhookKeysModal';
import { CRITICALITY_TONE, SERVICE_TYPE_LABEL, ServiceFormModal, cap, type ProjectLite } from '../ServiceFormModal';
import { MonitorFormModal, type CheckStats, type Monitor, type SeriesPoint } from '../../monitors/MonitorForm';
import { DEPLOY_STATUS_TONE, RecordDeploymentModal, commitHref, type Deployment } from '../../deployments/RecordDeploymentModal';

type Person = { id: number; name: string; email: string; avatarUrl?: string | null };
type Rel = { dependencyId: number; id: number; name: string; serviceType: ServiceType; healthStatus: ServiceHealthStatus; kind: 'hard' | 'soft' };
type Overview = {
  owner: Person | null;
  backupOwner: Person | null;
  team: { id: string; name: string } | null;
  maintenance: { id: number; name: string; endsAt: string } | null;
  monitors: Monitor[];
  uptime: { day: CheckStats; week: CheckStats; month: CheckStats };
  dailyUptime: SeriesPoint[];
  incidents: Array<{ id: number; title: string; severity: IncidentSeverity; status: IncidentStatus; detectedAt: string; resolvedAt: string | null }>;
  deployments: Deployment[];
  dependencies: Rel[];
  dependents: Rel[];
};
type Metrics = { summary: CheckStats; series: SeriesPoint[]; deployments: Array<{ id: number; version: string; deployedAt: string; status: string }> };
type Range = '24' | '168' | '720';

export default function ServiceOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const canManage = can(user?.role, 'services:manage');
  const canMonitors = can(user?.role, 'monitors:manage');
  const canDeploy = can(user?.role, 'deployments:create');

  const svc = useApi<{ service: ServiceItem; alertCount: number }>(id ? `/api/services/${id}` : null);
  const ov = useApi<Overview>(id ? `/api/services/${id}/overview` : null);
  const [range, setRange] = useState<Range>('24');
  const metrics = useApi<Metrics>(id ? `/api/services/${id}/metrics?hours=${range}` : null);
  const service = svc.data?.service;
  const projects = useApi<{ projects: ProjectLite[] }>(service?.projectId ? '/api/projects' : null);

  const [editOpen, setEditOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [depOpen, setDepOpen] = useState(false);
  const [monitorOpen, setMonitorOpen] = useState(false);
  const [running, setRunning] = useState<Record<number, boolean>>({});

  const closeEdit = useCallback(() => setEditOpen(false), []);
  const closeDeploy = useCallback(() => setDeployOpen(false), []);
  const closeDep = useCallback(() => setDepOpen(false), []);
  const closeMonitor = useCallback(() => setMonitorOpen(false), []);

  const reloadAll = () => {
    svc.reload();
    ov.reload();
    metrics.reload();
  };

  const days = useMemo(() => fillDays(ov.data?.dailyUptime ?? []), [ov.data]);

  const chart = useMemo(() => {
    const series = metrics.data?.series ?? [];
    const hours = Number(range);
    const labels = series.map((p) => fmtLabel(p.t, hours));
    const times = series.map((p) => Date.parse(p.t));
    const markers = (metrics.data?.deployments ?? [])
      .map((d) => {
        if (times.length === 0) return null;
        const t = Date.parse(d.deployedAt);
        let best = 0;
        for (let i = 1; i < times.length; i++) if (Math.abs(times[i]! - t) < Math.abs(times[best]! - t)) best = i;
        return { index: best, label: `Deploy ${d.version} (${d.status}) · ${formatDateTime(d.deployedAt)}` };
      })
      .filter((x): x is { index: number; label: string } => x !== null);
    return { labels, latency: series.map((p) => p.avgLatencyMs), uptime: series.map((p) => p.uptime), markers };
  }, [metrics.data, range]);

  async function runMonitor(m: Monitor) {
    setRunning((r) => ({ ...r, [m.id]: true }));
    try {
      const res = await api.post<{ monitor: Monitor | null }>(`/api/monitors/${m.id}/run`);
      toast.success(`${m.name}: ${res.monitor?.status ?? 'checked'}`);
      ov.reload();
      svc.reload();
      metrics.reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setRunning((r) => ({ ...r, [m.id]: false }));
    }
  }

  async function removeRel(rel: Rel, direction: 'dependency' | 'dependent') {
    const msg = direction === 'dependency' ? `${service?.name} will no longer depend on ${rel.name}.` : `${rel.name} will no longer depend on ${service?.name}.`;
    const ok = await confirm({ title: 'Remove dependency?', message: msg, confirmLabel: 'Remove', danger: true });
    if (!ok) return;
    try {
      const owner = direction === 'dependency' ? id : rel.id;
      await api.del(`/api/services/${owner}/dependencies/${rel.dependencyId}`);
      toast.success('Dependency removed');
      ov.reload();
    } catch (err) {
      toast.error(err);
    }
  }

  if ((svc.loading && !svc.data) || (ov.loading && !ov.data)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-5 w-96" />
        <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-56" />
        <SkeletonRows rows={4} />
      </div>
    );
  }
  if (svc.error || !service) {
    return (
      <div className="space-y-3">
        <Link href="/dashboard/services" className="inline-flex items-center gap-1 text-sm font-semibold text-[#5f6b64] hover:text-[#14201a]"><ArrowLeft className="h-4 w-4" /> Services</Link>
        <ErrorBanner message={svc.error ?? 'Service not found'} />
        <Button variant="secondary" size="sm" onClick={reloadAll}>Retry</Button>
      </div>
    );
  }

  const o = ov.data;
  const project = service.projectId ? projects.data?.projects.find((p) => p.id === service.projectId) : undefined;
  const openIncidents = (o?.incidents ?? []).filter((i) => i.status !== 'resolved');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<Link href="/dashboard/services" className="hover:underline">Services</Link>}
        title={service.name}
        description={service.description ?? undefined}
        actions={
          <>
            <Button variant="secondary" onClick={() => setKeysOpen(true)}><KeyRound className="h-4 w-4" /> Webhook keys</Button>
            {canDeploy && <Button variant="secondary" onClick={() => setDeployOpen(true)}><Rocket className="h-4 w-4" /> Record deployment</Button>}
            {canManage && <Button onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Edit</Button>}
          </>
        }
      />

      <div className="-mt-2 flex flex-wrap items-center gap-2">
        <HealthBadge status={service.healthStatus} />
        <Pill tone="slate">{SERVICE_TYPE_LABEL[service.serviceType] ?? service.serviceType}</Pill>
        <Pill tone={service.environment === 'production' ? 'violet' : 'blue'}>{cap(service.environment)}</Pill>
        <Pill tone={CRITICALITY_TONE[service.criticality]}>{cap(service.criticality)} criticality</Pill>
        {service.slug && <code className="rounded-md bg-[#eeebe0] px-2 py-0.5 font-mono text-xs text-[#3d4a42]">{service.slug}</code>}
        {service.currentVersion && <span className="text-xs text-[#5f6b64]">Version <b className="font-mono text-[#14201a]">{service.currentVersion}</b>{service.lastDeployedAt && ` · deployed ${timeAgo(service.lastDeployedAt)}`}</span>}
        {(service.tags ?? []).map((t) => <span key={t} className="rounded bg-[#eeebe0] px-1.5 py-0.5 text-[11px] font-semibold text-[#3d4a42]">{t}</span>)}
      </div>

      {o?.maintenance && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[#bae6fd] bg-[#e0f2fe] px-4 py-3 text-sm text-[#0369a1]">
          <Wrench className="mt-0.5 h-4 w-4 shrink-0" />
          <span><b>Maintenance in progress:</b> {o.maintenance.name}. Alerts are suppressed until {formatDateTime(o.maintenance.endsAt)}.</span>
        </div>
      )}
      {openIncidents.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#fecaca] bg-[#fee2e2] px-4 py-3 text-sm text-[#991b1b]">
          <b>{openIncidents.length} open incident{openIncidents.length > 1 ? 's' : ''}:</b>
          {openIncidents.slice(0, 3).map((i) => (
            <Link key={i.id} href={`/dashboard/incidents/${i.id}`} className="inline-flex items-center gap-1.5 font-semibold hover:underline">
              <SeverityBadge severity={i.severity} /> #{i.id} {i.title}
            </Link>
          ))}
        </div>
      )}
      {ov.error && <ErrorBanner message={`Could not load the service overview: ${ov.error}`} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4 sm:grid-cols-3">
          <UptimeCard label="Last 24 hours" s={o?.uptime.day} />
          <UptimeCard label="Last 7 days" s={o?.uptime.week} />
          <UptimeCard label="Last 30 days" s={o?.uptime.month} />
        </div>
        <SectionCard title="Ownership">
          <dl className="space-y-2 text-sm">
            <Item k="Owner">{o?.owner ? o.owner.name : <span className="text-[#5f6b64]">Unassigned</span>}</Item>
            <Item k="Backup">{o?.backupOwner ? o.backupOwner.name : <span className="text-[#5f6b64]">—</span>}</Item>
            <Item k="Team">{o?.team ? o.team.name : <span className="text-[#5f6b64]">—</span>}</Item>
            <Item k="Project">{service.projectId ? <Link href={`/dashboard/projects/${service.projectId}`} className="font-semibold text-[#177a43] hover:underline">{project ? `${project.key} · ${project.name}` : 'Open project'}</Link> : <span className="text-[#5f6b64]">—</span>}</Item>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-[#dfdbcc] pt-3">
            <ExtLink href={service.repositoryUrl} icon={GitBranch} label="Repository" />
            <ExtLink href={service.docsUrl} icon={BookOpen} label="Docs" />
            <ExtLink href={service.runbookUrl} icon={FileText} label="Runbook" />
            {!service.repositoryUrl && !service.docsUrl && !service.runbookUrl && <span className="text-xs text-[#5f6b64]">No links yet{canManage ? ' — add them via Edit.' : '.'}</span>}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Response time"
        subtitle="Average latency across this service's monitors. Purple lines mark deployments."
        action={<Tabs<Range> tabs={[{ id: '24', label: '24h' }, { id: '168', label: '7d' }, { id: '720', label: '30d' }]} value={range} onChange={setRange} />}
      >
        {metrics.error ? (
          <ErrorBanner message={metrics.error} />
        ) : metrics.loading && !metrics.data ? (
          <Skeleton className="h-[200px]" />
        ) : (
          <>
            <LineChart labels={chart.labels} series={[{ label: 'Avg latency', color: '#0284c7', values: chart.latency }]} unit=" ms" area height={200} markers={chart.markers} />
            {metrics.data && (
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-[#5f6b64]">
                <span>Uptime <b className="text-[#14201a]">{pct(metrics.data.summary.uptimePercent)}</b></span>
                <span>Avg <b className="text-[#14201a]">{metrics.data.summary.avgLatencyMs ?? '—'} ms</b></span>
                <span>p95 <b className="text-[#14201a]">{metrics.data.summary.p95LatencyMs ?? '—'} ms</b></span>
                <span>Checks <b className="text-[#14201a]">{metrics.data.summary.totalChecks}</b></span>
                <span>Deployments <b className="text-[#14201a]">{metrics.data.deployments.length}</b></span>
              </div>
            )}
          </>
        )}
      </SectionCard>

      <SectionCard title="30-day uptime" subtitle="One bar per day (UTC). Grey means no checks ran.">
        <UptimeBars days={days} />
        <div className="mt-1.5 flex justify-between text-[11px] text-[#5f6b64]"><span>30 days ago</span><span>Today</span></div>
      </SectionCard>

      <SectionCard
        title="Monitors"
        subtitle={`${o?.monitors.length ?? 0} configured`}
        action={canMonitors && <Button size="sm" onClick={() => setMonitorOpen(true)}><Plus className="h-3.5 w-3.5" /> Add monitor</Button>}
      >
        {!o || o.monitors.length === 0 ? (
          <EmptyState icon={Activity} title="No monitors" description="Add an HTTP check so this service's health and uptime are tracked automatically." />
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#dfdbcc] text-xs font-bold uppercase tracking-wide text-[#5f6b64]">
                  <th className="px-5 py-2">Monitor</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Last check</th>
                  <th className="px-3 py-2">Latency</th>
                  <th className="px-3 py-2">Last error</th>
                  <th className="px-5 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfdbcc]">
                {o.monitors.map((m) => (
                  <tr key={m.id} className={cn(!m.enabled && 'opacity-70')}>
                    <td className="px-5 py-2.5">
                      <Link href={`/dashboard/monitors/${m.id}`} className="font-semibold text-[#14201a] hover:underline">{m.name}</Link>
                      <div className="max-w-[280px] truncate font-mono text-xs text-[#5f6b64]" title={m.url}>{m.method} {m.url}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <HealthBadge status={m.status} />
                      {!m.enabled && <span className="ml-1 text-[11px] font-semibold text-[#92400e]">Paused</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-[#3d4a42]">{m.lastCheckedAt ? timeAgo(m.lastCheckedAt) : 'Never'}</td>
                    <td className="px-3 py-2.5 text-xs text-[#3d4a42]">{m.lastLatencyMs !== null ? `${m.lastLatencyMs} ms` : '—'}</td>
                    <td className="max-w-[220px] truncate px-3 py-2.5 text-xs text-[#991b1b]" title={m.lastError ?? undefined}>{m.lastError && m.status !== 'healthy' ? m.lastError : ''}</td>
                    <td className="px-5 py-2.5 text-right">
                      {canMonitors && (
                        <Button size="sm" variant="secondary" onClick={() => runMonitor(m)} loading={running[m.id]} aria-label={`Run ${m.name} now`}>
                          <Play className="h-3.5 w-3.5" /> Run now
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Incidents" subtitle="Most recent 20">
          {!o || o.incidents.length === 0 ? (
            <p className="py-4 text-center text-sm text-[#5f6b64]">No incidents recorded for this service.</p>
          ) : (
            <ul className="-my-2 divide-y divide-[#dfdbcc]">
              {o.incidents.map((i) => (
                <li key={i.id} className="py-2.5">
                  <Link href={`/dashboard/incidents/${i.id}`} className="group flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[#14201a] group-hover:underline">#{i.id} {i.title}</span>
                      <span className="text-xs text-[#5f6b64]">{formatDateTime(i.detectedAt)}{i.resolvedAt ? ` · resolved ${timeAgo(i.resolvedAt)}` : ''}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5"><SeverityBadge severity={i.severity} /><StatusBadge status={i.status} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Deployments"
          subtitle="Most recent 10"
          action={<Link href={`/dashboard/deployments`} className="text-xs font-semibold text-[#177a43] hover:underline">All deployments</Link>}
        >
          {!o || o.deployments.length === 0 ? (
            <div className="py-4 text-center text-sm text-[#5f6b64]">
              No deployments recorded.
              {canDeploy && <div className="mt-2"><Button size="sm" variant="secondary" onClick={() => setDeployOpen(true)}><Rocket className="h-3.5 w-3.5" /> Record deployment</Button></div>}
            </div>
          ) : (
            <ul className="-my-2 divide-y divide-[#dfdbcc]">
              {o.deployments.map((d) => {
                const href = d.commitSha ? commitHref(d.repositoryUrl || service.repositoryUrl, d.commitSha) : null;
                return (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-[#14201a]">{d.version}</span>
                        <Pill tone={DEPLOY_STATUS_TONE[d.status] ?? 'slate'}>{d.status.replace('_', ' ')}</Pill>
                        <span className="text-xs capitalize text-[#5f6b64]">{d.environment}</span>
                      </div>
                      <div className="text-xs text-[#5f6b64]">
                        {timeAgo(d.deployedAt)}
                        {d.author && ` · ${d.author}`}
                        {d.commitSha && (href ? <> · <a href={href} target="_blank" rel="noopener noreferrer" className="font-mono text-[#177a43] hover:underline">{d.commitSha.slice(0, 7)}</a></> : <> · <span className="font-mono">{d.commitSha.slice(0, 7)}</span></>)}
                        {` · ${d.source}`}
                      </div>
                    </div>
                    {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" aria-label={`Open deployment ${d.version}`} className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#eeebe0]"><ExternalLink className="h-3.5 w-3.5" /></a>}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Depends on"
          subtitle="Services this one needs to work"
          action={canManage && <Button size="sm" onClick={() => setDepOpen(true)}><Plus className="h-3.5 w-3.5" /> Add</Button>}
        >
          <RelList items={o?.dependencies ?? []} empty="No dependencies recorded." canManage={canManage} onRemove={(r) => removeRel(r, 'dependency')} />
        </SectionCard>
        <SectionCard title="Used by" subtitle="Services that depend on this one" action={<Link href="/dashboard/dependency-map" className="text-xs font-semibold text-[#177a43] hover:underline">Dependency map</Link>}>
          <RelList items={o?.dependents ?? []} empty="No services depend on this one." canManage={canManage} onRemove={(r) => removeRel(r, 'dependent')} />
        </SectionCard>
      </div>

      <ServiceFormModal open={editOpen} service={service} onClose={closeEdit} onSaved={() => reloadAll()} />
      {keysOpen && <WebhookKeysModal service={service} canManage={canManage} onClose={() => setKeysOpen(false)} />}
      <RecordDeploymentModal open={deployOpen} services={[{ id: service.id, name: service.name, environment: service.environment, repositoryUrl: service.repositoryUrl }]} defaultServiceId={service.id} onClose={closeDeploy} onSaved={reloadAll} />
      <MonitorFormModal open={monitorOpen} monitor={null} services={[{ id: service.id, name: service.name, environment: service.environment }]} defaultServiceId={service.id} onClose={closeMonitor} onSaved={() => { ov.reload(); svc.reload(); }} />
      <AddDependencyModal
        open={depOpen}
        serviceId={service.id}
        exclude={[service.id, ...(o?.dependencies ?? []).map((d) => d.id)]}
        onClose={closeDep}
        onSaved={() => ov.reload()}
      />
    </div>
  );
}

function UptimeCard({ label, s }: { label: string; s?: CheckStats }) {
  const u = s?.uptimePercent ?? null;
  return (
    <MetricCard
      label={label}
      value={pct(u)}
      icon={Activity}
      accent={u === null ? 'slate' : u >= 99.5 ? 'emerald' : u >= 95 ? 'amber' : 'rose'}
      sub={s ? `avg ${s.avgLatencyMs ?? '—'} ms · p95 ${s.p95LatencyMs ?? '—'} ms · ${s.failures} failed / ${s.totalChecks}` : 'No data'}
    />
  );
}

function Item({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs font-bold uppercase tracking-wide text-[#5f6b64]">{k}</dt>
      <dd className="truncate text-right text-[#14201a]">{children}</dd>
    </div>
  );
}

function ExtLink({ href, icon: Icon, label }: { href?: string | null; icon: React.ComponentType<{ className?: string }>; label: string }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfdbcc] px-2.5 py-1 text-xs font-semibold text-[#14201a] hover:bg-[#eeebe0]">
      <Icon className="h-3.5 w-3.5 text-[#177a43]" /> {label}
    </a>
  );
}

function RelList({ items, empty, canManage, onRemove }: { items: Rel[]; empty: string; canManage: boolean; onRemove: (r: Rel) => void }) {
  if (items.length === 0) return <p className="py-3 text-center text-sm text-[#5f6b64]">{empty}</p>;
  return (
    <ul className="-my-2 divide-y divide-[#dfdbcc]">
      {items.map((r) => (
        <li key={r.dependencyId} className="flex items-center justify-between gap-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Link href={`/dashboard/services/${r.id}`} className="truncate text-sm font-semibold text-[#14201a] hover:underline">{r.name}</Link>
            <Pill tone={r.kind === 'hard' ? 'red' : 'slate'}>{r.kind}</Pill>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <HealthBadge status={r.healthStatus} />
            {canManage && (
              <button type="button" onClick={() => onRemove(r)} aria-label={`Remove dependency with ${r.name}`} className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626]">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function AddDependencyModal({ open, serviceId, exclude, onClose, onSaved }: { open: boolean; serviceId: number; exclude: number[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const all = useApi<{ services: ServiceItem[] }>(open ? '/api/services' : null);
  const [target, setTarget] = useState('');
  const [kind, setKind] = useState<'hard' | 'soft'>('hard');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = (all.data?.services ?? []).filter((s) => !exclude.includes(s.id));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) {
      setError('Choose a service');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/services/${serviceId}/dependencies`, { dependsOnId: Number(target), kind });
      toast.success('Dependency added');
      setTarget('');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add dependency');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add dependency"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="dep-form" loading={saving} disabled={all.loading}>Add dependency</Button>
        </>
      }
    >
      <form id="dep-form" onSubmit={submit} className="space-y-4">
        {(error || all.error) && <ErrorBanner message={error ?? all.error ?? ''} />}
        <Field label="This service depends on" hint={!all.loading && options.length === 0 ? 'No other services available.' : undefined}>
          <Select value={target} onChange={(e) => setTarget(e.target.value)} disabled={all.loading}>
            <option value="">{all.loading ? 'Loading services…' : 'Select a service…'}</option>
            {options.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.environment})</option>)}
          </Select>
        </Field>
        <Field label="Kind" hint={kind === 'hard' ? 'Hard: this service fails when the dependency fails.' : 'Soft: this service degrades but keeps working.'}>
          <Select value={kind} onChange={(e) => setKind(e.target.value as 'hard' | 'soft')}>
            <option value="hard">Hard</option>
            <option value="soft">Soft</option>
          </Select>
        </Field>
      </form>
    </Modal>
  );
}

/** Exactly 30 UTC days ending today; days without checks are null (grey). */
function fillDays(points: SeriesPoint[]) {
  const map = new Map(points.map((p) => [p.t.slice(0, 10), p.uptime]));
  const out: Array<{ date: string; uptime: number | null }> = [];
  const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ date, uptime: map.get(date) ?? null });
  }
  return out;
}

function fmtLabel(iso: string, hours: number) {
  const d = new Date(iso);
  if (hours <= 24) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

