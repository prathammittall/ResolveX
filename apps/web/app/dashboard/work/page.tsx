'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, CalendarDays, ClipboardList } from 'lucide-react';
import type { TaskItem } from '../../../lib/types';
import { PageHeader, Select, Skeleton, SkeletonRows, Tabs, useApi } from '../_components/kit';
import { EmptyState, ErrorBanner, cn, formatDateTime, timeAgo } from '../_components/ui';
import { Avatar, DueDate, PriorityIcon, TypeIcon } from '../_components/work';

type Task = TaskItem & { storyPoints: number | null; sprintId: string | null };
type TabId = 'assigned' | 'created' | 'watching' | 'overdue' | 'recent';
type Sort = 'updated' | 'created' | 'due' | 'priority' | 'number';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const TABS: Array<{ id: TabId; label: string; description: string; empty: string }> = [
  { id: 'assigned', label: 'Assigned to me', description: 'Tickets you own', empty: 'Nothing is assigned to you.' },
  { id: 'created', label: 'Created by me', description: 'Tickets you reported', empty: 'You have not created any tickets yet.' },
  { id: 'watching', label: 'Watching', description: 'Tickets you follow', empty: 'You are not watching any tickets. Use “Watch” on a ticket to follow it.' },
  { id: 'overdue', label: 'Overdue', description: 'Your open tickets past their due date', empty: 'Nothing overdue. Nice work.' },
  { id: 'recent', label: 'Recently updated', description: 'Tickets changed in the last 7 days', empty: 'No tickets were updated in the last 7 days.' },
];
const DEFAULT_SORT: Record<TabId, { sort: Sort; order: 'asc' | 'desc' }> = {
  assigned: { sort: 'updated', order: 'desc' },
  created: { sort: 'created', order: 'desc' },
  watching: { sort: 'updated', order: 'desc' },
  overdue: { sort: 'due', order: 'asc' },
  recent: { sort: 'updated', order: 'desc' },
};

function qs(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') sp.set(k, String(v));
  return sp.toString();
}

