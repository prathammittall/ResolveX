'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, ExternalLink, Plus, Rocket } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { can } from '../../../lib/permissions';
import type { IncidentSeverity, ServiceEnvironment, ServiceItem } from '../../../lib/types';
import { EmptyState, ErrorBanner, SectionCard, SeverityBadge, formatDateTime, timeAgo } from '../_components/ui';
import { Button, PageHeader, Pill, Select, SkeletonRows, useApi } from '../_components/kit';
import { DEPLOY_STATUS_TONE, RecordDeploymentModal, commitHref, type Deployment } from './RecordDeploymentModal';

type DeploymentRow = Deployment & { serviceName: string; relatedIncidents: Array<{ id: number; title: string; severity: IncidentSeverity }> };

const PAGE = 50;

export default function DeploymentsPage() {
  const { user } = useAuth();
  const canCreate = can(user?.role, 'deployments:create');
  const services = useApi<{ services: ServiceItem[] }>('/api/services');
  const [serviceId, setServiceId] = useState('');
  const [env, setEnv] = useState<'' | ServiceEnvironment>('');
  const [rows, setRows] = useState<DeploymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const query = useCallback(
    (offset: number) => {
      const p = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
      if (serviceId) p.set('serviceId', serviceId);
      if (env) p.set('environment', env);
      return `/api/deployments?${p.toString()}`;
    },
    [serviceId, env],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ deployments: DeploymentRow[] }>(query(0));
      setRows(res.deployments);
      setHasMore(res.deployments.length === PAGE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deployments');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await api.get<{ deployments: DeploymentRow[] }>(query(rows.length));
      setRows((r) => [...r, ...res.deployments]);
      setHasMore(res.deployments.length === PAGE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }

  const serviceList = useMemo(() => services.data?.services ?? [], [services.data]);
  const repoOf = (sid: number) => serviceList.find((s) => s.id === sid)?.repositoryUrl ?? null;
  const closeModal = useCallback(() => setModalOpen(false), []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deployments"
        description="Release history across services, with incidents that started shortly after each deploy."
        actions={canCreate && (
          <Button onClick={() => setModalOpen(true)} disabled={serviceList.length === 0}>
            <Plus className="h-4 w-4" /> Record deployment
          </Button>
        )}
      />

      <div className="flex flex-wrap gap-2">
        <Select className="w-auto min-w-[200px]" value={serviceId} onChange={(e) => setServiceId(e.target.value)} aria-label="Filter by service">
          <option value="">All services</option>
          {serviceList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select className="w-auto min-w-[170px]" value={env} onChange={(e) => setEnv(e.target.value as ServiceEnvironment | '')} aria-label="Filter by environment">
          <option value="">All environments</option>
          <option value="production">Production</option>
          <option value="staging">Staging</option>
          <option value="development">Development</option>
        </Select>
      </div>

      {error && (
        <div className="space-y-2">
          <ErrorBanner message={error} />
          <Button variant="secondary" size="sm" onClick={load}>Retry</Button>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-[#dfdbcc] bg-white p-5 shadow-[0_2px_0_#dfdbcc]"><SkeletonRows rows={6} /></div>
      ) : !error && rows.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title={serviceId || env ? 'No deployments match these filters' : 'No deployments recorded yet'}
          description="Record deployments manually, from CI with the deployment webhook, or through the GitHub integration."
          action={canCreate && serviceList.length > 0 && <Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Record deployment</Button>}
        />
      ) : rows.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#dfdbcc] bg-[#fbfaf6] text-xs font-bold uppercase tracking-wide text-[#5f6b64]">
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">Env</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Commit</th>
                  <th className="px-4 py-3">Author</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Deployed</th>
                  <th className="px-4 py-3">Related incidents</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfdbcc]">
                {rows.map((d) => {
                  const repo = d.repositoryUrl || repoOf(d.serviceId);
                  const href = d.commitSha ? commitHref(repo, d.commitSha) : null;
                  return (
                    <tr key={d.id} className="align-top hover:bg-[#fbfaf6]">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/services/${d.serviceId}`} className="font-semibold text-[#14201a] hover:underline">{d.serviceName}</Link>
                        {d.description && <p className="mt-0.5 max-w-[240px] truncate text-xs text-[#5f6b64]" title={d.description}>{d.description}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-[#14201a]">{d.version}</span>
                        {d.url && (
                          <a href={d.url} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex text-[#5f6b64] hover:text-[#177a43]" aria-label={`Open deployment ${d.version}`}>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs capitalize text-[#3d4a42]">{d.environment}</td>
                      <td className="px-4 py-3"><Pill tone={DEPLOY_STATUS_TONE[d.status] ?? 'slate'}>{d.status.replace('_', ' ')}</Pill></td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {d.commitSha ? (
                          href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#177a43] hover:underline">{d.commitSha.slice(0, 7)}</a> : <span className="text-[#3d4a42]">{d.commitSha.slice(0, 7)}</span>
                        ) : <span className="text-[#5f6b64]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#3d4a42]">{d.author ?? '—'}</td>
                      <td className="px-4 py-3"><Pill tone={d.source === 'github' ? 'violet' : d.source === 'webhook' ? 'blue' : 'slate'}>{d.source}</Pill></td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-[#3d4a42]" title={formatDateTime(d.deployedAt)}>{timeAgo(d.deployedAt)}</td>
                      <td className="px-4 py-3">
                        {d.relatedIncidents.length === 0 ? (
                          <span className="text-xs text-[#5f6b64]">None</span>
                        ) : (
                          <ul className="space-y-1">
                            {d.relatedIncidents.map((i) => (
                              <li key={i.id} className="flex items-center gap-1.5">
                                <SeverityBadge severity={i.severity} />
                                <Link href={`/dashboard/incidents/${i.id}`} className="max-w-[200px] truncate text-xs font-semibold text-[#14201a] hover:underline">#{i.id} {i.title}</Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="flex justify-center border-t border-[#dfdbcc] p-3">
              <Button variant="secondary" size="sm" onClick={loadMore} loading={loadingMore}>Load more</Button>
            </div>
          )}
        </div>
      ) : null}

      <WebhookHowTo />

      <RecordDeploymentModal open={modalOpen} services={serviceList} defaultServiceId={serviceId ? Number(serviceId) : null} onClose={closeModal} onSaved={load} />
    </div>
  );
}

function WebhookHowTo() {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const example = `curl -X POST ${origin}/api/webhooks/deployments \\
  -H "Authorization: Bearer <service webhook key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "serviceId": 42,
    "environment": "production",
    "version": "v2.4.1",
    "commitSha": "a1b2c3d4e5f6",
    "repositoryUrl": "https://github.com/acme/payments",
    "author": "ci-bot",
    "status": "succeeded",
    "description": "Release 2.4.1",
    "url": "https://ci.example.com/runs/981",
    "externalId": "run-981"
  }'`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(example);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <SectionCard
      title="Record deployments from CI"
      subtitle="Use a per-service webhook key (Services → service → Webhook keys)."
      action={
        <Button variant="secondary" size="sm" onClick={copy} aria-label="Copy example request">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy'}
        </Button>
      }
    >
      <ul className="mb-3 space-y-1 text-sm text-[#3d4a42]">
        <li>• <code className="font-mono text-xs">serviceId</code> must match the service the key belongs to.</li>
        <li>• Required: <code className="font-mono text-xs">serviceId</code>, <code className="font-mono text-xs">environment</code> (production | staging | development), <code className="font-mono text-xs">version</code>.</li>
        <li>• <code className="font-mono text-xs">status</code>: succeeded (default), failed, rolled_back, in_progress, pending. Send the same <code className="font-mono text-xs">externalId</code> again to update a deployment&apos;s status.</li>
        <li>• Succeeded deployments update the service&apos;s current version and appear as markers on its charts and open incidents.</li>
      </ul>
      <pre className="overflow-x-auto rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] p-3 font-mono text-xs leading-relaxed text-[#14201a]">{example}</pre>
    </SectionCard>
  );
}
