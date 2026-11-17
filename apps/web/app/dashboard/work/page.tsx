'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { api } from '../../../lib/api';
import type { TaskItem } from '../../../lib/types';
import { EmptyState, ErrorBanner, PageLoader, SectionCard } from '../_components/ui';
import { DueDate, PriorityIcon, TypeIcon } from '../_components/work';

export default function MyWorkPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    api
      .get<{ tasks: TaskItem[] }>('/api/tasks?assignee=me&limit=500')
      .then((r) => setTasks(r.tasks))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load your work'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  const open = tasks.filter((t) => t.status.category !== 'done');
  const shown = showDone ? tasks : open;
  const byProject = new Map<string, TaskItem[]>();
  for (const t of shown) byProject.set(t.projectKey, [...(byProject.get(t.projectKey) ?? []), t]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dfdbcc] pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#14201a]">My work</h1>
          <p className="mt-1 text-sm text-[#5f6b64]">Tickets currently assigned to you across all projects and services.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-[#3d4a42] cursor-pointer">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-[#177a43] rounded" />
          Include finished
        </label>
      </div>
      {error && <ErrorBanner message={error} />}

      {shown.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={tasks.length === 0 ? 'Nothing assigned to you' : 'All caught up!'}
          description={tasks.length === 0 ? 'When tickets or incident actions are assigned to you, they will appear here.' : 'Every ticket assigned to you has been completed.'}
        />
      ) : (
        [...byProject.entries()].map(([key, list]) => (
          <SectionCard key={key} title={key} subtitle={`${list.length} ticket${list.length === 1 ? '' : 's'}`}>
            <ul className="-my-2 divide-y divide-[#dfdbcc]/50">
              {list.map((t) => (
                <li key={t.id}>
                  <Link href={`/dashboard/tasks/${t.ref}`} className="flex items-center justify-between gap-3 py-3 hover:bg-[#f6f4ec] transition rounded-xl px-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <TypeIcon type={t.type} />
                      <span className="font-mono text-xs font-bold text-[#5f6b64]">{t.ref}</span>
                      <span className="truncate text-sm font-bold text-[#14201a] hover:text-[#177a43] transition">{t.title}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <DueDate iso={t.dueDate} done={t.status.category === 'done'} />
                      <PriorityIcon priority={t.priority} />
                      <span className="rounded-full bg-[#eeebe0] px-2.5 py-0.5 text-xs text-[#14201a] font-semibold border border-[#dfdbcc]">{t.status.name}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </SectionCard>
        ))
      )}
    </div>
  );
}
