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
  epic: { label: 'Epic', Icon: Rocket, cls: 'bg-[#ede9fe] text-[#6d28d9] border border-[#ddd6fe]' },
  story: { label: 'Story', Icon: Layers, cls: 'bg-[#dcefd8] text-[#15803d] border border-[#b2e2a8]' },
  task: { label: 'Task', Icon: SquareCheck, cls: 'bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]' },
  bug: { label: 'Bug', Icon: Bug, cls: 'bg-[#fee2e2] text-[#b91c1c] border border-[#fecaca]' },
  subtask: { label: 'Subtask', Icon: ListTree, cls: 'bg-[#f1f5f9] text-[#475569] border border-[#cbd5e1]' },
};

const PRIORITY_META: Record<TaskPriority, { label: string; Icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  highest: { label: 'Highest', Icon: ChevronsUp, cls: 'text-[#dc2626]' },
  high: { label: 'High', Icon: ChevronUp, cls: 'text-[#ea580c]' },
  medium: { label: 'Medium', Icon: Equal, cls: 'text-[#d97706]' },
  low: { label: 'Low', Icon: ChevronDown, cls: 'text-[#0284c7]' },
  lowest: { label: 'Lowest', Icon: ChevronsDown, cls: 'text-[#64748b]' },
};

export function TypeIcon({ type, withLabel }: { type: TaskType; withLabel?: boolean }) {
  const meta = TYPE_META[type] ?? TYPE_META.task;
  const { label, Icon, cls } = meta;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold', cls)} title={label}>
      <Icon className="h-3 w-3 shrink-0" />
      {withLabel && label}
    </span>
  );
}

export function PriorityIcon({ priority, withLabel }: { priority: TaskPriority; withLabel?: boolean }) {
  const meta = PRIORITY_META[priority] ?? PRIORITY_META.medium;
  const { label, Icon, cls } = meta;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', cls)} title={`${label} priority`}>
      <Icon className="h-4 w-4 shrink-0" />
      {withLabel && <span className="text-[#3d4a42]">{label}</span>}
    </span>
  );
}

export function Avatar({ name, size = 26 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#177a43] font-bold text-white shadow-xs"
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
    <span className={cn('text-xs font-medium', overdue ? 'text-[#dc2626] font-semibold' : 'text-[#5f6b64]')} title={overdue ? 'Overdue' : 'Due date'}>
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
    'w-full rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3.5 py-2 text-sm text-[#14201a] outline-none transition focus:border-[#177a43] focus:ring-2 focus:ring-[#177a43]/20';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label="Create ticket">
      <div className="fixed inset-0 bg-[#14201a]/40 backdrop-blur-xs" onClick={onClose} />
      <form onSubmit={submit} className="relative my-8 w-full max-w-2xl rounded-2xl border border-[#dfdbcc] bg-white text-[#14201a] p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-[#14201a]">Create ticket</h2>
            <p className="mt-0.5 text-xs text-[#5f6b64]">Log an issue, feature request, or operational task.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#eeebe0] hover:text-[#14201a] transition cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && <div className="mt-4"><ErrorBanner message={error} /></div>}

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="t-title" className="mb-1 block text-sm font-semibold text-[#14201a]">Title</label>
            <input id="t-title" required maxLength={200} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className={input} placeholder="What needs to be done?" />
          </div>
          <div>
            <label htmlFor="t-desc" className="mb-1 block text-sm font-semibold text-[#14201a]">Description <span className="font-normal text-[#5f6b64]">(optional)</span></label>
            <textarea id="t-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className={input} placeholder="Provide details, steps to reproduce, or acceptance criteria..." />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="t-type" className="mb-1 block text-sm font-semibold text-[#14201a]">Type</label>
              <select id="t-type" value={type} onChange={(e) => setType(e.target.value as TaskType)} className={input}>
                {TASK_TYPES.map((t) => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="t-priority" className="mb-1 block text-sm font-semibold text-[#14201a]">Priority</label>
              <select id="t-priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className={input}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="t-status" className="mb-1 block text-sm font-semibold text-[#14201a]">Status</label>
              <select id="t-status" value={statusId} onChange={(e) => setStatusId(e.target.value)} className={input}>
                {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="t-assignee" className="mb-1 block text-sm font-semibold text-[#14201a]">Assignee</label>
              <select id="t-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={input}>
                <option value="">Unassigned</option>
                {assignable.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.name || m.email}{m.userId === user?.id ? ' (me)' : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="t-due" className="mb-1 block text-sm font-semibold text-[#14201a]">Due date</label>
              <input id="t-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className={input} />
            </div>
            <div>
              <label htmlFor="t-labels" className="mb-1 block text-sm font-semibold text-[#14201a]">Labels</label>
              <input id="t-labels" value={labels} onChange={(e) => setLabels(e.target.value)} placeholder="backend, api, incident" className={input} />
            </div>
          </div>
          {type !== 'epic' && type !== 'subtask' && epics.length > 0 && (
            <div>
              <label htmlFor="t-epic" className="mb-1 block text-sm font-semibold text-[#14201a]">Epic <span className="font-normal text-[#5f6b64]">(optional)</span></label>
              <select id="t-epic" value={parentId} onChange={(e) => setParentId(e.target.value)} className={input}>
                <option value="">No epic</option>
                {epics.map((ep) => <option key={ep.id} value={ep.id}>{ep.ref} · {ep.title}</option>)}
              </select>
            </div>
          )}
          {type === 'subtask' && (
            <p className="rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] p-3 text-xs text-[#5f6b64]">
              Subtasks are created directly from their parent ticket’s page.
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="btn-kizupi-white px-4 py-2 text-sm cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving || type === 'subtask'} className="btn-kizupi-go px-5 py-2 text-sm cursor-pointer disabled:opacity-60">
            {saving ? 'Creating…' : 'Create ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}
