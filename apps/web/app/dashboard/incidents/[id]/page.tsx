'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Check, ExternalLink, FileText, GitBranch, Hand, Pencil, RotateCcw, Server, X } from 'lucide-react';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { can, canRespond, canWork } from '../../../../lib/permissions';
import type { IncidentDetailResponse, IncidentSeverity, IncidentStatus } from '../../../../lib/types';
import { ErrorBanner, HealthBadge, SectionCard, SeverityBadge, StatusBadge, cn, formatDateTime, timeAgo } from '../../_components/ui';
import { Button, Input, Markdown, MemberSelect, Pill, Select, Skeleton, SkeletonRows, Textarea, formatDuration, useApi, useConfirm, useToast } from '../../_components/kit';
import { PM_STATUS_LABEL, PM_STATUS_TONE, SEVERITY_OPTIONS, STATUS_FLOW, STATUS_LABEL, mttrSeconds, nextStatuses, type IncidentContext, type TimelineResponse } from '../_shared';
import { AssistantPanel, EscalationPanel, LinkedTaskPanel, TimelinePanel } from './_panels';

export default function IncidentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const responder = canRespond(user?.role);
  const worker = canWork(user?.role);
  const pmWriter = can(user?.role, 'postmortems:write');

  const detail = useApi<IncidentDetailResponse>(`/api/incidents/${id}`);
  const ctx = useApi<IncidentContext>(`/api/incidents/${id}/context`);
  const timeline = useApi<TimelineResponse>(`/api/incidents/${id}/timeline`);

  const { reload: reloadDetail } = detail;
  const { reload: reloadCtx } = ctx;
  const { reload: reloadTimeline } = timeline;
  const reloadAll = useCallback(() => {
    reloadDetail();
    reloadCtx();
    reloadTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    const r = window.setInterval(() => {
      if (document.visibilityState === 'visible') reloadAll();
    }, 20000);
    return () => {
      window.clearInterval(t);
      window.clearInterval(r);
    };
  }, [reloadAll]);

  const [busy, setBusy] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [note, setNote] = useState('');
  const [editingImpact, setEditingImpact] = useState(false);
  const [impactDraft, setImpactDraft] = useState('');

  async function patch(key: string, body: Record<string, unknown>, success: string) {
    setBusy(key);
    try {
      await api.patch(`/api/incidents/${id}`, body);
      toast.success(success);
      reloadAll();
      return true;
    } catch (e) {
      toast.error(e);
      return false;
    } finally {
      setBusy(null);
    }
  }

  if (detail.loading && !detail.data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-4 w-32" />
        <div className="rounded-2xl border border-[#dfdbcc] bg-white p-6 shadow-[0_2px_0_#dfdbcc]">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-4 h-8 w-2/3" />
          <Skeleton className="mt-6 h-10 w-full" />
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SkeletonRows rows={6} />
          </div>
          <SkeletonRows rows={4} />
        </div>
      </div>
    );
  }

  if (!detail.data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorBanner message={detail.error || 'Incident not found'} />
        <Button variant="secondary" onClick={reloadAll}>
          Try again
        </Button>
      </div>
    );
  }

  const { incident, alerts, escalation } = detail.data;
  const c = ctx.data;
  const full = c?.incident;
  const resolved = incident.status === 'resolved';
  const assignedToMe = user?.id !== undefined && incident.assignedResponderId === user.id;
  const mttr = mttrSeconds(incident);

  const changeStatus = async (s: IncidentStatus) => {
    if (s === 'open') {
      const ok = await confirm({ title: 'Reopen incident?', message: 'The incident returns to Open and its resolution time is cleared.', confirmLabel: 'Reopen' });
      if (!ok) return;
    }
    const done = await patch(`status:${s}`, { status: s, ...(note.trim() ? { note: note.trim() } : {}) }, s === 'open' ? 'Incident reopened' : `Status set to ${STATUS_LABEL[s]}`);
    if (done) setNote('');
  };

  const saveTitle = async () => {
    const t = titleDraft.trim();
    if (!t || t === incident.title) {
      setEditingTitle(false);
      return;
    }
    if (await patch('title', { title: t }, 'Title updated')) setEditingTitle(false);
  };

  const saveImpact = async () => {
    if (await patch('impact', { customerImpact: impactDraft.trim() || null }, 'Customer impact updated')) setEditingImpact(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BackLink />
        <div className="flex flex-wrap gap-2">
          {c?.postmortem ? (
            <Link href={`/dashboard/incidents/${id}/postmortem`} className={PM_LINK_SECONDARY}><FileText className="h-3.5 w-3.5" /> Postmortem · {PM_STATUS_LABEL[c.postmortem.status] ?? c.postmortem.status}</Link>
          ) : resolved && pmWriter ? (
            <Link href={`/dashboard/incidents/${id}/postmortem`} className={PM_LINK_PRIMARY}><FileText className="h-3.5 w-3.5" /> Start postmortem</Link>
          ) : null}
        </div>
      </div>

      {detail.error && <ErrorBanner message={`Could not refresh: ${detail.error}`} />}

      {/* Header */}
      <div className="rounded-2xl border border-[#dfdbcc] bg-white p-5 shadow-[0_2px_0_#dfdbcc] sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold text-[#5f6b64]">#{incident.id}</span>
          {responder ? (
            <label className="block w-28">
              <span className="sr-only">Severity</span>
              <Select
                aria-label="Severity"
                className="py-1 text-xs font-bold"
                value={incident.severity}
                disabled={busy === 'severity'}
                onChange={(e) => void patch('severity', { severity: e.target.value as IncidentSeverity }, 'Severity updated')}
              >
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </label>
          ) : (
            <SeverityBadge severity={incident.severity} />
          )}
          <StatusBadge status={incident.status} />
          {full?.source && <Pill tone="slate">via {full.source}</Pill>}
          {full?.correlationGroupId && <Pill tone="violet">Correlated group #{full.correlationGroupId}</Pill>}
        </div>

        {editingTitle ? (
          <form
            className="mt-3 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void saveTitle();
            }}
          >
            <Input aria-label="Incident title" value={titleDraft} maxLength={200} onChange={(e) => setTitleDraft(e.target.value)} className="min-w-0 flex-1 text-lg font-bold" autoFocus onKeyDown={(e) => e.key === 'Escape' && setEditingTitle(false)} />
            <Button type="submit" size="sm" loading={busy === 'title'} aria-label="Save title">
              <Check className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditingTitle(false)} aria-label="Cancel editing title">
              <X className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <div className="mt-3 flex items-start gap-2">
            <h1 className="min-w-0 break-words font-display text-2xl font-extrabold tracking-tight text-[#14201a]">{incident.title}</h1>
            {responder && (
              <button
                onClick={() => {
                  setTitleDraft(incident.title);
                  setEditingTitle(true);
                }}
                aria-label="Edit title"
                className="mt-1 rounded-lg p-1 text-[#5f6b64] hover:bg-[#eeebe0] hover:text-[#14201a]"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#5f6b64]">
          <span className="inline-flex items-center gap-1.5">
            <Server className="h-4 w-4 text-[#177a43]" />
            <Link href={`/dashboard/services/${incident.serviceId}`} className="font-bold text-[#14201a] hover:text-[#177a43] hover:underline">
              {incident.serviceName}
            </Link>
          </span>
          <span>Detected {formatDateTime(incident.detectedAt)} ({timeAgo(incident.detectedAt)})</span>
        </div>

        {incident.description && (
          <div className="mt-4 border-t border-[#dfdbcc] pt-4">
            <Markdown source={incident.description} />
          </div>
        )}

        {/* Status stepper */}
        <div className="mt-5 border-t border-[#dfdbcc] pt-4">
          <ol className="flex items-center gap-1 overflow-x-auto pb-1" aria-label="Lifecycle">
            {STATUS_FLOW.map((s, i) => {
              const idx = STATUS_FLOW.indexOf(incident.status);
              const state = i < idx ? 'done' : i === idx ? 'current' : 'todo';
              return (
                <li key={s} className="flex min-w-0 flex-1 items-center gap-1" aria-current={state === 'current' ? 'step' : undefined}>
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold',
                      state === 'done' && 'border-[#177a43] bg-[#177a43] text-white',
                      state === 'current' && 'border-[#177a43] bg-[#dcefd8] text-[#177a43]',
                      state === 'todo' && 'border-[#dfdbcc] bg-white text-[#5f6b64]',
                    )}
                  >
                    {state === 'done' ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className={cn('whitespace-nowrap text-xs font-semibold', state === 'todo' ? 'text-[#5f6b64]' : 'text-[#14201a]')}>{STATUS_LABEL[s]}</span>
                  {i < STATUS_FLOW.length - 1 && <span className={cn('mx-1 h-0.5 min-w-3 flex-1 rounded', i < idx ? 'bg-[#177a43]' : 'bg-[#eeebe0]')} />}
                </li>
              );
            })}
          </ol>

          {responder && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input aria-label="Status change note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Optional note for the status change" className="sm:max-w-sm" />
              <div className="flex flex-wrap gap-2">
                {resolved ? (
                  <Button variant="secondary" loading={busy === 'status:open'} onClick={() => void changeStatus('open')}>
                    <RotateCcw className="h-4 w-4" /> Reopen
                  </Button>
                ) : (
                  nextStatuses(incident.status).map((s) => (
                    <Button key={s} variant={s === 'resolved' ? 'primary' : 'secondary'} size="sm" loading={busy === `status:${s}`} disabled={busy !== null} onClick={() => void changeStatus(s)}>
                      {s === 'acknowledged' ? 'Acknowledge' : s === 'resolved' ? 'Resolve' : `Mark ${STATUS_LABEL[s].toLowerCase()}`}
                    </Button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Assignee */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#dfdbcc] pt-4">
          <span className="text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Responder</span>
          {responder ? (
            <div className="w-full max-w-xs">
              <MemberSelect value={incident.assignedResponderId} onChange={(v) => void patch('assignee', { assigneeId: v }, v ? 'Responder assigned' : 'Responder removed')} />
            </div>
          ) : (
            <span className="text-sm font-semibold text-[#14201a]">{incident.assignedResponderName ?? 'Unassigned'}</span>
          )}
          {responder && !resolved && !assignedToMe && user && (
            <Button
              size="sm"
              variant="secondary"
              loading={busy === 'own'}
              onClick={() => void patch('own', { assigneeId: user.id, ...(incident.status === 'open' ? { status: 'acknowledged' } : {}) }, 'You now own this incident')}
            >
              <Hand className="h-3.5 w-3.5" /> Take ownership
            </Button>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-[#dfdbcc] pt-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Detected" value={formatDateTime(incident.detectedAt)} />
          <Stat label="Acknowledged" value={incident.acknowledgedAt ? formatDateTime(incident.acknowledgedAt) : '—'} sub={incident.acknowledgmentDueAt && !incident.acknowledgedAt ? `due ${timeAgo(incident.acknowledgmentDueAt)}` : undefined} />
          <Stat label="MTTA" value={formatDuration(incident.mttaSeconds)} />
          <Stat label="Mitigated" value={full?.mitigatedAt ? formatDateTime(full.mitigatedAt) : '—'} />
          <Stat label="Resolved" value={incident.resolvedAt ? formatDateTime(incident.resolvedAt) : '—'} />
          <Stat label="MTTR" value={mttr !== null ? formatDuration(mttr) : formatDuration(Math.max(0, (now - Date.parse(incident.detectedAt)) / 1000))} sub={mttr === null ? 'ongoing' : undefined} />
        </dl>
      </div>

      {ctx.error && !c && <ErrorBanner message={`Context unavailable: ${ctx.error}`} />}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <AssistantPanel incidentId={id} aiEnabled={c?.aiEnabled} />
          <TimelinePanel incidentId={id} timeline={timeline.data} loading={timeline.loading} error={timeline.error} canComment={responder} onPosted={reloadTimeline} />
        </div>

        <div className="min-w-0 space-y-5">
          <SectionCard title="Service">
            {!c ? (
              <SkeletonRows rows={2} />
            ) : !c.service ? (
              <p className="text-sm text-[#5f6b64]">Service not found.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/dashboard/services/${c.service.id}`} className="truncate font-bold text-[#14201a] hover:text-[#177a43] hover:underline">
                    {c.service.name}
                  </Link>
                  <HealthBadge status={c.service.healthStatus} />
                </div>
                <p className="text-xs capitalize text-[#5f6b64]">{c.service.environment}</p>
                <div className="flex flex-wrap gap-2">
                  <ExtLink href={c.service.runbookUrl} icon={BookOpen} label="Runbook" />
                  <ExtLink href={c.service.docsUrl} icon={FileText} label="Docs" />
                  <ExtLink href={c.service.repositoryUrl} icon={GitBranch} label="Repository" />
                </div>
                {!c.service.runbookUrl && <p className="text-xs text-[#92400e]">No runbook linked to this service.</p>}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Customer impact"
            action={
              responder && !editingImpact && c ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setImpactDraft(c.incident.customerImpact ?? '');
                    setEditingImpact(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              ) : undefined
            }
          >
            {!c ? (
              <Skeleton className="h-10 w-full" />
            ) : editingImpact ? (
              <div className="space-y-2">
                <Textarea aria-label="Customer impact" value={impactDraft} onChange={(e) => setImpactDraft(e.target.value)} maxLength={5000} placeholder="Who is affected, how, and since when?" />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setEditingImpact(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" loading={busy === 'impact'} onClick={() => void saveImpact()}>
                    Save
                  </Button>
                </div>
              </div>
            ) : c.incident.customerImpact ? (
              <Markdown source={c.incident.customerImpact} />
            ) : (
              <p className="text-sm text-[#5f6b64]">Not documented yet.</p>
            )}
          </SectionCard>

          <SectionCard title="Engineering task">
            {!c ? <SkeletonRows rows={2} /> : <LinkedTaskPanel incidentId={id} task={c.task} defaultProjectId={c.incident.projectId ?? c.service?.projectId ?? null} canEdit={worker} onChange={reloadAll} />}
          </SectionCard>

          <SectionCard title="Postmortem">
            {!c ? (
              <Skeleton className="h-8 w-full" />
            ) : c.postmortem ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Pill tone={PM_STATUS_TONE[c.postmortem.status] ?? 'slate'}>{PM_STATUS_LABEL[c.postmortem.status] ?? c.postmortem.status}</Pill>
                  <span className="text-xs text-[#5f6b64]">updated {timeAgo(c.postmortem.updatedAt)}</span>
                </div>
                <p className="text-xs text-[#5f6b64]">
                  {c.postmortem.actionItems?.filter((a) => a.status === 'done').length ?? 0}/{c.postmortem.actionItems?.length ?? 0} action items done
                </p>
                <Link href={`/dashboard/incidents/${id}/postmortem`} className="inline-flex items-center gap-1 text-sm font-semibold text-[#177a43] hover:underline">
                  Open postmortem <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : resolved ? (
              pmWriter ? (
                <Link href={`/dashboard/incidents/${id}/postmortem`} className={PM_LINK_PRIMARY}><FileText className="h-3.5 w-3.5" /> Start postmortem</Link>
              ) : (
                <p className="text-sm text-[#5f6b64]">No postmortem written yet.</p>
              )
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-[#5f6b64]">A postmortem can be published once the incident is resolved.</p>
                {pmWriter && (
                  <Link href={`/dashboard/incidents/${id}/postmortem`} className="text-xs font-semibold text-[#177a43] hover:underline">
                    Start a draft now
                  </Link>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Escalation">
            <EscalationPanel escalation={escalation} now={now} />
          </SectionCard>

          <SectionCard title="Monitors">
            {!c ? (
              <SkeletonRows rows={2} />
            ) : c.monitors.length === 0 ? (
              <p className="text-sm text-[#5f6b64]">No monitors on this service.</p>
            ) : (
              <ul className="space-y-2.5">
                {c.monitors.map((m) => (
                  <li key={m.id} className="rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-[#14201a]">{m.name}</span>
                      <HealthBadge status={m.status} />
                    </div>
                    {m.lastError && <p className="mt-1 break-words font-mono text-[11px] text-[#991b1b]">{m.lastError}</p>}
                    <p className="mt-0.5 text-[11px] text-[#5f6b64]">{m.lastCheckedAt ? `checked ${timeAgo(m.lastCheckedAt)}` : 'never checked'}</p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Recent deployments">
            {!c ? (
              <SkeletonRows rows={2} />
            ) : c.recentDeployments.length === 0 ? (
              <p className="text-sm text-[#5f6b64]">No deployments recorded for this service.</p>
            ) : (
              <ul className="space-y-2.5">
                {c.recentDeployments.map((d) => {
                  const beforeIncident = Date.parse(d.deployedAt) <= Date.parse(incident.detectedAt);
                  const recent = beforeIncident && Date.parse(incident.detectedAt) - Date.parse(d.deployedAt) < 2 * 3600 * 1000;
                  return (
                    <li key={d.id} className="text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-xs font-bold text-[#14201a]">
                          {d.url ? (
                            <a href={d.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {d.version}
                            </a>
                          ) : (
                            d.version
                          )}
                        </span>
                        <Pill tone={d.status === 'succeeded' ? 'green' : d.status === 'failed' || d.status === 'rolled_back' ? 'red' : 'amber'}>{d.status.replace('_', ' ')}</Pill>
                      </div>
                      <p className="text-xs text-[#5f6b64]">
                        {d.environment} · {formatDateTime(d.deployedAt)}
                        {d.author ? ` · ${d.author}` : ''}
                        {d.commitSha ? ` · ${d.commitSha.slice(0, 7)}` : ''}
                      </p>
                      {recent && <p className="text-[11px] font-semibold text-[#92400e]">Deployed within 2h before detection</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Related incidents">
            {!c ? (
              <SkeletonRows rows={2} />
            ) : c.relatedIncidents.length === 0 ? (
              <p className="text-sm text-[#5f6b64]">No correlated incidents.</p>
            ) : (
              <div className="space-y-2">
                {c.incident.correlationReason && <p className="text-xs text-[#5f6b64]">{c.incident.correlationReason}</p>}
                <ul className="space-y-1.5">
                  {c.relatedIncidents.map((r) => (
                    <li key={r.id}>
                      <Link href={`/dashboard/incidents/${r.id}`} className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-[#f6f4ec]">
                        <SeverityBadge severity={r.severity} />
                        <span className="min-w-0 flex-1 truncate text-sm text-[#14201a]">
                          #{r.id} {r.title}
                        </span>
                        <StatusBadge status={r.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Linked alerts">
            {alerts.length === 0 ? (
              <p className="text-sm text-[#5f6b64]">No raw alerts linked to this incident.</p>
            ) : (
              <ul className="space-y-2">
                {alerts.map((a) => (
                  <li key={a.id} className="rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3 py-2">
                    <p className="truncate font-mono text-xs font-bold text-[#14201a]">{a.providerEventId}</p>
                    <p className="mt-0.5 text-xs text-[#5f6b64]">
                      {a.provider} · {a.processingStatus} · {timeAgo(a.receivedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

const PM_LINK_PRIMARY = 'inline-flex items-center gap-1.5 rounded-xl border border-[#177a43] bg-[#177a43] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0f5e32]';
const PM_LINK_SECONDARY = 'inline-flex items-center gap-1.5 rounded-xl border border-[#dfdbcc] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#14201a] hover:bg-[#eeebe0]';

function BackLink() {
  return (
    <Link href="/dashboard/incidents" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5f6b64] transition hover:text-[#177a43]">
      <ArrowLeft className="h-3.5 w-3.5" /> Back to incidents
    </Link>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-[#5f6b64]">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-bold text-[#14201a]">{value}</dd>
      {sub && <p className="text-xs text-[#5f6b64]">{sub}</p>}
    </div>
  );
}

function ExtLink({ href, icon: Icon, label }: { href: string | null; icon: React.ComponentType<{ className?: string }>; label: string }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfdbcc] bg-white px-2.5 py-1 text-xs font-semibold text-[#14201a] hover:bg-[#eeebe0]">
      <Icon className="h-3.5 w-3.5 text-[#177a43]" /> {label}
    </a>
  );
}