export default function MyWorkPage() {
  const [tab, setTab] = useState<TabId>('assigned');
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT.assigned.sort);
  const [order, setOrder] = useState<'asc' | 'desc'>(DEFAULT_SORT.assigned.order);
  const [hideDone, setHideDone] = useState(true);
  // Fixed once per page load so the request URL stays stable between renders.
  const [since] = useState(() => new Date(Date.now() - 7 * 86_400_000).toISOString());

  const scope: Record<string, string> =
    tab === 'assigned' ? { assignee: 'me' } : tab === 'created' ? { reporter: 'me' } : tab === 'watching' ? { watching: 'me' } : tab === 'overdue' ? { assignee: 'me', overdue: 'true' } : { updatedSince: since };
  const statusCategory = hideDone && tab !== 'overdue' && tab !== 'recent' ? 'open' : undefined;
  const { data, error, loading } = useApi<{ tasks: Task[]; truncated: boolean; total: number }>(`/api/tasks?${qs({ ...scope, statusCategory, sort, order, limit: 200 })}`);

  const changeTab = (t: TabId) => {
    setTab(t);
    setSort(DEFAULT_SORT[t].sort);
    setOrder(DEFAULT_SORT[t].order);
  };
  const toggleSort = (s: Sort) => {
    if (s === sort) setOrder(order === 'asc' ? 'desc' : 'asc');
    else {
      setSort(s);
      setOrder(s === 'due' ? 'asc' : 'desc');
    }
  };
  const meta = TABS.find((t) => t.id === tab)!;
  const tasks = data?.tasks ?? [];

  const SortTh = ({ s, children, className }: { s?: Sort; children: React.ReactNode; className?: string }) => (
    <th className={cn('px-3 py-2.5 font-semibold', className)} aria-sort={s && s === sort ? (order === 'asc' ? 'ascending' : 'descending') : undefined}>
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
    <div className="space-y-6">
      <PageHeader title="My work" description="Everything on your plate across projects." />

      <DueThisWeek />

      <div className="space-y-4">
        <Tabs tabs={TABS.map(({ id, label }) => ({ id, label }))} value={tab} onChange={changeTab} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#5f6b64]">{meta.description}{data ? ` · ${tasks.length}${data.truncated ? '+' : ''} tickets` : ''}</p>
          <div className="flex flex-wrap items-center gap-2">
            {tab !== 'overdue' && tab !== 'recent' && (
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3d4a42]">
                <input type="checkbox" className="accent-[#177a43]" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
                Hide finished
              </label>
            )}
            <Select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="w-auto! py-1.5! text-xs!">
              <option value="updated">Last updated</option>
              <option value="created">Created</option>
              <option value="due">Due date</option>
              <option value="priority">Priority</option>
              <option value="number">Ticket number</option>
            </Select>
            <button onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')} aria-label={`Sort ${order === 'asc' ? 'descending' : 'ascending'}`} className="rounded-lg border border-[#dfdbcc] bg-white p-1.5 text-[#3d4a42] hover:bg-[#eeebe0]">
              {order === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {error && <ErrorBanner message={error} />}
        {loading && !data ? (
          <div className="rounded-2xl border border-[#dfdbcc] bg-white p-5"><SkeletonRows rows={6} /></div>
        ) : tasks.length === 0 ? (
          <EmptyState icon={ClipboardList} title="All clear" description={meta.empty} />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc]">
            <div className="overflow-x-auto">
              <table className={cn('w-full min-w-[760px] text-left text-sm', loading && 'opacity-60')}>
                <thead>
                  <tr className="border-b border-[#dfdbcc] bg-[#fbfaf6] text-xs uppercase tracking-wide text-[#5f6b64]">
                    <SortTh s="number">Ticket</SortTh>
                    <SortTh>Status</SortTh>
                    <SortTh s="priority">Priority</SortTh>
                    <SortTh>Assignee</SortTh>
                    <SortTh s="due">Due</SortTh>
                    <SortTh s="updated">Updated</SortTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dfdbcc]">
                  {tasks.map((t) => (
                    <tr key={t.id} className="hover:bg-[#fbfaf6]">
                      <td className="px-3 py-2.5">
                        <Link href={`/dashboard/tasks/${t.ref}`} className="flex items-center gap-2">
                          <TypeIcon type={t.type} />
                          <span className="font-mono text-xs font-bold text-[#5f6b64]">{t.ref}</span>
                          <span className="font-semibold text-[#14201a] hover:text-[#177a43]">{t.title}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', t.status.category === 'done' ? 'border-[#b2e2a8] bg-[#dcefd8] text-[#177a43]' : t.status.category === 'in_progress' ? 'border-[#fde68a] bg-[#fef3c7] text-[#92400e]' : 'border-[#dfdbcc] bg-[#f6f4ec] text-[#3d4a42]')}>{t.status.name}</span>
                      </td>
                      <td className="px-3 py-2.5"><PriorityIcon priority={t.priority} withLabel /></td>
                      <td className="px-3 py-2.5">
                        {t.assignee ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#14201a]"><Avatar name={t.assignee.name} size={20} />{t.assignee.name}</span> : <span className="text-xs text-[#5f6b64]">Unassigned</span>}
                      </td>
                      <td className="px-3 py-2.5">{t.dueDate ? <DueDate iso={t.dueDate} done={t.status.category === 'done'} /> : <span className="text-xs text-[#5f6b64]">—</span>}</td>
                      <td className="px-3 py-2.5 text-xs text-[#5f6b64]" title={formatDateTime(t.updatedAt)}>{timeAgo(t.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data?.truncated && <p className="border-t border-[#dfdbcc] px-4 py-2 text-xs text-[#5f6b64]">Showing the first 200 tickets.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Seven-day strip (Mon–Sun of this week) of open tickets assigned to me, placed by due date. */
function DueThisWeek() {
  const days = useMemo(() => {
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
  }, []);
  const from = `${ymd(days[0]!)}T00:00:00.000Z`;
  const to = `${ymd(days[6]!)}T23:59:59.999Z`;
  const { data, error, loading } = useApi<{ tasks: Task[] }>(`/api/tasks?${qs({ assignee: 'me', statusCategory: 'open', dueFrom: from, dueTo: to, sort: 'due', order: 'asc', limit: 200 })}`);
  const today = ymd(new Date());

  return (
    <section aria-label="Due this week" className="rounded-2xl border border-[#dfdbcc] bg-white p-4 shadow-[0_2px_0_#dfdbcc]">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-[#177a43]" />
        <h2 className="font-display text-base font-bold text-[#14201a]">Due this week</h2>
        {data && <span className="text-xs text-[#5f6b64]">{data.tasks.length} open</span>}
      </div>
      {error ? (
        <ErrorBanner message={error} />
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[640px] grid-cols-7 gap-2">
            {days.map((d) => {
              const key = ymd(d);
              const list = (data?.tasks ?? []).filter((t) => t.dueDate?.slice(0, 10) === key);
              return (
                <div key={key} className={cn('min-h-[88px] rounded-xl border p-2', key === today ? 'border-[#b2e2a8] bg-[#dcefd8]' : 'border-[#dfdbcc] bg-[#fbfaf6]')}>
                  <div className={cn('mb-1.5 text-xs font-bold', key === today ? 'text-[#177a43]' : 'text-[#5f6b64]')}>
                    {d.toLocaleDateString(undefined, { weekday: 'short' })} {d.getDate()}
                  </div>
                  {loading && !data ? (
                    <Skeleton className="h-3" />
                  ) : list.length === 0 ? (
                    <span className="text-[11px] text-[#5f6b64]">—</span>
                  ) : (
                    <ul className="space-y-1">
                      {list.slice(0, 3).map((t) => (
                        <li key={t.id}>
                          <Link href={`/dashboard/tasks/${t.ref}`} title={`${t.ref} · ${t.title}`} className="flex items-center gap-1 truncate rounded-md border border-[#dfdbcc] bg-white px-1 py-0.5 text-[11px] font-semibold text-[#14201a] hover:bg-[#eeebe0]">
                            <PriorityIcon priority={t.priority} />
                            <span className="truncate">{t.ref}</span>
                          </Link>
                        </li>
                      ))}
                      {list.length > 3 && <li className="text-[11px] font-semibold text-[#5f6b64]">+{list.length - 3} more</li>}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
