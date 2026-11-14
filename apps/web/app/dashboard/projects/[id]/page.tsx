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
  const input = 'rounded-lg border border-[#cbbaa9] dark:border-white/10 bg-[#eedccb]/60 dark:bg-zinc-900 px-2.5 py-1.5 text-sm text-[#171a1f] dark:text-white outline-none focus:border-[#ff5414]';

  return (
    <div className="space-y-5">
      <div>
        <Link href="/dashboard/projects" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#574f47] dark:text-zinc-400 hover:text-[#171a1f] dark:hover:text-white transition">
          <ArrowLeft className="h-4 w-4" /> Projects
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-[#cbbaa9]/40 dark:bg-white/10 px-2 py-0.5 font-mono text-xs font-semibold text-[#171a1f] dark:text-zinc-300">{project.key}</span>
            <h1 className="font-serif-title text-2xl font-semibold text-[#171a1f] dark:text-white">{project.name}</h1>
            {project.archived && <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-300 font-medium">Archived</span>}
          </div>
          {work && !project.archived && (
            <button
              onClick={() => setCreating({})}
              className="inline-flex items-center gap-2 rounded-xl bg-[#171a1f] dark:bg-[#ff5414] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2b2f38] dark:hover:bg-[#ff6830] transition shadow-xs"
            >
              <Plus className="h-4 w-4" />
              Create ticket
            </button>
          )}
        </div>
        {project.description && <p className="mt-1 max-w-2xl text-sm text-[#574f47] dark:text-zinc-400">{project.description}</p>}
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="inline-flex rounded-xl bg-[#cbbaa9]/40 dark:bg-white/5 p-1 border border-[#cbbaa9]/30 dark:border-white/5">
          {(['board', 'backlog', ...(manage ? (['workflow'] as const) : [])] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn('rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition', tab === t ? 'bg-[#eedccb] dark:bg-white/15 text-[#171a1f] dark:text-white shadow-xs font-semibold' : 'text-[#574f47] dark:text-zinc-400 hover:text-[#171a1f] dark:hover:text-white')}
            >
              {t === 'workflow' ? 'Workflow' : t}
            </button>
          ))}
        </div>
        {tab !== 'workflow' && (
          <div className="flex flex-wrap items-center gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tickets" aria-label="Search tickets" className={cn(input, 'w-44 placeholder-[#574f47]/50 dark:placeholder-zinc-500')} />
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
        <p className="text-xs text-amber-700 dark:text-amber-400">Showing the 500 newest tickets. Use filters to narrow the list.</p>
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
                  className={cn('w-72 shrink-0 rounded-2xl bg-[#eedccb]/50 dark:bg-[#12131a] border border-[#cbbaa9]/50 dark:border-white/10 p-3 transition', isOver && 'ring-2 ring-[#ff5414]/50 bg-[#eedccb]/80 dark:bg-[#181a24]')}
                >
                  <header className="mb-3 flex items-center justify-between px-1">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#574f47] dark:text-zinc-400">
                      {s.name} <span className="ml-1 font-normal opacity-70">({column.length})</span>
                    </h2>
                    {work && !project.archived && (
                      <button onClick={() => setCreating({ statusId: s.id })} aria-label={`Add ticket to ${s.name}`} className="rounded p-1 text-[#574f47] dark:text-zinc-400 hover:bg-[#cbbaa9]/30 dark:hover:bg-white/10 transition">
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </header>
                  <div className="space-y-2">
                    {column.map((t) => (
                      <article
                        key={t.id}
                        draggable={work}
                        onDragStart={() => setDragRef(t.ref)}
                        onDragEnd={() => {
                          setDragRef(null);
                          setOverStatus(null);
                        }}
                        className={cn('rounded-xl border border-[#cbbaa9] dark:border-white/10 bg-[#faefe3] dark:bg-[#1a1b24] p-3 shadow-xs transition hover:border-[#171a1f]/30 dark:hover:border-white/20', work && 'cursor-grab active:cursor-grabbing', dragRef === t.ref && 'opacity-50')}
                      >
                        <Link href={`/dashboard/tasks/${t.ref}`} className="block text-sm font-medium text-[#171a1f] dark:text-zinc-100 hover:text-[#ff5414] transition">
                          {t.title}
                        </Link>
                        {t.labels.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {t.labels.map((l) => <span key={l} className="rounded bg-[#eedccb] dark:bg-white/10 px-1.5 py-0.5 text-[11px] text-[#574f47] dark:text-zinc-300 font-medium">{l}</span>)}
                          </div>
                        )}
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TypeIcon type={t.type} />
                            <span className="font-mono text-xs text-[#574f47]/70 dark:text-zinc-400">{t.ref}</span>
                            <PriorityIcon priority={t.priority} />
                          </div>
                          <div className="flex items-center gap-2">
                            <DueDate iso={t.dueDate} done={t.status.category === 'done'} />
                            {t.assignee && <Avatar name={t.assignee.name} />}
                          </div>
                        </div>
                        {work && (
                          <select
                            aria-label={`Move ${t.ref} to another status`}
                            value={t.status.id}
                            onChange={(e) => void moveTask(t.ref, e.target.value)}
                            className="mt-2 w-full rounded-md border border-[#cbbaa9]/60 dark:border-white/10 bg-[#eedccb]/50 dark:bg-zinc-800 px-1.5 py-1 text-xs text-[#574f47] dark:text-zinc-300 outline-none"
                          >
                            {statuses.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                          </select>
                        )}
                      </article>
                    ))}
                    {column.length === 0 && <p className="px-1 py-6 text-center text-xs text-[#574f47]/60 dark:text-zinc-500">No tickets</p>}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'backlog' && (
        <SectionCard className="overflow-hidden">
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#574f47] dark:text-zinc-400">No tickets match. {work && 'Create the first one with “Create ticket”.'}</p>
          ) : (
            <div className="-mx-5 -my-5 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#cbbaa9]/30 dark:border-white/10 text-xs uppercase tracking-wide text-[#574f47] dark:text-zinc-400">
                    <th className="px-5 py-2.5 font-medium">Ticket</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Priority</th>
                    <th className="px-3 py-2.5 font-medium">Assignee</th>
                    <th className="px-5 py-2.5 font-medium">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#cbbaa9]/20 dark:divide-white/5">
                  {visible.map((t) => (
                    <tr key={t.id} className="hover:bg-[#cbbaa9]/20 dark:hover:bg-white/5 transition">
                      <td className="px-5 py-3">
                        <Link href={`/dashboard/tasks/${t.ref}`} className="flex items-center gap-2">
                          <TypeIcon type={t.type} />
                          <span className="font-mono text-xs text-[#574f47] dark:text-zinc-400">{t.ref}</span>
                          <span className="font-medium text-[#171a1f] dark:text-white hover:text-[#ff5414] transition">{t.title}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-[#574f47] dark:text-zinc-300">{t.status.name}</td>
                      <td className="px-3 py-3"><PriorityIcon priority={t.priority} withLabel /></td>
                      <td className="px-3 py-3">
                        {t.assignee ? (
                          <span className="inline-flex items-center gap-2 text-[#171a1f] dark:text-zinc-200"><Avatar name={t.assignee.name} />{t.assignee.name}</span>
                        ) : (
                          <span className="text-[#574f47]/70 dark:text-zinc-500">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3"><DueDate iso={t.dueDate} done={t.status.category === 'done'} /></td>
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
        <ul className="divide-y divide-[#cbbaa9]/20 dark:divide-white/5">
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
                className="min-w-0 flex-1 rounded-lg border border-[#cbbaa9] dark:border-white/10 bg-[#eedccb]/60 dark:bg-zinc-900 px-2.5 py-1.5 text-sm text-[#171a1f] dark:text-white outline-none focus:border-[#ff5414]"
              />
              <select
                aria-label={`Category of ${s.name}`}
                value={s.category}
                disabled={busy}
                onChange={(e) => void run(() => api.patch(`${base}/statuses/${s.id}`, { category: e.target.value }))}
                className="rounded-lg border border-[#cbbaa9] dark:border-white/10 bg-[#eedccb]/60 dark:bg-zinc-900 px-2 py-1.5 text-sm text-[#171a1f] dark:text-white outline-none focus:border-[#ff5414]"
              >
                {(Object.keys(CATEGORY_LABEL) as StatusCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
              <button disabled={busy || i === 0} onClick={() => void swap(s, statuses[i - 1]!)} aria-label={`Move ${s.name} up`} className="rounded p-1.5 text-[#574f47] dark:text-zinc-400 hover:bg-[#cbbaa9]/30 dark:hover:bg-white/10 disabled:opacity-30">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button disabled={busy || i === statuses.length - 1} onClick={() => void swap(s, statuses[i + 1]!)} aria-label={`Move ${s.name} down`} className="rounded p-1.5 text-[#574f47] dark:text-zinc-400 hover:bg-[#cbbaa9]/30 dark:hover:bg-white/10 disabled:opacity-30">
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                disabled={busy}
                onClick={() => window.confirm(`Delete the “${s.name}” status?`) && void run(() => api.del(`${base}/statuses/${s.id}`))}
                aria-label={`Delete ${s.name}`}
                className="rounded p-1.5 text-[#574f47] dark:text-zinc-400 hover:bg-rose-500/10 hover:text-rose-600 transition"
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
          className="mt-4 flex flex-wrap items-end gap-2"
        >
          <div className="min-w-[10rem] flex-1">
            <label htmlFor="new-status" className="mb-1 block text-sm font-medium text-[#171a1f] dark:text-zinc-200">New status</label>
            <input id="new-status" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Blocked" className="w-full rounded-lg border border-[#cbbaa9] dark:border-white/10 bg-[#eedccb]/60 dark:bg-zinc-900 px-3 py-2 text-sm text-[#171a1f] dark:text-white outline-none focus:border-[#ff5414]" />
          </div>
          <select aria-label="Category of new status" value={category} onChange={(e) => setCategory(e.target.value as StatusCategory)} className="rounded-lg border border-[#cbbaa9] dark:border-white/10 bg-[#eedccb]/60 dark:bg-zinc-900 px-2 py-2 text-sm text-[#171a1f] dark:text-white outline-none focus:border-[#ff5414]">
            {(Object.keys(CATEGORY_LABEL) as StatusCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
          <button type="submit" disabled={busy} className="rounded-xl bg-[#171a1f] dark:bg-[#ff5414] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2b2f38] dark:hover:bg-[#ff6830] transition shadow-xs disabled:opacity-60">Add status</button>
        </form>
      </SectionCard>

      <SectionCard title="Project" subtitle="Archived projects stay readable but no new tickets can be raised.">
        <button
          disabled={busy}
          onClick={() => void run(() => api.patch(base, { archived: !project.archived }))}
          className="rounded-xl border border-[#cbbaa9] dark:border-white/10 bg-[#eedccb]/70 dark:bg-zinc-900 px-4 py-2 text-sm font-medium text-[#171a1f] dark:text-zinc-200 hover:bg-[#cbbaa9]/30 dark:hover:bg-white/10 transition disabled:opacity-60"
        >
          {project.archived ? 'Restore project' : 'Archive project'}
        </button>
      </SectionCard>
    </div>
  );
}
