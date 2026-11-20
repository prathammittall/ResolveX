'use client';

/** Panels used by the incident detail page. */
import React, { useState } from 'react';
import Link from 'next/link';
import { Bot, Clock3, Link2, ListChecks, Plus, Send, Sparkles, Unlink } from 'lucide-react';
import { api } from '../../../../lib/api';
import type { IncidentEscalationItem, ProjectItem } from '../../../../lib/types';
import { cn, formatDateTime, timeAgo } from '../../_components/ui';
import { Avatar } from '../../_components/work';
import { Button, Field, Input, Markdown, Pill, Select, Skeleton, Textarea, useApi, useConfirm, useToast } from '../../_components/kit';
import { CheckStrip, eventMeta, type AssistantResult, type AssistantTask, type IncidentContext, type TimelineResponse } from '../_shared';

// ============ AI / rule-based assistant ============
const ASSISTANT_TASKS: Array<{ id: AssistantTask; label: string }> = [
  { id: 'summary', label: 'Summary' },
  { id: 'root_cause', label: 'Likely root causes' },
  { id: 'troubleshooting', label: 'Troubleshooting' },
  { id: 'postmortem_draft', label: 'Draft postmortem' },
];

export function AssistantPanel({ incidentId, aiEnabled }: { incidentId: string; aiEnabled: boolean | undefined }) {
  const toast = useToast();
  const [active, setActive] = useState<AssistantTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(task: AssistantTask) {
    setActive(task);
    setLoading(true);
    setError(null);
    try {
      setResult(await api.post<AssistantResult>(`/api/incidents/${incidentId}/assistant`, { task }));
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : 'Assistant request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dfdbcc] px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#6d28d9]" />
          <h3 className="font-display text-base font-bold text-[#14201a]">Incident assistant</h3>
        </div>
        {aiEnabled !== undefined && <span className="text-xs text-[#5f6b64]">{aiEnabled ? 'AI provider configured' : 'Rule-based mode (no AI provider configured)'}</span>}
      </div>
      <div className="space-y-3 p-5">
        <div className="flex flex-wrap gap-2">
          {ASSISTANT_TASKS.map((t) => (
            <Button key={t.id} size="sm" variant={active === t.id ? 'primary' : 'secondary'} loading={loading && active === t.id} disabled={loading} onClick={() => void run(t.id)}>
              {t.label}
            </Button>
          ))}
        </div>
        {loading && (
          <div className="space-y-2" role="status" aria-label="Generating">
            <Skeleton className="w-3/4" />
            <Skeleton className="w-full" />
            <Skeleton className="w-2/3" />
          </div>
        )}
        {error && !loading && <p className="text-sm font-semibold text-[#dc2626]">{error}</p>}
        {result && !loading && (
          <div className="rounded-xl border border-[#dfdbcc] bg-[#fbfaf6]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dfdbcc] px-3.5 py-2">
              <div className="flex items-center gap-2">
                <Pill tone={result.source === 'ai' ? 'violet' : 'slate'}>
                  <Bot className="h-3 w-3" /> {result.source === 'ai' ? 'AI' : 'Rule-based'}
                </Pill>
                <span className="text-xs font-semibold text-[#5f6b64]">Suggestion — verify before acting</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void navigator.clipboard?.writeText(result.content).then(
                    () => toast.success('Copied to clipboard'),
                    () => toast.error('Could not copy'),
                  );
                }}
              >
                Copy
              </Button>
            </div>
            <p className="border-b border-[#fde68a] bg-[#fef3c7] px-3.5 py-2 text-xs font-medium text-[#92400e]">{result.disclaimer}</p>
            <div className="px-3.5 py-3">
              <Markdown source={result.content} />
            </div>
          </div>
        )}
        {!result && !loading && !error && <p className="text-xs text-[#5f6b64]">Generate a summary, hypotheses or a checklist from this incident&apos;s data. Output is a suggestion, never a confirmed finding.</p>}
      </div>
    </div>
  );
}

