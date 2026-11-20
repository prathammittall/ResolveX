'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Skeleton, useApi } from '../../_components/kit';
import { ErrorBanner, cn } from '../../_components/ui';
import { PriorityIcon } from '../../_components/work';
import { toQuery, type Project, type TaskList } from './_shared';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Month grid of tickets by due date (due dates are stored as UTC midnight, so compare by YYYY-MM-DD). */
export function CalendarTab({ project }: { project: Project }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
  const from = `${ymd(cursor.y, cursor.m, 1)}T00:00:00.000Z`;
  const to = `${ymd(cursor.y, cursor.m, daysInMonth)}T23:59:59.999Z`;
  const { data, error, loading } = useApi<TaskList>(`/api/projects/${project.id}/tasks${toQuery({ dueFrom: from, dueTo: to, sort: 'due', order: 'asc', limit: 500 })}`);

  const byDay = useMemo(() => {
    const map = new Map<string, TaskList['tasks']>();
    for (const t of data?.tasks ?? []) {
      if (!t.dueDate) continue;
      const k = t.dueDate.slice(0, 10);
      map.set(k, [...(map.get(k) ?? []), t]);
    }
    return map;
  }, [data]);

  const lead = (new Date(Date.UTC(cursor.y, cursor.m, 1)).getUTCDay() + 6) % 7; // Monday-first offset
  const cells: Array<number | null> = [...Array.from({ length: lead }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const today = ymd(now.getFullYear(), now.getMonth(), now.getDate());
  const shift = (d: number) => setCursor((c) => {
    const n = new Date(c.y, c.m + d, 1);
    return { y: n.getFullYear(), m: n.getMonth() };
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="secondary" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="secondary" onClick={() => shift(1)} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })}>Today</Button>
          <h3 className="ml-2 font-display text-lg font-bold text-[#14201a]">
            {new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </h3>
        </div>
        <span className="text-xs text-[#5f6b64]">{loading ? 'Loading…' : `${data?.tasks.length ?? 0} tickets due this month`}</span>
      </div>
      {error && <ErrorBanner message={error} />}
      {data?.truncated && <p className="text-xs text-[#92400e]">Only the first 500 tickets due this month are shown.</p>}
      <div className="overflow-x-auto rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc]">
        <div className="grid min-w-[700px] grid-cols-7">
          {WEEKDAYS.map((d) => <div key={d} className="border-b border-[#dfdbcc] bg-[#fbfaf6] px-2 py-1.5 text-xs font-bold uppercase text-[#5f6b64]">{d}</div>)}
          {cells.map((day, i) => {
            const key = day ? ymd(cursor.y, cursor.m, day) : `pad-${i}`;
            const list = day ? (byDay.get(key) ?? []) : [];
            return (
              <div key={key} className={cn('min-h-[104px] border-b border-r border-[#dfdbcc] p-1.5', !day && 'bg-[#f6f4ec]', key === today && 'bg-[#dcefd8]')}>
                {day && (
                  <>
                    <div className={cn('mb-1 text-xs font-semibold', key === today ? 'text-[#177a43]' : 'text-[#5f6b64]')}>{day}</div>
                    {loading && !data ? (
                      <Skeleton className="h-3" />
                    ) : (
                      <ul className="space-y-1">
                        {list.slice(0, 4).map((t) => (
                          <li key={t.id}>
                            <Link
                              href={`/dashboard/tasks/${t.ref}`}
                              title={`${t.ref} · ${t.title}`}
                              className={cn('flex items-center gap-1 truncate rounded-md border px-1 py-0.5 text-[11px] font-semibold', t.status.category === 'done' ? 'border-[#b2e2a8] bg-[#dcefd8] text-[#177a43] line-through' : 'border-[#dfdbcc] bg-[#fbfaf6] text-[#14201a] hover:bg-[#eeebe0]')}
                            >
                              <PriorityIcon priority={t.priority} />
                              <span className="truncate">{t.ref} {t.title}</span>
                            </Link>
                          </li>
                        ))}
                        {list.length > 4 && <li className="text-[11px] font-semibold text-[#5f6b64]">+{list.length - 4} more</li>}
                      </ul>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
