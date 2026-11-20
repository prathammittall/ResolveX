'use client';

import React, { useState } from 'react';
import { Activity, ExternalLink, GitCommit, GitPullRequest, Plus, Rocket, Trash2, Unplug } from 'lucide-react';

function Github({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
import { api } from '../../../lib/api';
import { EmptyState, ErrorBanner, SectionCard, formatDateTime, timeAgo } from '../_components/ui';
import { Button, Field, Input, Modal, Pill, Select, SkeletonRows, useApi, useConfirm, useToast } from '../_components/kit';
import { CopyBox, useProjects, useServices } from '../oncall/_shared';

type Repo = { id: number; fullName: string; projectId: string | null; serviceId: number | null; defaultBranch: string | null; createdAt: string };
type GitHubState = { configured: boolean; connection: { accountLogin: string; scopes: string | null; createdAt: string } | null; repositories: Repo[]; webhookUrl: string };
type StoredEvent = { id: number; repository: string; kind: string; externalId: string; title: string; url: string | null; author: string | null; state: string | null; branch: string | null; taskRefs: string[] | null; occurredAt: string };
type Live =
  | { commits: Array<{ sha: string; message: string; author?: string; url: string; date?: string }>; pullRequests: Array<{ number: number; title: string; state: string; author?: string; url: string; updatedAt?: string }> }
  | { error: string }
  | null;

function webhookTarget(url: string) {
  // When the server has no PUBLIC_API_URL/APP_URL it returns a relative path; complete it with this origin.
  return url.startsWith('/') && typeof window !== 'undefined' ? `${window.location.origin}${url}` : url;
}

function AddRepoModal({ onClose, onAdded }: { onClose: () => void; onAdded: (fullName: string, secret: string) => void }) {
  const toast = useToast();
  const projects = useProjects();
  const services = useServices();
  const [fullName, setFullName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const name = fullName.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '').replace(/\/$/, '');
    if (!/^[\w.-]+\/[\w.-]+$/.test(name)) return setError('Enter the repository as owner/name, e.g. acme/payments-api.');
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ webhookSecret: string }>('/api/integrations/github/repositories', { fullName: name, projectId: projectId || null, serviceId: serviceId ? Number(serviceId) : null });
      toast.success('Repository linked');
      onAdded(name, res.webhookSecret);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not link repository');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Link a repository" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Link repository</Button></>}>
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <Field label="Repository" hint="owner/name"><Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="acme/payments-api" autoComplete="off" spellCheck={false} /></Field>
        <Field label="Project" hint="Commits and PRs mentioning tickets (e.g. PAY-12) link to them.">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">No project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.key} · {p.name}</option>)}
          </Select>
        </Field>
        <Field label="Service" hint="Successful deployment_status events are recorded as deployments of this service.">
          <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="">No service</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

function ActivityModal({ repo, onClose }: { repo: Repo; onClose: () => void }) {
  const { data, error, loading } = useApi<{ events: StoredEvent[]; live: Live }>(`/api/integrations/github/repositories/${repo.id}/activity`);
  const live = data?.live ?? null;
  const KindIcon = ({ kind }: { kind: string }) => (kind === 'pull_request' ? <GitPullRequest className="h-4 w-4 text-[#6d28d9]" /> : kind === 'deployment' ? <Rocket className="h-4 w-4 text-[#0369a1]" /> : <GitCommit className="h-4 w-4 text-[#5f6b64]" />);
  return (
    <Modal open wide onClose={onClose} title={`Activity · ${repo.fullName}`}>
      {error && <ErrorBanner message={error} />}
      {loading && !data ? (
        <SkeletonRows rows={5} />
      ) : data ? (
        <div className="space-y-5">
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Received via webhook</h4>
            {data.events.length === 0 ? (
              <p className="text-sm text-[#5f6b64]">No webhook events yet. Check that the repository webhook is configured with the secret and URL shown when you linked it.</p>
            ) : (
              <ul className="divide-y divide-[#dfdbcc] rounded-xl border border-[#dfdbcc]">
                {data.events.map((e) => (
                  <li key={e.id} className="flex items-start gap-2 px-3 py-2 text-sm">
                    <KindIcon kind={e.kind} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[#14201a]">
                        {e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{e.title}</a> : e.title}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#5f6b64]">
                        {e.author && <span>{e.author}</span>}
                        {e.branch && <span className="font-mono">{e.branch}</span>}
                        {e.state && <Pill>{e.state}</Pill>}
                        {(Array.isArray(e.taskRefs) ? e.taskRefs : []).map((r) => <a key={r} href={`/dashboard/tasks/${r}`} className="font-mono text-[#177a43] hover:underline">{r}</a>)}
                        <span title={formatDateTime(e.occurredAt)}>{timeAgo(e.occurredAt)}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Live from GitHub</h4>
            {live === null ? (
              <p className="text-sm text-[#5f6b64]">Connect GitHub to see the latest commits and pull requests here.</p>
            ) : 'error' in live ? (
              <ErrorBanner message={`GitHub request failed: ${live.error}`} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-sm font-semibold text-[#14201a]">Recent commits</div>
                  {live.commits.length === 0 ? <p className="text-xs text-[#5f6b64]">None</p> : (
                    <ul className="space-y-1.5">
                      {live.commits.map((c) => (
                        <li key={c.sha} className="text-sm">
                          <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-[#14201a] hover:underline"><span className="font-mono text-xs text-[#5f6b64]">{c.sha.slice(0, 7)}</span> {c.message}</a>
                          <div className="text-xs text-[#5f6b64]">{c.author}{c.date ? ` · ${timeAgo(c.date)}` : ''}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <div className="mb-1 text-sm font-semibold text-[#14201a]">Pull requests</div>
                  {live.pullRequests.length === 0 ? <p className="text-xs text-[#5f6b64]">None</p> : (
                    <ul className="space-y-1.5">
                      {live.pullRequests.map((p) => (
                        <li key={p.number} className="text-sm">
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[#14201a] hover:underline">#{p.number} {p.title}</a>
                          <div className="flex items-center gap-1.5 text-xs text-[#5f6b64]">
                            <Pill tone={p.state === 'merged' ? 'violet' : p.state === 'open' ? 'green' : 'slate'}>{p.state}</Pill>
                            {p.author}{p.updatedAt ? ` · ${timeAgo(p.updatedAt)}` : ''}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

export function GitHubTab({ admin }: { admin: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const projects = useProjects();
  const services = useServices();
  const { data, error, loading, reload } = useApi<GitHubState>('/api/integrations/github');
  const [connecting, setConnecting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<{ fullName: string; secret: string } | null>(null);
  const [activity, setActivity] = useState<Repo | null>(null);

  async function connect() {
    setConnecting(true);
    try {
      const res = await api.post<{ url: string }>('/api/integrations/github/connect');
      window.location.assign(res.url);
    } catch (e) {
      toast.error(e);
      setConnecting(false);
    }
  }

  async function disconnect() {
    if (!(await confirm({ title: 'Disconnect GitHub?', message: 'Live commit and pull request lookups stop. Linked repositories and their webhooks keep working.', confirmLabel: 'Disconnect', danger: true }))) return;
    try {
      await api.del('/api/integrations/github/connection');
      toast.success('GitHub disconnected');
      reload();
    } catch (e) {
      toast.error(e);
    }
  }

  async function updateRepo(r: Repo, patch: { projectId?: string | null; serviceId?: number | null }) {
    try {
      await api.patch(`/api/integrations/github/repositories/${r.id}`, patch);
      toast.success('Mapping saved');
      reload();
    } catch (e) {
      toast.error(e);
    }
  }

  async function removeRepo(r: Repo) {
    if (!(await confirm({ title: `Unlink ${r.fullName}?`, message: 'Webhook deliveries from this repository will be rejected. Remove the webhook in GitHub as well.', confirmLabel: 'Unlink', danger: true }))) return;
    try {
      await api.del(`/api/integrations/github/repositories/${r.id}`);
      toast.success('Repository unlinked');
      reload();
    } catch (e) {
      toast.error(e);
    }
  }

  if (loading && !data) return <SkeletonRows rows={4} />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return null;
  const hookUrl = webhookTarget(data.webhookUrl);

  return (
    <div className="space-y-5">
      <SectionCard title="Connection">
        {!data.configured ? (
          <div className="space-y-2 text-sm text-[#3d4a42]">
            <p className="flex items-center gap-2 font-semibold text-[#92400e]"><Github className="h-4 w-4" /> GitHub sign-in isn’t configured on this server.</p>
            <p>
              To connect an account, a server administrator must create a GitHub OAuth app and set <code className="font-mono text-xs">GITHUB_CLIENT_ID</code> and <code className="font-mono text-xs">GITHUB_CLIENT_SECRET</code>, with the callback URL{' '}
              <code className="break-all font-mono text-xs">{hookUrl.replace(/\/api\/webhooks\/github$/, '/api/integrations/github/callback')}</code>.
            </p>
            <p>You can still link repositories below: webhooks work without the OAuth connection; only live commit/PR lookups need it.</p>
          </div>
        ) : data.connection ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#14201a] text-white"><Github className="h-5 w-5" /></span>
              <div>
                <div className="font-semibold text-[#14201a]">Connected as {data.connection.accountLogin}</div>
                <div className="text-xs text-[#5f6b64]">Since {formatDateTime(data.connection.createdAt)}{data.connection.scopes ? ` · scopes: ${data.connection.scopes}` : ''}</div>
              </div>
            </div>
            {admin && <Button variant="secondary" onClick={disconnect}><Unplug className="h-4 w-4" /> Disconnect</Button>}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#3d4a42]">Connect a GitHub account to show recent commits and pull requests for linked repositories.</p>
            {admin && <Button onClick={connect} loading={connecting}><Github className="h-4 w-4" /> Connect GitHub</Button>}
          </div>
        )}
      </SectionCard>

      <SectionCard title={`Linked repositories (${data.repositories.length})`} action={admin && <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Link repository</Button>}>
        {data.repositories.length === 0 ? (
          <EmptyState icon={Github} title="No repositories linked" description="Link a repository to connect commits and pull requests to tickets and record deployments automatically." />
        ) : (
          <ul className="divide-y divide-[#dfdbcc]">
            {data.repositories.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-[180px] flex-1">
                  <a href={`https://github.com/${r.fullName}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-[#14201a] hover:underline">
                    {r.fullName} <ExternalLink className="h-3 w-3" />
                  </a>
                  <div className="text-xs text-[#5f6b64]">Linked {timeAgo(r.createdAt)}</div>
                </div>
                <label className="w-full sm:w-48">
                  <span className="sr-only">Project for {r.fullName}</span>
                  <Select disabled={!admin} value={r.projectId ?? ''} onChange={(e) => updateRepo(r, { projectId: e.target.value || null })}>
                    <option value="">No project</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.key} · {p.name}</option>)}
                  </Select>
                </label>
                <label className="w-full sm:w-48">
                  <span className="sr-only">Service for {r.fullName}</span>
                  <Select disabled={!admin} value={r.serviceId ?? ''} onChange={(e) => updateRepo(r, { serviceId: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">No service</option>
                    {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </label>
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={() => setActivity(r)}><Activity className="h-3.5 w-3.5" /> Activity</Button>
                  {admin && <button type="button" aria-label={`Unlink ${r.fullName}`} onClick={() => removeRepo(r)} className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626]"><Trash2 className="h-4 w-4" /></button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {adding && <AddRepoModal onClose={() => setAdding(false)} onAdded={(fullName, secret) => { setAdded({ fullName, secret }); reload(); }} />}
      <Modal open={added !== null} onClose={() => setAdded(null)} title={`Add the webhook to ${added?.fullName ?? ''}`} wide footer={<Button onClick={() => setAdded(null)}>Done</Button>}>
        {added && (
          <div className="space-y-4 text-sm text-[#3d4a42]">
            <p className="rounded-xl border border-[#fde68a] bg-[#fef3c7] px-3 py-2 text-[#92400e]">The webhook secret is shown only once. Copy it into GitHub now.</p>
            <ol className="list-decimal space-y-3 pl-5">
              <li>
                Open <a className="font-semibold text-[#177a43] hover:underline" href={`https://github.com/${added.fullName}/settings/hooks/new`} target="_blank" rel="noopener noreferrer">Settings → Webhooks → Add webhook</a> for the repository.
              </li>
              <li>
                <span className="font-semibold text-[#14201a]">Payload URL</span>
                <div className="mt-1"><CopyBox value={hookUrl} label="payload URL" /></div>
              </li>
              <li><span className="font-semibold text-[#14201a]">Content type:</span> <code className="font-mono text-xs">application/json</code></li>
              <li>
                <span className="font-semibold text-[#14201a]">Secret</span>
                <div className="mt-1"><CopyBox value={added.secret} label="webhook secret" /></div>
              </li>
              <li>Choose “Let me select individual events” and tick <strong>Pushes</strong>, <strong>Pull requests</strong> and <strong>Deployment statuses</strong>.</li>
            </ol>
            <p className="text-xs">Mention ticket keys like <code className="font-mono">PAY-12</code> in commit messages, branch names or PR titles to link them to tickets.</p>
          </div>
        )}
      </Modal>
      {activity && <ActivityModal repo={activity} onClose={() => setActivity(null)} />}
    </div>
  );
}
