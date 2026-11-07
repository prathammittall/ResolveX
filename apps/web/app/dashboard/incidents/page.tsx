'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Filter, Inbox } from 'lucide-react';
import { api } from '../../../lib/api';
import type {
  IncidentItem,
  IncidentSeverity,
  IncidentStatus,
  IncidentsResponse,
} from '../../../lib/types';
import {
  EmptyState,
  ErrorBanner,
  PageLoader,
  SeverityBadge,
  StatusBadge,
  cn,
  formatDateTime,
  timeAgo,
} from '../_components/ui';

const STATUSES: (IncidentStatus | 'all')[] = [
  'all',
  'open',
  'acknowledged',
  'investigating',
  'mitigated',
  'resolved',
];
const SEVERITIES: (IncidentSeverity | 'all')[] = ['all', 'sev1', 'sev2', 'sev3', 'sev4'];

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<IncidentStatus | 'all'>('all');
  const [severity, setSeverity] = useState<IncidentSeverity | 'all'>('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<IncidentsResponse>('/api/incidents');
        setIncidents(res.incidents);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load incidents');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    return incidents.filter((i) => {
      if (status !== 'all' && i.status !== status) return false;
      if (severity !== 'all' && i.severity !== severity) return false;
      return true;
    });
  }, [incidents, status, severity]);

  const counts = useMemo(() => {
    return {
      active: incidents.filter((i) => i.status !== 'resolved').length,
      resolved: incidents.filter((i) => i.status === 'resolved').length,
    };
  }, [incidents]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-title text-2xl font-semibold text-slate-900">Incidents</h1>
        <p className="mt-1 text-sm text-slate-500">
          {counts.active} active · {counts.resolved} resolved
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
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
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Severity</span>
          <div className="flex flex-wrap gap-1.5">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                onClick={() => setSeverity(s)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium uppercase transition',
                  severity === s
                    ? 'bg-[#25396e] text-white'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={incidents.length === 0 ? Inbox : AlertTriangle}
          title={incidents.length === 0 ? 'No incidents yet' : 'No matching incidents'}
          description={
            incidents.length === 0
              ? 'When alerts fire against your services, incidents will appear here.'
              : 'Try adjusting the filters above.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <ul className="divide-y divide-slate-100">
            {filtered.map((inc) => (
              <li key={inc.id}>
                <Link
                  href={`/dashboard/incidents/${inc.id}`}
                  className="flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <SeverityBadge severity={inc.severity} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{inc.title}</p>
                      <p className="truncate text-xs text-slate-400">
                        {inc.serviceName} · detected {timeAgo(inc.detectedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:shrink-0">
                    <StatusBadge status={inc.status} />
                    <span className="hidden text-xs text-slate-400 sm:inline">
                      {formatDateTime(inc.detectedAt)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
