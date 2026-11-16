'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { isAdmin } from '../../../lib/permissions';
import type { AuditLogItem } from '../../../lib/types';
import { EmptyState, ErrorBanner, PageLoader, SectionCard, formatDateTime, timeAgo } from '../_components/ui';

const ACTION_LABEL: Record<string, string> = {
  'member.role_changed': 'Changed a member’s role',
  'member.removed': 'Removed a member',
  'invitation.created': 'Created an invitation',
  'invitation.revoked': 'Revoked an invitation',
  'invitation.accepted': 'Accepted an invitation',
};

function describe(item: AuditLogItem): string {
  const m = item.metadata ?? {};
  if (item.action === 'member.role_changed') return `${String(m.from)} → ${String(m.to)}`;
  if (item.action === 'invitation.created') return `${String(m.email)} as ${String(m.role)}`;
  if (item.action === 'invitation.revoked') return String(m.email ?? '');
  if (item.action === 'invitation.accepted') return `joined as ${String(m.role)}`;
  if (item.action === 'member.removed') return `was ${String(m.role)}`;
  return '';
}

export default function AuditPage() {
  const { user } = useAuth();
  const allowed = isAdmin(user?.role);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (before?: string) => {
    const query = before ? `?limit=50&before=${encodeURIComponent(before)}` : '?limit=50';
    const res = await api.get<{ logs: AuditLogItem[]; nextBefore: string | null }>(`/api/audit-logs${query}`);
    return res;
  }, []);

  useEffect(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    load()
      .then((res) => {
        setLogs(res.logs);
        setNext(res.nextBefore);
      })
      .catch((err) => setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load audit log'))
      .finally(() => setLoading(false));
  }, [allowed, load]);

  async function more() {
    if (!next) return;
    setLoadingMore(true);
    try {
      const res = await load(next);
      setLogs((prev) => [...prev, ...res.logs]);
      setNext(res.nextBefore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) return <PageLoader />;
  if (!allowed) {
    return (
      <EmptyState
        icon={ScrollText}
        title="Audit log is restricted"
        description="Only organization owners and admins have permission to inspect security audit logs."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-[#dfdbcc] pb-5">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#14201a]">Audit log</h1>
        <p className="mt-1 text-sm text-[#5f6b64]">An immutable record of who changed what in this engineering organization.</p>
      </div>
      {error && <ErrorBanner message={error} />}
      <SectionCard>
        {logs.length === 0 ? (
          <EmptyState icon={ScrollText} title="Nothing recorded yet" description="Member and invitation changes will appear here." />
        ) : (
          <ul className="-my-3 divide-y divide-[#dfdbcc]/50">
            {logs.map((l) => (
              <li key={l.id} className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#14201a]">{ACTION_LABEL[l.action] ?? l.action}</p>
                  <p className="truncate text-xs text-[#5f6b64] mt-0.5">
                    {describe(l)}
                    {l.actorId !== null && <span className="opacity-70"> · by user #{l.actorId}</span>}
                    {l.requestId && <span className="opacity-50"> · {l.requestId.slice(0, 8)}</span>}
                  </p>
                </div>
                <time dateTime={l.createdAt} title={formatDateTime(l.createdAt)} className="shrink-0 text-xs font-semibold text-[#5f6b64]">
                  {timeAgo(l.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
        {next && (
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={more}
              disabled={loadingMore}
              className="btn-kizupi-white text-xs px-4 py-2 cursor-pointer disabled:opacity-60"
            >
              {loadingMore ? 'Loading…' : 'Load older audit entries'}
            </button>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
