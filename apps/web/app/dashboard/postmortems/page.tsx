'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, Search } from 'lucide-react';
import type { IncidentSeverity, IncidentStatus } from '../../../lib/types';
import { EmptyState, ErrorBanner, SeverityBadge, StatusBadge, formatDateTime, timeAgo } from '../_components/ui';
import { Button, Input, PageHeader, Pill, SkeletonRows, Tabs, useApi } from '../_components/kit';
import { PM_STATUS_LABEL, PM_STATUS_TONE, type Postmortem } from '../incidents/_shared';

type Row = Postmortem & { incident: { id: number; title: string; severity: IncidentSeverity; status: IncidentStatus; detectedAt: string; resolvedAt: string | null } | null };
type Filter = 'all' | 'draft' | 'in_review' | 'published';

export default function PostmortemsPage() {
  const { data, error, loading, reload } = useApi<{ postmortems: Row[] }>('/api/postmortems');
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');

  const rows = useMemo(() => data?.postmortems ?? [], [data]);
  const count = (s: Filter) => (s === 'all' ? rows.length : rows.filter((r) => r.status === s).length);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => (filter === 'all' || r.status === filter) && (!needle || `#${r.incidentId} ${r.incident?.title ?? ''} ${r.summary ?? ''}`.toLowerCase().includes(needle)));
  }, [rows, filter, q]);

  return (
    <div className="space-y-5">
      <PageHeader title="Postmortems" description="Blameless write-ups of resolved incidents, their root causes and follow-up actions." />

      <Tabs
        tabs={[
          { id: 'all', label: 'All', count: count('all') },
          { id: 'draft', label: 'Draft', count: count('draft') },
          { id: 'in_review', label: 'In review', count: count('in_review') },
          { id: 'published', label: 'Published', count: count('published') },
        ]}
        value={filter}
        onChange={setFilter}
      />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5f6b64]" />
        <Input aria-label="Search postmortems" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by incident title or summary" className="pl-8" />
      </div>

      {error && (
        <div className="space-y-2">
          <ErrorBanner message={error} />
          <Button variant="secondary" size="sm" onClick={reload}>
            Try again
          </Button>
        </div>
      )}

      {loading && !data ? (
        <div className="rounded-2xl border border-[#dfdbcc] bg-white p-4 shadow-[0_2px_0_#dfdbcc]">
          <SkeletonRows rows={5} />
        </div>
      ) : !data ? null : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={rows.length === 0 ? 'No postmortems yet' : 'No matching postmortems'}
          description={rows.length === 0 ? 'Start a postmortem from a resolved incident to capture what happened and what will change.' : 'Try another status or search term.'}
          action={
            rows.length === 0 ? (
              <Link href="/dashboard/incidents" className="text-sm font-semibold text-[#177a43] hover:underline">
                Go to incidents
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc]">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-[#dfdbcc] bg-[#fbfaf6] text-left text-xs font-bold uppercase tracking-wide text-[#5f6b64]">
                <th className="px-4 py-2.5">Incident</th>
                <th className="px-4 py-2.5">Postmortem</th>
                <th className="px-4 py-2.5">Incident status</th>
                <th className="px-4 py-2.5">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfdbcc]">
              {filtered.map((r) => (
                <tr key={r.id} className="transition hover:bg-[#f6f4ec]">
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {r.incident && <SeverityBadge severity={r.incident.severity} />}
                      <div className="min-w-0">
                        <Link href={`/dashboard/incidents/${r.incidentId}/postmortem`} className="block truncate font-bold text-[#14201a] hover:text-[#177a43] hover:underline">
                          {r.incident?.title ?? `Incident #${r.incidentId}`}
                        </Link>
                        <p className="truncate text-xs text-[#5f6b64]">
                          <Link href={`/dashboard/incidents/${r.incidentId}`} className="hover:underline">
                            #{r.incidentId}
                          </Link>
                          {r.summary ? ` · ${r.summary.replace(/[#*`>_-]/g, '').slice(0, 90)}` : ''}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Pill tone={PM_STATUS_TONE[r.status] ?? 'slate'}>{PM_STATUS_LABEL[r.status] ?? r.status}</Pill>
                    {r.publishedAt && <p className="mt-0.5 text-xs text-[#5f6b64]">Published {formatDateTime(r.publishedAt)}</p>}
                  </td>
                  <td className="px-4 py-3">{r.incident ? <StatusBadge status={r.incident.status} /> : <span className="text-xs text-[#5f6b64]">—</span>}</td>
                  <td className="px-4 py-3 text-[#3d4a42]">
                    <span title={formatDateTime(r.updatedAt)}>{timeAgo(r.updatedAt)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
