'use client';

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, Eye, EyeOff, GitBranch, GitCommit, GitPullRequest, Link2, Paperclip, Pencil, Rocket, SmilePlus, Trash2, Upload, X } from 'lucide-react';
import { api, apiFetch } from '../../../../lib/api';
import type { IncidentItem, ServiceItem, StatusItem, TaskType, UserRef } from '../../../../lib/types';
import { Button, Input, Markdown, Select, Skeleton, Textarea, useApi, useConfirm, useMembers, useToast } from '../../_components/kit';
import { ErrorBanner, SectionCard, cn, formatDateTime, timeAgo } from '../../_components/ui';
import { Avatar, PRIORITIES, PriorityIcon, TASK_TYPES, TypeIcon } from '../../_components/work';
import { describeActivity } from '../../projects/[id]/_overview';
import { AssigneeSelect, PRIORITY_LABEL, TYPE_LABEL, dateOnly, fmtDay, usePerms, type Sprint, type Task, type TaskList } from '../../projects/[id]/_shared';

type Comment = { id: string; body: string; author: UserRef | null; createdAt: string; editedAt: string | null; reactions: Array<{ emoji: string; count: number; userIds: number[] }> };
type Activity = { id: string; type: string; data: Record<string, unknown> | null; actor: UserRef | null; createdAt: string };
type Dep = { dependencyId: string; task: Task };
type Attachment = { id: string; fileName: string; contentType: string; sizeBytes: number; uploaderId: number | null; uploader: UserRef | null; createdAt: string };
type Detail = {
  task: Task;
  parent: Task | null;
  subtasks: Task[];
  statuses: StatusItem[];
  comments: Comment[];
  activity: Activity[];
  watchers: UserRef[];
  blockedBy: Dep[];
  blocks: Dep[];
  attachments: Attachment[];
  sprint: { id: string; name: string; status: string } | null;
};
type GitEvent = { id: number | string; kind: string; title: string; url: string | null; author: string | null; state: string | null; branch: string | null; repository: string; occurredAt: string };

