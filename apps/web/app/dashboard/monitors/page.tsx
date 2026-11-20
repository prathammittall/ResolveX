'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { can } from '../../../lib/permissions';
import type { ServiceHealthStatus, ServiceItem } from '../../../lib/types';
import { EmptyState, ErrorBanner, HealthBadge, cn, formatDateTime, timeAgo } from '../_components/ui';
import { Button, PageHeader, Select, SkeletonRows, useApi, useConfirm, useToast } from '../_components/kit';
import { MonitorFormModal, formatInterval, type Monitor } from './MonitorForm';

const STATUSES: ServiceHealthStatus[] = ['healthy', 'degraded', 'down', 'pending', 'maintenance'];

export default function MonitorsPage() {
  const { user } = useAuth();
  const canManage = can(user?.role, 'monitors:manage');
  const toast = useToast();
  const confirm = useConfirm();
  const monitors = useApi<{ monitors: Monitor[] }>('/api/monitors');
  const services = useApi<{ services: ServiceItem[] }>('/api/services');
  const [serviceId, setServiceId] = useState('');
  const [status, setStatus] = useState<'' | ServiceHealthStatus | 'disabled'>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Monitor | null>(null);
  const [busy, setBusy] = useState<Record<number, boolean>>({});

  const serviceList = useMemo(() => services.data?.services ?? [], [services.data]);
  const serviceName = (id: number) => serviceList.find((s) => s.id === id)?.name ?? `Service #${id}`;
  const list = useMemo(() => monitors.data?.monitors ?? [], [monitors.data]);
  const filtered = useMemo(
    () =>
      list.filter((m) => {
        if (serviceId && m.serviceId !== Number(serviceId)) return false;
        if (status === 'disabled') return !m.enabled;
        if (status && m.status !== status) return false;
        return true;
      }),
    [list, serviceId, status],
  );

  const replace = (m: Monitor) => monitors.setData((d) => (d ? { monitors: d.monitors.map((x) => (x.id === m.id ? m : x)) } : d));
  const setBusyFor = (id: number, v: boolean) => setBusy((b) => ({ ...b, [id]: v }));

  async function toggle(m: Monitor) {
    setBusyFor(m.id, true);
    try {
      const res = await api.patch<{ monitor: Monitor }>(`/api/monitors/${m.id}`, { enabled: !m.enabled });
      if (res.monitor) replace(res.monitor);
      toast.success(`${m.name} ${m.enabled ? 'paused' : 'enabled'}`);
    } catch (err) {
      toast.error(err);
    } finally {
      setBusyFor(m.id, false);
    }
  }

  async function run(m: Monitor) {
    setBusyFor(m.id, true);
    try {
      const res = await api.post<{ monitor: Monitor | null }>(`/api/monitors/${m.id}/run`);
      if (res.monitor) replace(res.monitor);
      toast.success(`Checked ${m.name}: ${res.monitor?.status ?? 'done'}`);
    } catch (err) {
      toast.error(err);
    } finally {
      setBusyFor(m.id, false);
    }
  }

  async function remove(m: Monitor) {
    const ok = await confirm({ title: `Delete ${m.name}?`, message: 'The monitor and its entire check history will be removed. This cannot be undone.', confirmLabel: 'Delete monitor', danger: true });
    if (!ok) return;
    try {
      await api.del(`/api/monitors/${m.id}`);
      toast.success('Monitor deleted');
      monitors.reload();
    } catch (err) {
      toast.error(err);
    }
  }

  const closeForm = useCallback(() => setFormOpen(false), []);
  const loading = monitors.loading && !monitors.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Monitors"
        description="HTTP checks that drive service health, incidents and uptime."
        actions={canManage && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} disabled={serviceList.length === 0}>
            <Plus className="h-4 w-4" /> New monitor
          </Button>
        )}
      />

      <div className="flex flex-wrap gap-2">
        <Select className="w-auto min-w-[200px]" value={serviceId} onChange={(e) => setServiceId(e.target.value)} aria-label="Filter by service">
          <option value="">All services</option>
          {serviceList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select className="w-auto min-w-[160px]" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          <option value="disabled">Paused</option>
        </Select>
      </div>

      {(monitors.error || services.error) && (
        <div className="space-y-2">
          <ErrorBanner message={monitors.error ?? services.error ?? ''} />
          <Button variant="secondary" size="sm" onClick={() => { monitors.reload(); services.reload(); }}>Retry</Button>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-[#dfdbcc] bg-white p-5 shadow-[0_2px_0_#dfdbcc]"><SkeletonRows rows={6} /></div>
      ) : !monitors.error && list.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No monitors yet"
          description={serviceList.length === 0 ? 'Register a service first, then add HTTP checks for it.' : 'Add an HTTP check to start tracking uptime and latency.'}
          action={canManage && serviceList.length > 0 && <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> New monitor</Button>}
        />
      ) : list.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#dfdbcc] bg-[#fbfaf6] text-xs font-bold uppercase tracking-wide text-[#5f6b64]">
                  <th className="px-4 py-3">Monitor</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Request</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Interval</th>
                  <th className="px-4 py-3">Last check</th>
                  <th className="px-4 py-3">Latency</th>
                  <th className="px-4 py-3">Enabled</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfdbcc]">
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-[#5f6b64]">No monitors match these filters.</td></tr>
                )}
                {filtered.map((m) => (
                  <tr key={m.id} className={cn('align-top hover:bg-[#fbfaf6]', !m.enabled && 'opacity-70')}>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/monitors/${m.id}`} className="font-semibold text-[#14201a] hover:underline">{m.name}</Link>
                      {m.lastError && m.status !== 'healthy' && <p className="mt-0.5 max-w-[220px] truncate text-xs text-[#991b1b]" title={m.lastError}>{m.lastError}</p>}
                    </td>
                    <td className="px-4 py-3"><Link href={`/dashboard/services/${m.serviceId}`} className="text-xs font-semibold text-[#3d4a42] hover:underline">{serviceName(m.serviceId)}</Link></td>
                    <td className="px-4 py-3">
                      <span className="mr-1.5 rounded bg-[#eeebe0] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#3d4a42]">{m.method}</span>
                      <span className="inline-block max-w-[260px] truncate align-bottom font-mono text-xs text-[#3d4a42]" title={m.url}>{m.url}</span>
                    </td>
                    <td className="px-4 py-3"><HealthBadge status={m.status} /></td>
                    <td className="px-4 py-3 text-xs text-[#3d4a42]">{formatInterval(m.intervalSeconds)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[#3d4a42]" title={m.lastCheckedAt ? formatDateTime(m.lastCheckedAt) : undefined}>{m.lastCheckedAt ? timeAgo(m.lastCheckedAt) : 'Never'}</td>
                    <td className="px-4 py-3 text-xs text-[#3d4a42]">{m.lastLatencyMs !== null ? `${m.lastLatencyMs} ms` : '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={m.enabled}
                        aria-label={`${m.enabled ? 'Pause' : 'Enable'} ${m.name}`}
                        disabled={!canManage || busy[m.id]}
                        onClick={() => toggle(m)}
                        className={cn('relative h-5 w-9 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50', m.enabled ? 'bg-[#177a43]' : 'bg-[#eeebe0] ring-1 ring-[#dfdbcc]')}
                      >
                        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', m.enabled ? 'left-[18px]' : 'left-0.5')} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManage && (
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => run(m)} disabled={busy[m.id]} className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#eeebe0] hover:text-[#177a43] disabled:opacity-50" title="Run now" aria-label={`Run ${m.name} now`}>
                            <Play className={cn('h-3.5 w-3.5', busy[m.id] && 'animate-pulse')} />
                          </button>
                          <button type="button" onClick={() => { setEditing(m); setFormOpen(true); }} className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#eeebe0] hover:text-[#14201a]" title="Edit" aria-label={`Edit ${m.name}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => remove(m)} className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626]" title="Delete" aria-label={`Delete ${m.name}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[#dfdbcc] bg-[#fbfaf6] px-4 py-2 text-xs text-[#5f6b64]">Showing {filtered.length} of {list.length} monitors</div>
        </div>
      ) : null}

      <MonitorFormModal
        open={formOpen}
        monitor={editing}
        services={serviceList}
        defaultServiceId={serviceId ? Number(serviceId) : null}
        onClose={closeForm}
        onSaved={() => monitors.reload()}
      />
    </div>
  );
}
