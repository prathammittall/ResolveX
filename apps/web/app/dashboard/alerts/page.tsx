'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Inbox } from 'lucide-react';
import { api } from '../../../lib/api';
import type {
  AlertItem,
  AlertProcessingStatus,
  AlertsResponse,
} from '../../../lib/types';
import {
  AlertStatusBadge,
  EmptyState,
  ErrorBanner,
  PageLoader,
  cn,
  formatDateTime,
  timeAgo,
} from '../_components/ui';

const STATUS_FILTERS: (AlertProcessingStatus | 'all')[] = [
  'all',
  'processed',
  'pending',
  'failed',
  'ignored',
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<AlertProcessingStatus | 'all'>('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<AlertsResponse>('/api/alerts');
        setAlerts(res.alerts);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load alerts');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = alerts.filter((a) => status === 'all' || a.processingStatus === status);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-title text-2xl font-semibold text-[#171a1f] dark:text-white">Alerts</h1>
        <p className="mt-1 text-sm text-[#574f47] dark:text-zinc-400">
          Raw alert events ingested across your services.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition',
              status === s
                ? 'bg-[#171a1f] dark:bg-[#ff5414] text-white shadow-xs'
                : 'bg-[#eedccb]/70 dark:bg-white/5 text-[#574f47] dark:text-zinc-300 border border-[#cbbaa9] dark:border-white/10 hover:bg-[#cbbaa9]/40 dark:hover:bg-white/10',
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={alerts.length === 0 ? Bell : Inbox}
          title={alerts.length === 0 ? 'No alerts yet' : 'No matching alerts'}
          description={
            alerts.length === 0
              ? 'Ingested alert events will show up here once your services start receiving webhooks.'
              : 'Try a different status filter.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#cbbaa9] dark:border-white/10 bg-[#eedccb]/70 dark:bg-[#101117] shadow-xs">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#cbbaa9]/40 dark:border-white/10 bg-[#e2cfc0]/40 dark:bg-white/5 text-left text-xs font-semibold uppercase tracking-wide text-[#574f47] dark:text-zinc-400">
                <th className="px-5 py-3">Service</th>
                <th className="px-5 py-3">Event ID</th>
                <th className="px-5 py-3">Status</th>
                <th className="hidden px-5 py-3 sm:table-cell">Incident</th>
                <th className="hidden px-5 py-3 md:table-cell">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#cbbaa9]/25 dark:divide-white/5">
              {filtered.map((a) => (
                <tr key={a.id} className="transition hover:bg-[#cbbaa9]/20 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-medium text-[#171a1f] dark:text-white">{a.serviceName}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs text-[#574f47] dark:text-zinc-400">{a.providerEventId}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <AlertStatusBadge status={a.processingStatus} />
                  </td>
                  <td className="hidden px-5 py-3.5 sm:table-cell">
                    {a.incidentId ? (
                      <Link
                        href={`/dashboard/incidents/${a.incidentId}`}
                        className="text-xs font-medium text-[#ff5414] hover:underline"
                      >
                        #{a.incidentId}
                      </Link>
                    ) : (
                      <span className="text-xs text-[#574f47]/60 dark:text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="hidden px-5 py-3.5 md:table-cell">
                    <span className="text-sm text-[#574f47] dark:text-zinc-300">{timeAgo(a.receivedAt)}</span>
                    <span className="block text-xs text-[#574f47]/70 dark:text-zinc-400">{formatDateTime(a.receivedAt)}</span>
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
