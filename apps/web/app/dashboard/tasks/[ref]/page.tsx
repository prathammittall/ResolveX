'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { canManageWork, canWork } from '../../../../lib/permissions';
import type { MemberItem, TaskDetail, TaskItem, TaskPriority } from '../../../../lib/types';
import { ErrorBanner, PageLoader, SectionCard, formatDateTime, timeAgo } from '../../_components/ui';
import { Avatar, PRIORITIES, PriorityIcon, TypeIcon } from '../../_components/work';

function describeActivity(a: TaskDetail['activity'][number], names: Map<number, string>): string {
  const d = a.data ?? {};
  const who = (id: unknown) => (typeof id === 'number' ? (names.get(id) ?? `user #${id}`) : 'nobody');
  switch (a.type) {
    case 'created':
      return `created this ticket in ${String(d.status ?? 'the backlog')}`;
    case 'status_changed':
      return `moved it from ${String(d.from)} to ${String(d.to)}`;
    case 'assigned':
      return d.to === null || d.to === undefined ? 'unassigned it' : `assigned it to ${who(d.to)}`;
    case 'priority_changed':
      return `changed priority from ${String(d.from)} to ${String(d.to)}`;
    case 'title_changed':
      return 'renamed the ticket';
    case 'description_changed':
      return 'edited the description';
    case 'due_date_changed':
      return d.to ? 'changed the due date' : 'removed the due date';
    case 'labels_changed':
      return 'updated the labels';
    case 'type_changed':
      return `changed the type from ${String(d.from)} to ${String(d.to)}`;
    case 'commented':
      return 'commented';
    default:
      return a.type.replace(/_/g, ' ');
  }
}

