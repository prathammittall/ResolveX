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
        <h1 className="font-serif-title text-2xl font-semibold text-slate-900">Alerts</h1>
        <p className="mt-1 text-sm text-slate-500">
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
                ? 'bg-[#25396e] text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
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
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">Service</th>
                <th className="px-5 py-3">Event ID</th>
                <th className="px-5 py-3">Status</th>
                <th className="hidden px-5 py-3 sm:table-cell">Incident</th>
                <th className="hidden px-5 py-3 md:table-cell">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((a) => (
                <tr key={a.id} className="transition hover:bg-slate-50/60">
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-medium text-slate-800">{a.serviceName}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs text-slate-500">{a.providerEventId}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <AlertStatusBadge status={a.processingStatus} />
                  </td>
                  <td className="hidden px-5 py-3.5 sm:table-cell">
                    {a.incidentId ? (
                      <Link
                        href={`/dashboard/incidents/${a.incidentId}`}
                        className="text-xs font-medium text-[#25396e] hover:underline"
                      >
                        #{a.incidentId}
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="hidden px-5 py-3.5 md:table-cell">
                    <span className="text-sm text-slate-500">{timeAgo(a.receivedAt)}</span>
                    <span className="block text-xs text-slate-400">{formatDateTime(a.receivedAt)}</span>
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
