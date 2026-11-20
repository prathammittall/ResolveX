'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { api } from '../../../../lib/api';
import type { StatusItem } from '../../../../lib/types';
import { Button, Input, Select, Skeleton, useApi, useMembers, useToast } from '../../_components/kit';
import { ErrorBanner, cn } from '../../_components/ui';
import { Avatar, DueDate, PRIORITIES, PriorityIcon, TASK_TYPES, TypeIcon } from '../../_components/work';
import { CATEGORY_LABEL, EMPTY_FILTERS, PRIORITY_LABEL, TYPE_LABEL, toQuery, usePerms, type Filters, type Project, type Sprint, type Task, type TaskList } from './_shared';

/** Debounce a fast-changing value (search box) before it hits the API. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const ctl = 'w-auto! min-w-0 py-1.5! text-xs!';

/** Filter controls shared by the board and the list. `extended` adds status, category and overdue. */
export function FilterBar({ filters, onChange, statuses, sprints, extended }: { filters: Filters; onChange: (f: Filters) => void; statuses: StatusItem[]; sprints: Sprint[]; extended?: boolean }) {
  const members = useMembers();
  const set = (k: keyof Filters, v: string) => onChange({ ...filters, [k]: v });
  const active = Object.entries(filters).some(([k, v]) => v !== '' && k !== 'sprintId');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input aria-label="Search tickets" placeholder="Search titles…" value={filters.q} onChange={(e) => set('q', e.target.value)} className={cn(ctl, 'w-44!')} />
      <Select aria-label="Assignee" value={filters.assigneeId} onChange={(e) => set('assigneeId', e.target.value)} className={ctl}>
        <option value="">Any assignee</option>
        <option value="none">Unassigned</option>
        {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
      </Select>
      <Select aria-label="Priority" value={filters.priority} onChange={(e) => set('priority', e.target.value)} className={ctl}>
        <option value="">Any priority</option>
        {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
      </Select>
      <Select aria-label="Type" value={filters.type} onChange={(e) => set('type', e.target.value)} className={ctl}>
        <option value="">Any type</option>
        {TASK_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
      </Select>
      <Input aria-label="Label" placeholder="Label" value={filters.label} onChange={(e) => set('label', e.target.value)} className={cn(ctl, 'w-24!')} />
      <Select aria-label="Sprint" value={filters.sprintId} onChange={(e) => set('sprintId', e.target.value)} className={ctl}>
        <option value="">All sprints</option>
        <option value="backlog">Backlog only</option>
        {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}{s.status === 'active' ? ' (active)' : s.status === 'completed' ? ' (done)' : ''}</option>)}
      </Select>
      {extended && (
        <>
          <Select aria-label="Status" value={filters.statusId} onChange={(e) => set('statusId', e.target.value)} className={ctl}>
            <option value="">Any status</option>
            {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Select aria-label="Status category" value={filters.statusCategory} onChange={(e) => set('statusCategory', e.target.value)} className={ctl}>
            <option value="">Any category</option>
            <option value="open">Open (not done)</option>
            {(Object.keys(CATEGORY_LABEL) as Array<keyof typeof CATEGORY_LABEL>).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </Select>
          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3d4a42]">
            <input type="checkbox" className="accent-[#177a43]" checked={filters.overdue === 'true'} onChange={(e) => set('overdue', e.target.checked ? 'true' : '')} />
            Overdue
          </label>
        </>
      )}
      {active && (
        <Button size="sm" variant="ghost" onClick={() => onChange({ ...EMPTY_FILTERS, sprintId: filters.sprintId })}>
          <X className="h-3.5 w-3.5" />Clear
        </Button>
      )}
    </div>
  );
}

function positionAt(col: Task[], index: number): number {
  const prev = col[index - 1];
  const next = col[index];
  if (prev && next) return (prev.position + next.position) / 2;
  if (prev) return prev.position + 1;
  if (next) return next.position - 1;
  return Date.now() / 1000;
}

export function BoardTab({ project, statuses, sprints }: { project: Project; statuses: StatusItem[]; sprints: Sprint[] }) {
  const perms = usePerms();
  const toast = useToast();
  const activeSprint = sprints.find((s) => s.status === 'active');
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS, sprintId: activeSprint?.id ?? '' });
  const q = useDebounced(filters.q);
  const label = useDebounced(filters.label);
  const path = `/api/projects/${project.id}/tasks${toQuery({ sort: 'position', limit: 500, q, assigneeId: filters.assigneeId, priority: filters.priority, type: filters.type, label, sprintId: filters.sprintId })}`;
  const { data, error, loading, reload, setData } = useApi<TaskList>(path);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<{ statusId: string; index: number } | null>(null);
  const [quick, setQuick] = useState<{ statusId: string; title: string } | null>(null);
  const [quickSaving, setQuickSaving] = useState(false);
  const canEdit = perms.work && !project.archived;

  const columns = useMemo(() => {
    const tasks = data?.tasks ?? [];
    return new Map(statuses.map((s) => [s.id, tasks.filter((t) => t.status.id === s.id).sort((a, b) => a.position - b.position)] as const));
  }, [data, statuses]);

  async function move(ref: string, statusId: string, index: number) {
    const task = data?.tasks.find((t) => t.ref === ref);
    const status = statuses.find((s) => s.id === statusId);
    if (!task || !status) return;
    const col = (columns.get(statusId) ?? []).filter((t) => t.ref !== ref);
    const position = positionAt(col, Math.max(0, Math.min(index, col.length)));
    const statusChanged = task.status.id !== statusId;
    if (!statusChanged && task.position === position) return;
    setData((d) => (d ? { ...d, tasks: d.tasks.map((t) => (t.ref === ref ? { ...t, position, status: { id: status.id, name: status.name, category: status.category } } : t)) } : d));
    try {
      await api.patch(`/api/tasks/${ref}`, statusChanged ? { statusId, position } : { position });
      if (statusChanged) toast.success(`${ref} moved to ${status.name}`);
    } catch (err) {
      toast.error(err);
      reload();
    }
  }

  async function quickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!quick || !quick.title.trim()) return;
    setQuickSaving(true);
    try {
      const sprintId = filters.sprintId && filters.sprintId !== 'backlog' ? filters.sprintId : null;
      const res = await api.post<{ task: Task }>(`/api/projects/${project.id}/tasks`, { title: quick.title.trim(), statusId: quick.statusId, sprintId });
      toast.success(`${res.task.ref} created`);
      setQuick({ statusId: quick.statusId, title: '' });
      reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setQuickSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <FilterBar filters={filters} onChange={setFilters} statuses={statuses} sprints={sprints.filter((s) => s.status !== 'completed')} />
      {error && <ErrorBanner message={error} />}
      {data?.truncated && <p className="text-xs text-[#92400e]">Showing the first 500 tickets. Narrow the filters to see the rest.</p>}
      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-3">
          {statuses.map((s) => {
            const col = columns.get(s.id) ?? [];
            return (
              <section
                key={s.id}
                aria-label={`${s.name} column`}
                onDragOver={(e) => {
                  if (!drag) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (over?.statusId !== s.id || over.index !== col.length) setOver({ statusId: s.id, index: col.length });
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o?.statusId === s.id ? null : o));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const ref = drag ?? e.dataTransfer.getData('text/plain');
                  const target = over?.statusId === s.id ? over.index : col.length;
                  setDrag(null);
                  setOver(null);
                  if (ref) {
                    // Index is computed against the column without the dragged card.
                    const from = col.findIndex((t) => t.ref === ref);
                    void move(ref, s.id, from !== -1 && from < target ? target - 1 : target);
                  }
                }}
                className={cn('flex w-72 shrink-0 flex-col rounded-2xl border border-[#dfdbcc] bg-[#f6f4ec] p-2.5', over?.statusId === s.id && 'border-[#b2e2a8] bg-[#dcefd8]')}
              >
                <header className="mb-2 flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#3d4a42]">
                    {s.name} <span className="ml-1 font-semibold text-[#5f6b64]">{loading && !data ? '…' : col.length}</span>
                  </h3>
                  {canEdit && (
                    <button onClick={() => setQuick({ statusId: s.id, title: '' })} aria-label={`Quick add to ${s.name}`} className="rounded-lg p-1 text-[#5f6b64] hover:bg-[#eeebe0]">
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </header>
                <div className="flex-1 space-y-2">
                  {loading && !data && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-20" />)}
                  {col.map((t, i) => (
                    <React.Fragment key={t.id}>
                      {over?.statusId === s.id && over.index === i && drag !== t.ref && <div className="h-1 rounded-full bg-[#177a43]" />}
                      <article
                        draggable={canEdit}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', t.ref);
                          e.dataTransfer.effectAllowed = 'move';
                          setDrag(t.ref);
                        }}
                        onDragEnd={() => {
                          setDrag(null);
                          setOver(null);
                        }}
                        onDragOver={(e) => {
                          if (!drag) return;
                          e.preventDefault();
                          e.stopPropagation();
                          const r = e.currentTarget.getBoundingClientRect();
                          const index = e.clientY < r.top + r.height / 2 ? i : i + 1;
                          if (over?.statusId !== s.id || over.index !== index) setOver({ statusId: s.id, index });
                        }}
                        className={cn('rounded-xl border border-[#dfdbcc] bg-white p-3 shadow-[0_1px_0_#dfdbcc]', canEdit && 'cursor-grab active:cursor-grabbing', drag === t.ref && 'opacity-40')}
                      >
                        <Link href={`/dashboard/tasks/${t.ref}`} className="block text-sm font-semibold text-[#14201a] hover:text-[#177a43]">{t.title}</Link>
                        {t.labels.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {t.labels.map((l) => <span key={l} className="rounded-md bg-[#eeebe0] px-1.5 py-0.5 text-[10px] font-semibold text-[#3d4a42]">{l}</span>)}
                          </div>
                        )}
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <TypeIcon type={t.type} />
                            <span className="font-mono text-[11px] font-semibold text-[#5f6b64]">{t.ref}</span>
                            <PriorityIcon priority={t.priority} />
                            {t.storyPoints !== null && <span className="rounded-full bg-[#eeebe0] px-1.5 text-[10px] font-bold text-[#3d4a42]" title="Story points">{t.storyPoints}</span>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <DueDate iso={t.dueDate} done={t.status.category === 'done'} />
                            {t.assignee && <Avatar name={t.assignee.name} size={20} />}
                          </div>
                        </div>
                        {canEdit && (
                          <div className="mt-2 flex items-center gap-1">
                            <select
                              aria-label={`Move ${t.ref} to status`}
                              value={t.status.id}
                              onChange={(e) => void move(t.ref, e.target.value, (columns.get(e.target.value) ?? []).length)}
                              className="min-w-0 flex-1 rounded-lg border border-[#dfdbcc] bg-[#fbfaf6] px-1.5 py-0.5 text-[11px] text-[#3d4a42]"
                            >
                              {statuses.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                            </select>
                            <button disabled={i === 0} onClick={() => void move(t.ref, s.id, i - 1)} aria-label={`Move ${t.ref} up`} className="rounded p-0.5 text-[#5f6b64] hover:bg-[#eeebe0] disabled:opacity-30">
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button disabled={i === col.length - 1} onClick={() => void move(t.ref, s.id, i + 1)} aria-label={`Move ${t.ref} down`} className="rounded p-0.5 text-[#5f6b64] hover:bg-[#eeebe0] disabled:opacity-30">
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </article>
                    </React.Fragment>
                  ))}
                  {over?.statusId === s.id && over.index === col.length && col.length > 0 && <div className="h-1 rounded-full bg-[#177a43]" />}
                  {!loading && col.length === 0 && <div className="rounded-xl border-2 border-dashed border-[#dfdbcc] p-5 text-center text-xs text-[#5f6b64]">No tickets</div>}
                  {quick?.statusId === s.id && (
                    <form onSubmit={quickAdd} className="space-y-1.5 rounded-xl border border-[#dfdbcc] bg-white p-2">
                      <Input
                        autoFocus
                        aria-label={`New ticket title in ${s.name}`}
                        placeholder="Ticket title…"
                        maxLength={200}
                        value={quick.title}
                        onChange={(e) => setQuick({ statusId: s.id, title: e.target.value })}
                        onKeyDown={(e) => e.key === 'Escape' && setQuick(null)}
                        className="py-1.5! text-xs!"
                      />
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" type="button" onClick={() => setQuick(null)}>Cancel</Button>
                        <Button size="sm" type="submit" loading={quickSaving} disabled={!quick.title.trim()}>Add</Button>
                      </div>
                    </form>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
