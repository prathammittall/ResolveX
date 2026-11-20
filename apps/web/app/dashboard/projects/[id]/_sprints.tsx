'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Pencil, Play, Plus, Trash2, Zap } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button, Field, Input, Modal, Pill, Select, Skeleton, SkeletonRows, Textarea, useApi, useConfirm, useToast } from '../../_components/kit';
import { ErrorBanner, SectionCard, cn } from '../../_components/ui';
import { Avatar, PriorityIcon, TypeIcon } from '../../_components/work';
import { BurndownChart } from './_overview';
import { dateOnly, fmtDay, toQuery, usePerms, type Burndown, type Project, type Sprint, type Task, type TaskList } from './_shared';

type Drag = { ref: string; from: string | null };
type DragCtx = { drag: Drag | null; setDrag: (d: Drag | null) => void; move: (ref: string, sprintId: string | null) => Promise<void> };

export function SprintsTab({ project, sprints, sprintsLoading, reloadSprints }: { project: Project; sprints: Sprint[]; sprintsLoading: boolean; reloadSprints: () => void }) {
  const perms = usePerms();
  const toast = useToast();
  const confirm = useConfirm();
  const [tick, setTick] = useState(0);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [editing, setEditing] = useState<Sprint | 'new' | null>(null);
  const [completing, setCompleting] = useState<Sprint | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const backlog = useApi<TaskList>(`/api/projects/${project.id}/tasks${toQuery({ sprintId: 'backlog', sort: 'position', limit: 500 })}`, [tick]);

  const open = sprints.filter((s) => s.status !== 'completed').sort((a, b) => (a.status === 'active' ? -1 : b.status === 'active' ? 1 : a.createdAt.localeCompare(b.createdAt)));
  const done = sprints.filter((s) => s.status === 'completed').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  const canMove = perms.work && !project.archived;

  const refresh = () => {
    setTick((t) => t + 1);
    reloadSprints();
  };

  async function move(ref: string, sprintId: string | null) {
    try {
      await api.patch(`/api/tasks/${ref}`, { sprintId });
      toast.success(`${ref} moved to ${sprintId ? (sprints.find((s) => s.id === sprintId)?.name ?? 'sprint') : 'backlog'}`);
      refresh();
    } catch (err) {
      toast.error(err);
    }
  }

  async function action(s: Sprint, kind: 'start' | 'delete') {
    if (kind === 'delete' && !(await confirm({ title: `Delete ${s.name}?`, message: 'Its tickets go back to the backlog. The sprint and its history are removed permanently.', confirmLabel: 'Delete sprint', danger: true }))) return;
    setBusy(s.id);
    try {
      if (kind === 'start') await api.post(`/api/projects/${project.id}/sprints/${s.id}/start`);
      else await api.del(`/api/projects/${project.id}/sprints/${s.id}`);
      toast.success(kind === 'start' ? `${s.name} started` : `${s.name} deleted`);
      refresh();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
    }
  }

  const ctx: DragCtx = { drag, setDrag, move };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#5f6b64]">Drag tickets between the backlog and sprints, or use the “Move to” menu on each row.</p>
        {perms.sprints && !project.archived && <Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" />New sprint</Button>}
      </div>

      {sprintsLoading && sprints.length === 0 ? (
        <Skeleton className="h-40" />
      ) : open.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#dfdbcc] bg-[#fbfaf6] p-6 text-center text-sm text-[#5f6b64]">
          No planned or active sprints. {perms.sprints ? 'Create one to start planning.' : 'A manager can create one.'}
        </div>
      ) : (
        open.map((s) => (
          <SprintSection
            key={s.id}
            project={project}
            sprint={s}
            sprints={sprints}
            tick={tick}
            ctx={ctx}
            canMove={canMove}
            canManage={perms.sprints}
            busy={busy === s.id}
            onEdit={() => setEditing(s)}
            onStart={() => void action(s, 'start')}
            onComplete={() => setCompleting(s)}
            onDelete={() => void action(s, 'delete')}
            hasActive={sprints.some((x) => x.status === 'active')}
          />
        ))
      )}

      <DropZone ctx={ctx} target={null} canMove={canMove}>
        <SectionCard title={`Backlog${backlog.data ? ` (${backlog.data.tasks.length})` : ''}`} subtitle="Tickets not planned into any sprint">
          {backlog.loading && !backlog.data ? (
            <SkeletonRows rows={4} />
          ) : backlog.error ? (
            <ErrorBanner message={backlog.error} />
          ) : backlog.data && backlog.data.tasks.length === 0 ? (
            <p className="text-sm text-[#5f6b64]">The backlog is empty.</p>
          ) : (
            <TaskRows tasks={backlog.data?.tasks ?? []} sprints={sprints} current={null} ctx={ctx} canMove={canMove} />
          )}
        </SectionCard>
      </DropZone>

      <div className="grid gap-5 lg:grid-cols-2">
        <BurndownCard project={project} sprints={sprints} tick={tick} />
        <VelocityCard project={project} tick={tick} />
      </div>

      <SectionCard title="Sprint history" subtitle="Completed sprints">
        {done.length === 0 ? (
          <p className="text-sm text-[#5f6b64]">No completed sprints yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#dfdbcc] text-xs uppercase tracking-wide text-[#5f6b64]">
                  <th className="py-2 pr-3 font-semibold">Sprint</th>
                  <th className="px-3 py-2 font-semibold">Dates</th>
                  <th className="px-3 py-2 font-semibold">Committed</th>
                  <th className="px-3 py-2 font-semibold">Completed</th>
                  <th className="px-3 py-2 font-semibold">Carried over</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfdbcc]">
                {done.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 pr-3">
                      <div className="font-semibold text-[#14201a]">{s.name}</div>
                      {s.goal && <div className="text-xs text-[#5f6b64]">{s.goal}</div>}
                    </td>
                    <td className="px-3 py-2 text-xs text-[#3d4a42]">{fmtDay(s.startDate)} – {fmtDay(s.completedAt ?? s.endDate)}</td>
                    <td className="px-3 py-2 text-xs text-[#3d4a42]">{s.summary?.committed ?? '—'} {s.summary?.unit ?? ''}</td>
                    <td className="px-3 py-2 text-xs font-semibold text-[#177a43]">{s.summary?.completed ?? '—'} {s.summary?.unit ?? ''}</td>
                    <td className="px-3 py-2 text-xs text-[#3d4a42]">{s.summary?.carriedOver ?? 0} tickets</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SprintModal project={project} sprint={editing} onClose={() => setEditing(null)} onSaved={refresh} />
      <CompleteModal project={project} sprint={completing} sprints={sprints} onClose={() => setCompleting(null)} onDone={refresh} />
    </div>
  );
}

function DropZone({ ctx, target, canMove, children }: { ctx: DragCtx; target: string | null; canMove: boolean; children: React.ReactNode }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        if (!canMove || !ctx.drag) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const d = ctx.drag;
        ctx.setDrag(null);
        if (d && d.from !== target) void ctx.move(d.ref, target);
      }}
      className={cn('rounded-2xl transition', over && 'ring-2 ring-[#177a43]')}
    >
      {children}
    </div>
  );
}

