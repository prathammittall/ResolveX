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
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-serif-title text-2xl font-semibold text-[#171a1f] dark:text-white">My work</h1>
          <p className="mt-1 text-sm text-[#574f47] dark:text-zinc-400">Tickets assigned to you across all projects.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-[#574f47] dark:text-zinc-400">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-[#ff5414]" />
          Include finished
        </label>
      </div>
      {error && <ErrorBanner message={error} />}

      {shown.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={tasks.length === 0 ? 'Nothing assigned to you' : 'All caught up'}
          description={tasks.length === 0 ? 'When an admin assigns you a ticket, it shows up here.' : 'Every ticket assigned to you is finished.'}
        />
      ) : (
        [...byProject.entries()].map(([key, list]) => (
          <SectionCard key={key} title={key} subtitle={`${list.length} ticket${list.length === 1 ? '' : 's'}`}>
            <ul className="-my-2 divide-y divide-[#cbbaa9]/20 dark:divide-white/5">
              {list.map((t) => (
                <li key={t.id}>
                  <Link href={`/dashboard/tasks/${t.ref}`} className="flex items-center justify-between gap-3 py-3 hover:bg-[#cbbaa9]/20 dark:hover:bg-white/5 transition rounded-lg px-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <TypeIcon type={t.type} />
                      <span className="font-mono text-xs text-[#574f47] dark:text-zinc-400">{t.ref}</span>
                      <span className="truncate text-sm font-medium text-[#171a1f] dark:text-white hover:text-[#ff5414] transition">{t.title}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <DueDate iso={t.dueDate} done={t.status.category === 'done'} />
                      <PriorityIcon priority={t.priority} />
                      <span className="rounded-full bg-[#e2cfc0] dark:bg-white/10 px-2 py-0.5 text-xs text-[#171a1f] dark:text-zinc-300 font-medium">{t.status.name}</span>
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
