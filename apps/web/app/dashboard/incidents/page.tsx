'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Filter, Inbox, ShieldCheck } from 'lucide-react';
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dfdbcc] pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#14201a]">Incidents</h1>
          <p className="mt-1 text-sm text-[#5f6b64]">
            Automated failure detection, owner routing, and deduplicated event lifecycles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fee2e2] text-[#dc2626] border border-[#fecaca] text-xs font-bold">
            <AlertTriangle className="w-3.5 h-3.5" /> {counts.active} active
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#dcefd8] text-[#177a43] border border-[#b2e2a8] text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5" /> {counts.resolved} resolved
          </span>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3.5 rounded-2xl border border-[#dfdbcc] shadow-[0_1px_0_#dfdbcc]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <Filter className="h-3.5 w-3.5 text-[#5f6b64]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#5f6b64]">Status:</span>
          </div>
          {STATUSES.map((s) => (
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

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#5f6b64] mr-2">Severity:</span>
          {SEVERITIES.map((s) => (
            <button
              key={s}
              onClick={() => setSeverity(s)}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-bold uppercase transition cursor-pointer',
                severity === s
                  ? 'bg-[#14201a] text-white shadow-xs'
                  : 'bg-[#fbfaf6] text-[#5f6b64] border border-[#dfdbcc] hover:bg-[#eeebe0] hover:text-[#14201a]',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={incidents.length === 0 ? Inbox : AlertTriangle}
          title={incidents.length === 0 ? 'No incidents logged' : 'No matching incidents'}
          description={
            incidents.length === 0
              ? 'When automated health checks detect repeated consecutive failures or webhook alerts fire, incidents appear here.'
              : 'Try clearing or modifying the status and severity filters above.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc]">
          <ul className="divide-y divide-[#dfdbcc]/50">
            {filtered.map((inc) => (
              <li key={inc.id}>
                <Link
                  href={`/dashboard/incidents/${inc.id}`}
                  className="flex flex-col gap-3 px-5 py-4 transition hover:bg-[#f6f4ec] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <SeverityBadge severity={inc.severity} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#14201a]">{inc.title}</p>
                      <p className="truncate text-xs text-[#5f6b64] mt-0.5">
                        {inc.serviceName} · detected {timeAgo(inc.detectedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:shrink-0">
                    <StatusBadge status={inc.status} />
                    <span className="hidden text-xs font-medium text-[#5f6b64] sm:inline">
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
