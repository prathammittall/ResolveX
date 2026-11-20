'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Bot, CheckCircle2, Circle, ExternalLink, FileText, Printer, Save, Sparkles, Trash2 } from 'lucide-react';
import { api, apiFetch } from '../../../../../lib/api';
import { useAuth } from '../../../../../lib/auth-context';
import { can } from '../../../../../lib/permissions';
import type { IncidentDetailResponse, ProjectItem } from '../../../../../lib/types';
import { EmptyState, ErrorBanner, SectionCard, SeverityBadge, StatusBadge, cn, formatDateTime, timeAgo } from '../../../_components/ui';
import { Avatar, DueDate } from '../../../_components/work';
import { Button, Field, Input, Markdown, MemberSelect, PageHeader, Pill, Select, Skeleton, SkeletonRows, Textarea, formatDuration, useApi, useConfirm, useMembers, useToast } from '../../../_components/kit';
import { PM_STATUS_LABEL, PM_STATUS_TONE, eventMeta, mttrSeconds, type AssistantResult, type Postmortem, type PostmortemStatus, type TimelineResponse } from '../../_shared';

type FieldKey = 'summary' | 'customerImpact' | 'rootCause' | 'contributingFactors' | 'resolution' | 'preventiveMeasures' | 'lessonsLearned';
type Form = Record<FieldKey, string> & { status: PostmortemStatus };

const SECTIONS: Array<{ key: FieldKey; label: string; hint: string }> = [
  { key: 'summary', label: 'Summary', hint: 'What happened, in two or three sentences.' },
  { key: 'customerImpact', label: 'Customer impact', hint: 'Who was affected, how badly, and for how long.' },
  { key: 'rootCause', label: 'Root cause', hint: 'The underlying cause, as established by the investigation.' },
  { key: 'contributingFactors', label: 'Contributing factors', hint: 'Conditions that made the incident possible or worse.' },
  { key: 'resolution', label: 'Resolution', hint: 'How service was restored.' },
  { key: 'preventiveMeasures', label: 'Preventive measures', hint: 'Changes that stop this from happening again.' },
  { key: 'lessonsLearned', label: 'Lessons learned', hint: 'What went well, what did not, where we got lucky.' },
];

const EMPTY: Form = { status: 'draft', summary: '', customerImpact: '', rootCause: '', contributingFactors: '', resolution: '', preventiveMeasures: '', lessonsLearned: '' };

function toForm(pm: Postmortem | null, fallbackImpact: string | null): Form {
  if (!pm) return { ...EMPTY, customerImpact: fallbackImpact ?? '' };
  return {
    status: pm.status,
    summary: pm.summary ?? '',
    customerImpact: pm.customerImpact ?? '',
    rootCause: pm.rootCause ?? '',
    contributingFactors: pm.contributingFactors ?? '',
    resolution: pm.resolution ?? '',
    preventiveMeasures: pm.preventiveMeasures ?? '',
    lessonsLearned: pm.lessonsLearned ?? '',
  };
}

