'use client';

/** Types, helpers and the ticket-create modal shared by the project page tabs. */
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { can } from '../../../../lib/permissions';
import type { ProjectItem, StatusCategory, StatusItem, TaskItem, TaskPriority, TaskType } from '../../../../lib/types';
import { Button, Field, Input, Modal, Select, Textarea, useMembers, useToast } from '../../_components/kit';
import { PRIORITIES, TASK_TYPES } from '../../_components/work';

export type Task = TaskItem & {
  sprintId: string | null;
  storyPoints: number | null;
  position: number;
  startDate: string | null;
  serviceId: number | null;
  incidentId: number | null;
  completedAt: string | null;
};

export type Project = ProjectItem & { leadId: number | null; teamId: string | null; color: string | null };

export type SprintStatus = 'planned' | 'active' | 'completed';
export type SprintProgress = { unit: 'points' | 'tickets'; total: number; completed: number; remaining: number; taskCount: number; doneCount: number };
export type Sprint = {
  id: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  startDate: string | null;
  endDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  summary?: { unit?: string; committed?: number; completed?: number; committedCount?: number; completedCount?: number; carriedOver?: number } | null;
  progress?: SprintProgress;
};
export type Burndown = SprintProgress & { series: Array<{ date: string; remaining: number | null; ideal: number }> };

export type TaskList = { tasks: Task[]; truncated: boolean; total: number };

export const CATEGORY_LABEL: Record<StatusCategory, string> = { todo: 'To do', in_progress: 'In progress', done: 'Done' };
export const TYPE_LABEL: Record<TaskType, string> = { epic: 'Epic', story: 'Story', task: 'Task', bug: 'Bug', subtask: 'Subtask' };
export const PRIORITY_LABEL: Record<TaskPriority, string> = { highest: 'Highest', high: 'High', medium: 'Medium', low: 'Low', lowest: 'Lowest' };
export const PRIORITY_COLOR: Record<TaskPriority, string> = { highest: '#dc2626', high: '#e3a008', medium: '#0284c7', low: '#22a35a', lowest: '#7c3aed' };
export const TYPE_COLOR: Record<TaskType, string> = { epic: '#7c3aed', story: '#22a35a', task: '#0284c7', bug: '#dc2626', subtask: '#e3a008' };
export const CATEGORY_COLOR: Record<string, string> = { todo: '#0284c7', in_progress: '#e3a008', done: '#22a35a' };

/** Ticket filter state shared by board and list. Empty string = no filter. */
export type Filters = {
  q: string;
  assigneeId: string; // '' | 'none' | userId
  priority: string;
  type: string;
  label: string;
  sprintId: string; // '' (all) | 'backlog' | uuid
  statusId: string;
  statusCategory: string;
  overdue: string; // '' | 'true'
};
export const EMPTY_FILTERS: Filters = { q: '', assigneeId: '', priority: '', type: '', label: '', sprintId: '', statusId: '', statusCategory: '', overdue: '' };

export function toQuery(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function usePerms() {
  const { user } = useAuth();
  const role = user?.role;
  return {
    user,
    work: can(role, 'tasks:create'),
    manage: can(role, 'projects:manage'),
    sprints: can(role, 'sprints:manage'),
    assign: can(role, 'tasks:assign'),
    del: can(role, 'tasks:delete'),
  };
}

export const dateOnly = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '');
export const fmtDay = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '—';

/** Assignee picker that respects the "members may only assign themselves" rule. */
export function AssigneeSelect({ value, onChange, id, disabled, noneLabel = 'Unassigned' }: { value: number | null; onChange: (v: number | null) => void; id?: string; disabled?: boolean; noneLabel?: string }) {
  const members = useMembers();
  const { user, assign } = usePerms();
  const options = assign ? members : members.filter((m) => m.userId === user?.id || m.userId === value);
  return (
    <Select id={id} disabled={disabled} value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">{noneLabel}</option>
      {options.map((m) => (
        <option key={m.userId} value={m.userId}>
          {m.name}
          {m.userId === user?.id ? ' (me)' : ''}
        </option>
      ))}
    </Select>
  );
}

