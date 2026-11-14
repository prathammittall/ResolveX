'use client';

import React, { useEffect, useState } from 'react';
import { Bug, ChevronsUp, ChevronUp, ChevronDown, ChevronsDown, Equal, Layers, ListTree, Rocket, SquareCheck, X } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { canManageWork } from '../../../lib/permissions';
import type { MemberItem, StatusItem, TaskItem, TaskPriority, TaskType } from '../../../lib/types';
import { ErrorBanner, cn } from './ui';

export const TASK_TYPES: TaskType[] = ['task', 'story', 'bug', 'epic', 'subtask'];
export const PRIORITIES: TaskPriority[] = ['highest', 'high', 'medium', 'low', 'lowest'];

const TYPE_META: Record<TaskType, { label: string; Icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  epic: { label: 'Epic', Icon: Rocket, cls: 'bg-violet-100 text-violet-700' },
  story: { label: 'Story', Icon: Layers, cls: 'bg-emerald-100 text-emerald-700' },
  task: { label: 'Task', Icon: SquareCheck, cls: 'bg-blue-100 text-blue-700' },
  bug: { label: 'Bug', Icon: Bug, cls: 'bg-rose-100 text-rose-700' },
  subtask: { label: 'Subtask', Icon: ListTree, cls: 'bg-slate-200 text-slate-700' },
};

const PRIORITY_META: Record<TaskPriority, { label: string; Icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  highest: { label: 'Highest', Icon: ChevronsUp, cls: 'text-rose-600' },
  high: { label: 'High', Icon: ChevronUp, cls: 'text-orange-500' },
  medium: { label: 'Medium', Icon: Equal, cls: 'text-amber-500' },
  low: { label: 'Low', Icon: ChevronDown, cls: 'text-sky-500' },
  lowest: { label: 'Lowest', Icon: ChevronsDown, cls: 'text-slate-400' },
};

export function TypeIcon({ type, withLabel }: { type: TaskType; withLabel?: boolean }) {
  const { label, Icon, cls } = TYPE_META[type];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium', cls)} title={label}>
      <Icon className="h-3 w-3" />
      {withLabel && label}
    </span>
  );
}

export function PriorityIcon({ priority, withLabel }: { priority: TaskPriority; withLabel?: boolean }) {
  const { label, Icon, cls } = PRIORITY_META[priority];
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', cls)} title={`${label} priority`}>
      <Icon className="h-4 w-4" />
      {withLabel && <span className="text-slate-600">{label}</span>}
    </span>
  );
}

export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#ff5414] font-semibold text-white shadow-xs"
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.42) }}
      title={name}
      aria-label={name}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function DueDate({ iso, done }: { iso: string | null; done?: boolean }) {
  if (!iso) return null;
  const d = new Date(iso);
  const overdue = !done && d.getTime() < Date.now() - 24 * 3600 * 1000;
  return (
    <span className={cn('text-xs', overdue ? 'font-medium text-rose-600' : 'text-slate-500')} title={overdue ? 'Overdue' : 'Due date'}>
      {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}
    </span>
  );
}

