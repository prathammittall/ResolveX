'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, GitMerge, Inbox, Plus, Search, ShieldCheck } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { canRespond } from '../../../lib/permissions';
import type { IncidentSeverity, IncidentStatus, IncidentsResponse, ProjectItem, ServiceItem } from '../../../lib/types';
import { EmptyState, ErrorBanner, SeverityBadge, StatusBadge, formatDateTime, timeAgo } from '../_components/ui';
import { Button, Field, Input, MemberSelect, Modal, PageHeader, Select, SkeletonRows, Tabs, Textarea, formatDuration, useApi, useMembers, useToast } from '../_components/kit';
import { SEVERITY_OPTIONS, STATUS_FLOW, STATUS_LABEL, mttrSeconds } from './_shared';

type StatusFilter = IncidentStatus | 'all' | 'active';
type GroupsResponse = {
  groups: Array<{ groupId: number; incidents: Array<{ id: number; title: string; severity: IncidentSeverity; status: IncidentStatus; detectedAt: string; correlationReason: string | null }> }>;
};

export default function IncidentsPage() {
  const { user } = useAuth();
  const responder = canRespond(user?.role);
  const members = useMembers();
  const list = useApi<IncidentsResponse>('/api/incidents');
  const groups = useApi<GroupsResponse>('/api/incidents/groups');

  const [tab, setTab] = useState<'incidents' | 'groups'>('incidents');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [severity, setSeverity] = useState<IncidentSeverity | 'all'>('all');
  const [serviceId, setServiceId] = useState<string>('all');
  const [assignee, setAssignee] = useState<string>('all');
  const [q, setQ] = useState('');
  const [declareOpen, setDeclareOpen] = useState(false);

  const incidents = useMemo(() => list.data?.incidents ?? [], [list.data]);
  const memberName = (id: number | null) => (id ? (members.find((m) => m.userId === id)?.name ?? `User #${id}`) : null);

  const services = useMemo(() => {
    const m = new Map<number, string>();
    incidents.forEach((i) => m.set(i.serviceId, i.serviceName));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [incidents]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return incidents.filter((i) => {
      if (status === 'active' && i.status === 'resolved') return false;
      if (status !== 'all' && status !== 'active' && i.status !== status) return false;
      if (severity !== 'all' && i.severity !== severity) return false;
      if (serviceId !== 'all' && String(i.serviceId) !== serviceId) return false;
      if (assignee === 'none' && i.assignedResponderId !== null) return false;
      if (assignee === 'me' && i.assignedResponderId !== user?.id) return false;
      if (assignee !== 'all' && assignee !== 'none' && assignee !== 'me' && String(i.assignedResponderId) !== assignee) return false;
      if (needle && !`#${i.id} ${i.title} ${i.serviceName} ${i.description ?? ''}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [incidents, status, severity, serviceId, assignee, q, user?.id]);

  const counts = useMemo(
    () => ({ active: incidents.filter((i) => i.status !== 'resolved').length, resolved: incidents.filter((i) => i.status === 'resolved').length }),
    [incidents],
  );
  const groupCount = groups.data?.groups.length ?? 0;
  const filtersActive = status !== 'active' || severity !== 'all' || serviceId !== 'all' || assignee !== 'all' || q !== '';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Incidents"
        description="Detected failures, declared incidents and their response lifecycle."
        actions={
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#fecaca] bg-[#fee2e2] px-3 py-1 text-xs font-bold text-[#dc2626]">
              <AlertTriangle className="h-3.5 w-3.5" /> {counts.active} active
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#b2e2a8] bg-[#dcefd8] px-3 py-1 text-xs font-bold text-[#177a43]">
              <ShieldCheck className="h-3.5 w-3.5" /> {counts.resolved} resolved
            </span>
            {responder && (
              <Button onClick={() => setDeclareOpen(true)}>
                <Plus className="h-4 w-4" /> Declare incident
              </Button>
            )}
          </>
        }
      />

      <Tabs
        tabs={[
          { id: 'incidents', label: 'Incidents', count: incidents.length },
          { id: 'groups', label: 'Correlated groups', count: groupCount },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'incidents' ? (
        <>
          <div className="grid gap-3 rounded-2xl border border-[#dfdbcc] bg-white p-3.5 shadow-[0_2px_0_#dfdbcc] sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Search" className="sm:col-span-2 lg:col-span-1">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5f6b64]" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, service, #id" className="pl-8" />
              </div>
            </Field>
            <Field label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
                <option value="active">Active (unresolved)</option>
                <option value="all">All statuses</option>
                {STATUS_FLOW.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Severity">
              <Select value={severity} onChange={(e) => setSeverity(e.target.value as IncidentSeverity | 'all')}>
                <option value="all">All severities</option>
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Service">
              <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                <option value="all">All services</option>
                {services.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Assignee">
              <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="all">Anyone</option>
                <option value="me">Assigned to me</option>
                <option value="none">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {list.error && <ErrorBanner message={list.error} />}

          {list.loading && !list.data ? (
            <div className="rounded-2xl border border-[#dfdbcc] bg-white p-4 shadow-[0_2px_0_#dfdbcc]">
              <SkeletonRows rows={6} />
            </div>
          ) : !list.data ? null : filtered.length === 0 ? (
            <EmptyState
              icon={incidents.length === 0 ? Inbox : AlertTriangle}
              title={incidents.length === 0 ? 'No incidents yet' : 'No matching incidents'}
              description={
                incidents.length === 0
                  ? 'Incidents appear here when monitors detect failures, alert webhooks fire, or someone declares one.'
                  : 'Adjust or clear the filters to see more incidents.'
              }
              action={
                filtersActive && incidents.length > 0 ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setStatus('all');
                      setSeverity('all');
                      setServiceId('all');
                      setAssignee('all');
                      setQ('');
                    }}
                  >
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc]">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-[#dfdbcc] bg-[#fbfaf6] text-left text-xs font-bold uppercase tracking-wide text-[#5f6b64]">
                    <th className="px-4 py-2.5">Incident</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Assignee</th>
                    <th className="px-4 py-2.5">Detected</th>
                    <th className="px-4 py-2.5 text-right" title="Mean time to acknowledge">
                      MTTA
                    </th>
                    <th className="px-4 py-2.5 text-right" title="Time to resolve">
                      MTTR
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dfdbcc]">
                  {filtered.map((inc) => (
                    <tr key={inc.id} className="transition hover:bg-[#f6f4ec]">
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <SeverityBadge severity={inc.severity} />
                          <div className="min-w-0">
                            <Link href={`/dashboard/incidents/${inc.id}`} className="block truncate font-bold text-[#14201a] hover:text-[#177a43] hover:underline">
                              {inc.title}
                            </Link>
                            <p className="truncate text-xs text-[#5f6b64]">
                              #{inc.id} · {inc.serviceName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inc.status} />
                      </td>
                      <td className="px-4 py-3 text-[#3d4a42]">{memberName(inc.assignedResponderId) ?? <span className="text-[#5f6b64]">Unassigned</span>}</td>
                      <td className="px-4 py-3 text-[#3d4a42]">
                        <span title={formatDateTime(inc.detectedAt)}>{timeAgo(inc.detectedAt)}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#14201a]">{formatDuration(inc.mttaSeconds)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#14201a]">{formatDuration(mttrSeconds(inc))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <GroupsView state={groups} />
      )}

      {responder && <DeclareModal open={declareOpen} onClose={() => setDeclareOpen(false)} />}
    </div>
  );
}

function GroupsView({ state }: { state: { data: GroupsResponse | null; error: string | null; loading: boolean } }) {
  if (state.loading && !state.data) return <SkeletonRows rows={4} />;
  if (state.error) return <ErrorBanner message={state.error} />;
  const groups = state.data?.groups ?? [];
  if (groups.length === 0)
    return (
      <EmptyState
        icon={GitMerge}
        title="No correlated groups"
        description="When incidents open close together on related services, ResolveX groups them here so responders can work them together."
      />
    );
  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const reason = g.incidents.find((i) => i.correlationReason)?.correlationReason;
        const active = g.incidents.filter((i) => i.status !== 'resolved').length;
        return (
          <div key={g.groupId} className="rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dfdbcc] px-4 py-3">
              <div className="flex items-center gap-2">
                <GitMerge className="h-4 w-4 text-[#6d28d9]" />
                <h3 className="font-display text-sm font-bold text-[#14201a]">Group #{g.groupId}</h3>
                <span className="text-xs text-[#5f6b64]">
                  {g.incidents.length} incidents · {active} active
                </span>
              </div>
              {reason && <p className="text-xs text-[#5f6b64]">{reason}</p>}
            </div>
            <ul className="divide-y divide-[#dfdbcc]">
              {g.incidents.map((i) => (
                <li key={i.id}>
                  <Link href={`/dashboard/incidents/${i.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 hover:bg-[#f6f4ec]">
                    <span className="flex min-w-0 items-center gap-2">
                      <SeverityBadge severity={i.severity} />
                      <span className="truncate text-sm font-semibold text-[#14201a]">
                        #{i.id} {i.title}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <StatusBadge status={i.status} />
                      <span className="text-xs text-[#5f6b64]">{timeAgo(i.detectedAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function DeclareModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const services = useApi<{ services: ServiceItem[] }>(open ? '/api/services' : null);
  const projects = useApi<{ projects: ProjectItem[] }>(open ? '/api/projects' : null);
  const [serviceId, setServiceId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('sev3');
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [projectId, setProjectId] = useState('');
  const [createTask, setCreateTask] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ service?: string; title?: string }>({});

  const selectedService = services.data?.services.find((s) => String(s.id) === serviceId);

  const reset = () => {
    setServiceId('');
    setTitle('');
    setDescription('');
    setSeverity('sev3');
    setAssigneeId(null);
    setProjectId('');
    setCreateTask(false);
    setErrors({});
  };

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const errs: typeof errors = {};
    if (!serviceId) errs.service = 'Choose the affected service';
    if (!title.trim()) errs.title = 'Give the incident a short title';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const res = await api.post<{ incidentId: number; created: boolean }>('/api/incidents', {
        serviceId: Number(serviceId),
        title: title.trim(),
        description: description.trim() || null,
        severity,
        assigneeId,
        projectId: projectId || null,
        createTask,
      });
      toast.success(res.created ? `Incident #${res.incidentId} declared` : `This service already has an open incident (#${res.incidentId}); opening it`);
      reset();
      onClose();
      router.push(`/dashboard/incidents/${res.incidentId}`);
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Declare incident"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={saving} onClick={() => void submit()}>
            Declare incident
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {(services.error || projects.error) && <ErrorBanner message={services.error ?? projects.error ?? ''} />}
        <Field label="Affected service" error={errors.service} hint={selectedService?.openIncident ? `Already has open incident #${selectedService.openIncident.id}; declaring will attach to it.` : undefined}>
          <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)} disabled={services.loading}>
            <option value="">{services.loading ? 'Loading services…' : 'Select a service'}</option>
            {services.data?.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.environment})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title" error={errors.title}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Checkout API returning 502s" />
        </Field>
        <Field label="Description" hint="What is happening and who is affected? Markdown supported.">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={10000} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Severity" hint={SEVERITY_OPTIONS.find((s) => s.value === severity)?.hint}>
            <Select value={severity} onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}>
              {SEVERITY_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Assignee" hint="Leave empty to route to the owner or on-call.">
            <MemberSelect value={assigneeId} onChange={setAssigneeId} noneLabel="Automatic routing" />
          </Field>
        </div>
        <Field label="Project" hint="Where the linked engineering task is created.">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={projects.loading}>
            <option value="">{selectedService?.projectId ? "Service's project (default)" : 'None'}</option>
            {projects.data?.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.key} · {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex cursor-pointer items-start gap-2 text-sm text-[#14201a]">
          <input type="checkbox" checked={createTask} onChange={(e) => setCreateTask(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#177a43]" />
          <span>
            Create a linked engineering task
            <span className="block text-xs text-[#5f6b64]">Needs a project (selected above or the service&apos;s project).</span>
          </span>
        </label>
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}