const EMOJIS = ['👍', '👎', '🎉', '❤️', '👀', '🚀', '😕'] as const;
const MAX_BYTES = 2 * 1024 * 1024;
const EXT_TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf',
  txt: 'text/plain', log: 'text/plain', csv: 'text/csv', md: 'text/markdown', json: 'application/json', zip: 'application/zip',
};
const fmtSize = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`);

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Could not read the file'));
    r.readAsDataURL(file);
  });
}

/** Markdown editor with a write/preview toggle. */
function MarkdownEditor({ value, onChange, label, rows = 6, placeholder, hint }: { value: string; onChange: (v: string) => void; label: string; rows?: number; placeholder?: string; hint?: string }) {
  const [preview, setPreview] = useState(false);
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1" role="tablist" aria-label={`${label} mode`}>
        <button type="button" role="tab" aria-selected={!preview} onClick={() => setPreview(false)} className={cn('rounded-lg px-2.5 py-1 text-xs font-semibold', !preview ? 'bg-[#eeebe0] text-[#14201a]' : 'text-[#5f6b64] hover:bg-[#f6f4ec]')}>Write</button>
        <button type="button" role="tab" aria-selected={preview} onClick={() => setPreview(true)} className={cn('rounded-lg px-2.5 py-1 text-xs font-semibold', preview ? 'bg-[#eeebe0] text-[#14201a]' : 'text-[#5f6b64] hover:bg-[#f6f4ec]')}>Preview</button>
      </div>
      {preview ? (
        <div className="min-h-[90px] rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] p-3"><Markdown source={value} /></div>
      ) : (
        <Textarea aria-label={label} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
      {hint && <p className="mt-1 text-xs text-[#5f6b64]">{hint}</p>}
    </div>
  );
}

function SideField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-[#5f6b64]">{label}</div>
      {children}
    </div>
  );
}

export default function TaskPage() {
  const params = useParams<{ ref: string }>();
  const ref = decodeURIComponent(params.ref);
  const router = useRouter();
  const perms = usePerms();
  const toast = useToast();
  const confirm = useConfirm();
  const members = useMembers();
  const { data, error, loading, reload } = useApi<Detail>(`/api/tasks/${encodeURIComponent(ref)}`);
  const pid = data?.task.projectId ?? null;
  const sprintsRes = useApi<{ sprints: Sprint[] }>(pid ? `/api/projects/${pid}/sprints` : null);
  const projectTasks = useApi<TaskList>(pid ? `/api/projects/${pid}/tasks?limit=500&sort=number&order=desc` : null);
  const services = useApi<{ services: ServiceItem[] }>(data ? '/api/services' : null);
  const incidents = useApi<{ incidents: IncidentItem[] }>(data ? '/api/incidents' : null);
  const git = useApi<{ events: GitEvent[] }>(data ? `/api/integrations/github/events?taskRef=${encodeURIComponent(data.task.ref)}` : null);

  const [title, setTitle] = useState<string | null>(null);
  const [descDraft, setDescDraft] = useState<string | null>(null);
  const [labels, setLabels] = useState<string | null>(null);
  const [points, setPoints] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [picker, setPicker] = useState<string | null>(null);
  const [child, setChild] = useState({ title: '', type: 'task' as TaskType });
  const [dep, setDep] = useState({ ref: '', kind: 'blockedBy' as 'blockedBy' | 'blocks' });
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const names = useMemo(() => new Map(members.map((m) => [m.userId, m.name] as const)), [members]);

  if (loading && !data) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4"><Skeleton className="h-5 w-40" /><Skeleton className="h-9 w-3/4" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/work" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5f6b64] hover:text-[#177a43]"><ArrowLeft className="h-3.5 w-3.5" />My work</Link>
        <ErrorBanner message={error ?? 'Ticket not found'} />
      </div>
    );
  }

  const { task } = data;
  const base = `/api/tasks/${encodeURIComponent(task.ref)}`;
  const work = perms.work;
  const me = perms.user?.id;
  const watching = data.watchers.some((w) => w.id === me);
  const canReassign = perms.assign || task.assignee === null || task.assignee.id === me;
  const sprints = sprintsRes.data?.sprints ?? [];
  const parentOptions = (projectTasks.data?.tasks ?? []).filter((t) => t.id !== task.id && (task.type === 'subtask' ? ['story', 'task', 'bug'].includes(t.type) : t.type === 'epic'));

  async function run(key: string, fn: () => Promise<unknown>, msg?: string) {
    setBusy(key);
    try {
      await fn();
      if (msg) toast.success(msg);
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
      reload();
    }
  }
  const patch = (body: Record<string, unknown>, msg = 'Ticket updated') => run('patch', () => api.patch(base, body), msg);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_BYTES) return toast.error(`${file.name} is larger than 2 MB`);
    if (file.size === 0) return toast.error(`${file.name} is empty`);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const contentType = EXT_TYPES[ext] ?? file.type;
    if (!Object.values(EXT_TYPES).includes(contentType)) return toast.error('Allowed: images, PDF, text, CSV, Markdown, JSON or ZIP');
    await run('upload', async () => api.post(`${base}/attachments`, { fileName: file.name, contentType, contentBase64: await readBase64(file) }), `${file.name} attached`);
  }

  async function react(c: Comment, emoji: string) {
    const mine = c.reactions.find((r) => r.emoji === emoji)?.userIds.includes(me ?? -1);
    setPicker(null);
    await run('react', () => apiFetch(`${base}/comments/${c.id}/reactions`, { method: mine ? 'DELETE' : 'POST', body: JSON.stringify({ emoji }) }));
  }

  async function addDep(e: React.FormEvent) {
    e.preventDefault();
    const other = dep.ref.trim().toUpperCase();
    if (!other) return;
    await run(
      'dep',
      () =>
        dep.kind === 'blockedBy'
          ? api.post(`${base}/dependencies`, { dependsOn: other })
          : api.post(`/api/tasks/${encodeURIComponent(other)}/dependencies`, { dependsOn: task.ref }),
      dep.kind === 'blockedBy' ? `${task.ref} is now blocked by ${other}` : `${task.ref} now blocks ${other}`,
    );
    setDep({ ...dep, ref: '' });
  }

  async function removeTicket() {
    if (!(await confirm({ title: `Delete ${task.ref}?`, message: 'The ticket, its comments, attachments and history are permanently deleted. Subtasks are kept but detached.', confirmLabel: 'Delete ticket', danger: true }))) return;
    try {
      await api.del(base);
      toast.success(`${task.ref} deleted`);
      router.replace(`/dashboard/projects/${task.projectId}`);
    } catch (err) {
      toast.error(err);
    }
  }

  const describe = (a: Activity) => {
    if (a.type === 'assigned') {
      const to = a.data?.to;
      return typeof to === 'number' ? `assigned it to ${names.get(to) ?? `user #${to}`}` : 'unassigned it';
    }
    if (a.type === 'sprint_changed') {
      const to = a.data?.to;
      return typeof to === 'string' ? `moved it to ${sprints.find((s) => s.id === to)?.name ?? 'a sprint'}` : 'moved it to the backlog';
    }
    return describeActivity(a.type, a.data);
  };

  const childLabel = task.type === 'epic' ? 'Child tickets' : 'Subtasks';
  const showChildren = task.type !== 'subtask' || data.subtasks.length > 0;
  const gitEvents = git.error ? [] : (git.data?.events ?? []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dfdbcc] pb-3">
        <nav className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[#5f6b64]" aria-label="Breadcrumb">
          <Link href={`/dashboard/projects/${task.projectId}#board`} className="inline-flex items-center gap-1 hover:text-[#177a43]"><ArrowLeft className="h-3.5 w-3.5" />{task.projectKey}</Link>
          {data.parent && (
            <>
              <span>/</span>
              <Link href={`/dashboard/tasks/${data.parent.ref}`} className="hover:text-[#177a43]">{data.parent.ref}</Link>
            </>
          )}
          <span>/</span>
          <span className="font-mono font-bold text-[#14201a]">{task.ref}</span>
        </nav>
        <div className="flex flex-wrap gap-2">
          {work && (
            <Button size="sm" variant="secondary" loading={busy === 'watch'} onClick={() => void run('watch', () => (watching ? api.del(`${base}/watchers`) : api.post(`${base}/watchers`)), watching ? 'You stopped watching' : 'You are watching this ticket')}>
              {watching ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {watching ? 'Unwatch' : 'Watch'} · {data.watchers.length}
            </Button>
          )}
          {perms.del && <Button size="sm" variant="ghost" className="text-[#dc2626]" onClick={() => void removeTicket()}><Trash2 className="h-3.5 w-3.5" />Delete</Button>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          <div>
            <div className="flex items-center gap-2"><TypeIcon type={task.type} withLabel /><span className="text-xs text-[#5f6b64]">{task.status.name}</span></div>
            <label htmlFor="ticket-title" className="sr-only">Title</label>
            <input
              id="ticket-title"
              value={title ?? task.title}
              disabled={!work}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              onBlur={() => {
                const v = title?.trim();
                setTitle(null);
                if (v && v !== task.title) void patch({ title: v }, 'Title updated');
              }}
              className="mt-1 w-full rounded-xl border border-transparent bg-transparent px-2 py-1 font-display text-2xl font-extrabold text-[#14201a] outline-none hover:border-[#dfdbcc] focus:border-[#177a43] focus:bg-white disabled:hover:border-transparent"
            />
          </div>

          <SectionCard
            title="Description"
            action={work && descDraft === null && <Button size="sm" variant="ghost" onClick={() => setDescDraft(task.description ?? '')}><Pencil className="h-3.5 w-3.5" />Edit</Button>}
          >
            {descDraft === null ? (
              <Markdown source={task.description} />
            ) : (
              <div className="space-y-2">
                <MarkdownEditor label="Description" value={descDraft} onChange={setDescDraft} rows={10} placeholder="Context, steps to reproduce, acceptance criteria…" hint="Markdown supported: **bold**, *italic*, `code`, lists, ``` blocks, [links](https://…). Mention people with @username." />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setDescDraft(null)}>Cancel</Button>
                  <Button size="sm" loading={busy === 'patch'} onClick={() => { const v = descDraft.trim() || null; setDescDraft(null); void patch({ description: v }, 'Description saved'); }}>Save</Button>
                </div>
              </div>
            )}
          </SectionCard>

          {showChildren && (
            <SectionCard title={`${childLabel} (${data.subtasks.length})`}>
              {data.subtasks.length === 0 ? (
                <p className="text-sm text-[#5f6b64]">{task.type === 'epic' ? 'No stories, tasks or bugs in this epic yet.' : 'No subtasks yet.'}</p>
              ) : (
                <ul className="divide-y divide-[#dfdbcc]">
                  {data.subtasks.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                      <Link href={`/dashboard/tasks/${s.ref}`} className="flex min-w-0 items-center gap-2 text-sm">
                        <TypeIcon type={s.type} />
                        <span className="font-mono text-xs font-bold text-[#5f6b64]">{s.ref}</span>
                        <span className={cn('truncate font-semibold hover:text-[#177a43]', s.status.category === 'done' ? 'text-[#5f6b64] line-through' : 'text-[#14201a]')}>{s.title}</span>
                      </Link>
                      <span className="flex shrink-0 items-center gap-2">
                        <PriorityIcon priority={s.priority} />
                        {s.assignee && <Avatar name={s.assignee.name} size={20} />}
                        <span className="text-xs font-semibold text-[#5f6b64]">{s.status.name}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {work && task.type !== 'subtask' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const t = child.title.trim();
                    if (!t) return;
                    void run('child', () => api.post(`/api/projects/${task.projectId}/tasks`, { title: t, type: task.type === 'epic' ? child.type : 'subtask', parentId: task.id }), task.type === 'epic' ? 'Child ticket created' : 'Subtask created').then(() => setChild({ ...child, title: '' }));
                  }}
                  className="mt-3 flex flex-wrap gap-2"
                >
                  {task.type === 'epic' && (
                    <Select aria-label="Child ticket type" value={child.type} onChange={(e) => setChild({ ...child, type: e.target.value as TaskType })} className="w-auto!">
                      {(['story', 'task', 'bug'] as TaskType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                    </Select>
                  )}
                  <Input aria-label={task.type === 'epic' ? 'New child ticket title' : 'New subtask title'} value={child.title} maxLength={200} onChange={(e) => setChild({ ...child, title: e.target.value })} placeholder={task.type === 'epic' ? 'Add a ticket to this epic…' : 'Add a subtask…'} className="min-w-0 flex-1" />
                  <Button type="submit" loading={busy === 'child'} disabled={!child.title.trim()}>Add</Button>
                </form>
              )}
            </SectionCard>
          )}

          <SectionCard title="Dependencies">
            <div className="grid gap-4 sm:grid-cols-2">
              {(['blockedBy', 'blocks'] as const).map((kind) => (
                <div key={kind}>
                  <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[#5f6b64]">{kind === 'blockedBy' ? 'Blocked by' : 'Blocks'}</h4>
                  {data[kind].length === 0 ? (
                    <p className="text-sm text-[#5f6b64]">None</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {data[kind].map((d) => (
                        <li key={d.dependencyId} className="flex items-center gap-2 text-sm">
                          <Link href={`/dashboard/tasks/${d.task.ref}`} className="flex min-w-0 flex-1 items-center gap-1.5 hover:text-[#177a43]">
                            <span className="font-mono text-xs font-bold text-[#5f6b64]">{d.task.ref}</span>
                            <span className={cn('truncate', d.task.status.category === 'done' ? 'text-[#5f6b64] line-through' : 'text-[#14201a]')}>{d.task.title}</span>
                          </Link>
                          {work && (
                            <button onClick={() => void run('dep', () => api.del(`${base}/dependencies/${d.dependencyId}`), 'Dependency removed')} aria-label={`Remove dependency on ${d.task.ref}`} className="rounded p-0.5 text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626]">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            {work && (
              <form onSubmit={addDep} className="mt-4 flex flex-wrap items-center gap-2">
                <Select aria-label="Dependency kind" value={dep.kind} onChange={(e) => setDep({ ...dep, kind: e.target.value as 'blockedBy' | 'blocks' })} className="w-auto!">
                  <option value="blockedBy">Blocked by</option>
                  <option value="blocks">Blocks</option>
                </Select>
                <Input aria-label="Ticket reference" value={dep.ref} maxLength={40} onChange={(e) => setDep({ ...dep, ref: e.target.value })} placeholder={`${task.projectKey}-1`} className="w-36! font-mono" />
                <Button type="submit" variant="secondary" loading={busy === 'dep'} disabled={!dep.ref.trim()}><Link2 className="h-3.5 w-3.5" />Link</Button>
              </form>
            )}
          </SectionCard>

          <SectionCard
            title={`Attachments (${data.attachments.length})`}
            action={
              work && (
                <>
                  <input ref={fileRef} type="file" className="hidden" onChange={(e) => void upload(e)} accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.log,.csv,.md,.json,.zip" aria-label="Choose a file to attach" />
                  <Button size="sm" variant="secondary" loading={busy === 'upload'} onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5" />Upload</Button>
                </>
              )
            }
          >
            {data.attachments.length === 0 ? (
              <p className="text-sm text-[#5f6b64]">No files attached. Images, PDF, text, CSV, Markdown, JSON and ZIP up to 2 MB.</p>
            ) : (
              <ul className="divide-y divide-[#dfdbcc]">
                {data.attachments.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
                    <Paperclip className="h-4 w-4 shrink-0 text-[#5f6b64]" />
                    <a href={`${base}/attachments/${a.id}`} download={a.fileName} className="min-w-0 flex-1 truncate text-sm font-semibold text-[#14201a] hover:text-[#177a43]">{a.fileName}</a>
                    <span className="text-xs text-[#5f6b64]">{fmtSize(a.sizeBytes)} · {a.uploader?.name ?? 'Someone'} · {timeAgo(a.createdAt)}</span>
                    <a href={`${base}/attachments/${a.id}`} download={a.fileName} aria-label={`Download ${a.fileName}`} className="rounded p-1 text-[#5f6b64] hover:bg-[#eeebe0]"><Download className="h-3.5 w-3.5" /></a>
                    {work && (a.uploader?.id === me || perms.del) && (
                      <button
                        aria-label={`Delete ${a.fileName}`}
                        className="rounded p-1 text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626]"
                        onClick={async () => {
                          if (await confirm({ title: 'Delete attachment?', message: `${a.fileName} will be permanently removed.`, confirmLabel: 'Delete', danger: true })) void run('att', () => api.del(`${base}/attachments/${a.id}`), 'Attachment deleted');
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {gitEvents.length > 0 && (
            <SectionCard title="Development" subtitle="GitHub activity that mentions this ticket">
              <ul className="space-y-2">
                {gitEvents.map((ev) => {
                  const Icon = ev.kind.includes('pull') ? GitPullRequest : ev.kind.includes('deploy') ? Rocket : ev.kind.includes('push') ? GitCommit : GitBranch;
                  return (
                    <li key={ev.id} className="flex items-start gap-2 text-sm">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#5f6b64]" />
                      <div className="min-w-0 flex-1">
                        {ev.url ? <a href={ev.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#14201a] hover:text-[#177a43]">{ev.title}</a> : <span className="font-semibold text-[#14201a]">{ev.title}</span>}
                        <div className="text-xs text-[#5f6b64]">
                          {ev.repository}{ev.branch ? ` · ${ev.branch}` : ''}{ev.author ? ` · ${ev.author}` : ''}{ev.state ? ` · ${ev.state}` : ''} · {timeAgo(ev.occurredAt)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          )}

          <SectionCard title={`Comments (${data.comments.length})`}>
            {data.comments.length === 0 && <p className="text-sm text-[#5f6b64]">No comments yet.</p>}
            <ul className="space-y-4">
              {data.comments.map((c) => {
                const own = c.author?.id === me;
                return (
                  <li key={c.id} className="flex gap-3">
                    <Avatar name={c.author?.name ?? '?'} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 text-sm">
                        <span className="font-bold text-[#14201a]">{c.author?.name ?? 'Former member'}</span>
                        <span className="text-xs text-[#5f6b64]" title={formatDateTime(c.createdAt)}>{timeAgo(c.createdAt)}</span>
                        {c.editedAt && <span className="text-xs text-[#5f6b64]" title={formatDateTime(c.editedAt)}>(edited)</span>}
                        <span className="ml-auto flex gap-1">
                          {own && work && editing?.id !== c.id && <button onClick={() => setEditing({ id: c.id, body: c.body })} className="text-xs font-semibold text-[#5f6b64] hover:text-[#14201a]">Edit</button>}
                          {work && (own || perms.del) && (
                            <button
                              onClick={async () => {
                                if (await confirm({ title: 'Delete comment?', message: 'This comment will be permanently removed.', confirmLabel: 'Delete', danger: true })) void run('comment', () => api.del(`${base}/comments/${c.id}`), 'Comment deleted');
                              }}
                              className="text-xs font-semibold text-[#5f6b64] hover:text-[#dc2626]"
                            >
                              Delete
                            </button>
                          )}
                        </span>
                      </div>
                      {editing?.id === c.id ? (
                        <div className="mt-1.5 space-y-2">
                          <MarkdownEditor label="Edit comment" value={editing.body} onChange={(v) => setEditing({ id: c.id, body: v })} rows={4} />
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                            <Button size="sm" loading={busy === 'comment'} disabled={!editing.body.trim()} onClick={() => void run('comment', () => api.patch(`${base}/comments/${c.id}`, { body: editing.body.trim() }), 'Comment updated').then(() => setEditing(null))}>Save</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1 rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3 py-2"><Markdown source={c.body} /></div>
                      )}
                      <div className="relative mt-1.5 flex flex-wrap items-center gap-1">
                        {c.reactions.map((r) => {
                          const mine = r.userIds.includes(me ?? -1);
                          return (
                            <button
                              key={r.emoji}
                              disabled={!work}
                              aria-pressed={mine}
                              aria-label={`${r.emoji} ${r.count} — ${mine ? 'remove your reaction' : 'react'}`}
                              title={r.userIds.map((id) => names.get(id) ?? `user #${id}`).join(', ')}
                              onClick={() => void react(c, r.emoji)}
                              className={cn('rounded-full border px-2 py-0.5 text-xs', mine ? 'border-[#b2e2a8] bg-[#dcefd8] text-[#177a43]' : 'border-[#dfdbcc] bg-white text-[#3d4a42] hover:bg-[#f6f4ec]')}
                            >
                              {r.emoji} {r.count}
                            </button>
                          );
                        })}
                        {work && (
                          <button onClick={() => setPicker(picker === c.id ? null : c.id)} aria-label="Add reaction" aria-expanded={picker === c.id} className="rounded-full border border-[#dfdbcc] p-1 text-[#5f6b64] hover:bg-[#f6f4ec]">
                            <SmilePlus className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {picker === c.id && (
                          <div className="flex gap-0.5 rounded-full border border-[#dfdbcc] bg-white px-1 py-0.5 shadow">
                            {EMOJIS.map((e) => (
                              <button key={e} onClick={() => void react(c, e)} aria-label={`React with ${e}`} className="rounded-full px-1 text-base hover:bg-[#eeebe0]">{e}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {work && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const body = comment.trim();
                  if (!body) return;
                  void run('post', () => api.post(`${base}/comments`, { body }), 'Comment posted').then(() => setComment(''));
                }}
                className="mt-5 space-y-2 border-t border-[#dfdbcc] pt-4"
              >
                <MarkdownEditor label="Add a comment" value={comment} onChange={setComment} rows={3} placeholder="Write a comment…" hint="Markdown supported. Type @username or @email to mention and notify a teammate." />
                <div className="flex justify-end"><Button type="submit" loading={busy === 'post'} disabled={!comment.trim()}>Comment</Button></div>
              </form>
            )}
          </SectionCard>

          <SectionCard title="History">
            {data.activity.length === 0 ? (
              <p className="text-sm text-[#5f6b64]">No activity yet.</p>
            ) : (
              <ol className="space-y-2.5">
                {data.activity.map((a) => (
                  <li key={a.id} className="text-sm text-[#3d4a42]">
                    <span className="font-semibold text-[#14201a]">{a.actor?.name ?? 'Someone'}</span> {describe(a)}{' '}
                    <span className="text-xs text-[#5f6b64]" title={formatDateTime(a.createdAt)}>· {timeAgo(a.createdAt)}</span>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>
        </div>

        <aside className="space-y-4">
          <SectionCard title="Details">
            <div className="space-y-3.5">
              <SideField label="Status">
                <Select aria-label="Status" disabled={!work} value={task.status.id} onChange={(e) => void patch({ statusId: e.target.value }, 'Status updated')}>
                  {data.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </SideField>
              <div className="grid grid-cols-2 gap-2">
                <SideField label="Priority">
                  <Select aria-label="Priority" disabled={!work} value={task.priority} onChange={(e) => void patch({ priority: e.target.value }, 'Priority updated')}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                  </Select>
                </SideField>
                <SideField label="Type">
                  <Select aria-label="Type" disabled={!work} value={task.type} onChange={(e) => void patch({ type: e.target.value }, 'Type updated')}>
                    {TASK_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                  </Select>
                </SideField>
              </div>
              <SideField label="Assignee">
                <AssigneeSelect value={task.assignee?.id ?? null} disabled={!work || !canReassign} onChange={(v) => void patch({ assigneeId: v }, 'Assignee updated')} />
                {work && !canReassign && <p className="mt-1 text-xs text-[#5f6b64]">Only managers can reassign someone else’s ticket.</p>}
                {work && task.assignee?.id !== me && canReassign && (
                  <button onClick={() => void patch({ assigneeId: me }, 'Assigned to you')} className="mt-1 text-xs font-semibold text-[#177a43] hover:underline">Assign to me</button>
                )}
              </SideField>
              <SideField label="Reporter">
                <span className="flex items-center gap-2 text-sm font-semibold text-[#14201a]">{task.reporter ? <><Avatar name={task.reporter.name} size={20} />{task.reporter.name}</> : '—'}</span>
              </SideField>
              <div className="grid grid-cols-2 gap-2">
                <SideField label="Start date">
                  <Input type="date" aria-label="Start date" disabled={!work} value={dateOnly(task.startDate)} onChange={(e) => void patch({ startDate: e.target.value || null }, 'Start date updated')} className="px-2! text-xs!" />
                </SideField>
                <SideField label="Due date">
                  <Input type="date" aria-label="Due date" disabled={!work} value={dateOnly(task.dueDate)} onChange={(e) => void patch({ dueDate: e.target.value || null }, 'Due date updated')} className="px-2! text-xs!" />
                </SideField>
              </div>
              <SideField label="Labels">
                <Input
                  aria-label="Labels"
                  disabled={!work}
                  value={labels ?? task.labels.join(', ')}
                  onChange={(e) => setLabels(e.target.value)}
                  onBlur={() => {
                    if (labels === null) return;
                    const next = labels.split(',').map((l) => l.trim()).filter(Boolean);
                    setLabels(null);
                    if (next.join('|') !== task.labels.join('|')) void patch({ labels: next }, 'Labels updated');
                  }}
                  placeholder="comma, separated"
                />
              </SideField>
              <div className="grid grid-cols-2 gap-2">
                <SideField label="Sprint">
                  <Select aria-label="Sprint" disabled={!work} value={task.sprintId ?? ''} onChange={(e) => void patch({ sprintId: e.target.value || null }, 'Sprint updated')}>
                    <option value="">Backlog</option>
                    {data.sprint && data.sprint.status === 'completed' && <option value={data.sprint.id}>{data.sprint.name} (done)</option>}
                    {sprints.filter((s) => s.status !== 'completed').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </SideField>
                <SideField label="Story points">
                  <Input
                    type="number"
                    min={0}
                    max={1000}
                    aria-label="Story points"
                    disabled={!work}
                    value={points ?? (task.storyPoints ?? '')}
                    onChange={(e) => setPoints(e.target.value)}
                    onBlur={() => {
                      if (points === null) return;
                      const v = points === '' ? null : Math.round(Number(points));
                      setPoints(null);
                      if (v !== task.storyPoints && (v === null || Number.isFinite(v))) void patch({ storyPoints: v }, 'Story points updated');
                    }}
                  />
                </SideField>
              </div>
              {task.type !== 'epic' && (
                <SideField label={task.type === 'subtask' ? 'Parent' : 'Epic'}>
                  <Select aria-label="Parent ticket" disabled={!work} value={task.parentId ?? ''} onChange={(e) => void patch({ parentId: e.target.value || null }, 'Parent updated')}>
                    {task.type !== 'subtask' && <option value="">No epic</option>}
                    {data.parent && !parentOptions.some((p) => p.id === data.parent!.id) && <option value={data.parent.id}>{data.parent.ref} · {data.parent.title}</option>}
                    {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.ref} · {p.title}</option>)}
                  </Select>
                </SideField>
              )}
              <SideField label="Linked service">
                <Select aria-label="Linked service" disabled={!work} value={task.serviceId ?? ''} onChange={(e) => void patch({ serviceId: e.target.value ? Number(e.target.value) : null }, 'Service link updated')}>
                  <option value="">None</option>
                  {(services.data?.services ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.environment})</option>)}
                </Select>
                {task.serviceId && <Link href={`/dashboard/services/${task.serviceId}`} className="mt-1 inline-block text-xs font-semibold text-[#177a43] hover:underline">Open service</Link>}
              </SideField>
              <SideField label="Linked incident">
                <Select aria-label="Linked incident" disabled={!work} value={task.incidentId ?? ''} onChange={(e) => void patch({ incidentId: e.target.value ? Number(e.target.value) : null }, 'Incident link updated')}>
                  <option value="">None</option>
                  {(incidents.data?.incidents ?? []).map((i) => <option key={i.id} value={i.id}>#{i.id} {i.title.slice(0, 50)} ({i.status})</option>)}
                </Select>
                {task.incidentId && <Link href={`/dashboard/incidents/${task.incidentId}`} className="mt-1 inline-block text-xs font-semibold text-[#177a43] hover:underline">Open incident #{task.incidentId}</Link>}
              </SideField>
              <div className="space-y-0.5 border-t border-[#dfdbcc] pt-3 text-xs text-[#5f6b64]">
                <div>Created {formatDateTime(task.createdAt)}</div>
                <div>Updated {timeAgo(task.updatedAt)}</div>
                {task.completedAt && <div>Completed {fmtDay(task.completedAt)}</div>}
              </div>
            </div>
          </SectionCard>

          <SectionCard title={`Watchers (${data.watchers.length})`}>
            {data.watchers.length === 0 ? (
              <p className="text-sm text-[#5f6b64]">Nobody is watching this ticket.</p>
            ) : (
              <ul className="space-y-2">
                {data.watchers.map((w) => (
                  <li key={w.id} className="flex items-center gap-2 text-sm text-[#14201a]"><Avatar name={w.name} size={22} />{w.name}{w.id === me && <span className="text-xs text-[#5f6b64]">(you)</span>}</li>
                ))}
              </ul>
            )}
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
