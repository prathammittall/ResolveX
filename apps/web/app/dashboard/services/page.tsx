'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, KeyRound, Pencil, Plus, Search, Server, ShieldCheck, Trash2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { can } from '../../../lib/permissions';
import type { ServiceEnvironment, ServiceHealthStatus, ServiceItem, ServiceType } from '../../../lib/types';
import WebhookKeysModal from './WebhookKeysModal';
import { CRITICALITY_TONE, ENVIRONMENTS, SERVICE_TYPES, SERVICE_TYPE_LABEL, ServiceFormModal, cap } from './ServiceFormModal';
import { EmptyState, ErrorBanner, HealthBadge, SeverityBadge, StatusBadge, cn } from '../_components/ui';
import { Button, Input, PageHeader, Pill, Select, SkeletonRows, useApi, useConfirm, useMembers, useToast } from '../_components/kit';

const HEALTH: ServiceHealthStatus[] = ['healthy', 'degraded', 'down', 'pending', 'maintenance', 'unknown'];

export default function ServicesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const members = useMembers();
  const canManage = can(user?.role, 'services:manage');
  const { data, error, loading, reload, setData } = useApi<{ services: ServiceItem[] }>('/api/services');
  const services = useMemo(() => data?.services ?? [], [data]);

  const [q, setQ] = useState('');
  const [health, setHealth] = useState<'' | ServiceHealthStatus>('');
  const [env, setEnv] = useState<'' | ServiceEnvironment>('');
  const [type, setType] = useState<'' | ServiceType>('');
  const [owner, setOwner] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceItem | null>(null);
  const [keysFor, setKeysFor] = useState<ServiceItem | null>(null);

  const closeForm = useCallback(() => setFormOpen(false), []);
  const memberName = (id: number | null | undefined) => (id ? members.find((m) => m.userId === id)?.name ?? `User #${id}` : null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return services.filter((s) => {
      if (health && s.healthStatus !== health) return false;
      if (env && s.environment !== env) return false;
      if (type && s.serviceType !== type) return false;
      if (owner === 'none' && s.ownerId) return false;
      if (owner && owner !== 'none' && s.ownerId !== Number(owner) && s.backupOwnerId !== Number(owner)) return false;
      if (!needle) return true;
      return [s.name, s.slug ?? '', s.description ?? '', ...(s.tags ?? [])].some((v) => v.toLowerCase().includes(needle));
    });
  }, [services, q, health, env, type, owner]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of services) c[s.healthStatus] = (c[s.healthStatus] ?? 0) + 1;
    return c;
  }, [services]);

  const filtersActive = Boolean(q || health || env || type || owner);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  async function remove(svc: ServiceItem) {
    const ok = await confirm({ title: `Delete ${svc.name}?`, message: 'This permanently removes the service with its monitors, incidents, alerts and deployment history. This cannot be undone.', confirmLabel: 'Delete service', danger: true });
    if (!ok) return;
    try {
      await api.del(`/api/services/${svc.id}`);
      toast.success(`${svc.name} deleted`);
      reload();
    } catch (err) {
      toast.error(err);
    }
  }

  function onSaved(saved: ServiceItem) {
    if (editing) setData((d) => (d ? { services: d.services.map((s) => (s.id === saved.id ? { ...s, ...saved } : s)) } : d));
    reload();
  }

  return (
    <div>
      <PageHeader
        title="Services"
        description="Catalog of services, owners and health, backed by automated uptime checks."
        actions={
          <>
            <Link href="/dashboard/dependency-map" className="rounded-xl border border-[#dfdbcc] bg-white px-3.5 py-2 text-sm font-semibold text-[#14201a] hover:bg-[#eeebe0]">Dependency map</Link>
            {canManage && (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> New service
              </Button>
            )}
          </>
        }
      />

      {!loading && services.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {HEALTH.filter((h) => counts[h]).map((h) => (
            <button key={h} type="button" onClick={() => setHealth(health === h ? '' : h)} aria-pressed={health === h} className={cn('rounded-full transition', health === h ? 'ring-2 ring-[#177a43]/40' : 'opacity-90 hover:opacity-100')}>
              <span className="inline-flex items-center gap-1.5">
                <HealthBadge status={h} />
                <span className="text-xs font-bold text-[#3d4a42]">{counts[h]}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5f6b64]" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, slug, tag…" aria-label="Search services" className="pl-9" />
        </div>
        <Select value={health} onChange={(e) => setHealth(e.target.value as ServiceHealthStatus | '')} aria-label="Filter by health">
          <option value="">All health</option>
          {HEALTH.map((h) => <option key={h} value={h}>{cap(h)}</option>)}
        </Select>
        <Select value={env} onChange={(e) => setEnv(e.target.value as ServiceEnvironment | '')} aria-label="Filter by environment">
          <option value="">All environments</option>
          {ENVIRONMENTS.map((h) => <option key={h} value={h}>{cap(h)}</option>)}
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value as ServiceType | '')} aria-label="Filter by type">
          <option value="">All types</option>
          {SERVICE_TYPES.map((t) => <option key={t} value={t}>{SERVICE_TYPE_LABEL[t]}</option>)}
        </Select>
        <Select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Filter by owner">
          <option value="">Any owner</option>
          <option value="none">No owner</option>
          {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
        </Select>
      </div>

      {error && (
        <div className="mb-4 space-y-2">
          <ErrorBanner message={error} />
          <Button variant="secondary" size="sm" onClick={reload}>Retry</Button>
        </div>
      )}

      {loading && !data ? (
        <div className="rounded-2xl border border-[#dfdbcc] bg-white p-5 shadow-[0_2px_0_#dfdbcc]"><SkeletonRows rows={6} /></div>
      ) : !error && services.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No services registered yet"
          description={canManage ? 'Add your first service so monitors, alerts, deployments and incidents can be tied to it.' : 'An owner, admin or manager needs to add services first.'}
          action={canManage && <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add a service</Button>}
        />
      ) : services.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead>
                <tr className="border-b border-[#dfdbcc] bg-[#fbfaf6] text-xs font-bold uppercase tracking-wide text-[#5f6b64]">
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Health</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Environment</th>
                  <th className="px-4 py-3">Criticality</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Incident</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfdbcc] text-sm">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#5f6b64]">
                      No services match these filters.{' '}
                      {filtersActive && (
                        <button type="button" className="font-semibold text-[#177a43] hover:underline" onClick={() => { setQ(''); setHealth(''); setEnv(''); setType(''); setOwner(''); }}>
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                )}
                {filtered.map((svc) => (
                  <tr key={svc.id} className="cursor-pointer transition hover:bg-[#f6f4ec]" onClick={() => router.push(`/dashboard/services/${svc.id}`)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eeebe0] text-[#177a43]">
                          <Server className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <Link href={`/dashboard/services/${svc.id}`} onClick={(e) => e.stopPropagation()} className="font-bold text-[#14201a] hover:underline">
                            {svc.name}
                          </Link>
                          <div className="flex flex-wrap items-center gap-1 text-xs text-[#5f6b64]">
                            {svc.slug && <code className="font-mono">{svc.slug}</code>}
                            {svc.currentVersion && <span>· {svc.currentVersion}</span>}
                            {(svc.tags ?? []).slice(0, 3).map((t) => (
                              <span key={t} className="rounded bg-[#eeebe0] px-1.5 py-px text-[10px] font-semibold text-[#3d4a42]">{t}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><HealthBadge status={svc.healthStatus} /></td>
                    <td className="px-4 py-3"><span className="rounded-md bg-[#eeebe0] px-2 py-0.5 text-xs font-semibold text-[#3d4a42]">{SERVICE_TYPE_LABEL[svc.serviceType] ?? svc.serviceType}</span></td>
                    <td className="px-4 py-3 text-xs font-semibold capitalize text-[#3d4a42]">{svc.environment}</td>
                    <td className="px-4 py-3"><Pill tone={CRITICALITY_TONE[svc.criticality]}>{cap(svc.criticality)}</Pill></td>
                    <td className="px-4 py-3 text-xs text-[#3d4a42]">{memberName(svc.ownerId) ?? <span className="text-[#5f6b64]">—</span>}</td>
                    <td className="px-4 py-3">
                      {svc.openIncident ? (
                        <Link href={`/dashboard/incidents/${svc.openIncident.id}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 hover:opacity-80" aria-label={`Open incident #${svc.openIncident.id}`}>
                          <SeverityBadge severity={svc.openIncident.severity} />
                          <StatusBadge status={svc.openIncident.status} />
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#177a43]"><ShieldCheck className="h-3.5 w-3.5" /> None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {svc.monitoredUrl && (
                          <a href={svc.monitoredUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#eeebe0] hover:text-[#14201a]" title="Open monitored URL" aria-label={`Open monitored URL for ${svc.name}`}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button type="button" onClick={() => setKeysFor(svc)} className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#eeebe0] hover:text-[#177a43]" title="Webhook keys" aria-label={`Webhook keys for ${svc.name}`}>
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                        {canManage && (
                          <>
                            <button type="button" onClick={() => { setEditing(svc); setFormOpen(true); }} className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#eeebe0] hover:text-[#14201a]" title="Edit" aria-label={`Edit ${svc.name}`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => remove(svc)} className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626]" title="Delete" aria-label={`Delete ${svc.name}`}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[#dfdbcc] bg-[#fbfaf6] px-4 py-2 text-xs text-[#5f6b64]">
            Showing {filtered.length} of {services.length} services
          </div>
        </div>
      ) : null}

      <ServiceFormModal open={formOpen} service={editing} onClose={closeForm} onSaved={onSaved} />
      {keysFor && <WebhookKeysModal service={keysFor} canManage={canManage} onClose={() => setKeysFor(null)} />}
    </div>
  );
}
