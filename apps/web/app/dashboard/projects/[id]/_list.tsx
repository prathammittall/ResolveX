'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Bookmark, ChevronLeft, ChevronRight, ListChecks, Trash2 } from 'lucide-react';
import { api } from '../../../../lib/api';
import type { StatusItem } from '../../../../lib/types';
import { Button, Input, Select, SkeletonRows, useApi, useConfirm, useToast } from '../../_components/kit';
import { EmptyState, ErrorBanner, cn } from '../../_components/ui';
import { Avatar, DueDate, PRIORITIES, PriorityIcon, TypeIcon } from '../../_components/work';
import { FilterBar, useDebounced } from './_board';
import { AssigneeSelect, EMPTY_FILTERS, PRIORITY_LABEL, fmtDay, toQuery, usePerms, type Filters, type Project, type Sprint, type TaskList } from './_shared';

type Sort = 'number' | 'priority' | 'due' | 'updated' | 'created';
type SavedFilter = { id: string; name: string; scope: string; query: Record<string, string>; shared: boolean; mine: boolean };
type BulkAction = 'status' | 'assignee' | 'priority' | 'sprint' | 'delete';

const PAGE = 50;

export function ListTab({ project, statuses, sprints }: { project: Project; statuses: StatusItem[]; sprints: Sprint[] }) {
  const perms = usePerms();
  const toast = useToast();
  const confirm = useConfirm();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<Sort>('number');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const q = useDebounced(filters.q);
  const label = useDebounced(filters.label);

  const query = { ...filters, q, label };
  const path = `/api/projects/${project.id}/tasks${toQuery({ ...query, sort, order, limit: PAGE, offset })}`;
  const { data, error, loading, reload } = useApi<TaskList>(path);

  // Reset paging and selection whenever the result set changes shape.
  const shape = JSON.stringify([query, sort, order]);
  useEffect(() => {
    setOffset(0);
    setSelected(new Set());
  }, [shape]);

  const tasks = data?.tasks ?? [];
  const allSelected = tasks.length > 0 && tasks.every((t) => selected.has(t.ref));

  const toggleSort = (s: Sort) => {
    if (sort === s) setOrder(order === 'asc' ? 'desc' : 'asc');
    else {
      setSort(s);
      setOrder(s === 'due' ? 'asc' : 'desc');
    }
  };

  const Th = ({ s, children, className }: { s?: Sort; children: React.ReactNode; className?: string }) => (
    <th className={cn('px-3 py-2.5 font-semibold', className)} aria-sort={s && sort === s ? (order === 'asc' ? 'ascending' : 'descending') : undefined}>
      {s ? (
        <button onClick={() => toggleSort(s)} className="inline-flex items-center gap-1 uppercase hover:text-[#14201a]">
          {children}
          {sort === s && (order === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        </button>
      ) : (
        children
      )}
    </th>
  );

  return (
    <div className="space-y-4">
      <FilterBar filters={filters} onChange={setFilters} statuses={statuses} sprints={sprints} extended />
      <SavedFilters projectId={project.id} filters={filters} onApply={setFilters} />
      {selected.size > 0 && (
        <BulkBar
          refs={[...selected]}
          statuses={statuses}
          sprints={sprints}
          canDelete={perms.del}
          onDone={() => {
            setSelected(new Set());
            reload();
          }}
          onClear={() => setSelected(new Set())}
          toast={toast}
          confirm={confirm}
        />
      )}
      {error && <ErrorBanner message={error} />}
      <div className="overflow-hidden rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc]">
        {loading && !data ? (
          <div className="p-5"><SkeletonRows rows={8} /></div>
        ) : tasks.length === 0 ? (
          <div className="p-5"><EmptyState icon={ListChecks} title="No tickets match" description="Try clearing some filters, or create a new ticket." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#dfdbcc] bg-[#fbfaf6] text-xs uppercase tracking-wide text-[#5f6b64]">
                  <th className="w-10 px-3 py-2.5">
                    {perms.work && (
                      <input
                        type="checkbox"
                        aria-label="Select all on this page"
                        className="accent-[#177a43]"
                        checked={allSelected}
                        onChange={(e) => setSelected(e.target.checked ? new Set(tasks.map((t) => t.ref)) : new Set())}
                      />
                    )}
                  </th>
                  <Th s="number">Ticket</Th>
                  <Th>Status</Th>
                  <Th s="priority">Priority</Th>
                  <Th>Assignee</Th>
                  <Th>Sprint</Th>
                  <Th s="due">Due</Th>
                  <Th s="updated">Updated</Th>
                  <Th s="created">Created</Th>
                </tr>
              </thead>
              <tbody className={cn('divide-y divide-[#dfdbcc]', loading && 'opacity-60')}>
                {tasks.map((t) => (
                  <tr key={t.id} className={cn('hover:bg-[#fbfaf6]', selected.has(t.ref) && 'bg-[#f6f4ec]')}>
                    <td className="px-3 py-2.5">
                      {perms.work && (
                        <input
                          type="checkbox"
                          aria-label={`Select ${t.ref}`}
                          className="accent-[#177a43]"
                          checked={selected.has(t.ref)}
                          onChange={(e) =>
                            setSelected((s) => {
                              const n = new Set(s);
                              if (e.target.checked) n.add(t.ref);
                              else n.delete(t.ref);
                              return n;
                            })
                          }
                        />
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/dashboard/tasks/${t.ref}`} className="flex items-center gap-2">
                        <TypeIcon type={t.type} />
                        <span className="font-mono text-xs font-bold text-[#5f6b64]">{t.ref}</span>
                        <span className="font-semibold text-[#14201a] hover:text-[#177a43]">{t.title}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-[#3d4a42]">{t.status.name}</td>
                    <td className="px-3 py-2.5"><PriorityIcon priority={t.priority} withLabel /></td>
                    <td className="px-3 py-2.5">
                      {t.assignee ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#14201a]"><Avatar name={t.assignee.name} size={20} />{t.assignee.name}</span> : <span className="text-xs text-[#5f6b64]">Unassigned</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[#3d4a42]">{sprints.find((s) => s.id === t.sprintId)?.name ?? <span className="text-[#5f6b64]">Backlog</span>}</td>
                    <td className="px-3 py-2.5"><DueDate iso={t.dueDate} done={t.status.category === 'done'} /></td>
                    <td className="px-3 py-2.5 text-xs text-[#5f6b64]">{fmtDay(t.updatedAt)}</td>
                    <td className="px-3 py-2.5 text-xs text-[#5f6b64]">{fmtDay(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && (offset > 0 || data.truncated) && (
          <div className="flex items-center justify-between border-t border-[#dfdbcc] px-4 py-2.5 text-xs text-[#5f6b64]">
            <span>
              Showing {offset + 1}–{offset + tasks.length}
            </span>
            <span className="flex gap-1">
              <Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))} aria-label="Previous page"><ChevronLeft className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="secondary" disabled={!data.truncated} onClick={() => setOffset(offset + PAGE)} aria-label="Next page"><ChevronRight className="h-3.5 w-3.5" /></Button>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function BulkBar({
  refs,
  statuses,
  sprints,
  canDelete,
  onDone,
  onClear,
  toast,
  confirm,
}: {
  refs: string[];
  statuses: StatusItem[];
  sprints: Sprint[];
  canDelete: boolean;
  onDone: () => void;
  onClear: () => void;
  toast: ReturnType<typeof useToast>;
  confirm: ReturnType<typeof useConfirm>;
}) {
  const [action, setAction] = useState<BulkAction>('status');
  const [statusId, setStatusId] = useState(statuses[0]?.id ?? '');
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [priority, setPriority] = useState('medium');
  const [sprintId, setSprintId] = useState('');
  const [busy, setBusy] = useState(false);

  async function apply() {
    let body: Record<string, unknown>;
    if (action === 'delete') {
      const ok = await confirm({ title: `Delete ${refs.length} ticket${refs.length === 1 ? '' : 's'}?`, message: 'The tickets, their comments and history are permanently deleted. This cannot be undone.', confirmLabel: 'Delete', danger: true });
      if (!ok) return;
      body = { refs, action: 'delete' };
    } else {
      const patch =
        action === 'status' ? { statusId } : action === 'assignee' ? { assigneeId } : action === 'priority' ? { priority } : { sprintId: sprintId || null };
      body = { refs, action: 'update', patch };
    }
    setBusy(true);
    try {
      const res = await api.post<{ results: Array<{ ref: string; ok: boolean; error?: string }> }>('/api/tasks/bulk', body);
      const failed = res.results.filter((r) => !r.ok);
      const done = res.results.length - failed.length;
      if (done) toast.success(`${done} ticket${done === 1 ? '' : 's'} ${action === 'delete' ? 'deleted' : 'updated'}`);
      if (failed.length) toast.error(`${failed.length} failed: ${failed.slice(0, 3).map((f) => `${f.ref} (${f.error ?? 'error'})`).join(', ')}`);
      onDone();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#b2e2a8] bg-[#dcefd8] px-3 py-2">
      <span className="text-sm font-semibold text-[#177a43]">{refs.length} selected</span>
      <Select aria-label="Bulk action" value={action} onChange={(e) => setAction(e.target.value as BulkAction)} className="w-auto! py-1.5! text-xs!">
        <option value="status">Set status</option>
        <option value="assignee">Set assignee</option>
        <option value="priority">Set priority</option>
        <option value="sprint">Move to sprint</option>
        {canDelete && <option value="delete">Delete</option>}
      </Select>
      {action === 'status' && (
        <Select aria-label="New status" value={statusId} onChange={(e) => setStatusId(e.target.value)} className="w-auto! py-1.5! text-xs!">
          {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      )}
      {action === 'assignee' && (
        <div className="w-44 [&_select]:py-1.5! [&_select]:text-xs!"><AssigneeSelect value={assigneeId} onChange={setAssigneeId} /></div>
      )}
      {action === 'priority' && (
        <Select aria-label="New priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="w-auto! py-1.5! text-xs!">
          {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
        </Select>
      )}
      {action === 'sprint' && (
        <Select aria-label="Target sprint" value={sprintId} onChange={(e) => setSprintId(e.target.value)} className="w-auto! py-1.5! text-xs!">
          <option value="">Backlog</option>
          {sprints.filter((s) => s.status !== 'completed').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      )}
      <Button size="sm" variant={action === 'delete' ? 'danger' : 'primary'} loading={busy} onClick={() => void apply()}>
        {action === 'delete' ? <><Trash2 className="h-3.5 w-3.5" />Delete</> : 'Apply'}
      </Button>
      <Button size="sm" variant="ghost" onClick={onClear}>Clear selection</Button>
    </div>
  );
}

function SavedFilters({ projectId, filters, onApply }: { projectId: string; filters: Filters; onApply: (f: Filters) => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { manage } = usePerms();
  const { data, reload } = useApi<{ filters: SavedFilter[] }>('/api/saved-filters');
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const [open, setOpen] = useState(false);

  const mine = useMemo(() => (data?.filters ?? []).filter((f) => f.scope === 'tasks' && (!f.query.projectId || f.query.projectId === projectId)), [data, projectId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const query: Record<string, string> = { projectId };
      for (const [k, v] of Object.entries(filters)) if (v) query[k] = v.slice(0, 200);
      await api.post('/api/saved-filters', { name: name.trim(), scope: 'tasks', query, shared });
      toast.success('Filter saved');
      setName('');
      setOpen(false);
      reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function remove(f: SavedFilter) {
    if (!(await confirm({ title: 'Delete saved filter?', message: `“${f.name}” will be removed${f.shared ? ' for everyone it is shared with' : ''}.`, confirmLabel: 'Delete', danger: true }))) return;
    try {
      await api.del(`/api/saved-filters/${f.id}`);
      toast.success('Filter deleted');
      reload();
    } catch (err) {
      toast.error(err);
    }
  }

  const apply = (f: SavedFilter) => {
    const next = { ...EMPTY_FILTERS };
    for (const k of Object.keys(EMPTY_FILTERS) as Array<keyof Filters>) if (typeof f.query[k] === 'string') next[k] = f.query[k]!;
    onApply(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-[#5f6b64]"><Bookmark className="h-3.5 w-3.5" />Saved</span>
      {mine.length === 0 && <span className="text-xs text-[#5f6b64]">No saved filters yet</span>}
      {mine.map((f) => (
        <span key={f.id} className="inline-flex items-center overflow-hidden rounded-full border border-[#dfdbcc] bg-white text-xs">
          <button onClick={() => apply(f)} className="px-2.5 py-1 font-semibold text-[#14201a] hover:bg-[#eeebe0]" title={f.shared ? 'Shared filter' : 'Private filter'}>
            {f.name}{f.shared ? ' · shared' : ''}
          </button>
          {(f.mine || manage) && (
            <button onClick={() => void remove(f)} aria-label={`Delete saved filter ${f.name}`} className="border-l border-[#dfdbcc] px-1.5 py-1 text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626]">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      {open ? (
        <form onSubmit={save} className="flex flex-wrap items-center gap-2">
          <Input aria-label="Filter name" required maxLength={80} placeholder="Filter name" value={name} onChange={(e) => setName(e.target.value)} className="w-40! py-1! text-xs!" autoFocus />
          <label className="inline-flex items-center gap-1 text-xs text-[#3d4a42]"><input type="checkbox" className="accent-[#177a43]" checked={shared} onChange={(e) => setShared(e.target.checked)} />Share with org</label>
          <Button size="sm" type="submit" loading={saving} disabled={!name.trim()}>Save</Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button>
        </form>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Save current filters</Button>
      )}
    </div>
  );
}