// ============ Linked engineering task ============
export function LinkedTaskPanel({ incidentId, task, defaultProjectId, canEdit, onChange }: { incidentId: string; task: IncidentContext['task']; defaultProjectId: string | null; canEdit: boolean; onChange: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const projects = useApi<{ projects: ProjectItem[] }>(canEdit && !task ? '/api/projects' : null);
  const [ref, setRef] = useState('');
  const [projectId, setProjectId] = useState('');
  const [busy, setBusy] = useState<'link' | 'create' | 'unlink' | null>(null);

  async function link(e: React.FormEvent) {
    e.preventDefault();
    if (!ref.trim()) return;
    setBusy('link');
    try {
      const r = await api.post<{ task: { ref: string } }>(`/api/incidents/${incidentId}/task`, { ref: ref.trim().toUpperCase() });
      toast.success(`Linked ${r.task.ref}`);
      setRef('');
      onChange();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
    }
  }
  async function create() {
    const pid = projectId || defaultProjectId;
    if (!pid) {
      toast.error('Choose a project for the task');
      return;
    }
    setBusy('create');
    try {
      const r = await api.post<{ task: { ref: string } }>(`/api/incidents/${incidentId}/task`, { projectId: pid });
      toast.success(`Created ${r.task.ref}`);
      onChange();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
    }
  }
  async function unlink() {
    if (!task) return;
    const ok = await confirm({ title: 'Unlink task?', message: `${task.ref} will no longer be linked to this incident. The task itself is not deleted.`, confirmLabel: 'Unlink', danger: true });
    if (!ok) return;
    setBusy('unlink');
    try {
      await api.del(`/api/incidents/${incidentId}/task`);
      toast.success('Task unlinked');
      onChange();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
    }
  }

  if (task) {
    const done = task.status.category === 'done';
    return (
      <div className="space-y-2">
        <Link href={`/dashboard/tasks/${task.ref}`} className="block rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3.5 py-2.5 hover:bg-[#f6f4ec]">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs font-bold text-[#177a43]">{task.ref}</span>
            <Pill tone={done ? 'green' : task.status.category === 'in_progress' ? 'blue' : 'slate'}>{task.status.name}</Pill>
          </div>
          <p className="mt-1 text-sm font-semibold text-[#14201a]">{task.title}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[#5f6b64]">
            {task.assignee ? (
              <>
                <Avatar name={task.assignee.name} size={18} /> {task.assignee.name}
              </>
            ) : (
              'Unassigned'
            )}
          </p>
        </Link>
        {canEdit && (
          <Button size="sm" variant="ghost" loading={busy === 'unlink'} onClick={() => void unlink()}>
            <Unlink className="h-3.5 w-3.5" /> Unlink task
          </Button>
        )}
      </div>
    );
  }

  if (!canEdit) return <p className="text-sm text-[#5f6b64]">No engineering task linked.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-[#5f6b64]">No engineering task linked yet.</p>
      <form onSubmit={link} className="flex items-end gap-2">
        <Field label="Link existing task" className="flex-1">
          <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. PAY-12" />
        </Field>
        <Button type="submit" variant="secondary" loading={busy === 'link'} disabled={!ref.trim()}>
          <Link2 className="h-4 w-4" /> Link
        </Button>
      </form>
      <div className="flex items-end gap-2">
        <Field label="Or create a bug in" className="flex-1">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={projects.loading}>
            <option value="">{defaultProjectId ? "Incident/service project" : 'Select a project'}</option>
            {projects.data?.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.key} · {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="secondary" loading={busy === 'create'} disabled={!projectId && !defaultProjectId} onClick={() => void create()}>
          <Plus className="h-4 w-4" /> Create
        </Button>
      </div>
      {projects.error && <p className="text-xs text-[#dc2626]">{projects.error}</p>}
    </div>
  );
}

// ============ Escalation & notification delivery ============
function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s).padStart(2, '0')}s`;
}
function formatDelay(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`;
}
const deliveryTone = (s: string): 'green' | 'red' | 'amber' | 'slate' => (s === 'sent' || s === 'delivered' || s === 'completed' ? 'green' : s === 'failed' ? 'red' : s === 'pending' || s === 'processing' ? 'amber' : 'slate');

export function EscalationPanel({ escalation, now }: { escalation: IncidentEscalationItem | null; now: number }) {
  if (!escalation) return <p className="text-sm text-[#5f6b64]">No escalation policy matched this incident.</p>;
  const remaining = escalation.nextEscalationAt ? Math.max(0, Date.parse(escalation.nextEscalationAt) - now) : null;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-[#92400e]" />
          <span className="text-sm text-[#3d4a42]">
            Step <b>{escalation.currentStep}</b> · <span className="capitalize">{escalation.status}</span>
          </span>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#5f6b64]">Next escalation</p>
          <p className="font-mono text-sm font-bold text-[#14201a]">{remaining === null ? '—' : remaining === 0 ? 'Due now' : formatCountdown(remaining)}</p>
        </div>
      </div>
      {escalation.steps.length > 0 && (
        <div className="rounded-xl bg-[#fbfaf6] p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#5f6b64]">
            <ListChecks className="h-3.5 w-3.5" /> Steps
          </p>
          <ol className="space-y-1">
            {escalation.steps.map((step) => (
              <li key={step.position} className="flex justify-between gap-3 text-xs">
                <span className={cn(step.position === escalation.currentStep ? 'font-bold text-[#177a43]' : 'text-[#3d4a42]')}>
                  {step.position}. {step.targetType} · {step.targetId}
                </span>
                <span className="text-[#5f6b64]">after {formatDelay(step.delaySeconds)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="rounded-xl bg-[#fbfaf6] p-3">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#5f6b64]">Queue and delivery</p>
        {escalation.queue.length === 0 && escalation.deliveries.length === 0 ? (
          <p className="text-xs text-[#5f6b64]">No queue activity yet.</p>
        ) : (
          <ul className="space-y-1.5 text-xs text-[#3d4a42]">
            {escalation.queue.map((job) => (
              <li key={`q${job.id}`} className="flex items-center justify-between gap-2">
                <span className="truncate" title={job.lastError ?? undefined}>
                  {job.type} job #{job.id} · {timeAgo(job.runAt)}
                </span>
                <Pill tone={deliveryTone(job.status)}>{job.status}</Pill>
              </li>
            ))}
            {escalation.deliveries.map((d) => (
              <li key={`d${d.id}`} className="flex items-center justify-between gap-2">
                <span className="truncate" title={d.error ?? undefined}>
                  {d.channel} → {d.recipient}
                  {d.error ? <span className="text-[#dc2626]"> · {d.error}</span> : null}
                </span>
                <Pill tone={deliveryTone(d.status)}>{d.status}</Pill>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ============ Timeline ============
export function TimelinePanel({ incidentId, timeline, loading, error, canComment, onPosted }: { incidentId: string; timeline: TimelineResponse | null; loading: boolean; error: string | null; canComment: boolean; onPosted: () => void }) {
  const toast = useToast();
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'comments' | 'system'>('all');

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setPosting(true);
    try {
      await api.post(`/api/incidents/${incidentId}/comments`, { message: comment.trim() });
      setComment('');
      toast.success('Comment added');
      onPosted();
    } catch (err) {
      toast.error(err);
    } finally {
      setPosting(false);
    }
  }

  const events = (timeline?.events ?? []).filter((e) => (filter === 'all' ? true : filter === 'comments' ? e.eventType === 'comment' : e.eventType !== 'comment'));

  return (
    <div className="rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dfdbcc] px-5 py-3.5">
        <h3 className="font-display text-base font-bold text-[#14201a]">Timeline</h3>
        <div className="flex gap-1" role="group" aria-label="Filter timeline">
          {(['all', 'comments', 'system'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={cn('rounded-lg border px-2.5 py-1 text-xs font-semibold capitalize', filter === f ? 'border-[#b2e2a8] bg-[#dcefd8] text-[#177a43]' : 'border-[#dfdbcc] bg-white text-[#5f6b64] hover:bg-[#eeebe0]')}
            >
              {f === 'system' ? 'Events' : f}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-5 p-5">
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#5f6b64]">Monitor checks · 30 min before detection until resolution</p>
          {loading && !timeline ? <Skeleton className="h-7 w-full" /> : <CheckStrip checks={timeline?.checks ?? []} />}
        </div>
        {error && <p className="text-sm font-semibold text-[#dc2626]">{error}</p>}
        {loading && !timeline ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-[#5f6b64]">{filter === 'comments' ? 'No comments yet.' : 'No activity recorded yet.'}</p>
        ) : (
          <ol className="relative space-y-5 border-l-2 border-[#dfdbcc] pl-6">
            {events.map((ev) => {
              const m = eventMeta(ev.eventType);
              const Icon = m.icon;
              return (
                <li key={ev.id} className="relative">
                  <span className={cn('absolute -left-[37px] flex h-7 w-7 items-center justify-center rounded-full border', m.cls)} aria-hidden="true">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-bold text-[#14201a]">{m.label}</span>
                    <span className="text-xs text-[#5f6b64]" title={formatDateTime(ev.occurredAt)}>
                      {formatDateTime(ev.occurredAt)} · {timeAgo(ev.occurredAt)}
                    </span>
                  </div>
                  {ev.eventType === 'comment' ? (
                    <div className="mt-1 rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3 py-2">
                      <Markdown source={ev.message} />
                    </div>
                  ) : (
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-[#3d4a42]">{ev.message}</p>
                  )}
                  {ev.actorName && <p className="mt-0.5 text-xs text-[#5f6b64]">by {ev.actorName}</p>}
                </li>
              );
            })}
          </ol>
        )}
        {canComment && (
          <form onSubmit={post} className="border-t border-[#dfdbcc] pt-4">
            <Field label="Add a comment" hint="Markdown supported. Visible to everyone on this incident.">
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={4000} placeholder="Triage note, finding or update…" rows={3} />
            </Field>
            <div className="mt-2 flex justify-end">
              <Button type="submit" size="sm" loading={posting} disabled={!comment.trim()}>
                <Send className="h-3.5 w-3.5" /> Post comment
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