/** Raise a ticket. Admins can allot it to anyone; other roles can only assign themselves. */
export function CreateTaskModal({
  projectId,
  statuses,
  defaultStatusId,
  epics,
  onClose,
  onCreated,
}: {
  projectId: string;
  statuses: StatusItem[];
  defaultStatusId?: string;
  epics: TaskItem[];
  onClose: () => void;
  onCreated: (task: TaskItem) => void;
}) {
  const { user } = useAuth();
  const admin = canManageWork(user?.role);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('task');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [statusId, setStatusId] = useState(defaultStatusId ?? statuses[0]?.id ?? '');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [due, setDue] = useState('');
  const [labels, setLabels] = useState('');
  const [parentId, setParentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ members: MemberItem[] }>('/api/org/members')
      .then((r) => setMembers(r.members))
      .catch(() => setMembers([]));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Non-admins may only assign to themselves.
  const assignable = admin ? members : members.filter((m) => m.userId === user?.id);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ task: TaskItem }>(`/api/projects/${projectId}/tasks`, {
        title,
        description: description.trim() || null,
        type,
        priority,
        statusId,
        assigneeId: assigneeId ? Number(assigneeId) : null,
        dueDate: due || null,
        labels: labels
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean),
        parentId: parentId || null,
      });
      onCreated(res.task);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to create ticket');
      setSaving(false);
    }
  }

  const input =
    'w-full rounded-xl border border-[#c4b19f] dark:border-zinc-800 bg-[#dfcebe]/80 dark:bg-zinc-900 px-3 py-2 text-sm text-[#171a1f] dark:text-white outline-none focus:border-[#ff5414] focus:ring-2 focus:ring-[#ff5414]/20';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label="Create ticket">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />
      <form onSubmit={submit} className="relative my-8 w-full max-w-2xl rounded-2xl border border-[#cbbaa9] dark:border-zinc-800 bg-[#eedccb] dark:bg-[#101117] text-[#171a1f] dark:text-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <h2 className="font-sans text-lg font-bold text-[#171a1f] dark:text-white">Create ticket</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 opacity-60 hover:opacity-100 transition cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && <div className="mt-4"><ErrorBanner message={error} /></div>}

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="t-title" className="mb-1 block text-sm font-semibold text-[#171a1f] dark:text-zinc-200">Title</label>
            <input id="t-title" required maxLength={200} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className={input} placeholder="What needs to be done?" />
          </div>
          <div>
            <label htmlFor="t-desc" className="mb-1 block text-sm font-semibold text-[#171a1f] dark:text-zinc-200">Description <span className="font-normal opacity-60">(optional)</span></label>
            <textarea id="t-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className={input} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="t-type" className="mb-1 block text-sm font-semibold text-[#171a1f] dark:text-zinc-200">Type</label>
              <select id="t-type" value={type} onChange={(e) => setType(e.target.value as TaskType)} className={input}>
                {TASK_TYPES.map((t) => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="t-priority" className="mb-1 block text-sm font-semibold text-[#171a1f] dark:text-zinc-200">Priority</label>
              <select id="t-priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className={input}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="t-status" className="mb-1 block text-sm font-semibold text-[#171a1f] dark:text-zinc-200">Status</label>
              <select id="t-status" value={statusId} onChange={(e) => setStatusId(e.target.value)} className={input}>
                {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="t-assignee" className="mb-1 block text-sm font-semibold text-[#171a1f] dark:text-zinc-200">Assignee</label>
              <select id="t-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={input}>
                <option value="">Unassigned</option>
                {assignable.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.name || m.email}{m.userId === user?.id ? ' (me)' : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="t-due" className="mb-1 block text-sm font-semibold text-[#171a1f] dark:text-zinc-200">Due date</label>
              <input id="t-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className={input} />
            </div>
            <div>
              <label htmlFor="t-labels" className="mb-1 block text-sm font-semibold text-[#171a1f] dark:text-zinc-200">Labels</label>
              <input id="t-labels" value={labels} onChange={(e) => setLabels(e.target.value)} placeholder="backend, urgent" className={input} />
            </div>
          </div>
          {type !== 'epic' && type !== 'subtask' && epics.length > 0 && (
            <div>
              <label htmlFor="t-epic" className="mb-1 block text-sm font-semibold text-[#171a1f] dark:text-zinc-200">Epic <span className="font-normal opacity-60">(optional)</span></label>
              <select id="t-epic" value={parentId} onChange={(e) => setParentId(e.target.value)} className={input}>
                <option value="">No epic</option>
                {epics.map((ep) => <option key={ep.id} value={ep.id}>{ep.ref} · {ep.title}</option>)}
              </select>
            </div>
          )}
          {type === 'subtask' && (
            <p className="rounded-xl border border-[#cbbaa9] dark:border-zinc-800 bg-[#dfcebe]/60 dark:bg-zinc-900 p-3 text-xs text-[#574f47] dark:text-zinc-400">
              Subtasks are created from their parent ticket’s page.
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-[#574f47] dark:text-zinc-400 hover:bg-[#dfcebe] dark:hover:bg-zinc-800 cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving || type === 'subtask'} className="rounded-xl bg-[#171a1f] dark:bg-[#f5e6d3] px-5 py-2.5 text-sm font-bold text-white dark:text-zinc-950 hover:bg-black dark:hover:bg-[#faebd7] disabled:opacity-60 cursor-pointer shadow-sm">
            {saving ? 'Creating…' : 'Create ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}
