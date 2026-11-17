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
      <div className="border-b border-[#dfdbcc] pb-5">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#14201a]">Alerts</h1>
        <p className="mt-1 text-sm text-[#5f6b64]">
          Raw telemetry and alert webhooks ingested across all configured services and endpoints.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-[#dfdbcc] shadow-[0_1px_0_#dfdbcc]">
        <span className="text-xs font-bold uppercase tracking-wider text-[#5f6b64] mr-2">Filter status:</span>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cn(
              'rounded-lg px-3 py-1 text-xs font-bold capitalize transition cursor-pointer',
              status === s
                ? 'bg-[#dcefd8] text-[#177a43] border border-[#b2e2a8] shadow-xs'
                : 'bg-[#fbfaf6] text-[#5f6b64] border border-[#dfdbcc] hover:bg-[#eeebe0] hover:text-[#14201a]',
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={alerts.length === 0 ? Bell : Inbox}
          title={alerts.length === 0 ? 'No alerts received yet' : 'No matching alerts'}
          description={
            alerts.length === 0
              ? 'Ingested alert events will appear here once your service webhooks or health checks fire.'
              : 'Try selecting a different status filter above.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc]">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#dfdbcc] bg-[#fbfaf6] text-xs font-bold uppercase tracking-wide text-[#5f6b64]">
                  <th className="px-5 py-3">Service</th>
                  <th className="px-5 py-3">Event ID</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="hidden px-5 py-3 sm:table-cell">Incident</th>
                  <th className="hidden px-5 py-3 md:table-cell">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfdbcc]/50 text-sm">
                {filtered.map((a) => (
                  <tr key={a.id} className="transition hover:bg-[#f6f4ec]">
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-[#14201a]">{a.serviceName}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs text-[#5f6b64]">{a.providerEventId}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <AlertStatusBadge status={a.processingStatus} />
                    </td>
                    <td className="hidden px-5 py-3.5 sm:table-cell">
                      {a.incidentId ? (
                        <Link
                          href={`/dashboard/incidents/${a.incidentId}`}
                          className="text-xs font-bold text-[#177a43] hover:underline"
                        >
                          Incident #{a.incidentId}
                        </Link>
                      ) : (
                        <span className="text-xs text-[#5f6b64]">—</span>
                      )}
                    </td>
                    <td className="hidden px-5 py-3.5 md:table-cell">
                      <span className="text-sm font-medium text-[#3d4a42]">{timeAgo(a.receivedAt)}</span>
                      <span className="block text-xs text-[#5f6b64]">{formatDateTime(a.receivedAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