export default function TaskPage() {
  const { ref } = useParams<{ ref: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const work = canWork(user?.role);
  const manage = canManageWork(user?.role);

  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [labels, setLabels] = useState('');
  const [comment, setComment] = useState('');
  const [subtask, setSubtask] = useState('');

  const apply = (d: TaskDetail) => {
    setDetail(d);
    setTitle(d.task.title);
    setDescription(d.task.description ?? '');
    setLabels(d.task.labels.join(', '));
  };

  const load = useCallback(async () => {
    try {
      const [d, m] = await Promise.all([
        api.get<TaskDetail>(`/api/tasks/${ref}`),
        api.get<{ members: MemberItem[] }>('/api/org/members'),
      ]);
      apply(d);
      setMembers(m.members);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  }, [ref]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/tasks/${ref}`, body);
      apply(await api.get<TaskDetail>(`/api/tasks/${ref}`));
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save the change');
      if (detail) apply(detail); // snap the form back to the saved values
    } finally {
      setSaving(false);
    }
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setSaving(true);
    try {
      await api.post(`/api/tasks/${ref}/comments`, { body: comment.trim() });
      setComment('');
      apply(await api.get<TaskDetail>(`/api/tasks/${ref}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post the comment');
    } finally {
      setSaving(false);
    }
  }

  async function addSubtask(e: React.FormEvent) {
    e.preventDefault();
    if (!detail || !subtask.trim()) return;
    setSaving(true);
    try {
      await api.post<{ task: TaskItem }>(`/api/projects/${detail.task.projectId}/tasks`, {
        title: subtask.trim(),
        type: 'subtask',
        parentId: detail.task.id,
      });
      setSubtask('');
      apply(await api.get<TaskDetail>(`/api/tasks/${ref}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the subtask');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this ticket permanently? Its comments and history are deleted too.')) return;
    try {
      await api.del(`/api/tasks/${ref}`);
      router.replace(`/dashboard/projects/${detail?.task.projectId ?? ''}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the ticket');
    }
  }

  if (loading) return <PageLoader />;
  if (!detail) return <ErrorBanner message={error ?? 'Ticket not found'} />;

  const { task } = detail;
  const names = new Map(members.map((m) => [m.userId, m.name || m.email] as const));
  // Non-admins can only take unassigned tickets or release/keep their own.
  const ownsOrFree = task.assignee === null || task.assignee.id === user?.id;
  const assignOptions = manage ? members : members.filter((m) => m.userId === user?.id);
  const field = 'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-[#25396e] disabled:bg-slate-50 disabled:text-slate-500';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href={`/dashboard/projects/${task.projectId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> {task.projectKey} board
        </Link>
        {manage && (
          <button onClick={remove} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-rose-50 hover:text-rose-600">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              {detail.parent && (
                <>
                  <Link href={`/dashboard/tasks/${detail.parent.ref}`} className="hover:underline">{detail.parent.ref}</Link>
                  <span>/</span>
                </>
              )}
              <TypeIcon type={task.type} withLabel />
              <span className="font-mono">{task.ref}</span>
            </div>
            <label htmlFor="title" className="sr-only">Title</label>
            <input
              id="title"
              value={title}
              disabled={!work}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title.trim() && title !== task.title && void patch({ title: title.trim() })}
              className="mt-2 w-full rounded-lg border border-transparent bg-transparent px-1 py-1 font-serif-title text-2xl font-semibold text-slate-900 outline-none hover:border-slate-200 focus:border-[#25396e] disabled:hover:border-transparent"
            />
          </div>

          <SectionCard title="Description">
            <textarea
              aria-label="Description"
              rows={6}
              value={description}
              disabled={!work}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={work ? 'Add more detail…' : 'No description'}
              className={field}
            />
            {work && description !== (task.description ?? '') && (
              <div className="mt-2 flex justify-end gap-2">
                <button onClick={() => setDescription(task.description ?? '')} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
                <button disabled={saving} onClick={() => void patch({ description: description.trim() || null })} className="rounded-lg bg-[#25396e] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">Save</button>
              </div>
            )}
          </SectionCard>

          {(task.type !== 'subtask' || detail.subtasks.length > 0) && task.type !== 'epic' && (
            <SectionCard title={`Subtasks (${detail.subtasks.length})`}>
              <ul className="divide-y divide-slate-100">
                {detail.subtasks.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/dashboard/tasks/${s.ref}`} className="flex min-w-0 items-center gap-2 text-sm">
                      <span className="font-mono text-xs text-slate-400">{s.ref}</span>
                      <span className="truncate text-slate-800">{s.title}</span>
                    </Link>
                    <span className="shrink-0 text-xs text-slate-500">{s.status.name}</span>
                  </li>
                ))}
              </ul>
              {work && task.type !== 'subtask' && (
                <form onSubmit={addSubtask} className="mt-3 flex gap-2">
                  <input aria-label="New subtask title" value={subtask} onChange={(e) => setSubtask(e.target.value)} placeholder="Add a subtask" maxLength={200} className={field} />
                  <button type="submit" disabled={saving || !subtask.trim()} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Add</button>
                </form>
              )}
            </SectionCard>
          )}

          {task.type === 'epic' && (
            <SectionCard title={`Child tickets (${detail.subtasks.length})`}>
              {detail.subtasks.length === 0 ? (
                <p className="text-sm text-slate-500">Pick this epic when creating a story, task or bug.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {detail.subtasks.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                      <Link href={`/dashboard/tasks/${s.ref}`} className="flex min-w-0 items-center gap-2 text-sm">
                        <TypeIcon type={s.type} />
                        <span className="font-mono text-xs text-slate-400">{s.ref}</span>
                        <span className="truncate text-slate-800">{s.title}</span>
                      </Link>
                      <span className="shrink-0 text-xs text-slate-500">{s.status.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          )}

          <SectionCard title={`Comments (${detail.comments.length})`}>
            <ul className="space-y-4">
              {detail.comments.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <Avatar name={c.author?.name ?? '?'} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium text-slate-800">{c.author?.name ?? 'Former member'}</span>{' '}
                      <span className="text-xs text-slate-400" title={formatDateTime(c.createdAt)}>{timeAgo(c.createdAt)}</span>
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{c.body}</p>
                  </div>
                </li>
              ))}
              {detail.comments.length === 0 && <li className="text-sm text-slate-500">No comments yet.</li>}
            </ul>
            {work && (
              <form onSubmit={addComment} className="mt-4 space-y-2">
                <textarea aria-label="Add a comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…" className={field} />
                <div className="flex justify-end">
                  <button type="submit" disabled={saving || !comment.trim()} className="rounded-lg bg-[#25396e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Comment</button>
                </div>
              </form>
            )}
          </SectionCard>

          <SectionCard title="Activity">
            <ol className="space-y-3">
              {detail.activity.map((a) => (
                <li key={a.id} className="text-sm text-slate-600">
                  <span className="font-medium text-slate-800">{a.actor?.name ?? 'Someone'}</span> {describeActivity(a, names)}{' '}
                  <span className="text-xs text-slate-400" title={formatDateTime(a.createdAt)}>{timeAgo(a.createdAt)}</span>
                </li>
              ))}
            </ol>
          </SectionCard>
        </div>

        <aside className="space-y-4">
          <SectionCard title="Details">
            <dl className="space-y-4">
              <div>
                <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Status</dt>
                <dd>
                  <select aria-label="Status" disabled={!work || saving} value={task.status.id} onChange={(e) => void patch({ statusId: e.target.value })} className={field}>
                    {detail.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Assignee</dt>
                <dd>
                  <select
                    aria-label="Assignee"
                    disabled={!work || saving || (!manage && !ownsOrFree)}
                    value={task.assignee?.id ?? ''}
                    onChange={(e) => void patch({ assigneeId: e.target.value ? Number(e.target.value) : null })}
                    className={field}
                  >
                    <option value="">Unassigned</option>
                    {assignOptions.map((m) => <option key={m.userId} value={m.userId}>{m.name || m.email}{m.userId === user?.id ? ' (me)' : ''}</option>)}
                    {task.assignee && !assignOptions.some((m) => m.userId === task.assignee?.id) && (
                      <option value={task.assignee.id}>{task.assignee.name}</option>
                    )}
                  </select>
                  {!manage && !ownsOrFree && <p className="mt-1 text-xs text-slate-400">Only admins can reassign this ticket.</p>}
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Priority</dt>
                <dd className="flex items-center gap-2">
                  <PriorityIcon priority={task.priority} />
                  <select aria-label="Priority" disabled={!work || saving} value={task.priority} onChange={(e) => void patch({ priority: e.target.value as TaskPriority })} className={field}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Due date</dt>
                <dd>
                  <input aria-label="Due date" type="date" disabled={!work || saving} value={task.dueDate ? task.dueDate.slice(0, 10) : ''} onChange={(e) => void patch({ dueDate: e.target.value || null })} className={field} />
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Labels</dt>
                <dd>
                  <input
                    aria-label="Labels"
                    disabled={!work}
                    value={labels}
                    onChange={(e) => setLabels(e.target.value)}
                    onBlur={() => {
                      const next = labels.split(',').map((l) => l.trim()).filter(Boolean);
                      if (next.join('|') !== task.labels.join('|')) void patch({ labels: next });
                    }}
                    placeholder="comma, separated"
                    className={field}
                  />
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Reporter</dt>
                <dd className="flex items-center gap-2 text-sm text-slate-700">
                  {task.reporter ? (<><Avatar name={task.reporter.name} />{task.reporter.name}</>) : 'Former member'}
                </dd>
              </div>
              <div className="text-xs text-slate-400">
                Created {formatDateTime(task.createdAt)}
                <br />
                Updated {timeAgo(task.updatedAt)}
              </div>
            </dl>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