export default function PostmortemPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const members = useMembers();
  const writer = can(user?.role, 'postmortems:write');

  const incident = useApi<IncidentDetailResponse>(`/api/incidents/${id}`);
  const pm = useApi<{ postmortem: Postmortem | null }>(`/api/incidents/${id}/postmortem`);
  const ctx = useApi<{ incident: { customerImpact: string | null } }>(`/api/incidents/${id}/context`);
  const timeline = useApi<TimelineResponse>(`/api/incidents/${id}/timeline`);
  const projects = useApi<{ projects: ProjectItem[] }>(writer ? '/api/projects' : null);

  const [form, setForm] = useState<Form>(EMPTY);
  const [initialized, setInitialized] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftNote, setDraftNote] = useState<AssistantResult | null>(null);
  const [view, setView] = useState<'edit' | 'document'>('edit');
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Initialise the form once both the postmortem and the incident context are known; never clobber edits.
  useEffect(() => {
    if (initialized || !pm.data || ctx.loading) return;
    setForm(toForm(pm.data.postmortem, ctx.data?.incident.customerImpact ?? null));
    setInitialized(true);
  }, [pm.data, ctx.loading, ctx.data, initialized]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  useEffect(() => {
    if (!writer && pm.data) setView('document');
  }, [writer, pm.data]);

  const set = (k: keyof Form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  const inc = incident.data?.incident;
  const resolved = inc?.status === 'resolved';
  const existing = pm.data?.postmortem ?? null;
  const actionItems = existing?.actionItems ?? [];

  async function save(statusOverride?: PostmortemStatus) {
    const status = statusOverride ?? form.status;
    if (status === 'published' && !resolved) {
      toast.error('Resolve the incident before publishing its postmortem');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { status };
      for (const s of SECTIONS) body[s.key] = form[s.key].trim() ? form[s.key] : null;
      await apiFetch(`/api/incidents/${id}/postmortem`, { method: 'PUT', body: JSON.stringify(body) });
      setForm((f) => ({ ...f, status }));
      setDirty(false);
      toast.success(status === 'published' ? 'Postmortem published' : 'Postmortem saved');
      pm.reload();
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function draftWithAssistant() {
    setDrafting(true);
    try {
      const r = await api.post<AssistantResult>(`/api/incidents/${id}/assistant`, { task: 'postmortem_draft' });
      if (!form.summary.trim()) {
        set('summary', r.content);
      } else {
        const ok = await confirm({ title: 'Append assistant draft?', message: 'Summary already has content. Append the assistant draft below it? Nothing is saved until you click Save.', confirmLabel: 'Append' });
        if (!ok) return;
        set('summary', `${form.summary.trim()}\n\n---\n\n${r.content}`);
      }
      setDraftNote(r);
      toast.info('Draft inserted into Summary — review and edit before saving');
    } catch (e) {
      toast.error(e);
    } finally {
      setDrafting(false);
    }
  }

  function printDoc() {
    setView('document');
    window.setTimeout(() => window.print(), 50);
  }

  const timelineEvents = useMemo(() => (timeline.data?.events ?? []).filter((e) => e.eventType !== 'notification'), [timeline.data]);
  const memberName = (uid: number | null) => (uid ? (members.find((m) => m.userId === uid)?.name ?? `User #${uid}`) : null);

  if ((incident.loading && !incident.data) || (pm.loading && !pm.data)) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-2/3" />
        <SkeletonRows rows={8} />
      </div>
    );
  }
  if (!incident.data || !pm.data) {
    return (
      <div className="space-y-4">
        <Back id={id} />
        <ErrorBanner message={incident.error || pm.error || 'Could not load the postmortem'} />
        <Button
          variant="secondary"
          onClick={() => {
            incident.reload();
            pm.reload();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }
  if (!existing && !writer) {
    return (
      <div className="space-y-4">
        <Back id={id} />
        <EmptyState icon={FileText} title="No postmortem yet" description="Nobody has started a postmortem for this incident." />
      </div>
    );
  }

  const incidentInfo = inc!;
  const doc = (
    <PostmortemDocument
      incident={incidentInfo}
      form={form}
      authorName={memberName(existing?.authorId ?? null)}
      publishedAt={existing?.publishedAt ?? null}
      updatedAt={existing?.updatedAt ?? null}
      events={timelineEvents}
      actionItems={actionItems.map((a) => ({ ...a, ownerName: memberName(a.ownerId) }))}
    />
  );

  return (
    <div className="space-y-5">
      <PrintStyles />
      {mounted && createPortal(<div id="rx-pm-print">{doc}</div>, document.body)}

      <Back id={id} />
      <PageHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={incidentInfo.severity} /> <StatusBadge status={incidentInfo.status} /> <span>Incident #{incidentInfo.id} · {incidentInfo.serviceName}</span>
          </span>
        }
        title={`Postmortem: ${incidentInfo.title}`}
        description={existing ? `Last updated ${timeAgo(existing.updatedAt)}${dirty ? ' · unsaved changes' : ''}` : 'Not saved yet — saving creates the postmortem.'}
        actions={
          <>
            <Pill tone={PM_STATUS_TONE[form.status] ?? 'slate'}>{PM_STATUS_LABEL[form.status]}</Pill>
            {writer && (
              <Button variant="secondary" onClick={() => setView(view === 'edit' ? 'document' : 'edit')}>
                {view === 'edit' ? 'Document view' : 'Edit'}
              </Button>
            )}
            <Button variant="secondary" onClick={printDoc}>
              <Printer className="h-4 w-4" /> Print / export
            </Button>
            {writer && (
              <Button loading={saving} onClick={() => void save()} disabled={!initialized}>
                <Save className="h-4 w-4" /> Save
              </Button>
            )}
          </>
        }
      />

      {!resolved && <p className="rounded-xl border border-[#fde68a] bg-[#fef3c7] px-4 py-2.5 text-sm text-[#92400e]">This incident is still {incidentInfo.status}. You can draft now; publishing is available once it is resolved.</p>}

      {view === 'document' ? (
        <div className="overflow-x-auto rounded-2xl border border-[#dfdbcc] bg-white p-5 shadow-[0_2px_0_#dfdbcc] sm:p-8">{doc}</div>
      ) : !initialized ? (
        <SkeletonRows rows={8} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="min-w-0 space-y-5 lg:col-span-2">
            <SectionCard
              title="Write-up"
              action={
                <Button size="sm" variant="secondary" loading={drafting} onClick={() => void draftWithAssistant()}>
                  <Sparkles className="h-3.5 w-3.5" /> Draft with assistant
                </Button>
              }
            >
              <div className="space-y-5">
                {draftNote && (
                  <div className="flex items-start gap-2 rounded-xl border border-[#fde68a] bg-[#fef3c7] px-3 py-2 text-xs text-[#92400e]">
                    <Pill tone={draftNote.source === 'ai' ? 'violet' : 'slate'}>
                      <Bot className="h-3 w-3" /> {draftNote.source === 'ai' ? 'AI' : 'Rule-based'}
                    </Pill>
                    <span className="flex-1">
                      {draftNote.disclaimer} The draft was placed in Summary; move parts into the right sections and verify every claim before saving.
                    </span>
                    <button onClick={() => setDraftNote(null)} className="font-semibold underline" aria-label="Dismiss assistant notice">
                      Dismiss
                    </button>
                  </div>
                )}
                {SECTIONS.map((s) => (
                  <MarkdownField key={s.key} label={s.label} hint={s.hint} value={form[s.key]} onChange={(v) => set(s.key, v)} />
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Timeline" subtitle="Generated from the incident record">
              <TimelineTable events={timelineEvents} loading={timeline.loading && !timeline.data} error={timeline.error} />
            </SectionCard>
          </div>

          <div className="min-w-0 space-y-5">
            <SectionCard title="Status">
              <div className="space-y-3">
                <Field label="Review status" hint={!resolved ? 'Publishing requires a resolved incident.' : undefined}>
                  <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
                    <option value="draft">Draft</option>
                    <option value="in_review">In review</option>
                    <option value="published" disabled={!resolved}>
                      Published
                    </option>
                  </Select>
                </Field>
                {existing?.publishedAt && <p className="text-xs text-[#5f6b64]">Published {formatDateTime(existing.publishedAt)}</p>}
                {form.status !== 'published' && resolved && (
                  <Button className="w-full" loading={saving} onClick={() => void save('published')}>
                    Save & publish
                  </Button>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Incident facts">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Fact label="Detected" value={formatDateTime(incidentInfo.detectedAt)} />
                <Fact label="Resolved" value={incidentInfo.resolvedAt ? formatDateTime(incidentInfo.resolvedAt) : '—'} />
                <Fact label="Time to acknowledge" value={formatDuration(incidentInfo.mttaSeconds)} />
                <Fact label="Time to resolve" value={formatDuration(mttrSeconds(incidentInfo))} />
              </dl>
              <Link href={`/dashboard/incidents/${id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#177a43] hover:underline">
                Open incident <ExternalLink className="h-3 w-3" />
              </Link>
            </SectionCard>

            <ActionItems incidentId={id} items={actionItems} projects={projects.data?.projects ?? []} memberName={memberName} onChange={pm.reload} />
          </div>
        </div>
      )}
    </div>
  );
}

function Back({ id }: { id: string }) {
  return (
    <Link href={`/dashboard/incidents/${id}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5f6b64] transition hover:text-[#177a43]">
      <ArrowLeft className="h-3.5 w-3.5" /> Back to incident
    </Link>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-[#5f6b64]">{label}</dt>
      <dd className="font-semibold text-[#14201a]">{value}</dd>
    </div>
  );
}

function MarkdownField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  const [preview, setPreview] = useState(false);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-[#5f6b64]">{label}</span>
        <div className="flex gap-1" role="group" aria-label={`${label} editor mode`}>
          {(['Write', 'Preview'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={(m === 'Preview') === preview}
              onClick={() => setPreview(m === 'Preview')}
              className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold', (m === 'Preview') === preview ? 'bg-[#dcefd8] text-[#177a43]' : 'text-[#5f6b64] hover:bg-[#eeebe0]')}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      {preview ? (
        <div className="min-h-[90px] rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3 py-2">
          <Markdown source={value} />
        </div>
      ) : (
        <Textarea aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} maxLength={20000} rows={5} />
      )}
      <span className="mt-1 block text-xs text-[#5f6b64]">{hint} Markdown supported.</span>
    </div>
  );
}

function TimelineTable({ events, loading, error }: { events: TimelineResponse['events']; loading: boolean; error: string | null }) {
  if (loading) return <SkeletonRows rows={4} />;
  if (error) return <p className="text-sm text-[#dc2626]">{error}</p>;
  if (events.length === 0) return <p className="text-sm text-[#5f6b64]">No timeline events recorded.</p>;
  return (
    <ol className="space-y-2">
      {events.map((e) => {
        const m = eventMeta(e.eventType);
        const Icon = m.icon;
        return (
          <li key={e.id} className="flex gap-3 text-sm">
            <span className="w-36 shrink-0 font-mono text-xs text-[#5f6b64]">{formatDateTime(e.occurredAt)}</span>
            <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', m.cls)} aria-hidden="true">
              <Icon className="h-3 w-3" />
            </span>
            <span className="min-w-0 break-words text-[#14201a]">
              <b className="font-semibold">{m.label}:</b> {e.message}
              {e.actorName && <span className="text-[#5f6b64]"> — {e.actorName}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ActionItems({ incidentId, items, projects, memberName, onChange }: { incidentId: string; items: NonNullable<Postmortem['actionItems']>; projects: ProjectItem[]; memberName: (id: number | null) => string | null; onChange: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [title, setTitle] = useState('');
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true);
    try {
      await api.post(`/api/incidents/${incidentId}/postmortem/action-items`, {
        title: title.trim(),
        ownerId,
        dueDate: dueDate || null,
        ...(projectId ? { createTaskInProject: projectId } : {}),
      });
      toast.success(projectId ? 'Action item and task created' : 'Action item added');
      setTitle('');
      setOwnerId(null);
      setDueDate('');
      setProjectId('');
      onChange();
    } catch (err) {
      toast.error(err);
    } finally {
      setAdding(false);
    }
  }
  async function toggle(id: number, done: boolean) {
    setBusyId(id);
    try {
      await api.patch(`/api/postmortems/action-items/${id}`, { status: done ? 'open' : 'done' });
      onChange();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusyId(null);
    }
  }
  async function remove(id: number, t: string) {
    if (!(await confirm({ title: 'Delete action item?', message: `“${t}” will be removed from this postmortem. A linked task, if any, is kept.`, confirmLabel: 'Delete', danger: true }))) return;
    setBusyId(id);
    try {
      await api.del(`/api/postmortems/action-items/${id}`);
      toast.success('Action item deleted');
      onChange();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SectionCard title="Action items" subtitle={`${items.filter((i) => i.status === 'done').length}/${items.length} done`}>
      <div className="space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-[#5f6b64]">No action items yet.</p>
        ) : (
          <ul className="divide-y divide-[#dfdbcc]">
            {items.map((it) => {
              const done = it.status === 'done';
              const owner = memberName(it.ownerId);
              return (
                <li key={it.id} className="flex items-start gap-2 py-2">
                  <button onClick={() => void toggle(it.id, done)} disabled={busyId === it.id} aria-label={done ? `Mark “${it.title}” as open` : `Mark “${it.title}” as done`} className="mt-0.5 shrink-0 text-[#177a43] disabled:opacity-50">
                    {done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4 text-[#5f6b64]" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cn('break-words text-sm', done ? 'text-[#5f6b64] line-through' : 'text-[#14201a]')}>{it.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#5f6b64]">
                      {owner ? (
                        <span className="inline-flex items-center gap-1">
                          <Avatar name={owner} size={16} /> {owner}
                        </span>
                      ) : (
                        <span>No owner</span>
                      )}
                      <DueDate iso={it.dueDate} done={done} />
                      {it.taskId && (
                        <Link href={`/dashboard/tasks/${it.taskId}`} className="font-semibold text-[#177a43] hover:underline">
                          Linked task
                        </Link>
                      )}
                    </div>
                  </div>
                  <button onClick={() => void remove(it.id, it.title)} disabled={busyId === it.id} aria-label={`Delete “${it.title}”`} className="rounded-md p-1 text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626] disabled:opacity-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <form onSubmit={add} className="space-y-2.5 border-t border-[#dfdbcc] pt-3">
          <Field label="New action item">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} placeholder="Add alerting on queue depth" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Owner">
              <MemberSelect value={ownerId} onChange={setOwnerId} noneLabel="No owner" />
            </Field>
            <Field label="Due date">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </div>
          <Field label="Create task in project" hint="Optional — also opens a tracked task.">
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Don&apos;t create a task</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.key} · {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" size="sm" loading={adding} disabled={!title.trim()}>
            Add action item
          </Button>
        </form>
      </div>
    </SectionCard>
  );
}

type DocIncident = IncidentDetailResponse['incident'];
function PostmortemDocument({
  incident,
  form,
  authorName,
  publishedAt,
  updatedAt,
  events,
  actionItems,
}: {
  incident: DocIncident;
  form: Form;
  authorName: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  events: TimelineResponse['events'];
  actionItems: Array<NonNullable<Postmortem['actionItems']>[number] & { ownerName: string | null }>;
}) {
  const mttr = mttrSeconds(incident);
  return (
    <article className="rx-pm-doc mx-auto max-w-3xl text-[#14201a]">
      <header className="border-b-2 border-[#14201a] pb-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5f6b64]">Incident postmortem · {PM_STATUS_LABEL[form.status]}</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold">{incident.title}</h1>
        <table className="mt-4 w-full text-sm">
          <tbody>
            <DocRow k="Incident" v={`#${incident.id} · ${incident.severity.toUpperCase()} · ${incident.serviceName}`} />
            <DocRow k="Detected" v={formatDateTime(incident.detectedAt)} />
            <DocRow k="Resolved" v={incident.resolvedAt ? formatDateTime(incident.resolvedAt) : `Not resolved (${incident.status})`} />
            <DocRow k="Time to acknowledge / resolve" v={`${formatDuration(incident.mttaSeconds)} / ${formatDuration(mttr)}`} />
            {authorName && <DocRow k="Author" v={authorName} />}
            {publishedAt && <DocRow k="Published" v={formatDateTime(publishedAt)} />}
            {updatedAt && <DocRow k="Last updated" v={formatDateTime(updatedAt)} />}
          </tbody>
        </table>
      </header>
      {SECTIONS.map((s) => (
        <section key={s.key} className="mt-6 break-inside-avoid">
          <h2 className="mb-1 font-display text-lg font-bold">{s.label}</h2>
          {form[s.key].trim() ? <Markdown source={form[s.key]} /> : <p className="text-sm italic text-[#5f6b64]">Not documented.</p>}
        </section>
      ))}
      <section className="mt-6">
        <h2 className="mb-2 font-display text-lg font-bold">Timeline</h2>
        {events.length === 0 ? (
          <p className="text-sm italic text-[#5f6b64]">No timeline events recorded.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-[#dfdbcc] align-top">
                  <td className="whitespace-nowrap py-1.5 pr-3 font-mono text-xs text-[#5f6b64]">{formatDateTime(e.occurredAt)}</td>
                  <td className="py-1.5 pr-3 text-xs font-semibold">{eventMeta(e.eventType).label}</td>
                  <td className="break-words py-1.5">
                    {e.message}
                    {e.actorName ? <span className="text-[#5f6b64]"> — {e.actorName}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="mt-6 break-inside-avoid">
        <h2 className="mb-2 font-display text-lg font-bold">Action items</h2>
        {actionItems.length === 0 ? (
          <p className="text-sm italic text-[#5f6b64]">No action items.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#14201a] text-left text-xs uppercase tracking-wide text-[#5f6b64]">
                <th className="py-1.5 pr-3">Item</th>
                <th className="py-1.5 pr-3">Owner</th>
                <th className="py-1.5 pr-3">Due</th>
                <th className="py-1.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {actionItems.map((a) => (
                <tr key={a.id} className="border-b border-[#dfdbcc] align-top">
                  <td className="py-1.5 pr-3">{a.title}</td>
                  <td className="py-1.5 pr-3">{a.ownerName ?? '—'}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3">{a.dueDate ? a.dueDate.slice(0, 10) : '—'}</td>
                  <td className="py-1.5 capitalize">{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <footer className="mt-8 border-t border-[#dfdbcc] pt-3 text-xs text-[#5f6b64]">This is a blameless postmortem. Generated by ResolveX on {formatDateTime(new Date().toISOString())}.</footer>
    </article>
  );
}

function DocRow({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <th className="w-56 py-0.5 pr-3 text-left align-top text-xs font-bold uppercase tracking-wide text-[#5f6b64]">{k}</th>
      <td className="py-0.5">{v}</td>
    </tr>
  );
}

/** Print-only layout: hide the app, print the portal copy of the document in plain black on white. */
function PrintStyles() {
  return (
    <style>{`
      #rx-pm-print { display: none; }
      @media print {
        @page { margin: 16mm; }
        body > *:not(#rx-pm-print) { display: none !important; }
        html, body { background: #fff !important; }
        #rx-pm-print { display: block !important; }
        #rx-pm-print, #rx-pm-print * { color: #111 !important; background: transparent !important; border-color: #bbb !important; box-shadow: none !important; }
        #rx-pm-print .rx-pm-doc { max-width: none; }
        #rx-pm-print h1, #rx-pm-print h2 { page-break-after: avoid; }
        #rx-pm-print tr { page-break-inside: avoid; }
        #rx-pm-print a { text-decoration: underline; }
      }
    `}</style>
  );
}