/** Create a ticket with every planning field (type, priority, status, assignee, dates, labels, sprint, points, parent). */
export function TicketModal({
  open,
  onClose,
  projectId,
  statuses,
  sprints,
  defaults,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  statuses: StatusItem[];
  sprints: Sprint[];
  defaults?: { statusId?: string; sprintId?: string | null; type?: TaskType; parentId?: string };
  onCreated: (t: Task) => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('task');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [statusId, setStatusId] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [due, setDue] = useState('');
  const [labels, setLabels] = useState('');
  const [sprintId, setSprintId] = useState('');
  const [points, setPoints] = useState('');
  const [parentId, setParentId] = useState('');
  const [parents, setParents] = useState<Task[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setType(defaults?.type ?? 'task');
    setPriority('medium');
    setStatusId(defaults?.statusId ?? statuses[0]?.id ?? '');
    setAssigneeId(null);
    setDue('');
    setLabels('');
    setSprintId(defaults?.sprintId ?? '');
    setPoints('');
    setParentId(defaults?.parentId ?? '');
    setError(null);
    api
      .get<TaskList>(`/api/projects/${projectId}/tasks?limit=500&sort=number&order=desc`)
      .then((r) => setParents(r.tasks.filter((t) => t.type !== 'subtask')))
      .catch(() => setParents([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  const parentOptions = useMemo(
    () => (type === 'epic' ? [] : type === 'subtask' ? parents.filter((p) => p.type === 'story' || p.type === 'task' || p.type === 'bug') : parents.filter((p) => p.type === 'epic')),
    [parents, type],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (type === 'subtask' && !parentId) {
      setError('A subtask needs a parent ticket');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ task: Task }>(`/api/projects/${projectId}/tasks`, {
        title: title.trim(),
        description: description.trim() || null,
        type,
        priority,
        statusId: statusId || undefined,
        assigneeId,
        dueDate: due || null,
        labels: labels.split(',').map((l) => l.trim()).filter(Boolean),
        sprintId: sprintId || null,
        storyPoints: points === '' ? null : Number(points),
        parentId: type === 'epic' ? null : parentId || null,
      });
      toast.success(`${res.task.ref} created`);
      onCreated(res.task);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the ticket');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create ticket"
      wide
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="create-ticket-form" loading={saving} disabled={!title.trim()}>Create ticket</Button>
        </>
      }
    >
      <form id="create-ticket-form" onSubmit={submit} className="space-y-4">
        {error && <p className="rounded-xl border border-[#fecaca] bg-[#fee2e2] px-3 py-2 text-sm text-[#991b1b]">{error}</p>}
        <Field label="Title">
          <Input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" />
        </Field>
        <Field label="Description" hint="Markdown supported. Mention teammates with @username.">
          <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Type">
            <Select value={type} onChange={(e) => { setType(e.target.value as TaskType); setParentId(''); }}>
              {TASK_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={statusId} onChange={(e) => setStatusId(e.target.value)}>
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Assignee">
            <AssigneeSelect value={assigneeId} onChange={setAssigneeId} />
          </Field>
          <Field label="Due date">
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <Field label="Story points">
            <Input type="number" min={0} max={1000} value={points} onChange={(e) => setPoints(e.target.value)} />
          </Field>
          <Field label="Sprint">
            <Select value={sprintId} onChange={(e) => setSprintId(e.target.value)}>
              <option value="">Backlog</option>
              {sprints.filter((s) => s.status !== 'completed').map((s) => <option key={s.id} value={s.id}>{s.name}{s.status === 'active' ? ' (active)' : ''}</option>)}
            </Select>
          </Field>
          <Field label="Labels" hint="Comma separated" className="sm:col-span-2">
            <Input value={labels} onChange={(e) => setLabels(e.target.value)} placeholder="backend, api" />
          </Field>
        </div>
        {type !== 'epic' && (
          <Field label={type === 'subtask' ? 'Parent ticket' : 'Epic'} hint={type === 'subtask' ? 'Required for subtasks' : 'Optional'}>
            <Select value={parentId} onChange={(e) => setParentId(e.target.value)} required={type === 'subtask'}>
              <option value="">{type === 'subtask' ? 'Choose a parent…' : 'No epic'}</option>
              {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.ref} · {p.title}</option>)}
            </Select>
          </Field>
        )}
      </form>
    </Modal>
  );
}