function TaskRows({ tasks, sprints, current, ctx, canMove }: { tasks: Task[]; sprints: Sprint[]; current: string | null; ctx: DragCtx; canMove: boolean }) {
  const targets = sprints.filter((s) => s.status !== 'completed' && s.id !== current);
  return (
    <ul className="-my-1 divide-y divide-[#dfdbcc]">
      {tasks.map((t) => (
        <li
          key={t.id}
          draggable={canMove}
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', t.ref);
            e.dataTransfer.effectAllowed = 'move';
            ctx.setDrag({ ref: t.ref, from: current });
          }}
          onDragEnd={() => ctx.setDrag(null)}
          className={cn('flex flex-wrap items-center gap-2 py-2', canMove && 'cursor-grab', ctx.drag?.ref === t.ref && 'opacity-40')}
        >
          <TypeIcon type={t.type} />
          <Link href={`/dashboard/tasks/${t.ref}`} className="font-mono text-xs font-bold text-[#5f6b64] hover:text-[#177a43]">{t.ref}</Link>
          <Link href={`/dashboard/tasks/${t.ref}`} className="min-w-0 flex-1 truncate text-sm font-semibold text-[#14201a] hover:text-[#177a43]">{t.title}</Link>
          <span className="text-xs text-[#5f6b64]">{t.status.name}</span>
          <PriorityIcon priority={t.priority} />
          {t.storyPoints !== null && <span className="rounded-full bg-[#eeebe0] px-1.5 text-[10px] font-bold text-[#3d4a42]" title="Story points">{t.storyPoints}</span>}
          {t.assignee && <Avatar name={t.assignee.name} size={20} />}
          {canMove && (
            <select
              aria-label={`Move ${t.ref} to`}
              value=""
              onChange={(e) => e.target.value && void ctx.move(t.ref, e.target.value === 'backlog' ? null : e.target.value)}
              className="rounded-lg border border-[#dfdbcc] bg-[#fbfaf6] px-1.5 py-0.5 text-[11px] text-[#3d4a42]"
            >
              <option value="">Move to…</option>
              {current !== null && <option value="backlog">Backlog</option>}
              {targets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </li>
      ))}
    </ul>
  );
}

function SprintSection(props: {
  project: Project;
  sprint: Sprint;
  sprints: Sprint[];
  tick: number;
  ctx: DragCtx;
  canMove: boolean;
  canManage: boolean;
  busy: boolean;
  hasActive: boolean;
  onEdit: () => void;
  onStart: () => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const { project, sprint: s, sprints, tick, ctx, canMove, canManage, busy, hasActive } = props;
  const tasks = useApi<TaskList>(`/api/projects/${project.id}/tasks${toQuery({ sprintId: s.id, sort: 'position', limit: 500 })}`, [tick]);
  const p = s.progress;
  const pctDone = p && p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
  return (
    <DropZone ctx={ctx} target={s.id} canMove={canMove}>
      <div className="rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#dfdbcc] px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-bold text-[#14201a]">{s.name}</h3>
              <Pill tone={s.status === 'active' ? 'green' : 'blue'}>{s.status === 'active' ? 'Active' : 'Planned'}</Pill>
              <span className="text-xs text-[#5f6b64]">{fmtDay(s.startDate)} – {fmtDay(s.endDate)}</span>
            </div>
            {s.goal && <p className="mt-1 text-sm text-[#3d4a42]">{s.goal}</p>}
            {p && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 w-48 rounded-full bg-[#eeebe0]" role="progressbar" aria-valuenow={pctDone} aria-valuemin={0} aria-valuemax={100} aria-label={`${s.name} progress`}>
                  <div className="h-1.5 rounded-full bg-[#177a43]" style={{ width: `${pctDone}%` }} />
                </div>
                <span className="text-xs text-[#5f6b64]">{p.completed}/{p.total} {p.unit} · {p.doneCount}/{p.taskCount} tickets</span>
              </div>
            )}
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="ghost" onClick={props.onEdit} aria-label={`Edit ${s.name}`}><Pencil className="h-3.5 w-3.5" />Edit</Button>
              {s.status === 'planned' && <Button size="sm" variant="secondary" loading={busy} disabled={hasActive} title={hasActive ? 'Complete the active sprint first' : undefined} onClick={props.onStart}><Play className="h-3.5 w-3.5" />Start</Button>}
              {s.status === 'active' && <Button size="sm" onClick={props.onComplete}><CheckCircle2 className="h-3.5 w-3.5" />Complete</Button>}
              {s.status !== 'active' && <Button size="sm" variant="ghost" loading={busy} onClick={props.onDelete} aria-label={`Delete ${s.name}`}><Trash2 className="h-3.5 w-3.5" /></Button>}
            </div>
          )}
        </div>
        <div className="px-5 py-3">
          {tasks.loading && !tasks.data ? (
            <SkeletonRows rows={2} />
          ) : tasks.error ? (
            <ErrorBanner message={tasks.error} />
          ) : tasks.data && tasks.data.tasks.length === 0 ? (
            <p className="py-3 text-center text-sm text-[#5f6b64]">Drop tickets here to plan them into this sprint.</p>
          ) : (
            <TaskRows tasks={tasks.data?.tasks ?? []} sprints={sprints} current={s.id} ctx={ctx} canMove={canMove} />
          )}
        </div>
      </div>
    </DropZone>
  );
}

