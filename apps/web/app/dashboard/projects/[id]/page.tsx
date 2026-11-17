'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { canManageWork, canWork } from '../../../../lib/permissions';
import type { MemberItem, ProjectItem, StatusCategory, StatusItem, TaskItem, TaskType } from '../../../../lib/types';
import { ErrorBanner, PageLoader, SectionCard, cn } from '../../_components/ui';
import { Avatar, CreateTaskModal, DueDate, PriorityIcon, TASK_TYPES, TypeIcon } from '../../_components/work';

type Tab = 'board' | 'backlog' | 'workflow';

const CATEGORY_LABEL: Record<StatusCategory, string> = { todo: 'To do', in_progress: 'In progress', done: 'Done' };

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const work = canWork(user?.role);
  const manage = canManageWork(user?.role);

  const [project, setProject] = useState<ProjectItem | null>(null);
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>('board');
  const [creating, setCreating] = useState<{ statusId?: string } | null>(null);
  const [assignee, setAssignee] = useState<string>('all');
  const [type, setType] = useState<TaskType | 'all'>('all');
  const [query, setQuery] = useState('');
  const [dragRef, setDragRef] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, t, m] = await Promise.all([
        api.get<{ project: ProjectItem; statuses: StatusItem[] }>(`/api/projects/${id}`),
        api.get<{ tasks: TaskItem[]; truncated: boolean }>(`/api/projects/${id}/tasks?limit=500`),
        api.get<{ members: MemberItem[] }>('/api/org/members'),
      ]);
      setProject(p.project);
      setStatuses(p.statuses);
      setTasks(t.tasks);
      setTruncated(t.truncated);
      setMembers(m.members);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (type !== 'all' && t.type !== type) return false;
      if (assignee === 'me' && t.assignee?.id !== user?.id) return false;
      if (assignee === 'none' && t.assignee) return false;
      if (/^\d+$/.test(assignee) && t.assignee?.id !== Number(assignee)) return false;
      if (q && !t.title.toLowerCase().includes(q) && !t.ref.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, type, assignee, query, user?.id]);

  async function moveTask(ref: string, statusId: string) {
    const current = tasks.find((t) => t.ref === ref);
    const target = statuses.find((s) => s.id === statusId);
    if (!current || !target || current.status.id === statusId) return;
    const previous = tasks;
    // Optimistic move; roll back if the server refuses.
    setTasks((all) => all.map((t) => (t.ref === ref ? { ...t, status: { id: target.id, name: target.name, category: target.category } } : t)));
    try {
      await api.patch(`/api/tasks/${ref}`, { statusId });
    } catch (err) {
      setTasks(previous);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not move the ticket');
    }
  }

  if (loading) return <PageLoader />;
  if (!project) return <ErrorBanner message={error ?? 'Project not found'} />;

  const epics = tasks.filter((t) => t.type === 'epic');
  const input = 'rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3 py-1.5 text-sm text-[#14201a] outline-none transition focus:border-[#177a43]';

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/projects" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5f6b64] hover:text-[#177a43] transition">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to projects
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-[#eeebe0] px-2.5 py-1 font-mono text-xs font-bold text-[#14201a]">{project.key}</span>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#14201a]">{project.name}</h1>
            {project.archived && <span className="rounded-full bg-[#fef3c7] border border-[#fde68a] px-2.5 py-0.5 text-xs text-[#92400e] font-semibold">Archived</span>}
          </div>
          {work && !project.archived && (
            <button
              onClick={() => setCreating({})}
              className="btn-kizupi-go text-sm px-4 py-2 cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Create ticket
            </button>
          )}
        </div>
        {project.description && <p className="mt-1 max-w-2xl text-sm text-[#5f6b64]">{project.description}</p>}
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="inline-flex rounded-xl bg-[#eeebe0] p-1 border border-[#dfdbcc]">
          {(['board', 'backlog', ...(manage ? (['workflow'] as const) : [])] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                'rounded-lg px-4 py-1.5 text-xs font-bold capitalize transition cursor-pointer',
                tab === t ? 'bg-white text-[#177a43] shadow-[0_1px_0_#dfdbcc] border border-[#dfdbcc]' : 'text-[#5f6b64] hover:text-[#14201a]'
              )}
            >
              {t === 'workflow' ? 'Workflow' : t}
            </button>
          ))}
        </div>
        {tab !== 'workflow' && (
          <div className="flex flex-wrap items-center gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tickets..." aria-label="Search tickets" className={cn(input, 'w-48')} />
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Filter by assignee" className={input}>
              <option value="all">Everyone</option>
              <option value="me">Assigned to me</option>
              <option value="none">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>{m.name || m.email}</option>
              ))}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value as TaskType | 'all')} aria-label="Filter by type" className={input}>
              <option value="all">All types</option>
              {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}
      </div>

      {truncated && (
        <p className="text-xs text-[#b45309]">Showing the 500 newest tickets. Use filters to narrow the list.</p>
      )}

      {tab === 'board' && (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex min-w-max gap-4">
            {statuses.map((s) => {
              const column = visible.filter((t) => t.status.id === s.id);
              const isOver = overStatus === s.id;
              return (
                <section
                  key={s.id}
                  aria-label={`${s.name} column`}
                  onDragOver={(e) => {
                    if (work && dragRef) {
                      e.preventDefault();
                      setOverStatus(s.id);
                    }
                  }}
                  onDragLeave={() => setOverStatus((o) => (o === s.id ? null : o))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOverStatus(null);
                    if (dragRef) void moveTask(dragRef, s.id);
                    setDragRef(null);
                  }}
                  className={cn(
                    'w-76 shrink-0 rounded-2xl bg-[#eeebe0]/50 border border-[#dfdbcc] p-3 transition-all',
                    isOver && 'ring-2 ring-[#177a43] bg-[#dcefd8]/30'
                  )}
                >
                  <header className="mb-3 flex items-center justify-between px-1">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#3d4a42]">
                      {s.name} <span className="ml-1 text-xs font-semibold text-[#5f6b64]">({column.length})</span>
                    </h2>
                    {work && !project.archived && (
                      <button onClick={() => setCreating({ statusId: s.id })} aria-label={`Add ticket to ${s.name}`} className="rounded-lg p-1 text-[#5f6b64] hover:bg-[#eeebe0] transition cursor-pointer">
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </header>
                  <div className="space-y-2.5">
                    {column.map((t) => (
                      <article
                        key={t.id}
                        draggable={work}
                        onDragStart={() => setDragRef(t.ref)}
                        onDragEnd={() => {
                          setDragRef(null);
                          setOverStatus(null);
                        }}
                        className={cn(
                          'rounded-xl border border-[#dfdbcc] bg-white p-3.5 shadow-[0_2px_0_#dfdbcc] transition hover:-translate-y-0.5 hover:shadow-[0_4px_0_#dfdbcc]',
                          work && 'cursor-grab active:cursor-grabbing',
                          dragRef === t.ref && 'opacity-40'
                        )}
                      >
                        <Link href={`/dashboard/tasks/${t.ref}`} className="block text-sm font-bold text-[#14201a] hover:text-[#177a43] transition">
                          {t.title}
                        </Link>
                        {t.labels.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {t.labels.map((l) => (
                              <span key={l} className="rounded-md bg-[#eeebe0] px-1.5 py-0.5 text-[10px] text-[#3d4a42] font-semibold">{l}</span>
                            ))}
                          </div>
                        )}
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <TypeIcon type={t.type} />
                            <span className="font-mono text-xs font-semibold text-[#5f6b64]">{t.ref}</span>
                            <PriorityIcon priority={t.priority} />
                          </div>
                          <div className="flex items-center gap-2">
                            <DueDate iso={t.dueDate} done={t.status.category === 'done'} />
                            {t.assignee && <Avatar name={t.assignee.name} size={22} />}
                          </div>
                        </div>
                        {work && (
                          <select
                            aria-label={`Move ${t.ref} to another status`}
                            value={t.status.id}
                            onChange={(e) => void moveTask(t.ref, e.target.value)}
                            className="mt-2 w-full rounded-lg border border-[#dfdbcc] bg-[#fbfaf6] px-2 py-1 text-xs text-[#3d4a42] outline-none cursor-pointer"
                          >
                            {statuses.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                          </select>
                        )}
                      </article>
                    ))}
                    {column.length === 0 && (
                      <div className="rounded-xl border-2 border-dashed border-[#dfdbcc] p-6 text-center text-xs text-[#5f6b64]">
                        No tickets
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'backlog' && (
        <SectionCard className="overflow-hidden p-0">
          {visible.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#5f6b64]">No tickets match. {work && 'Create the first one with “Create ticket”.'}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#dfdbcc] bg-[#fbfaf6] text-xs font-bold uppercase tracking-wide text-[#5f6b64]">
                    <th className="px-5 py-3 font-semibold">Ticket</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Priority</th>
                    <th className="px-3 py-3 font-semibold">Assignee</th>
                    <th className="px-5 py-3 font-semibold">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dfdbcc]/50">
                  {visible.map((t) => (
                    <tr key={t.id} className="hover:bg-[#f6f4ec] transition">
                      <td className="px-5 py-3.5">
                        <Link href={`/dashboard/tasks/${t.ref}`} className="flex items-center gap-2">
                          <TypeIcon type={t.type} />
                          <span className="font-mono text-xs font-bold text-[#5f6b64]">{t.ref}</span>
                          <span className="font-semibold text-[#14201a] hover:text-[#177a43] transition">{t.title}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-3.5 text-xs font-semibold text-[#3d4a42]">{t.status.name}</td>
                      <td className="px-3 py-3.5"><PriorityIcon priority={t.priority} withLabel /></td>
                      <td className="px-3 py-3.5">
                        {t.assignee ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#14201a]"><Avatar name={t.assignee.name} size={20} />{t.assignee.name}</span>
                        ) : (
                          <span className="text-xs text-[#5f6b64]">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5"><DueDate iso={t.dueDate} done={t.status.category === 'done'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {tab === 'workflow' && manage && (
        <WorkflowEditor project={project} statuses={statuses} onChanged={load} onError={setError} />
      )}

      {creating && (
        <CreateTaskModal
          projectId={project.id}
          statuses={statuses}
          defaultStatusId={creating.statusId}
          epics={epics}
          onClose={() => setCreating(null)}
          onCreated={(t) => {
            setCreating(null);
            setTasks((all) => [t, ...all]);
          }}
        />
      )}
    </div>
  );
}

function WorkflowEditor({
  project,
  statuses,
  onChanged,
  onError,
}: {
  project: ProjectItem;
  statuses: StatusItem[];
  onChanged: () => Promise<void>;
  onError: (m: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<StatusCategory>('in_progress');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    onError(null);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      onError(err instanceof ApiError || err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const base = `/api/projects/${project.id}`;
  const swap = (a: StatusItem, b: StatusItem) =>
    run(async () => {
      await api.patch(`${base}/statuses/${a.id}`, { position: b.position });
      await api.patch(`${base}/statuses/${b.id}`, { position: a.position });
    });

  return (
    <div className="space-y-5">
      <SectionCard title="Workflow statuses" subtitle="Tickets move left to right across these columns. “Done” category statuses count as finished.">
        <ul className="divide-y divide-[#dfdbcc]/50">
          {statuses.map((s, i) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
              <input
                aria-label={`Name of ${s.name}`}
                defaultValue={s.name}
                maxLength={40}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== s.name) void run(() => api.patch(`${base}/statuses/${s.id}`, { name: v }));
                }}
                className="min-w-0 flex-1 rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3 py-1.5 text-sm text-[#14201a] outline-none focus:border-[#177a43]"
              />
              <select
                aria-label={`Category of ${s.name}`}
                value={s.category}
                disabled={busy}
                onChange={(e) => void run(() => api.patch(`${base}/statuses/${s.id}`, { category: e.target.value }))}
                className="rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-2.5 py-1.5 text-sm text-[#14201a] outline-none focus:border-[#177a43]"
              >
                {(Object.keys(CATEGORY_LABEL) as StatusCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
              <button disabled={busy || i === 0} onClick={() => void swap(s, statuses[i - 1]!)} aria-label={`Move ${s.name} up`} className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#eeebe0] disabled:opacity-30 cursor-pointer">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button disabled={busy || i === statuses.length - 1} onClick={() => void swap(s, statuses[i + 1]!)} aria-label={`Move ${s.name} down`} className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#eeebe0] disabled:opacity-30 cursor-pointer">
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                disabled={busy}
                onClick={() => window.confirm(`Delete the “${s.name}” status?`) && void run(() => api.del(`${base}/statuses/${s.id}`))}
                aria-label={`Delete ${s.name}`}
                className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626] transition cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api.post(`${base}/statuses`, { name, category });
              setName('');
            });
          }}
          className="mt-5 flex flex-wrap items-end gap-2.5"
        >
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="new-status" className="mb-1 block text-xs font-semibold text-[#14201a]">New column status</label>
            <input id="new-status" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. In QA, Blocked" className="w-full rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3 py-2 text-sm text-[#14201a] outline-none focus:border-[#177a43]" />
          </div>
          <select aria-label="Category of new status" value={category} onChange={(e) => setCategory(e.target.value as StatusCategory)} className="rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3 py-2 text-sm text-[#14201a] outline-none focus:border-[#177a43]">
            {(Object.keys(CATEGORY_LABEL) as StatusCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
          <button type="submit" disabled={busy} className="btn-kizupi-go text-sm px-4 py-2 cursor-pointer disabled:opacity-60">Add status</button>
        </form>
      </SectionCard>

      <SectionCard title="Project settings" subtitle="Archived projects stay readable but no new tickets can be raised.">
        <button
          disabled={busy}
          onClick={() => void run(() => api.patch(base, { archived: !project.archived }))}
          className="btn-kizupi-white text-sm px-4 py-2 cursor-pointer disabled:opacity-60"
        >
          {project.archived ? 'Restore project' : 'Archive project'}
        </button>
      </SectionCard>
    </div>
  );
}