function SprintModal({ project, sprint, onClose, onSaved }: { project: Project; sprint: Sprint | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const editing = sprint && sprint !== 'new' ? sprint : null;
  const [form, setForm] = useState({ name: '', goal: '', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const currentKey = sprint === null ? null : sprint === 'new' ? 'new' : sprint.id;
  if (currentKey !== key) {
    setKey(currentKey);
    setForm(editing ? { name: editing.name, goal: editing.goal ?? '', startDate: dateOnly(editing.startDate), endDate: dateOnly(editing.endDate) } : { name: '', goal: '', startDate: '', endDate: '' });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      toast.error('The end date must be after the start date');
      return;
    }
    setSaving(true);
    try {
      const body = { name: form.name.trim(), goal: form.goal.trim() || null, startDate: form.startDate || null, endDate: form.endDate || null };
      if (editing) await api.patch(`/api/projects/${project.id}/sprints/${editing.id}`, body);
      else await api.post(`/api/projects/${project.id}/sprints`, body);
      toast.success(editing ? 'Sprint updated' : 'Sprint created');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={sprint !== null}
      onClose={onClose}
      title={editing ? `Edit ${editing.name}` : 'New sprint'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="sprint-form" loading={saving} disabled={!form.name.trim()}>{editing ? 'Save' : 'Create sprint'}</Button>
        </>
      }
    >
      <form id="sprint-form" onSubmit={save} className="space-y-4">
        <Field label="Name"><Input required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sprint 12" /></Field>
        <Field label="Goal" hint="What should this sprint achieve?"><Textarea rows={3} maxLength={2000} value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date"><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
          <Field label="End date" hint="Defaults to two weeks when started"><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
        </div>
      </form>
    </Modal>
  );
}

function CompleteModal({ project, sprint, sprints, onClose, onDone }: { project: Project; sprint: Sprint | null; sprints: Sprint[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [target, setTarget] = useState('backlog');
  const [saving, setSaving] = useState(false);
  const others = sprints.filter((s) => s.status === 'planned' && s.id !== sprint?.id);
  const openCount = sprint?.progress ? sprint.progress.taskCount - sprint.progress.doneCount : null;

  async function complete() {
    if (!sprint) return;
    setSaving(true);
    try {
      await api.post(`/api/projects/${project.id}/sprints/${sprint.id}/complete`, { moveOpenTo: target });
      toast.success(`${sprint.name} completed`);
      onDone();
      onClose();
      setTarget('backlog');
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={sprint !== null}
      onClose={onClose}
      title={sprint ? `Complete ${sprint.name}` : 'Complete sprint'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={() => void complete()}>Complete sprint</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-[#3d4a42]">
          {openCount === null ? 'Unfinished tickets will be moved.' : openCount === 0 ? 'Every ticket in this sprint is done.' : `${openCount} unfinished ticket${openCount === 1 ? '' : 's'} will be moved.`}
        </p>
        <Field label="Move open tickets to">
          <Select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="backlog">Backlog</option>
            {others.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

function BurndownCard({ project, sprints, tick }: { project: Project; sprints: Sprint[]; tick: number }) {
  const def = sprints.find((s) => s.status === 'active') ?? sprints.find((s) => s.status === 'completed') ?? sprints[0];
  const [chosen, setChosen] = useState<string>('');
  const sprintId = chosen || def?.id || '';
  const res = useApi<{ sprint: Sprint; burndown: Burndown }>(sprintId ? `/api/projects/${project.id}/sprints/${sprintId}` : null, [tick]);
  return (
    <SectionCard
      title="Sprint burndown"
      action={
        sprints.length > 0 && (
          <Select aria-label="Sprint for burndown" value={sprintId} onChange={(e) => setChosen(e.target.value)} className="w-auto! py-1! text-xs!">
            {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        )
      }
    >
      {!sprintId ? (
        <p className="text-sm text-[#5f6b64]">Create a sprint to see its burndown.</p>
      ) : res.loading && !res.data ? (
        <Skeleton className="h-48" />
      ) : res.error ? (
        <ErrorBanner message={res.error} />
      ) : res.data ? (
        <BurndownChart burndown={res.data.burndown} />
      ) : null}
    </SectionCard>
  );
}

type Velocity = { sprints: Array<{ id: string; name: string; committed?: number; completed?: number; unit?: string }>; averageVelocity: number | null };

function VelocityCard({ project, tick }: { project: Project; tick: number }) {
  const res = useApi<Velocity>(`/api/projects/${project.id}/velocity`, [tick]);
  const rows = res.data?.sprints.slice(-8) ?? [];
  const max = Math.max(1, ...rows.flatMap((r) => [r.committed ?? 0, r.completed ?? 0]));
  return (
    <SectionCard title="Velocity" subtitle={res.data?.averageVelocity !== null && res.data?.averageVelocity !== undefined ? `Average of last 3 sprints: ${res.data.averageVelocity}` : 'Committed vs completed per sprint'}>
      {res.loading && !res.data ? (
        <Skeleton className="h-48" />
      ) : res.error ? (
        <ErrorBanner message={res.error} />
      ) : rows.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-[#5f6b64]"><Zap className="h-4 w-4" />Complete a sprint to start tracking velocity.</p>
      ) : (
        <div>
          <div className="flex h-44 items-end gap-3">
            {rows.map((r) => (
              <div key={r.id} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                <div className="flex flex-1 items-end justify-center gap-1">
                  <div className="w-1/3 rounded-t-md" style={{ height: `${((r.committed ?? 0) / max) * 100}%`, background: '#0284c7', minHeight: (r.committed ?? 0) > 0 ? 3 : 0 }} title={`${r.name} committed: ${r.committed ?? 0} ${r.unit ?? ''}`} />
                  <div className="w-1/3 rounded-t-md" style={{ height: `${((r.completed ?? 0) / max) * 100}%`, background: '#177a43', minHeight: (r.completed ?? 0) > 0 ? 3 : 0 }} title={`${r.name} completed: ${r.completed ?? 0} ${r.unit ?? ''}`} />
                </div>
                <div className="mt-1 truncate text-center text-[10px] text-[#5f6b64]" title={r.name}>{r.name}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-4 text-xs text-[#5f6b64]">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: '#0284c7' }} />Committed</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#177a43]" />Completed</span>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
